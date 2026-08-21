// evolution-status-webhook: recebe status callbacks da Evolution API (WhatsApp).
// Autenticação: header "apikey" comparado com EVOLUTION_API_KEY do Vault
// (mesmo segredo usado para enviar). Atualiza notifications_log pelo
// provider_message_id (key.id retornado no envio).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mapeia status Evolution -> string padronizada (compatível com Twilio).
function mapStatus(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("read")) return "read";
  if (s.includes("delivered") || s === "delivery_ack") return "delivered";
  if (s.includes("sent") || s === "server_ack") return "sent";
  if (s.includes("fail") || s.includes("error")) return "failed";
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const expectedKey = await vaultGet("EVOLUTION_API_KEY");
    if (!expectedKey) return json({ error: "secret_not_configured" }, 503);

    const providedKey = req.headers.get("apikey") ?? req.headers.get("x-api-key");
    if (!providedKey || providedKey !== expectedKey) {
      return json({ error: "invalid_api_key" }, 401);
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "invalid_body" }, 400);

    // Evolution envia diferentes payloads dependendo do evento.
    // Tentamos extrair message id e status de formatos comuns.
    const data = (body.data ?? body) as Record<string, unknown>;
    const key = (data.key ?? {}) as Record<string, unknown>;
    const messageId =
      (key.id as string | undefined) ??
      (data.messageId as string | undefined) ??
      (body.id as string | undefined);
    const rawStatus =
      (data.status as string | undefined) ??
      (body.status as string | undefined) ??
      (body.event as string | undefined);
    const status = mapStatus(rawStatus);

    if (messageId && status) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase
        .from("notifications_log")
        .update({
          provider_event: status,
          provider_event_at: new Date().toISOString(),
        })
        .eq("provider_message_id", messageId);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("evolution-status-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
