// Public endpoint: cria/renova um pedido de registo de indicador
// e dispara e-mail de confirmação (double opt-in).
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyEvent } from "../_shared/notify.ts";
import { vaultGet } from "../_shared/vault.ts";

const Body = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(32).optional().nullable(),
  app_url: z.string().url().optional(),
  password: z.string().min(6).max(100).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { full_name, email, phone, password } = parsed.data;
    const appUrl =
      parsed.data.app_url ||
      req.headers.get("origin") ||
      Deno.env.get("APP_URL") ||
      "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ===== Bootstrap do 1º admin: se não houver nenhum profile, cria direto =====
    const { count: profilesCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if ((profilesCount ?? 0) === 0) {
      if (!password || password.length < 6) {
        return json({ error: "password_required_for_bootstrap" }, 400);
      }
      const { data: created, error: createErr } = await supabase.auth.admin
        .createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (createErr || !created.user) {
        return json({
          error: "bootstrap_failed",
          details: createErr?.message,
        }, 500);
      }
      // O trigger handle_new_user já cria profile como admin (1º profile).
      // Garantia extra: upsert força a existência do profile mesmo sem trigger.
      await supabase.from("profiles").upsert({
        id: created.user.id,
        role: "admin",
        email,
        full_name,
        phone: phone ?? null,
      }, { onConflict: "id" });

      return json({ ok: true, bootstrap_admin: true, user_id: created.user.id });
    }

    // E-mail já é um indicador?
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfile) {
      return json({ error: "email_already_registered" }, 409);
    }

    // ===== Registo de aluno com palavra-passe: cria a conta imediatamente =====
    if (password && password.length >= 6) {
      const { data: created, error: cuErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, signup_kind: "referrer" },
      });
      if (cuErr || !created.user) {
        const msg = cuErr?.message ?? "";
        if (/already/i.test(msg)) return json({ error: "email_already_registered" }, 409);
        return json({ error: "create_user_failed", details: msg }, 400);
      }
      const userId = created.user.id;

      await supabase.from("profiles").upsert({
        id: userId,
        role: "referrer",
        email,
        full_name,
        phone: phone ?? null,
      }, { onConflict: "id" });

      await supabase
        .from("referrer_signups")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          created_user_id: userId,
        })
        .ilike("email", email)
        .eq("status", "awaiting_confirmation");

      // Boas-vindas (best-effort — nunca bloqueia o registo)
      try {
        await notifyEvent({
          event_key: "referrer_welcome",
          profile_id: userId,
          data: { full_name, app_url: appUrl },
        });
      } catch (e) {
        console.warn("welcome notify failed", e);
      }

      return json({ ok: true, account_created: true, user_id: userId });
    }


    // Existe pendente? Se sim, regenera token e reenvia.
    const { data: pending } = await supabase
      .from("referrer_signups")
      .select("id")
      .ilike("email", email)
      .eq("status", "awaiting_confirmation")
      .maybeSingle();

    let signupId: string;
    let token: string;

    if (pending) {
      const newToken = crypto.randomUUID();
      const { data: updated, error: updErr } = await supabase
        .from("referrer_signups")
        .update({
          full_name,
          phone: phone ?? null,
          confirmation_token: newToken,
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", (pending as any).id)
        .select("id, confirmation_token")
        .maybeSingle();
      if (updErr || !updated) return json({ error: "update_failed" }, 500);
      signupId = (updated as any).id;
      token = (updated as any).confirmation_token;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("referrer_signups")
        .insert({
          email,
          full_name,
          phone: phone ?? null,
        })
        .select("id, confirmation_token")
        .maybeSingle();
      if (insErr || !inserted) {
        return json({ error: "insert_failed", details: insErr?.message }, 500);
      }
      signupId = (inserted as any).id;
      token = (inserted as any).confirmation_token;
    }

    const confirmationUrl = `${appUrl.replace(/\/$/, "")}/indicador/confirmar?token=${token}`;

    // Para enviar via send-notification precisamos de um profile_id.
    // Como ainda não existe profile, criamos um log direto via Resend através de um "ghost":
    // estratégia: usar notifyEvent com um profile_id real se existir; caso contrário,
    // chamar send-notification com override e um pseudo-profile. Aqui usamos uma alternativa simples:
    // chama send-notification passando um profile temporário não funciona — então enviamos
    // o e-mail diretamente via Resend reusando vault.

    // Buscamos branding para company_name
    const { data: brand } = await supabase
      .from("app_branding")
      .select("company_name")
      .eq("id", "singleton")
      .maybeSingle();
    const companyName = (brand as any)?.company_name ?? "Indica+";

    // Carrega template do banco
    const { data: tpl } = await supabase
      .from("notification_templates")
      .select("subject, body")
      .eq("event_key", "referrer_signup_confirm")
      .eq("channel", "email")
      .maybeSingle();

    const data = {
      full_name,
      confirmation_url: confirmationUrl,
      app_url: appUrl,
      company_name: companyName,
    };
    const render = (s: string) =>
      s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => String((data as any)[k] ?? ""));

    const subject = (tpl as any)?.subject
      ? render((tpl as any).subject)
      : "Confirme seu registo";
    const bodyText = (tpl as any)?.body
      ? render((tpl as any).body)
      : `Olá ${full_name}, confirme seu registo: ${confirmationUrl}`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0F172A;font-size:15px;line-height:1.6;white-space:pre-wrap;">${
      bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#16A34A;">$1</a>',
      )
    }</div>`;

    // Resend direto (vault) — usa o mesmo helper das demais edge functions
    const RESEND_API_KEY = await vaultGet("RESEND_API_KEY");
    const RESEND_FROM = await vaultGet("RESEND_FROM");
    if (!RESEND_API_KEY || !RESEND_FROM) {
      return json({
        error: "resend_not_configured",
        missing: { resend_api_key: !RESEND_API_KEY, resend_from: !RESEND_FROM },
      }, 503);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const details = await res.text();
      console.error("resend error", res.status, details);
      const hint = res.status === 401 || res.status === 403
        ? "A RESEND_API_KEY salva em Definições → Integrações é inválida ou foi revogada. Gere uma nova chave no Resend e salve novamente."
        : "Falha ao enviar o e-mail de confirmação pelo Resend.";
      return json({ error: "email_send_failed", status: res.status, hint, details }, 502);
    }

    return json({ ok: true, signup_id: signupId });
  } catch (e) {
    console.error("submit-referrer-signup error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
