import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";

const PassSchema = z.string().min(8, "Mínimo 8 caracteres").max(72);

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string; full_name: string }
  | { kind: "error"; message: string };

export default function ConfirmSignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: branding } = useBranding();
  const companyName = branding?.companyName ?? "Indica+";
  const logo = branding?.logoUrl;

  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Link inválido." });
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        `confirm-referrer-signup?action=lookup&token=${encodeURIComponent(token)}`,
        { method: "GET" },
      );
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error;
        const human =
          msg === "expired"
            ? "Este link expirou. Solicite um novo."
            : msg === "already_used"
            ? "Este link já foi usado."
            : msg === "not_found"
            ? "Link inválido."
            : "Não foi possível validar o link.";
        setState({ kind: "error", message: human });
        return;
      }
      setState({
        kind: "ready",
        email: (data as any).email,
        full_name: (data as any).full_name,
      });
    })();
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const p = PassSchema.safeParse(pass);
    if (!p.success) {
      setErr(p.error.issues[0]?.message ?? "Senha inválida");
      return;
    }
    if (pass !== confirm) {
      setErr("As senhas não coincidem.");
      return;
    }
    if (state.kind !== "ready") return;

    setBusy(true);
    const { data, error } = await supabase.functions.invoke("confirm-referrer-signup", {
      body: { token, password: pass },
    });
    if (error || (data as any)?.error) {
      setErr((data as any)?.error || error?.message || "Falha ao confirmar.");
      setBusy(false);
      return;
    }

    // Auto-login
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: pass,
    });
    setBusy(false);
    if (signErr) {
      toast.success("Cadastro confirmado!", { description: "Faça login para continuar." });
      navigate("/login", { replace: true });
      return;
    }
    toast.success("Bem-vindo(a)!");
    navigate("/app", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          {logo ? (
            <img src={logo} alt={companyName} className="h-12 w-auto max-w-[180px] object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
          )}
          <h1 className="text-xl font-semibold">{companyName}</h1>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm p-6">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando link…
            </div>
          )}

          {state.kind === "error" && (
            <div className="text-center space-y-3 py-4">
              <h2 className="text-xl font-semibold">Não foi possível confirmar</h2>
              <p className="text-sm text-muted-foreground">{state.message}</p>
              <Link to="/quero-indicar" className="inline-block text-sm text-primary hover:underline">
                Fazer um novo cadastro
              </Link>
            </div>
          )}

          {state.kind === "ready" && (
            <>
              <div className="mb-5">
                <h2 className="text-2xl font-semibold">Defina sua senha</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Olá, <strong>{state.full_name}</strong>! Crie uma senha para acessar sua conta
                  ({state.email}).
                </p>
              </div>

              {err && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
                  {err}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    placeholder="Senha (mín. 8 caracteres)"
                    value={pass}
                    autoComplete="new-password"
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full px-[15px] pr-11 py-[11px] bg-muted rounded-md border border-input outline-none text-sm transition-colors focus:border-primary focus:bg-card placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    placeholder="Confirmar senha"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full px-[15px] pr-11 py-[11px] bg-muted rounded-md border border-input outline-none text-sm transition-colors focus:border-primary focus:bg-card placeholder:text-muted-foreground"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Lock className="h-4 w-4" />
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {busy ? "Confirmando…" : "Confirmar e entrar"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
