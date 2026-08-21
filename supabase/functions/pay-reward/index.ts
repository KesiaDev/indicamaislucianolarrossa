import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { notifyEvent } from "../_shared/notify.ts";

const Body = z.object({ reward_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await auth.admin.from("rewards").update({
      status: "paid", paid_at: new Date().toISOString(),
    }).eq("id", parsed.data.reward_id);
    if (error) throw error;

    // Best-effort: notifica o indicador
    const { data: reward } = await auth.admin
      .from("rewards")
      .select("referrer_id, reward_description, reward_value")
      .eq("id", parsed.data.reward_id)
      .maybeSingle();
    if (reward) {
      await notifyEvent({
        event_key: "reward_paid",
        profile_id: (reward as any).referrer_id,
        related_reward_id: parsed.data.reward_id,
        data: {
          reward_description: (reward as any).reward_description ?? "",
          reward_value: (reward as any).reward_value ?? "",
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
