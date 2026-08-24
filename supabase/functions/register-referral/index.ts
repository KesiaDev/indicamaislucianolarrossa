// register-referral: público — cria referral pendente
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyEvent } from "../_shared/notify.ts";
import { createClintDeal } from "../_shared/clint.ts";

const Body = z.object({
  code: z.string().min(1).max(120),
  lead_name: z.string().trim().min(1).max(120),
  lead_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  lead_phone: z.string().trim().max(40).optional().or(z.literal("")),
  variant_id: z.string().uuid().optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { code, lead_name, lead_email, lead_phone, variant_id } = parsed.data;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase
      .from("referral_links")
      .select("id, referrer_id, campaign_id, campaigns!inner(status, name)")
      .eq("code", code)
      .maybeSingle();
    if (!link || (link as any).campaigns.status !== "active") {
      return new Response(JSON.stringify({ error: "Invalid link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || null;

    if (lead_email || ip) {
      const { data: blocked } = await supabase
        .from("fraud_blocklist")
        .select("id")
        .or([
          lead_email ? `email.eq.${lead_email}` : null,
          ip ? `ip.eq.${ip}` : null,
        ].filter(Boolean).join(","))
        .limit(1);
      if (blocked && blocked.length > 0) {
        return new Response(JSON.stringify({ error: "Blocked" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabase.from("referrals").insert({
      referral_link_id: (link as any).id,
      referrer_id: (link as any).referrer_id,
      campaign_id: (link as any).campaign_id,
      lead_name,
      lead_email: lead_email || null,
      lead_phone: lead_phone || null,
      lead_ip: ip,
      lead_user_agent: ua,
      status: "pending",
      variant_id: variant_id ?? null,
    });
    if (error) throw error;

    // Pontos por indicação registada (10 pontos)
    const { data: referrer } = await supabase
      .from("profiles")
      .select("total_points, full_name, email")
      .eq("id", (link as any).referrer_id)
      .maybeSingle();
    if (referrer) {
      await supabase
        .from("profiles")
        .update({ total_points: ((referrer as any).total_points ?? 0) + 10 })
        .eq("id", (link as any).referrer_id);
      await supabase.rpc("recompute_tier", { _profile_id: (link as any).referrer_id });
    }

    // Best-effort: cria o negócio no funil de indicados da Clint
    await createClintDeal({
      name: lead_name,
      email: lead_email || null,
      phone: lead_phone || null,
      fields: {
        indicado_por: (referrer as any)?.full_name ?? (referrer as any)?.email ?? "",
        campanha: (link as any).campaigns?.name ?? "",
        codigo_indicacao: code,
      },
    });

    // Best-effort: notifica o indicador
    await notifyEvent({
      event_key: "referral_registered",
      profile_id: (link as any).referrer_id,
      data: {
        lead_name,
        lead_email: lead_email || "",
        campaign_name: (link as any).campaigns?.name ?? "",
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
