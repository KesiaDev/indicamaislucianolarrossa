// notify-campaign-launched: dispara o evento `campaign_launched` em lote
// para todos os indicadores ativos. Cria/garante o link de indicação de
// cada referrer para a campanha e monta a share_url usando o slug.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyEvent } from "../_shared/notify.ts";

const Body = z.object({
  campaign_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Valida utilizador e role admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: me } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { campaign_id } = parsed.data;

    // Carrega campanha
    const { data: campaign, error: cErr } = await admin
      .from("campaigns")
      .select("id, name, slug, description, status")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) return json({ error: "campaign_not_found" }, 404);
    if (campaign.status !== "active") {
      return json({ error: "campaign_not_active", status: campaign.status }, 400);
    }

    // Branding (para company_name)
    const { data: branding } = await admin
      .from("app_branding")
      .select("company_name")
      .eq("id", "singleton")
      .maybeSingle();
    const companyName = branding?.company_name ?? "Indica+";

    // Base URL para share (origin do request)
    const reqUrl = new URL(req.url);
    const origin = req.headers.get("origin") ?? `${reqUrl.protocol}//${reqUrl.host}`;

    // Lista todos os indicadores
    const { data: referrers, error: rErr } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "referrer");
    if (rErr) return json({ error: rErr.message }, 500);

    const list = referrers ?? [];
    let sent = 0;
    let failed = 0;

    for (const ref of list) {
      try {
        // Garante link de indicação para essa campanha
        let { data: link } = await admin
          .from("referral_links")
          .select("code")
          .eq("campaign_id", campaign_id)
          .eq("referrer_id", ref.id)
          .maybeSingle();

        if (!link) {
          // Gera código único baseado no nome
          const base = (ref.full_name || ref.email.split("@")[0] || "user")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 20) || "user";
          let code = "";
          for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
            const { data: existing } = await admin
              .from("referral_links")
              .select("id")
              .eq("code", candidate)
              .maybeSingle();
            if (!existing) {
              code = candidate;
              break;
            }
          }
          if (!code) {
            failed++;
            continue;
          }
          const { data: created, error: insErr } = await admin
            .from("referral_links")
            .insert({
              campaign_id,
              referrer_id: ref.id,
              code,
            })
            .select("code")
            .single();
          if (insErr || !created) {
            failed++;
            continue;
          }
          link = created;
        }

        const shareUrl = `${origin}/r/${link.code}`;
        const firstName = (ref.full_name ?? ref.email.split("@")[0] ?? "").split(" ")[0];

        await notifyEvent({
          event_key: "campaign_launched",
          profile_id: ref.id,
          data: {
            referrer_first_name: firstName,
            referrer_name: ref.full_name ?? "",
            campaign_name: campaign.name,
            campaign_description: campaign.description ?? "",
            share_url: shareUrl,
            company_name: companyName,
          },
        });
        sent++;
      } catch (e) {
        console.error("notify-campaign-launched referrer error", ref.id, (e as Error).message);
        failed++;
      }
    }

    return json({
      ok: true,
      campaign_id,
      total_referrers: list.length,
      dispatched: sent,
      failed,
    });
  } catch (e) {
    console.error("notify-campaign-launched fatal", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
