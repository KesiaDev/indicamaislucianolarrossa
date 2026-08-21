import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Camera, ArrowRight, ArrowLeft, Check, Eye, EyeOff, ExternalLink, Mail, Webhook, RefreshCw, Copy, MessageCircle, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = ["Marca", "Seu perfil", "Webhook de conversão", "E-mails (Resend)", "WhatsApp"] as const;

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/conversion-webhook`;

const ACCEPTED_LOGO = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export function AdminSetupWizard({ open, onClose }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  // Step 0: Marca
  const [companyName, setCompanyName] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Step 1: Perfil
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Step 2: Webhook
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [skipWebhook, setSkipWebhook] = useState(false);

  // Step 3: Resend
  const [resendKey, setResendKey] = useState("");
  const [resendFrom, setResendFrom] = useState("");
  const [showResendKey, setShowResendKey] = useState(false);
  const [skipResend, setSkipResend] = useState(false);

  // Step 4: WhatsApp
  const [clintApiKey, setClintApiKey] = useState("");
  const [clintChannelId, setClintChannelId] = useState("");

  const [showWaSecret, setShowWaSecret] = useState(false);
  const [skipWhatsapp, setSkipWhatsapp] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current || !profile) return;
    loadedRef.current = true;

    setFullName((cur) => cur || profile.full_name || "");
    setAvatarPreview((cur) => cur || profile.avatar_url || null);
    setPhone((cur) => cur || (profile as any).phone || "");

    supabase
      .from("app_branding")
      .select("company_name, logo_url, hero_title, hero_subtitle")
      .eq("id", "singleton")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCompanyName((cur) => cur || data.company_name || "");
        setHeroTitle((cur) => cur || data.hero_title || "");
        setHeroSubtitle((cur) => cur || data.hero_subtitle || "");
        setLogoPreview((cur) => cur || data.logo_url || null);
      });
  }, [open, profile]);

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_LOGO.includes(file.type)) {
      toast.error("Use PNG, JPEG, SVG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo muito grande (máx 2 MB).");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const generateRandomSecret = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    setWebhookSecret(hex);
    setShowSecret(true);
    toast.success("Segredo gerado");
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL copiada");
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão inválida");

      // 1) Branding
      let logoUrl = logoPreview;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("branding")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }
      const { error: brErr } = await supabase
        .from("app_branding")
        .upsert({
          id: "singleton",
          company_name: companyName.trim() || "Indicações",
          hero_title: heroTitle.trim() || null,
          hero_subtitle: heroSubtitle.trim() || null,
          logo_url: logoUrl,
          setup_completed_at: new Date().toISOString(),
        }, { onConflict: "id" });
      if (brErr) throw brErr;

      // 2) Profile
      let avatarUrl = profile?.avatar_url ?? null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = pub.publicUrl;
      }
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // 3) Webhook secret
      if (!skipWebhook && webhookSecret.trim()) {
        const { error } = await supabase.rpc("set_vault_secret" as any, {
          p_name: "WEBHOOK_SECRET",
          p_value: webhookSecret.trim(),
        });
        if (error) throw new Error(`Webhook: ${error.message}`);
      }

      // 4) Resend
      if (!skipResend && resendKey.trim() && resendFrom.trim()) {
        const { error: e1 } = await supabase.rpc("set_vault_secret" as any, {
          p_name: "RESEND_API_KEY",
          p_value: resendKey.trim(),
        });
        if (e1) throw new Error(`Resend: ${e1.message}`);
        const { error: e2 } = await supabase.rpc("set_vault_secret" as any, {
          p_name: "RESEND_FROM",
          p_value: resendFrom.trim(),
        });
        if (e2) throw new Error(`Resend: ${e2.message}`);
      }

      // 5) WhatsApp (opcional)
      if (!skipWhatsapp) {
        const setSecret = async (name: string, value: string) => {
          const { error } = await supabase.rpc("set_vault_secret" as any, { p_name: name, p_value: value });
          if (error) throw new Error(`WhatsApp (${name}): ${error.message}`);
        };
        await setSecret("WHATSAPP_PROVIDER", "clint");
        if (clintApiKey.trim()) await setSecret("CLINT_API_KEY", clintApiKey.trim());
        if (clintChannelId.trim()) await setSecret("CLINT_CHANNEL_ACCOUNT_ID", clintChannelId.trim());

      }
    },
    onSuccess: () => {
      toast.success("Tudo pronto! Sua plataforma está configurada.");
      qc.invalidateQueries({ queryKey: ["app-branding"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      onClose();
    },
    onError: (err: Error) => {
      const msg = err.message || "Erro ao concluir setup";
      setErrorBanner(msg);
      toast.error(msg);
    },
  });

  const skipAll = async () => {
    // Marca apenas como concluído pra não reabrir (upsert garante a linha)
    const { error } = await supabase
      .from("app_branding")
      .upsert(
        { id: "singleton", company_name: companyName.trim() || "Indicações", setup_completed_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    if (error) {
      setErrorBanner(`Não foi possível salvar: ${error.message}. Verifique se o seu perfil tem papel "admin".`);
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["app-branding"] });
    onClose();
  };

  const canNext0 = companyName.trim().length >= 2;
  const canNext1 = fullName.trim().length >= 2;
  const canNext2 = skipWebhook || webhookSecret.trim().length >= 16;
  const canNext3 =
    skipResend ||
    (resendKey.trim().length === 0 && resendFrom.trim().length === 0) ||
    (resendKey.trim().length > 10 && /\S+@\S+\.\S+/.test(resendFrom.trim()));
  const canFinish =
    skipWhatsapp ||
    (clintApiKey.trim().length > 0 && clintChannelId.trim().length > 0);


  const handleFinish = async () => {
    setErrorBanner(null);
    setSaving(true);
    try {
      await finishMutation.mutateAsync();
    } finally {
      setSaving(false);
    }
  };

  const initial = (companyName || "?").charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bem-vindo! Vamos configurar sua plataforma</DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {errorBanner && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Não foi possível salvar</div>
              <div className="text-xs opacity-90">{errorBanner}</div>
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt={companyName} className="h-16 w-auto max-w-[180px] rounded-md bg-muted/30 object-contain p-2" />
              ) : (
                <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center text-2xl font-semibold">
                  {initial}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={logoRef}
                  type="file"
                  accept={ACCEPTED_LOGO.join(",")}
                  className="hidden"
                  onChange={onPickLogo}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {logoFile || logoPreview ? "Trocar logo" : "Enviar logo"}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP ou SVG. Máx 2 MB.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sw-company">Nome da empresa</Label>
              <Input id="sw-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-htitle">Título do hero (opcional)</Label>
              <Textarea id="sw-htitle" rows={2} value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Indique e ganhe, {{nome}}! 🎉" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-hsub">Subtítulo do hero (opcional)</Label>
              <Textarea id="sw-hsub" rows={2} value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img src={avatarPreview} alt={fullName} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
                  {(fullName || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                <Button type="button" variant="outline" size="sm" onClick={() => avatarRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />
                  {avatarPreview ? "Trocar foto" : "Adicionar foto"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG ou WEBP.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-name">Nome completo</Label>
              <Input id="sw-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sw-phone">Telefone (opcional)</Label>
              <Input id="sw-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
              <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Defina um segredo compartilhado com seu sistema externo para autenticar conversões.
                Pode ser gerado aleatoriamente. Fica armazenado criptografado no Vault.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>URL do webhook (cole no seu sistema)</Label>
              <div className="flex gap-2">
                <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sw-secret">Webhook secret</Label>
                <Button type="button" variant="ghost" size="sm" onClick={generateRandomSecret} disabled={skipWebhook}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Gerar aleatório
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="sw-secret"
                  type={showSecret ? "text" : "password"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  disabled={skipWebhook}
                  className="pr-10 font-mono text-xs"
                  placeholder="Mínimo 16 caracteres"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={skipWebhook} onChange={(e) => setSkipWebhook(e.target.checked)} />
              Ignorar por agora — configuro depois em Definições → Integrações.
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Configure o Resend para enviar e-mails transacionais. A chave é guardada
                criptografada no Vault. Você pode pular e configurar depois.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sw-resend-key">Resend API Key</Label>
              <div className="relative">
                <Input
                  id="sw-resend-key"
                  type={showResendKey ? "text" : "password"}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  disabled={skipResend}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showResendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Como gerar uma API key no Resend <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sw-resend-from">Remetente (from)</Label>
              <Input
                id="sw-resend-from"
                placeholder="Indicações <indicacoes@seudominio.com>"
                value={resendFrom}
                onChange={(e) => setResendFrom(e.target.value)}
                disabled={skipResend}
              />
              <p className="text-xs text-muted-foreground">Use um domínio verificado no Resend.</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={skipResend} onChange={(e) => setSkipResend(e.target.checked)} />
              Ignorar por agora — configuro depois em Definições → Integrações.
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Configure o WhatsApp para enviar notificações por mensagem. Você pode pular e
                configurar depois em <strong>Definições → Integrações</strong>.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipWhatsapp} onChange={(e) => setSkipWhatsapp(e.target.checked)} />
              Ignorar WhatsApp por enquanto
            </label>

            {!skipWhatsapp && (
              <>
                <p className="text-xs text-muted-foreground">
                  Envio pela <span className="font-medium text-foreground">Clint</span> usando o WhatsApp Oficial da Meta.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="sw-clint-key">API Key da Clint</Label>
                  <div className="relative">
                    <Input
                      id="sw-clint-key"
                      type={showWaSecret ? "text" : "password"}
                      value={clintApiKey}
                      onChange={(e) => setClintApiKey(e.target.value)}
                      placeholder="clint_live_..."
                      className="pr-10"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showWaSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sw-clint-channel">ID da conta de canal</Label>
                  <Input
                    id="sw-clint-channel"
                    value={clintChannelId}
                    onChange={(e) => setClintChannelId(e.target.value)}
                    placeholder="550e8400-e29b-41d4-a716-446655440001"
                  />
                </div>
              </>
            )}

          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={skipAll}>
            Configurar depois
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && !canNext0) ||
                  (step === 1 && !canNext1) ||
                  (step === 2 && !canNext2) ||
                  (step === 3 && !canNext3)
                }
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={!canFinish || saving}>
                <Check className="h-4 w-4 mr-2" />
                {saving ? "Concluindo…" : "Concluir setup"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
