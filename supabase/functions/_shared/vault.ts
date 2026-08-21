// Helper para ler segredos do Vault por conexão direta ao banco.
// Evita depender do RPC legado e do PostgREST, que não expõe o schema vault.
// Cache em memória de 5 minutos por nome.
import postgres from "npm:postgres@3.4.5";

type Entry = { value: string | null; expiresAt: number };
const cache = new Map<string, Entry>();
const TTL_MS = 5 * 60_000;

let _sql: ReturnType<typeof postgres> | null = null;
function db() {
  if (_sql) return _sql;

  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL is not configured");
  }

  _sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  return _sql;
}

export async function vaultGet(name: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(name);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const rows = await db()<[{ decrypted_secret: string | null }][]>`
      select decrypted_secret
      from vault.decrypted_secrets
      where name = ${name}
      limit 1
    `;

    const value = rows[0]?.decrypted_secret ?? null;
    cache.set(name, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (error) {
    console.error("vaultGet error", name, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function vaultInvalidate(name?: string) {
  if (name) cache.delete(name);
  else cache.clear();
}
