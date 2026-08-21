// track-click: público, registra clique e (se houver URL externa) redireciona
// GET  /track-click?code=<link_code>&v=<variant_id?>  -> 302 (se URL externa) ou 204
// POST /track-click  body: { code, variant_id? }      -> 200 (fire-and-forget do front)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  const cur = buckets.get(ip);
  if (!cur || cur.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  return cur.count <= RATE_LIMIT_MAX;
}

async function ipHash(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function redirect(url: string, status = 302): Response {
  return new Response(null, { status, headers: { ...corsHeaders, Location: url } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!checkRate(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let code: string | null = null;
    let variantId: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = (body?.code ?? null) as string | null;
      variantId = (body?.variant_id ?? null) as string | null;
    } else {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      variantId = url.searchParams.get("v");
    }

    if (!code) {
      return req.method === "GET"
        ? redirect("/")
        : new Response(JSON.stringify({ ok: false, error: "missing_code" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase
      .from("referral_links")
      .select("id, referrer_id, campaign_id, clicks_count, campaigns!inner(landing_page_url, status)")
      .eq("code", code)
      .maybeSingle();

    const campaign: any = (link as any)?.campaigns;
    if (!link || !campaign || campaign.status !== "active") {
      return req.method === "GET"
        ? redirect("/")
        : new Response(JSON.stringify({ ok: false, error: "invalid_link" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
    }

    const ua = req.headers.get("user-agent") || null;
    const hash = ip !== "unknown" ? await ipHash(ip) : null;

    // Registra clique individual + incrementa contador (fire-and-forget)
    Promise.all([
      supabase.from("referral_clicks").insert({
        link_id: (link as any).id,
        campaign_id: (link as any).campaign_id,
        referrer_id: (link as any).referrer_id,
        variant_id: variantId,
        ip_hash: hash,
        user_agent: ua,
      }),
      supabase
        .from("referral_links")
        .update({ clicks_count: ((link as any).clicks_count ?? 0) + 1 })
        .eq("id", (link as any).id),
    ]).catch((e) => console.error("track-click write error", e));

    if (req.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: se URL externa, redireciona; senão envia para landing interna
    if (campaign.landing_page_url) {
      const target = new URL(campaign.landing_page_url);
      target.searchParams.set("ref", code);
      if (variantId) target.searchParams.set("v", variantId);
      return redirect(target.toString());
    }
    // Fallback: volta para o redirect interno (deveria ser raro vindo de GET)
    return redirect(`/r/${code}${variantId ? `?v=${variantId}` : ""}`);
  } catch (e) {
    console.error("track-click error", e);
    return req.method === "GET"
      ? redirect("/")
      : new Response(JSON.stringify({ ok: false }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
  }
});
