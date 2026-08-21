// twilio-status-webhook: recebe status callbacks do Twilio WhatsApp
// Valida X-Twilio-Signature (HMAC-SHA1 com auth token + URL pública + params ordenados)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  let s = "";
  for (let i = 0; i < sig.length; i++) s += String.fromCharCode(sig[i]);
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const token = await vaultGet("TWILIO_AUTH_TOKEN");
    if (!token) return json({ error: "secret_not_configured" }, 503);

    const sigHeader = req.headers.get("x-twilio-signature");
    if (!sigHeader) return json({ error: "missing_signature" }, 401);

    const url = req.url;
    const formText = await req.text();
    const params = new URLSearchParams(formText);
    const sortedKeys = [...params.keys()].sort();
    let payload = url;
    for (const k of sortedKeys) payload += k + (params.get(k) ?? "");

    const expected = await hmacSha1Base64(token, payload);
    if (expected !== sigHeader) return json({ error: "invalid_signature" }, 401);

    const messageSid = params.get("MessageSid") ?? params.get("SmsSid");
    const messageStatus = params.get("MessageStatus") ?? params.get("SmsStatus");

    if (messageSid && messageStatus) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase
        .from("notifications_log")
        .update({
          provider_event: messageStatus,
          provider_event_at: new Date().toISOString(),
        })
        .eq("provider_message_id", messageSid);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("twilio-status-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
