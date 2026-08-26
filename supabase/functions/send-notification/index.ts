// send-notification: dispara notificação por e-mail ou WhatsApp.
// Suporta dois modos:
//  - Legacy: template.kind = 'reward_unlocked' | 'referrer_invite' | 'raw'
//  - Event:  template.kind = 'event' + event_key — consulta notification_rules
//            e notification_templates para decidir disparo e conteúdo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { vaultGet } from "../_shared/vault.ts";
import { sendEmail } from "../_shared/resend.ts";
import { rewardUnlockedHtml, referrerInviteHtml } from "./templates.ts";

const Body = z.object({
  profile_id: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]),
  subject: z.string().max(300).optional(),
  body: z.string().min(1).optional(),
  template: z
    .object({
      kind: z.enum(["reward_unlocked", "referrer_invite", "raw", "event"]),
      event_key: z.string().max(80).optional(),
      data: z.record(z.unknown()).optional(),
    })
    .optional(),
  related_reward_id: z.string().uuid().nullable().optional(),
  override_phone: z.string().min(5).max(32).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CLINT_BASE = "https://api.clint.digital";

// Separa E.164 em DDI + número local (Clint guarda os dois campos).
function splitPhone(e164: string): { ddi: string; local: string } {
  const digits = e164.replace(/^whatsapp:/, "").replace(/\D+/g, "");
  if (digits.startsWith("351")) return { ddi: "351", local: digits.slice(3) };
  if (digits.startsWith("55")) return { ddi: "55", local: digits.slice(2) };
  if (digits.startsWith("1") && digits.length === 11) return { ddi: "1", local: digits.slice(1) };
  return { ddi: digits.slice(0, 2), local: digits.slice(2) };
}

// Busca o contato na Clint pelo telefone; cria se não existir. Retorna o UUID.
async function clintResolveContact(
  apiKey: string,
  ddi: string,
  local: string,
  name: string | null,
  email: string | null,
): Promise<string | null> {
  const headers = { "Content-Type": "application/json", "api-token": apiKey };

  const search = await fetch(
    `${CLINT_BASE}/v1/contacts?ddi=${encodeURIComponent(ddi)}&phone=${encodeURIComponent(local)}&limit=1`,
    { headers },
  );
  if (search.ok) {
    const found = await search.json().catch(() => ({}));
    const id = (found as any)?.data?.[0]?.id;
    if (id) return id as string;
  } else {
    console.error("clint contact search failed", search.status, await search.text());
  }

  const create = await fetch(`${CLINT_BASE}/v1/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: name || `+${ddi}${local}`,
      ddi,
      phone: local,
      ...(email ? { email } : {}),
    }),
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok) {
    throw new Error((created as any)?.message || `clint_contact_${create.status}`);
  }
  return ((created as any)?.id ?? (created as any)?.data?.id ?? null) as string | null;
}

// Resolve o UUID de um template APROVADO pelo nome, para um número (channel account).
async function clintResolveTemplateId(
  apiKey: string,
  channelAccountId: string,
  name: string,
): Promise<string | null> {
  const res = await fetch(
    `${CLINT_BASE}/v2/message-templates?channel_account_id=${encodeURIComponent(channelAccountId)}&limit=100`,
    { headers: { "Content-Type": "application/json", "api-token": apiKey } },
  );
  if (!res.ok) {
    console.error("clint templates list failed", res.status, await res.text());
    return null;
  }
  const payload = await res.json().catch(() => ({}));
  const list = ((payload as any)?.data ?? []) as any[];
  const tpl = list.find((t) => t?.name === name && t?.status === "APPROVED");
  return (tpl?.id ?? null) as string | null;
}

// Envia um template aprovado (necessário fora da janela de 24h da Meta).
async function clintSendTemplate(
  apiKey: string,
  channelAccountId: string,
  contactId: string,
  templateId: string,
): Promise<{ ok: boolean; messageId?: string | null; error?: string }> {
  const res = await fetch(`${CLINT_BASE}/v2/messages/template`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-token": apiKey },
    body: JSON.stringify({
      channel_account_id: channelAccountId,
      contact_id: contactId,
      template_id: templateId,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (payload as any)?.message || `clint_template_${res.status}` };
  }
  return { ok: true, messageId: (payload as any)?.data?.message_id ?? null };
}


// --- E.164 normalization (PT-aware, com fallback BR) ---
function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  // Preserva prefixo whatsapp: e normaliza só o número
  const wa = trimmed.startsWith("whatsapp:");
  const raw = wa ? trimmed.slice("whatsapp:".length) : trimmed;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  let e164: string | null = null;
  if (digits.length === 12 && digits.startsWith("351")) {
    e164 = "+" + digits;
  } else if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    e164 = "+" + digits;
  } else if (digits.length === 9 && digits.startsWith("9")) {
    e164 = "+351" + digits;
  } else if (digits.length === 10 || digits.length === 11) {
    e164 = "+55" + digits;
  } else if (digits.length >= 8 && digits.length <= 15) {
    e164 = "+" + digits;
  }
  if (!e164) return null;
  return wa ? `whatsapp:${e164}` : e164;
}

// --- placeholder rendering ---
function renderTemplate(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = (data as any)[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

// --- legacy email builder ---
function buildLegacyEmail(
  template: { kind: string; data?: Record<string, unknown> } | undefined,
  fallbackBody: string,
) {
  if (!template || template.kind === "raw") {
    return {
      subject: undefined as string | undefined,
      html: `<pre style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0F172A;white-space:pre-wrap;">${fallbackBody}</pre>`,
    };
  }
  const d = (template.data ?? {}) as any;
  if (template.kind === "reward_unlocked") {
    return {
      subject: "🎉 Você desbloqueou um prêmio!",
      html: rewardUnlockedHtml({
        name: d.name,
        rewardDescription: String(d.rewardDescription ?? "um prêmio"),
        redemptionCode: d.redemptionCode ?? null,
        rewardsUrl: d.rewardsUrl,
      }),
    };
  }
  if (template.kind === "referrer_invite") {
    return {
      subject: "Você foi convidado para o programa de indicações",
      html: referrerInviteHtml({
        inviterName: d.inviterName,
        signupUrl: String(d.signupUrl ?? "#"),
      }),
    };
  }
  return { subject: undefined, html: fallbackBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    let authorized = token === serviceKey;
    if (!authorized) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const adminCheck = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
        const { data: me } = await adminCheck
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if ((me as any)?.role === "admin") authorized = true;
      }
    }
    if (!authorized) return json({ error: "unauthorized" }, 401);

    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);

    const { profile_id, channel, subject, body, related_reward_id, template } = parsed.data;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Lookup profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone, full_name")
      .eq("id", profile_id)
      .maybeSingle();
    if (!profile) return json({ error: "profile_not_found" }, 404);

    // --- modo "event": rules + templates do banco ---
    let resolvedSubject = subject ?? null;
    let resolvedBody = body ?? "";
    let isEvent = false;
    let whatsappTemplateName: string | null = null;

    if (template?.kind === "event") {
      isEvent = true;
      const event_key = template.event_key;
      if (!event_key) return json({ error: "event_key_required" }, 400);

      // Verifica regra de disparo
      const { data: rule } = await supabase
        .from("notification_rules")
        .select("email_enabled, whatsapp_enabled")
        .eq("event_key", event_key)
        .maybeSingle();

      const enabled = channel === "email"
        ? !!(rule as any)?.email_enabled
        : !!(rule as any)?.whatsapp_enabled;

      if (!enabled) {
        return json({ ok: true, suppressed: true, reason: "rule_disabled" });
      }

      // Carrega template
      const { data: tpl } = await supabase
        .from("notification_templates")
        .select("subject, body, whatsapp_template")
        .eq("event_key", event_key)
        .eq("channel", channel)
        .maybeSingle();

      if (!tpl || !(tpl as any).body) {
        return json({ error: "template_not_found", event_key, channel }, 404);
      }
      whatsappTemplateName = ((tpl as any).whatsapp_template ?? "").trim() || null;

      // Enriquecer data com nome do indicador / company
      const data = { ...(template.data ?? {}) } as Record<string, unknown>;
      const fullName = (profile as any).full_name ?? "";
      if (data.referrer_name === undefined) data.referrer_name = fullName || null;
      if (data.referrer_first_name === undefined) {
        data.referrer_first_name = (fullName || "indicador").split(" ")[0];
      }
      if (data.company_name === undefined) {
        const { data: brand } = await supabase
          .from("app_branding")
          .select("company_name")
          .eq("id", "singleton")
          .maybeSingle();
        data.company_name = (brand as any)?.company_name ?? "Indica+";
      }

      resolvedSubject = (tpl as any).subject ? renderTemplate((tpl as any).subject, data) : null;
      resolvedBody = renderTemplate((tpl as any).body, data);
    }

    let providerMessageId: string | null = null;
    let logBody = resolvedBody || body || "";
    let logSubject = resolvedSubject ?? subject ?? null;
    let errorMessage: string | null = null;
    let suppressed = false;

    if (channel === "email") {
      const email = (profile as any).email as string;
      const { data: supp } = await supabase
        .from("notifications_suppressions")
        .select("email")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (supp) {
        suppressed = true;
        errorMessage = "suppressed";
      } else {
        let html: string;
        let finalSubject: string;

        if (isEvent) {
          html = resolvedBody;
          finalSubject = resolvedSubject ?? "Atualização do programa de indicações";
        } else {
          const built = buildLegacyEmail(template, body ?? "");
          html = built.html;
          finalSubject = subject ?? built.subject ?? "Atualização do programa de indicações";
        }
        logSubject = finalSubject;
        logBody = html;

        const sent = await sendEmail({ to: email, subject: finalSubject, html });
        if (!sent.ok) errorMessage = sent.error || `resend_${sent.status}`;
        else providerMessageId = sent.id;
      }
    } else {
      // WhatsApp via Clint (API Oficial da Meta)
      const rawPhone = (parsed.data.override_phone ?? (profile as any).phone) as string | null;
      const phone = toE164(rawPhone);
      if (!rawPhone) {
        errorMessage = "no_phone";
      } else if (!phone) {
        errorMessage = "invalid_phone";
      } else {
        const text = isEvent
          ? resolvedBody
          : (body ?? "Atualização do seu programa de indicações.");
        logBody = text;

        const apiKey = await vaultGet("CLINT_API_KEY");

        // Números habilitados na tabela (rotação por menos usado recentemente).
        const { data: accounts } = await supabase
          .from("clint_channel_accounts")
          .select("id, is_default, last_used_at")
          .eq("is_enabled", true)
          .eq("type", "WHATSAPP_OFFICIAL")
          .eq("status", "CONNECTED")
          .order("last_used_at", { ascending: true, nullsFirst: true });

        let candidates = ((accounts ?? []) as any[]).map((a) => a.id as string);
        if (!candidates.length) {
          const fallback = await vaultGet("CLINT_CHANNEL_ACCOUNT_ID");
          if (fallback) candidates = [fallback];
        }

        if (!apiKey || !candidates.length) {
          errorMessage = "clint_not_configured";
        } else {
          try {
            const { ddi, local } = splitPhone(phone);
            const contactId = await clintResolveContact(
              apiKey,
              ddi,
              local,
              ((profile as any).full_name as string | null) ?? null,
              ((profile as any).email as string | null) ?? null,
            );
            if (!contactId) {
              errorMessage = "clint_contact_not_created";
            } else {
              // Tenta cada número até um enviar com sucesso (failover).
              for (const channelAccountId of candidates) {
                const res = await fetch(`${CLINT_BASE}/v2/messages/text`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "api-token": apiKey },
                  body: JSON.stringify({
                    channel_account_id: channelAccountId,
                    contact_id: contactId,
                    message: text,
                  }),
                });
                const respJson = await res.json().catch(() => ({}));
                if (res.ok) {
                  providerMessageId = (respJson as any)?.data?.message_id ?? null;
                  errorMessage = null;
                  await supabase
                    .from("clint_channel_accounts")
                    .update({ last_used_at: new Date().toISOString() })
                    .eq("id", channelAccountId);
                  break;
                }
                console.error("clint send failed", channelAccountId, res.status, JSON.stringify(respJson));
                errorMessage = (respJson as any)?.message || `clint_${res.status}`;
              }
            }
          } catch (err) {
            console.error("clint error", err);
            errorMessage = (err as Error).message;
          }
        }
      }
    }


    const { data: logRow, error: logError } = await supabase
      .from("notifications_log")
      .insert({
        profile_id,
        channel,
        subject: logSubject,
        body: logBody,
        related_reward_id: related_reward_id ?? null,
        sent_at: errorMessage ? null : new Date().toISOString(),
        error_message: errorMessage,
        provider_message_id: providerMessageId,
      })
      .select("id")
      .maybeSingle();

    if (logError) console.error("notifications_log insert error", logError);

    if (errorMessage && !suppressed) {
      return json({ ok: false, error: errorMessage, notification_id: (logRow as any)?.id }, 502);
    }

    return json({
      ok: true,
      suppressed,
      notification_id: (logRow as any)?.id,
      provider_message_id: providerMessageId,
    });
  } catch (e) {
    console.error("send-notification error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
