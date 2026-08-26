// Envio de e-mail através da conta Resend ligada por conector (gateway Lovable).
// Remetente fixo e verificado.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const EMAIL_FROM = "Indica+ Luciano Larrossa <cursos@lucianolarrossa.com>";
export const EMAIL_FROM_DOMAIN = "lucianolarrossa.com";

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; status: number; error: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey = Deno.env.get("RESEND_API_KEY");
  if (!lovableKey || !connectionKey) {
    return {
      ok: false,
      status: 503,
      error: "resend_connector_not_linked",
    };
  }

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`resend gateway failed [${res.status}]: ${body}`);
    return { ok: false, status: res.status, error: body };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, id: (data as any)?.id ?? null };
}
