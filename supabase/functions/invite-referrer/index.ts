import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { notifyEvent } from "../_shared/notify.ts";
import { vaultGet } from "../_shared/vault.ts";

const Body = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().max(120).nullable().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_body" }, 400);
    const { email, full_name } = parsed.data;

    // 1) Verifica se Resend está configurado — falha clara se não.
    const [resendKey, resendFrom] = await Promise.all([
      vaultGet("RESEND_API_KEY"),
      vaultGet("RESEND_FROM"),
    ]);
    if (!resendKey || !resendFrom) {
      return json({
        error: "resend_not_configured",
        message: "Configure Resend (API key e remetente) em Definições → Integrações antes de enviar convites.",
        missing: { resend_api_key: !resendKey, resend_from: !resendFrom },
      }, 400);
    }

    const origin = req.headers.get("origin") || Deno.env.get("SUPABASE_URL")!;

    // 2) Cria o utilizador (ou recupera se já existir) com signup_kind=referrer para
    //    o trigger handle_new_user não promover a admin.
    let userId: string | null = null;
    const { data: created, error: createErr } = await auth.admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: full_name ?? null, signup_kind: "referrer" },
    });
    if (createErr) {
      // Se já existe, tenta recuperar
      const msg = createErr.message?.toLowerCase() || "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // procurar o profile
        const { data: existing } = await auth.admin
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        userId = (existing as any)?.id ?? null;
        if (!userId) return json({ error: createErr.message }, 400);
      } else {
        return json({ error: createErr.message }, 400);
      }
    } else {
      userId = created.user?.id ?? null;
    }

    // 3) Gera magic link de invite.
    const { data: linkData, error: linkErr } = await auth.admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${origin}/auth` },
    });
    if (linkErr) return json({ error: `invite_link_failed: ${linkErr.message}` }, 500);

    const actionLink = (linkData as any)?.properties?.action_link
      || (linkData as any)?.action_link
      || `${origin}/auth`;

    // 4) Envia o e-mail via send-notification (que usa Resend internamente).
    if (userId) {
      const inviter = (auth.user.user_metadata as any)?.full_name || auth.user.email || "nosso time";
      await notifyEvent({
        event_key: "referrer_invite",
        profile_id: userId,
        data: { inviter_name: inviter, signup_url: actionLink },
      });
    }

    return json({ ok: true, user_id: userId });
  } catch (e) {
    console.error("invite-referrer error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
