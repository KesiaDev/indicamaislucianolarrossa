// Helpers para chamar send-notification a partir de outras edge functions.
// Best-effort: nunca lançam, apenas logam.

type LegacyKind = "reward_unlocked" | "referrer_invite" | "raw";

async function postNotification(payload: Record<string, unknown>): Promise<void> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("notify failed", res.status, t);
    }
  } catch (e) {
    console.warn("notify error", (e as Error).message);
  }
}

// Compat antigo (mantido para chamadas legacy, se houver).
export async function notify(payload: {
  profile_id: string;
  channel: "email" | "whatsapp";
  template?: { kind: LegacyKind; data?: Record<string, unknown> };
  body?: string;
  subject?: string;
  related_reward_id?: string | null;
}): Promise<void> {
  await postNotification(payload);
}

// Novo: dispara um evento configurável. send-notification consulta
// notification_rules para decidir quais canais enviar e
// notification_templates para renderizar o conteúdo.
export async function notifyEvent(opts: {
  event_key: string;
  profile_id: string;
  data?: Record<string, unknown>;
  related_reward_id?: string | null;
}): Promise<void> {
  const { event_key, profile_id, data, related_reward_id } = opts;
  await Promise.allSettled([
    postNotification({
      profile_id,
      channel: "email",
      related_reward_id: related_reward_id ?? null,
      template: { kind: "event", event_key, data: data ?? {} },
    }),
    postNotification({
      profile_id,
      channel: "whatsapp",
      related_reward_id: related_reward_id ?? null,
      template: { kind: "event", event_key, data: data ?? {} },
    }),
  ]);
}
