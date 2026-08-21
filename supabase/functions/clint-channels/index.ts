// clint-channels: sincroniza os números (channel accounts) da Clint com o banco.
// GET/POST (admin) -> busca /v2/channel-accounts, faz upsert e retorna a lista.
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { vaultGet } from "../_shared/vault.ts";

const CLINT_BASE = "https://api.clint.digital";

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
    const admin = auth.admin!;

    const apiKey = await vaultGet("CLINT_API_KEY");
    if (!apiKey) return json({ error: "clint_not_configured" }, 503);

    const res = await fetch(`${CLINT_BASE}/v2/channel-accounts?limit=100`, {
      headers: { "Content-Type": "application/json", "api-token": apiKey },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("clint channel-accounts failed", res.status, JSON.stringify(payload));
      return json({ error: "clint_error", status: res.status, details: payload }, res.status);
    }

    const remote = ((payload as any)?.data ?? []) as any[];

    // Mantém apenas WhatsApp Oficial conectado como candidato a envio
    const rows = remote.map((c) => ({
      id: c.id as string,
      name: (c.name as string) ?? "Sem nome",
      identifier: (c.identifier as string) ?? null,
      team_name: c.team?.name ?? null,
      type: (c.type as string) ?? null,
      status: (c.status as string) ?? null,
      avatar: (c.avatar as string) ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data: existing } = await admin
      .from("clint_channel_accounts")
      .select("id");
    const known = new Set(((existing ?? []) as any[]).map((r) => r.id));

    // Novos números entram habilitados apenas se WhatsApp Oficial conectado
    const toInsert = rows
      .filter((r) => !known.has(r.id))
      .map((r) => ({
        ...r,
        is_enabled: r.type === "WHATSAPP_OFFICIAL" && r.status === "CONNECTED",
      }));

    const toUpdate = rows.filter((r) => known.has(r.id));

    if (toInsert.length) {
      const { error } = await admin.from("clint_channel_accounts").insert(toInsert);
      if (error) throw error;
    }
    for (const r of toUpdate) {
      const { id, ...rest } = r;
      const { error } = await admin.from("clint_channel_accounts").update(rest).eq("id", id);
      if (error) throw error;
    }

    // Remove números que não existem mais na Clint
    const remoteIds = rows.map((r) => r.id);
    if (remoteIds.length) {
      await admin
        .from("clint_channel_accounts")
        .delete()
        .not("id", "in", `(${remoteIds.join(",")})`);
    }

    // Garante um padrão
    const { data: all } = await admin
      .from("clint_channel_accounts")
      .select("*")
      .order("name", { ascending: true });

    const list = (all ?? []) as any[];
    const enabled = list.filter((c) => c.is_enabled);
    if (enabled.length && !enabled.some((c) => c.is_default)) {
      await admin.from("clint_channel_accounts").update({ is_default: true }).eq("id", enabled[0].id);
      enabled[0].is_default = true;
    }

    return json({ ok: true, synced: rows.length, accounts: list });
  } catch (e) {
    console.error("clint-channels error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
