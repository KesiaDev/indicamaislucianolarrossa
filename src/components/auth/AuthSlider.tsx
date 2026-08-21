import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import mentorPhoto from "@/assets/luciano-larrossa.webp";


const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passSchema = z.string().min(6, "Mínimo 6 caracteres").max(100);

const RegisterSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.replace(/\D/g, "").length >= 10,
      "Telefone deve ter DDD + número (mín. 10 dígitos)",
    ),
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.9 29.1 5 24 5 16.3 5 9.6 9.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c5 0 9.6-1.9 13-5l-6-5.1C29.1 34.5 26.7 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 38.7 16.2 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6 5.1c4.2-3.9 6.5-9.6 6.5-15.8 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

interface AuthSliderProps {
  initialMode?: "login" | "register";
}

export default function AuthSlider({ initialMode = "login" }: AuthSliderProps) {
  const { user, profile, loading } = useAuth();
  const { data: branding } = useBranding();
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(initialMode === "register");

  // Login state
  const [loginForm, setLoginForm] = useState({ email: "", pass: "" });
  const [showPass, setShowPass] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState("");

  // Register state
  const [regForm, setRegForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showRegPass, setShowRegPass] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regErr, setRegErr] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // Detecta projeto vazio (1º cadastro vira admin)
  const [isFirstUser, setIsFirstUser] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (!active || error) return;
      setIsFirstUser((count ?? 0) === 0);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Redirect after auth
  useEffect(() => {
    if (loading || !user) return;
    if (profile) {
      navigate(profile.role === "admin" ? "/admin" : "/app", { replace: true });
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) {
        await supabase.auth.signOut();
        toast.error("Cadastro não encontrado", {
          description:
            "Para participar do programa, faça sua inscrição em 'Quero ser indicador'.",
        });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [user, profile, loading, navigate]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    try {
      emailSchema.parse(loginForm.email);
      passSchema.parse(loginForm.pass);
    } catch (err) {
      const m =
        err instanceof z.ZodError ? err.issues[0]?.message : "Dados inválidos";
      setLoginErr(m || "Dados inválidos");
      return;
    }
    setLoginBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.pass,
    });
    setLoginBusy(false);
    if (error) setLoginErr(error.message || "Erro ao fazer login");
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  };

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErr(null);
    const parsed = RegisterSchema.safeParse(regForm);
    if (!parsed.success) {
      setRegErr(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (isFirstUser) {
      try {
        passSchema.parse(regForm.password);
      } catch (err) {
        const m =
          err instanceof z.ZodError
            ? err.issues[0]?.message
            : "Senha inválida";
        setRegErr(m || "Senha inválida");
        return;
      }
    }
    setRegBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "submit-referrer-signup",
        {
          body: {
            full_name: parsed.data.full_name,
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            app_url: window.location.origin,
            ...(isFirstUser ? { password: regForm.password } : {}),
          },
        },
      );
      const errCode = (data as any)?.error as string | undefined;
      if (errCode || fnErr) {
        const map: Record<string, string> = {
          email_already_registered:
            "Este e-mail já está cadastrado. Faça login.",
          resend_not_configured:
            "Envio de e-mail não está configurado. Avise o administrador.",
          email_send_failed:
            "Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.",
          insert_failed: "Erro ao registrar seu cadastro. Tente novamente.",
          update_failed: "Erro ao atualizar seu cadastro. Tente novamente.",
          invalid_body: "Dados inválidos. Confira os campos.",
          password_required_for_bootstrap:
            "Defina uma senha para criar a conta de administrador.",
          bootstrap_failed:
            "Não foi possível criar a conta de administrador. Tente novamente.",
        };
        setRegErr(
          map[errCode ?? ""] ?? errCode ?? fnErr?.message ?? "Erro ao enviar.",
        );
        return;
      }
      // Bootstrap do 1º admin: faz login automático
      if ((data as any)?.bootstrap_admin) {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: regForm.password,
        });
        if (signErr) {
          toast.error("Conta criada, mas falhou ao entrar", {
            description: "Tente fazer login manualmente.",
          });
          setIsActive(false);
          return;
        }
        toast.success("Bem-vindo, administrador!");
        return;
      }
      setRegSuccess(true);
    } catch (err) {
      setRegErr((err as Error).message);
    } finally {
      setRegBusy(false);
    }
  };

  const companyName = branding?.companyName ?? "Indica+";
  const logo = branding?.logoUrl;

  return (
    <main className="auth-scope relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Fundo: retrato do mentor + camadas escuras e douradas */}
      <div className="auth-bg" aria-hidden>
        <img src={mentorPhoto} alt="" className="auth-bg-photo" />
        <div className="auth-bg-veil" />
        <div className="auth-bg-embers" />
      </div>

      <div className="auth-header relative z-10 flex flex-col items-center gap-3 mb-7 text-center">
        {logo ? (
          <img
            src={logo}
            alt={companyName}
            className="h-16 w-auto max-w-[220px] object-contain drop-shadow-[0_6px_22px_rgba(0,0,0,0.75)]"
          />
        ) : (
          <div className="auth-crest flex h-14 w-14 items-center justify-center rounded-2xl">
            <Sparkles className="h-7 w-7" />
          </div>
        )}
        <h1 className="auth-title text-3xl font-extrabold uppercase tracking-[0.24em]">
          {companyName}
        </h1>
        <span className="auth-rule" aria-hidden />
        <p className="auth-subtitle text-[11px] font-semibold uppercase tracking-[0.34em]">
          Programa de Indicações · Luciano Larrossa
        </p>
      </div>




      <style>{`
        /* Tema escuro + dourado, aplicado apenas na tela de login */
        .auth-scope {
          --background: 20 16% 4%;
          --foreground: 40 32% 96%;
          --card: 24 14% 9%;
          --card-foreground: 40 32% 96%;
          --muted: 26 14% 15%;
          --muted-foreground: 38 16% 70%;
          --input: 36 26% 26%;
          --border: 36 26% 22%;
          --primary: 38 82% 54%;
          --primary-foreground: 24 40% 8%;
          --secondary: 30 60% 40%;
          --destructive: 4 76% 60%;
          --warning: 38 92% 56%;
          color: hsl(var(--foreground));
          background: radial-gradient(120% 90% at 50% 0%, hsl(26 40% 12%) 0%, hsl(22 30% 6%) 45%, hsl(20 20% 3%) 100%);
        }
        .auth-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .auth-bg-photo {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: min(80%, 1250px);
          object-fit: cover;
          object-position: 70% 12%;
          filter: contrast(1.35) brightness(1.08) saturate(1.12);
          opacity: 1;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 46%, #000 100%),
                              linear-gradient(180deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
          -webkit-mask-composite: source-in;
          mask-image: linear-gradient(90deg, transparent 0%, #000 46%, #000 100%),
                      linear-gradient(180deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
          mask-composite: intersect;
        }
        .auth-bg-veil {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(70% 80% at 88% 35%, hsl(32 90% 55% / 0.08) 0%, transparent 55%),
            radial-gradient(60% 55% at 18% 40%, hsl(32 95% 55% / 0.12) 0%, transparent 70%),
            linear-gradient(90deg, hsl(20 25% 3% / 0.94) 0%, hsl(20 25% 3% / 0.60) 40%, hsl(20 22% 3% / 0.18) 60%, hsl(20 20% 2% / 0.30) 100%),
            linear-gradient(180deg, hsl(20 25% 3% / 0.55) 0%, transparent 26%, transparent 74%, hsl(20 20% 2% / 0.94) 100%);
        }



        .auth-bg-embers {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(2px 2px at 12% 78%, hsl(35 100% 62% / 0.85), transparent 60%),
            radial-gradient(2px 2px at 82% 66%, hsl(28 100% 58% / 0.8), transparent 60%),
            radial-gradient(1.5px 1.5px at 30% 40%, hsl(40 100% 65% / 0.7), transparent 60%),
            radial-gradient(2.5px 2.5px at 68% 86%, hsl(24 100% 55% / 0.75), transparent 60%),
            radial-gradient(1.5px 1.5px at 55% 20%, hsl(42 100% 70% / 0.6), transparent 60%),
            radial-gradient(2px 2px at 90% 30%, hsl(30 100% 60% / 0.55), transparent 60%);
          animation: auth-embers 14s ease-in-out infinite alternate;
        }
        @keyframes auth-embers {
          from { transform: translate3d(0, 0, 0); opacity: 0.75; }
          to   { transform: translate3d(0, -28px, 0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-bg-embers { animation: none; }
        }
        .auth-crest {
          background: linear-gradient(135deg, hsl(44 92% 62%), hsl(28 88% 46%));
          color: hsl(24 40% 8%);
          box-shadow: 0 10px 30px hsl(32 90% 50% / 0.35);
        }
        .auth-header {
          padding: 18px 32px 24px;
          border-radius: 20px;
          background:
            radial-gradient(120% 100% at 50% 0%, hsl(20 20% 3% / 0.45) 0%, transparent 70%),
            linear-gradient(180deg, hsl(20 20% 3% / 0.28) 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 70%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 0%, #000 70%, transparent 100%);
        }
        .auth-title {
          background: linear-gradient(180deg, hsl(46 96% 84%), hsl(32 85% 54%));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 2px 20px hsl(20 20% 2% / 0.75), 0 1px 4px hsl(20 20% 2% / 0.5);
        }
        .auth-subtitle {
          color: hsl(38 20% 78%);
          text-shadow: 0 1px 12px hsl(20 20% 2% / 0.8), 0 1px 3px hsl(20 20% 2% / 0.5);
        }
        .auth-container {
          position: relative;
          z-index: 10;
          width: 850px;
          max-width: 100%;
          height: 550px;
          background: hsl(24 14% 9% / 0.86);
          backdrop-filter: blur(14px);
          border: 1px solid hsl(38 60% 55% / 0.28);
          border-radius: 30px;
          box-shadow: 0 30px 80px hsl(20 40% 2% / 0.8), 0 0 0 1px hsl(38 80% 60% / 0.08), 0 0 90px hsl(32 90% 50% / 0.12);
          overflow: hidden;
        }

        .auth-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: transparent;
          display: flex;
          align-items: center;
          color: hsl(var(--foreground));
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
        }
        .auth-container.active .auth-form-box {
          right: 50%;
        }
        .auth-form-box.register {
          visibility: hidden;
        }
        .auth-container.active .auth-form-box.register {
          visibility: visible;
        }
        .auth-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .auth-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: linear-gradient(135deg, hsl(44 92% 60%) 0%, hsl(32 88% 48%) 45%, hsl(22 70% 26%) 100%);
          box-shadow: inset 0 0 80px hsl(20 60% 10% / 0.45);

          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }
        .auth-container.active .auth-toggle-box::before {
          left: 50%;
        }
        .auth-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: hsl(var(--primary-foreground));
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          padding: 0 40px;
          text-align: center;
          transition: 0.6s ease-in-out;
        }
        .auth-toggle-panel.left {
          left: 0;
          transition-delay: 1.2s;
        }
        .auth-container.active .auth-toggle-panel.left {
          left: -50%;
          transition-delay: 0.6s;
        }
        .auth-toggle-panel.right {
          right: -50%;
          transition-delay: 0.6s;
        }
        .auth-container.active .auth-toggle-panel.right {
          right: 0;
          transition-delay: 1.2s;
        }
        @media screen and (max-width: 850px) {
          .auth-container {
            width: 100%;
            height: calc(100vh - 160px);
            min-height: 620px;
            border-radius: 24px;
          }
          .auth-form-box {
            bottom: 0;
            width: 100%;
            height: 70%;
            padding: 24px;
          }
          .auth-container.active .auth-form-box {
            right: 0;
            bottom: 30%;
          }
          .auth-toggle-box::before {
            left: 0;
            top: -270%;
            width: 100%;
            height: 300%;
            border-radius: 20vw;
          }
          .auth-container.active .auth-toggle-box::before {
            left: 0;
            top: 70%;
          }
          .auth-toggle-panel {
            width: 100%;
            height: 30%;
            padding: 16px 24px;
          }
          .auth-toggle-panel.left {
            top: 0;
          }
          .auth-container.active .auth-toggle-panel.left {
            left: 0;
            top: -30%;
          }
          .auth-toggle-panel.right {
            right: 0;
            bottom: -30%;
          }
          .auth-container.active .auth-toggle-panel.right {
            bottom: 0;
          }
        }
      `}</style>

      <div className={`auth-container ${isActive ? "active" : ""}`}>
        {/* Login Form */}
        <div className="auth-form-box login">
          <form onSubmit={doLogin} className="w-full space-y-4">
            <h2 className="text-3xl font-bold mb-2">Entrar</h2>

            {loginErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {loginErr}
              </div>
            )}

            <FieldInput
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              value={loginForm.email}
              onChange={(v) => setLoginForm({ ...loginForm, email: v })}
            />

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Senha"
                value={loginForm.pass}
                autoComplete="current-password"
                onChange={(e) =>
                  setLoginForm({ ...loginForm, pass: e.target.value })
                }
                className="w-full px-[15px] pr-11 py-[11px] bg-muted rounded-md border border-input outline-none text-sm transition-colors focus:border-primary focus:bg-card placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <button
              type="button"
              className="block w-full text-right text-xs text-muted-foreground hover:text-foreground -mt-2"
              onClick={() =>
                toast.info("Em breve", {
                  description: "Recuperação de senha disponível em breve.",
                })
              }
            >
              Esqueci minha senha
            </button>

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {loginBusy ? "Entrando…" : "Entrar"}
            </button>

            <p className="text-xs text-muted-foreground">ou entre com</p>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full h-11 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2"
            >
              <GoogleIcon className="h-4 w-4" /> Continuar com Google
            </button>
          </form>
        </div>

        {/* Register Form */}
        <div className="auth-form-box register">
          {regSuccess ? (
            <div className="w-full text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-2xl font-bold">Confira seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de confirmação para{" "}
                <strong>{regForm.email}</strong>. Clique nele para concluir seu
                cadastro (válido por 24 horas).
              </p>
              <button
                type="button"
                onClick={() => {
                  setRegSuccess(false);
                  setIsActive(false);
                }}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={doRegister} className="w-full space-y-4">
              <h2 className="text-3xl font-bold mb-2">Cadastro</h2>

              {regErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {regErr}
                </div>
              )}

              <FieldInput
                icon={<User className="h-4 w-4" />}
                type="text"
                placeholder="Nome completo"
                autoComplete="name"
                value={regForm.full_name}
                onChange={(v) => setRegForm({ ...regForm, full_name: v })}
              />
              <FieldInput
                icon={<Mail className="h-4 w-4" />}
                type="email"
                placeholder="E-mail"
                autoComplete="email"
                value={regForm.email}
                onChange={(v) => setRegForm({ ...regForm, email: v })}
              />
              <FieldInput
                icon={<Phone className="h-4 w-4" />}
                type="tel"
                placeholder="Telefone (opcional)"
                autoComplete="tel"
                value={regForm.phone}
                onChange={(v) => setRegForm({ ...regForm, phone: v })}
              />

              {isFirstUser && (
                <div className="relative">
                  <input
                    type={showRegPass ? "text" : "password"}
                    placeholder="Senha (mín. 6 caracteres)"
                    autoComplete="new-password"
                    value={regForm.password}
                    onChange={(e) =>
                      setRegForm({ ...regForm, password: e.target.value })
                    }
                    className="w-full px-[15px] pr-11 py-[11px] bg-muted rounded-md border border-input outline-none text-sm transition-colors focus:border-primary focus:bg-card placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass((v) => !v)}
                    aria-label={
                      showRegPass ? "Ocultar senha" : "Mostrar senha"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRegPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={regBusy}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                {regBusy
                  ? "Enviando…"
                  : isFirstUser
                    ? "Criar conta de administrador"
                    : "Enviar confirmação"}
              </button>

              <p className="text-xs text-muted-foreground">
                {isFirstUser
                  ? "Como primeiro cadastro, você se torna o administrador da plataforma."
                  : "Você receberá um e-mail para confirmar e definir sua senha."}
              </p>
            </form>
          )}
        </div>

        {/* Toggle Box */}
        <div className="auth-toggle-box">
          <div className="auth-toggle-panel left">
            <h2 className="text-3xl font-bold mb-2">Olá, bem-vindo!</h2>
            <p className="text-sm opacity-90 mb-5">
              Ainda não tem cadastro como indicador?
            </p>
            <button
              type="button"
              onClick={() => setIsActive(true)}
              aria-pressed={isActive}
              className="w-40 h-11 rounded-md border-2 border-primary-foreground text-primary-foreground text-sm font-semibold hover:bg-primary-foreground/10 transition"
            >
              Quero me cadastrar
            </button>
          </div>

          <div className="auth-toggle-panel right">
            <h2 className="text-3xl font-bold mb-2">Bem-vindo de volta!</h2>
            <p className="text-sm opacity-90 mb-5">Já tem uma conta?</p>
            <button
              type="button"
              onClick={() => setIsActive(false)}
              aria-pressed={!isActive}
              className="w-40 h-11 rounded-md border-2 border-primary-foreground text-primary-foreground text-sm font-semibold hover:bg-primary-foreground/10 transition"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>

      {isFirstUser && (
        <div className="relative z-10 mt-6 flex w-full max-w-[850px] items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left backdrop-blur">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              Bem-vindo ao seu novo programa de indicações!
            </p>
            <p className="text-muted-foreground">
              O primeiro a se cadastrar será o administrador. Use o formulário
              de cadastro ao lado.
            </p>
          </div>
        </div>
      )}
    </main>

  );
}

function FieldInput({
  icon,
  ...rest
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type={rest.type}
        placeholder={rest.placeholder}
        autoComplete={rest.autoComplete}
        value={rest.value}
        onChange={(e) => rest.onChange(e.target.value)}
        className="w-full px-[15px] pr-11 py-[11px] bg-muted rounded-md border border-input outline-none text-sm transition-colors focus:border-primary focus:bg-card placeholder:text-muted-foreground"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        {icon}
      </span>
    </div>
  );
}
