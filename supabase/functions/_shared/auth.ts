import { createClient } from "npm:@supabase/supabase-js@2";

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Unauthorized", status: 401 as const };

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Valida o JWT diretamente com o service-role (não depende de SUPABASE_ANON_KEY)
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    console.warn("requireAdmin: token inválido", userErr?.message);
    return { error: "Unauthorized", status: 401 as const };
  }

  const { data: me } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") {
    console.warn("requireAdmin: utilizador não é admin", user.id, me?.role);
    return { error: "Forbidden", status: 403 as const };
  }
  return { user, admin };
}
