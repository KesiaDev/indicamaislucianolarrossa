// clint-webhook: recebe eventos de negócio (deal) da Clint.
// Quando o negócio é marcado como GANHO, confirma a conversão da indicação
// correspondente, gera pontos e prémios.
//
// URL: /clint-webhook?token=<WEBHOOK_SECRET>
// (também aceita o header X-Webhook-Secret)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";
import { notifyEvent, notifyAdmins } from "../_shared/notify.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const WON_WORDS = ["won", "win", "gain", "ganho", "ganha", "gagn", "success", "closed_won"];

/** Procura recursivamente valores por nome de chave (case-insensitive). */
function collect(obj: unknown, keys: string[], out: string[] = [], depth = 0): string[] {
  if (!obj || typeof obj !== "object" || depth > 6) return out;
  if (Array.isArray(obj)) {
    for (const v of obj) collect(v, keys, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (keys.some((key) => lk === key || lk.endsWith(`_${key}`))) {
      if (typeof v === "string" || typeof v === "number") out.push(String(v));
    }
    if (v && typeof v === "object") collect(v, keys, out, depth + 1);
  }
  return out;
}

/** Campos personalizados da Clint podem vir como array [{slug,value}] ou objeto. */
function customField(payload: any, slug: string): string | null {
  const found: string[] = [];
  const walk = (obj: unknown, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 6) return;
    if (Array.isArray(obj)) {
      for (const v of obj) walk(v, depth + 1);
      return;
    }
    const rec = obj as Record<string, unknown>;
    const key = String(rec.slug ?? rec.key ?? rec.name ?? "").toLowerCase();
    if (key === slug) {
      const val = rec.value ?? rec.content ?? rec.text;
      if (typeof val === "string" || typeof val === "number") found.push(String(val));
    }
    if (typeof rec[slug] === "string" || typeof rec[slug] === "number") {
      found.push(String(rec[slug]));
    }
    for (const v of Object.values(rec)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(payload);
  return found.find((v) => v.trim().length > 0) ?? null;
}

function isWon(payload: any): boolean {
  const values = [
    ...collect(payload, ["event", "status", "type", "action", "stage", "situation", "result"]),
  ].map((v) => v.toLowerCase());
  return values.some((v) => WON_WORDS.some((w) => v.includes(w)));
}

function digits(v?: string | null) {
  return (v ?? "").replace(/[^0-9]/g, "");
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

    const url = new URL(req.url);
    const provided = req.headers.get("x-webhook-secret") ?? url.searchParams.get("token");
    if (!provided || provided !== expected) return json({ error: "unauthorized" }, 401);

    const raw = await req.json().catch(() => null);
    if (!raw) return json({ error: "invalid_body" }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const dealId = collect(raw, ["deal_id", "id"])[0] ?? null;

    const { data: logRow } = await supabase
      .from("conversion_webhooks")
      .insert({ payload: raw, source_ip: ip, external_order_id: dealId })
      .select("id")
      .maybeSingle();
    const logId = (logRow as any)?.id ?? null;

    const fail = async (msg: string, status = 200) => {
      if (logId) {
        await supabase.from("conversion_webhooks").update({ error_message: msg }).eq("id", logId);
      }
      return json({ ok: false, error: msg, log_id: logId }, status);
    };

    if (!isWon(raw)) return await fail("ignored_not_won");

    // 1) Código de indicação vindo do campo personalizado
    const code = customField(raw, "codigo_indicacao");
    const emails = collect(raw, ["email"]).filter((e) => e.includes("@"));
    const phones = collect(raw, ["phone", "telefone", "whatsapp", "mobile"])
      .map(digits)
      .filter((p) => p.length >= 8);

    let referralId: string | null = null;

    const pickPending = async (query: any) => {
      const { data } = await query
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.id ?? null;
    };

    if (code) {
      const { data: link } = await supabase
        .from("referral_links")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (link) {
        referralId = await pickPending(
          supabase.from("referrals").select("id").eq("referral_link_id", (link as any).id),
        );
      }
    }

    for (const email of emails) {
      if (referralId) break;
      referralId = await pickPending(
        supabase.from("referrals").select("id").ilike("lead_email", email),
      );
    }

    for (const phone of phones) {
      if (referralId) break;
      const tail = phone.slice(-9);
      const { data } = await supabase
        .from("referrals")
        .select("id, lead_phone, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200);
      const match = (data ?? []).find((r: any) => digits(r.lead_phone).endsWith(tail));
      referralId = match?.id ?? null;
    }

    if (!referralId) return await fail("cannot_resolve_referral", 422);

    const valueRaw = collect(raw, ["value", "amount", "price", "valor"])[0];
    const conversionValue = Number(String(valueRaw ?? "0").replace(",", ".")) || 0;

    const { data: rpcResult, error: rpcError } = await supabase.rpc("confirm_conversion", {
      p_referral_id: referralId,
      p_conversion_value: conversionValue,
      p_external_order_id: dealId,
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

    const { data: refData } = await supabase
      .from("referrals")
      .select("referrer_id, lead_name, lead_email, profiles:referrer_id(full_name), campaigns:campaign_id(name)")
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
          conversion_value: conversionValue,
        },
      });
    }

    const unlocked = ((rpcResult as any)?.rewards_unlocked ?? []) as any[];
    if (unlocked.length > 0) {
      await notifyAdmins({
        event_key: "reward_pending_admin",
        data: {
          referrer_name: (refData as any)?.profiles?.full_name ?? "",
          reward_description: unlocked
            .map((r: any) => r?.reward_description ?? r?.description ?? "prémio")
            .join(", "),
          rewards_count: unlocked.length,
          queue_url: "https://indicamaislucianolarrossa.lovable.app/admin/rewards-queue",
        },
      });
    }

    return json({
      ok: true,
      referral_id: referralId,
      rewards_unlocked: unlocked,
      log_id: logId,
    });
  } catch (e) {
    console.error("clint-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
