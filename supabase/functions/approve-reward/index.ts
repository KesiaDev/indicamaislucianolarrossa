import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { notifyEvent } from "../_shared/notify.ts";

const Body = z.object({
  reward_id: z.string().uuid(),
  redemption_code: z.string().max(120).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await auth.admin.from("rewards").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id,
      redemption_code: parsed.data.redemption_code ?? null,
    }).eq("id", parsed.data.reward_id);
    if (error) throw error;

    // Best-effort: dispara notificação por e-mail
    const { data: reward } = await auth.admin
      .from("rewards")
      .select("referrer_id, reward_description, redemption_code, profiles:referrer_id(full_name, email)")
      .eq("id", parsed.data.reward_id)
      .maybeSingle();

    if (reward) {
      const origin = req.headers.get("origin") || "";
      await notifyEvent({
        event_key: "reward_unlocked",
        profile_id: (reward as any).referrer_id,
        related_reward_id: parsed.data.reward_id,
        data: {
          reward_description: (reward as any).reward_description,
          redemption_code: (reward as any).redemption_code ?? parsed.data.redemption_code ?? "",
          rewards_url: origin ? `${origin}/app/rewards` : "",
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
