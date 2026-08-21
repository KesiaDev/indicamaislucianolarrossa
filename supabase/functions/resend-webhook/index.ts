// resend-webhook: recebe eventos do Resend (delivered, bounced, complained, etc.)
// Valida assinatura Svix (svix-id, svix-timestamp, svix-signature)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function verifySvix(secret: string, msgId: string, ts: string, body: string, sigHeader: string) {
  // secret format: "whsec_xxxxx"
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = base64ToBytes(rawSecret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const toSign = new TextEncoder().encode(`${msgId}.${ts}.${body}`);
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, toSign));
  const expected = bytesToBase64(sigBytes);
  // header format: "v1,sig1 v1,sig2 ..."
  const parts = sigHeader.split(" ");
  for (const p of parts) {
    const [, sig] = p.split(",");
    if (sig && sig === expected) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const secret = await vaultGet("RESEND_WEBHOOK_SECRET");
    if (!secret) return json({ error: "secret_not_configured" }, 503);

    const msgId = req.headers.get("svix-id");
    const ts = req.headers.get("svix-timestamp");
    const sig = req.headers.get("svix-signature");
    if (!msgId || !ts || !sig) return json({ error: "missing_signature_headers" }, 401);

    const bodyText = await req.text();
    const ok = await verifySvix(secret, msgId, ts, bodyText, sig);
    if (!ok) return json({ error: "invalid_signature" }, 401);

    const event = JSON.parse(bodyText) as any;
    const type: string = event.type ?? "";
    const data = event.data ?? {};
    const providerMessageId: string | null = data.email_id ?? data.id ?? null;
    const to: string | null = Array.isArray(data.to) ? data.to[0] : data.to ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (providerMessageId) {
      await supabase
        .from("notifications_log")
        .update({
          provider_event: type,
          provider_event_at: new Date().toISOString(),
        })
        .eq("provider_message_id", providerMessageId);
    }

    if ((type === "email.bounced" || type === "email.complained") && to) {
      const reason = type === "email.complained" ? "complaint" : "bounce";
      // hard bounce only -> bounce.type === 'hard'? Resend nem sempre envia. Tratamos todo bounce como suprimido por segurança no MVP.
      await supabase
        .from("notifications_suppressions")
        .upsert({ email: to.toLowerCase(), reason }, { onConflict: "email" });
    }

    return json({ ok: true });
  } catch (e) {
    console.error("resend-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
