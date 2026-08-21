import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageCircle, Webhook, Eye, EyeOff, ExternalLink, Trash2, Send, Copy, RefreshCw, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/shared/Loading";
import { IntegrationCard } from "@/components/shared/IntegrationCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

function FieldStatusBadge({ filled }: { filled: boolean }) {
  return filled ? (
    <Badge variant="secondary" className="ml-2 text-[10px] font-normal">Preenchido</Badge>
  ) : (
    <Badge variant="outline" className="ml-2 text-[10px] font-normal">Não configurado</Badge>
  );
}

type Status = Record<string, boolean | string | null>;

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const FN_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1`;

export function IntegrationsTab() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status"],
    queryFn: async (): Promise<Status> => {
      const { data, error } = await supabase.rpc("list_integration_status" as any);
      if (error) throw error;
      return (data as Status) ?? {};
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["integration-status"] });

  if (isLoading || !status) return <Loading />;

  return (
    <div className="space-y-4">
      <ResendCard status={status} onChanged={refresh} />
      <WhatsappCard status={status} onChanged={refresh} />
      <WebhookCard status={status} onChanged={refresh} />
    </div>
  );
}

/* ---------------------- RESEND ---------------------- */

function ResendCard({ status, onChanged }: { status: Status; onChanged: () => void }) {
  const connected = !!status.RESEND_API_KEY && !!status.RESEND_FROM;
  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (apiKey.trim()) {
        const { error } = await supabase.rpc("set_vault_secret" as any, {
          p_name: "RESEND_API_KEY",
          p_value: apiKey.trim(),
        });
        if (error) throw error;
      }
      if (fromEmail.trim()) {
        const { error } = await supabase.rpc("set_vault_secret" as any, {
          p_name: "RESEND_FROM",
          p_value: fromEmail.trim(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Resend configurado");
      setApiKey("");
      setFromEmail("");
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      for (const name of ["RESEND_API_KEY", "RESEND_FROM", "RESEND_WEBHOOK_SECRET"]) {
        const { error } = await supabase.rpc("delete_vault_secret" as any, { p_name: name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração removida");
      setRemoveOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = async () => {
    if (!/\S+@\S+\.\S+/.test(testTo.trim())) {
      toast.error("Informe um e-mail válido");
      return;
    }
    setTesting(true);
    try {
      // Buscar profile_id pelo email
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", testTo.trim().toLowerCase())
        .maybeSingle();
      if (!profs?.id) {
        toast.error("Nenhum perfil com esse e-mail. Use um e-mail já cadastrado.");
        setTesting(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          profile_id: profs.id,
          channel: "email",
          subject: "Teste de envio (Indica+)",
          body: "Este é um e-mail de teste enviado a partir das Configurações.",
          template: { kind: "raw" },
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.ok === false) throw new Error((data as any).error || "Falha");
      toast.success(`E-mail enviado para ${testTo.trim()}`);
      setTestOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <IntegrationCard
        title="Resend (e-mail)"
        description="Envio de e-mails transacionais via seu domínio verificado no Resend."
        icon={Mail}
        connected={connected}
        extraActions={
          connected && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                <Send className="h-4 w-4 mr-2" /> Testar envio
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            </>
          )
        }
        onSave={connected ? undefined : () => setOpen(true)}
        saveLabel="Configurar"
        saving={false}
      >
        {connected ? (
          <p className="text-sm text-muted-foreground">
            Chave configurada e armazenada no Vault.{" "}
            {status.RESEND_WEBHOOK_SECRET ? "Webhook de bounce/complaint ativo." : "Webhook opcional não configurado."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Conecte sua conta Resend para enviar prêmios desbloqueados, convites e notificações.
          </p>
        )}
      </IntegrationCard>

      {/* Save dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{connected ? "Editar integração Resend" : "Configurar Resend"}</DialogTitle>
            <DialogDescription>
              A chave é armazenada criptografada no Vault. Deixe um campo vazio para manter o valor atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rs-key" className="flex items-center">
                API Key
                <FieldStatusBadge filled={!!status.RESEND_API_KEY} />
              </Label>
              <div className="relative">
                <Input
                  id="rs-key"
                  type={showKey ? "text" : "password"}
                  placeholder={status.RESEND_API_KEY ? "Deixe em branco para manter" : "re_xxxxxxxxxxxxxxxxxxxx"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Como gerar uma API key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-from" className="flex items-center">
                Remetente (from)
                <FieldStatusBadge filled={!!status.RESEND_FROM} />
              </Label>
              <Input
                id="rs-from"
                placeholder={status.RESEND_FROM ? "Deixe em branco para manter" : "Indicações <indicacoes@seudominio.com>"}
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Domínio precisa estar verificado no Resend.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || (!connected && !apiKey.trim() && !fromEmail.trim())}>
              {save.isPending ? "Salvando…" : connected ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar e-mail de teste</DialogTitle>
            <DialogDescription>
              Use o e-mail de um perfil já cadastrado no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rs-test">Enviar para</Label>
            <Input id="rs-test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="seu@email.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testing}>Cancelar</Button>
            <Button onClick={runTest} disabled={testing}>{testing ? "Enviando…" : "Enviar teste"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove dialog */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover configuração do Resend?</AlertDialogTitle>
            <AlertDialogDescription>
              As chaves serão apagadas do Vault e o sistema deixará de enviar e-mails até nova configuração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------------- WHATSAPP ---------------------- */

function WhatsappCard({ status, onChanged }: { status: Status; onChanged: () => void }) {
  const { profile } = useAuth();
  const currentProvider = (status.whatsapp_provider_value as string | null) || null;
  const connected =
    !!currentProvider &&
    ((currentProvider === "twilio" && status.TWILIO_ACCOUNT_SID && status.TWILIO_AUTH_TOKEN && status.TWILIO_FROM) ||
      (currentProvider === "evolution" && status.EVOLUTION_API_URL && status.EVOLUTION_API_KEY && status.EVOLUTION_INSTANCE));

  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState<"twilio" | "evolution">((currentProvider as any) ?? "twilio");
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentProvider) setProvider(currentProvider as any);
  }, [currentProvider]);

  const onChange = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { error: pe } = await supabase.rpc("set_vault_secret" as any, {
        p_name: "WHATSAPP_PROVIDER",
        p_value: provider,
      });
      if (pe) throw pe;
      for (const [k, v] of Object.entries(vals)) {
        if (!v.trim()) continue;
        const { error } = await supabase.rpc("set_vault_secret" as any, { p_name: k, p_value: v.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("WhatsApp configurado");
      setVals({});
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const names = ["WHATSAPP_PROVIDER", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM",
        "EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE"];
      for (const n of names) {
        const { error } = await supabase.rpc("delete_vault_secret" as any, { p_name: n });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração removida");
      setRemoveOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = async () => {
    const phone = testTo.trim();
    if (phone.length < 8) {
      toast.error("Informe um número válido com DDI (ex: +5511999999999)");
      return;
    }
    if (!profile?.id) {
      toast.error("Sessão inválida");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          profile_id: profile.id,
          channel: "whatsapp",
          override_phone: phone,
          body: "Teste de envio (Indica+) via WhatsApp.",
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.ok === false) throw new Error((data as any).error || "Falha");
      toast.success(`Mensagem enviada para ${phone}`);
      setTestOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const fields = provider === "twilio"
    ? [
        { name: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "ACxxxxx" },
        { name: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "password" as const },
        { name: "TWILIO_FROM", label: "Número WhatsApp (from)", placeholder: "whatsapp:+14155238886" },
      ]
    : [
        { name: "EVOLUTION_API_URL", label: "URL da API", placeholder: "https://evolution.seudominio.com" },
        { name: "EVOLUTION_API_KEY", label: "API Key", type: "password" as const },
        { name: "EVOLUTION_INSTANCE", label: "Instância", placeholder: "minha-instancia" },
      ];

  return (
    <>
      <IntegrationCard
        title="WhatsApp"
        description={currentProvider ? `Provedor atual: ${currentProvider}` : "Escolha um provedor (Twilio ou Evolution API)."}
        icon={MessageCircle}
        connected={!!connected}
        extraActions={
          connected && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                <Send className="h-4 w-4 mr-2" /> Testar envio
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            </>
          )
        }
        onSave={connected ? undefined : () => setOpen(true)}
        saveLabel="Configurar"
      >
        <p className="text-sm text-muted-foreground">
          Notificações via WhatsApp para indicadores quando prêmios são liberados.
        </p>
      </IntegrationCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{connected ? "Editar integração WhatsApp" : "Configurar WhatsApp"}</DialogTitle>
            <DialogDescription>
              Os valores são gravados criptografados no Vault. Deixe vazio para manter o atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                  <SelectItem value="evolution">Evolution API (self-hosted)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fields.map((f) => {
              const isConfigured = !!status[f.name];
              return (
                <div key={f.name} className="space-y-1.5">
                  <Label htmlFor={f.name} className="flex items-center">
                    {f.label}
                    <FieldStatusBadge filled={isConfigured} />
                  </Label>
                  <Input
                    id={f.name}
                    type={f.type === "password" ? "password" : "text"}
                    placeholder={isConfigured ? "Deixe em branco para manter" : f.placeholder}
                    value={vals[f.name] ?? ""}
                    onChange={(e) => onChange(f.name, e.target.value)}
                    autoComplete="off"
                  />
                </div>
              );
            })}
            {provider === "evolution" && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">Webhook de status (opcional)</p>
                <p className="text-muted-foreground">
                  Configure no painel do Evolution para receber confirmações de entrega/leitura.
                  Use o header <code className="font-mono">apikey</code> com a mesma API Key acima.
                </p>
                <code className="block break-all rounded bg-background p-2 font-mono">
                  https://{import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/evolution-status-webhook
                </code>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : connected ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp de teste</DialogTitle>
            <DialogDescription>
              Use formato internacional. A mensagem será enviada via {currentProvider}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wa-test">Número (com DDI)</Label>
            <Input
              id="wa-test"
              type="tel"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+5511999999999"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testing}>Cancelar</Button>
            <Button onClick={runTest} disabled={testing}>{testing ? "Enviando…" : "Enviar teste"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover configuração do WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as credenciais do provedor serão apagadas do Vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------------- WEBHOOK ---------------------- */

function WebhookCard({ status, onChanged }: { status: Status; onChanged: () => void }) {
  const connected = !!status.WEBHOOK_SECRET;
  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const url = `${FN_BASE}/conversion-webhook`;

  const generate = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    setSecret(hex);
    setShowSecret(true);
    toast.success("Segredo gerado");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (secret.trim().length < 16) throw new Error("Mínimo 16 caracteres");
      const { error } = await supabase.rpc("set_vault_secret" as any, {
        p_name: "WEBHOOK_SECRET",
        p_value: secret.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook secret salvo");
      setSecret("");
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_vault_secret" as any, { p_name: "WEBHOOK_SECRET" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração removida");
      setRemoveOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <IntegrationCard
        title="Webhook de conversão"
        description="Chave usada para autenticar chamadas externas que confirmam conversões."
        icon={Webhook}
        connected={connected}
        extraActions={
          connected && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            </>
          )
        }
        onSave={connected ? undefined : () => setOpen(true)}
        saveLabel="Configurar"
      >
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center">
            URL do webhook
            <FieldStatusBadge filled={!!status.WEBHOOK_SECRET} />
          </Label>
          <div className="flex gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copiada"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </IntegrationCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{connected ? "Editar webhook secret" : "Configurar webhook secret"}</DialogTitle>
            <DialogDescription>
              Compartilhe este segredo com seu sistema externo. Fica criptografado no Vault.
              {connected && " Gerar um novo invalida o anterior."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="wh-secret">Webhook secret</Label>
              <Button type="button" variant="ghost" size="sm" onClick={generate}>
                <RefreshCw className="mr-1 h-3 w-3" /> Gerar aleatório
              </Button>
            </div>
            <div className="relative">
              <Input
                id="wh-secret"
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !secret.trim()}>
              {save.isPending ? "Salvando…" : connected ? "Salvar novo segredo" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Chamadas externas pararão de ser autenticadas até nova configuração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
