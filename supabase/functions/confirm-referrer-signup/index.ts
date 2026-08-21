// Public endpoint: valida token, cria conta auth + profile, e dispara welcome.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyEvent } from "../_shared/notify.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LookupSchema = z.object({ token: z.string().uuid() });
const ConfirmSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(72),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "confirm";

    if (req.method === "GET" || action === "lookup") {
      const token = url.searchParams.get("token") ?? "";
      const parsed = LookupSchema.safeParse({ token });
      if (!parsed.success) return json({ error: "invalid_token" }, 400);

      const { data: signup } = await supabase
        .from("referrer_signups")
        .select("id, email, full_name, status, token_expires_at")
        .eq("confirmation_token", parsed.data.token)
        .maybeSingle();

      if (!signup) return json({ error: "not_found" }, 404);
      if ((signup as any).status !== "awaiting_confirmation") {
        return json({ error: "already_used" }, 410);
      }
      if (new Date((signup as any).token_expires_at) < new Date()) {
        return json({ error: "expired" }, 410);
      }
      return json({
        ok: true,
        email: (signup as any).email,
        full_name: (signup as any).full_name,
      });
    }

    // POST = confirma + cria conta
    const body = await req.json().catch(() => null);
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_body" }, 400);
    const { token, password } = parsed.data;

    const { data: signup } = await supabase
      .from("referrer_signups")
      .select("id, email, full_name, phone, status, token_expires_at")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (!signup) return json({ error: "not_found" }, 404);
    if ((signup as any).status !== "awaiting_confirmation") {
      return json({ error: "already_used" }, 410);
    }
    if (new Date((signup as any).token_expires_at) < new Date()) {
      return json({ error: "expired" }, 410);
    }

    const email = (signup as any).email as string;
    const fullName = (signup as any).full_name as string;
    const phone = (signup as any).phone as string | null;

    // Cria usuário (email já confirmado — o opt-in foi o e-mail nosso)
    const { data: created, error: cuErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (cuErr || !created.user) {
      return json({ error: "create_user_failed", details: cuErr?.message }, 400);
    }

    const userId = created.user.id;

    // Garante profile (handle_new_user já cria via trigger; aqui só reforçamos campos)
    await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, role: "referrer" })
      .eq("id", userId);

    await supabase
      .from("referrer_signups")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        created_user_id: userId,
      })
      .eq("id", (signup as any).id);

    // Welcome (best-effort)
    const appUrl = req.headers.get("origin") || "";
    await notifyEvent({
      event_key: "referrer_welcome",
      profile_id: userId,
      data: { full_name: fullName, app_url: appUrl },
    });

    // Reenvia welcome WhatsApp se houve falha anterior por "no_phone" e agora há telefone
    if (phone) {
      const { data: pendingWa } = await supabase
        .from("notifications_log")
        .select("id")
        .eq("profile_id", userId)
        .eq("channel", "whatsapp")
        .eq("error_message", "no_phone")
        .limit(1)
        .maybeSingle();

      if (pendingWa) {
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              profile_id: userId,
              channel: "whatsapp",
              template: {
                kind: "event",
                event_key: "referrer_welcome",
                data: { full_name: fullName, app_url: appUrl },
              },
            },
          });
        } catch (e) {
          console.warn("welcome whatsapp resend failed", e);
        }
      }
    }

    return json({ ok: true, email });
  } catch (e) {
    console.error("confirm-referrer-signup error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
