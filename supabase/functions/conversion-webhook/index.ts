// conversion-webhook: recebe evento de conversão de sistema externo
// POST /conversion-webhook  com header X-Webhook-Secret
// Segredo lido do Vault (WEBHOOK_SECRET)
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";
import { notifyEvent } from "../_shared/notify.ts";

const Body = z.object({
  external_order_id: z.string().min(1).max(200),
  conversion_value: z.number().nonnegative(),
  referral_code: z.string().min(1).max(120).optional(),
  lead_email: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expected = await vaultGet("WEBHOOK_SECRET");
    if (!expected) return json({ error: "secret_not_configured" }, 503);

    const provided = req.headers.get("x-webhook-secret");
    if (!provided || provided !== expected) return json({ error: "unauthorized" }, 401);

    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);

    const { external_order_id, conversion_value, referral_code, lead_email } = parsed.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

    const { data: logRow } = await supabase
      .from("conversion_webhooks")
      .insert({ payload: raw, source_ip: ip, external_order_id })
      .select("id")
      .maybeSingle();
    const logId = (logRow as any)?.id ?? null;

    let referralId: string | null = null;

    if (referral_code) {
      const { data: link } = await supabase
        .from("referral_links")
        .select("id")
        .eq("code", referral_code)
        .maybeSingle();
      if (link) {
        const { data: ref } = await supabase
          .from("referrals")
          .select("id")
          .eq("referral_link_id", (link as any).id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        referralId = (ref as any)?.id ?? null;
      }
    }
    if (!referralId && lead_email) {
      const { data: ref } = await supabase
        .from("referrals")
        .select("id")
        .ilike("lead_email", lead_email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      referralId = (ref as any)?.id ?? null;
    }

    if (!referralId) {
      if (logId) {
        await supabase
          .from("conversion_webhooks")
          .update({ error_message: "cannot_resolve_referral" })
          .eq("id", logId);
      }
      return json({ ok: false, error: "cannot_resolve_referral", log_id: logId }, 422);
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc("confirm_conversion", {
      p_referral_id: referralId,
      p_conversion_value: conversion_value,
      p_external_order_id: external_order_id,
    });

    const rpcOk = !rpcError && (rpcResult as any)?.ok === true;
    const rpcErrMsg = rpcError?.message ?? (rpcOk ? null : (rpcResult as any)?.error ?? "rpc_failed");

    if (logId) {
      await supabase
        .from("conversion_webhooks")
        .update({
          referral_id: referralId,
          processed_at: new Date().toISOString(),
          error_message: rpcOk ? null : rpcErrMsg,
        })
        .eq("id", logId);
    }

    if (!rpcOk) return json({ ok: false, error: rpcErrMsg, log_id: logId }, 200);

    // Best-effort: notifica o indicador
    const { data: refData } = await supabase
      .from("referrals")
      .select("referrer_id, lead_name, lead_email, campaigns:campaign_id(name)")
      .eq("id", referralId)
      .maybeSingle();
    if (refData) {
      await notifyEvent({
        event_key: "referral_converted",
        profile_id: (refData as any).referrer_id,
        data: {
          lead_name: (refData as any).lead_name ?? "",
          lead_email: (refData as any).lead_email ?? "",
          campaign_name: (refData as any).campaigns?.name ?? "",
          conversion_value,
        },
      });
    }

    return json({
      ok: true,
      referral_id: referralId,
      rewards_unlocked: (rpcResult as any)?.rewards_unlocked ?? [],
      log_id: logId,
    });
  } catch (e) {
    console.error("conversion-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
