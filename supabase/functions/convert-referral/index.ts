// convert-referral: admin — marca referral como convertido e gera rewards conforme reward_rules
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { notifyEvent } from "../_shared/notify.ts";

const Body = z.object({
  referral_id: z.string().uuid(),
  conversion_value: z.number().nonnegative().optional(),
  external_order_id: z.string().max(200).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { admin, user } = auth;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { referral_id, conversion_value, external_order_id } = parsed.data;

    const { data: ref } = await admin
      .from("referrals")
      .select("id, status, referrer_id, campaign_id, lead_name, lead_email, campaigns:campaign_id(name)")
      .eq("id", referral_id)
      .maybeSingle();
    if (!ref) return new Response(JSON.stringify({ error: "Referral not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if ((ref as any).status === "converted") return new Response(JSON.stringify({ ok: true, already: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("referrals").update({
      status: "converted",
      converted_at: new Date().toISOString(),
      conversion_value: conversion_value ?? null,
      external_order_id: external_order_id ?? null,
    }).eq("id", referral_id);

    const referrerId = (ref as any).referrer_id;
    const campaignId = (ref as any).campaign_id;

    const { count: convCount } = await admin
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", referrerId)
      .eq("campaign_id", campaignId)
      .eq("status", "converted");
    const conversions = convCount ?? 0;

    const { data: rules } = await admin
      .from("reward_rules")
      .select("*")
      .eq("campaign_id", campaignId);

    const grants: any[] = [];
    let totalPoints = 0;
    for (const rule of rules ?? []) {
      totalPoints += rule.points_per_conversion ?? 0;
      if (rule.is_recurring) {
        if (conversions > 0 && conversions % rule.trigger_count === 0) {
          grants.push({
            referrer_id: referrerId,
            reward_rule_id: rule.id,
            campaign_id: campaignId,
            reward_type: rule.reward_type,
            reward_value: rule.reward_value,
            reward_description: rule.reward_description,
            status: "pending",
          });
        }
      } else {
        if (conversions === rule.trigger_count) {
          const { count: existing } = await admin
            .from("rewards")
            .select("*", { count: "exact", head: true })
            .eq("reward_rule_id", rule.id)
            .eq("referrer_id", referrerId);
          if ((existing ?? 0) === 0) {
            grants.push({
              referrer_id: referrerId,
              reward_rule_id: rule.id,
              campaign_id: campaignId,
              reward_type: rule.reward_type,
              reward_value: rule.reward_value,
              reward_description: rule.reward_description,
              status: "pending",
            });
          }
        }
      }
    }

    if (grants.length > 0) {
      const { error } = await admin.from("rewards").insert(grants);
      if (error) throw error;
    }

    if (totalPoints > 0) {
      const { data: prof } = await admin.from("profiles").select("total_points").eq("id", referrerId).maybeSingle();
      const newPoints = (prof?.total_points ?? 0) + totalPoints;
      await admin.from("profiles").update({ total_points: newPoints }).eq("id", referrerId);
      await admin.rpc("recompute_tier", { _profile_id: referrerId });
    }

    // Best-effort: notifica o indicador da conversão
    await notifyEvent({
      event_key: "referral_converted",
      profile_id: referrerId,
      data: {
        lead_name: (ref as any).lead_name ?? "",
        lead_email: (ref as any).lead_email ?? "",
        campaign_name: (ref as any).campaigns?.name ?? "",
        conversion_value: conversion_value ?? "",
      },
    });

    return new Response(JSON.stringify({ ok: true, grants: grants.length, points: totalPoints }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
