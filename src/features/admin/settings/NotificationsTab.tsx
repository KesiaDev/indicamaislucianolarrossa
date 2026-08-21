import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, RotateCcw, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loading } from "@/components/shared/Loading";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

type Channel = "email" | "whatsapp";

type Rule = {
  event_key: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
};

type Template = {
  event_key: string;
  channel: Channel;
  subject: string | null;
  body: string;
};

type EventDef = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  channels: Channel[];
};

const EVENTS: EventDef[] = [
  {
    key: "referrer_invite",
    label: "Convite de indicador",
    description: "Disparado quando o admin convida um novo indicador.",
    channels: ["email", "whatsapp"],
    placeholders: ["{{inviter_name}}", "{{signup_url}}", "{{company_name}}", "{{referrer_first_name}}"],
  },
  {
    key: "referral_registered",
    label: "Indicação registrada",
    description: "Disparado quando um lead se cadastra via link de indicação.",
    channels: ["email", "whatsapp"],
    placeholders: [
      "{{referrer_first_name}}",
      "{{referrer_name}}",
      "{{lead_name}}",
      "{{lead_email}}",
      "{{campaign_name}}",
      "{{company_name}}",
    ],
  },
  {
    key: "referral_converted",
    label: "Indicação convertida",
    description: "Disparado quando uma indicação é confirmada como convertida.",
    channels: ["email", "whatsapp"],
    placeholders: [
      "{{referrer_first_name}}",
      "{{lead_name}}",
      "{{campaign_name}}",
      "{{conversion_value}}",
      "{{company_name}}",
    ],
  },
  {
    key: "reward_unlocked",
    label: "Prêmio desbloqueado",
    description: "Disparado quando um prêmio é aprovado para o indicador.",
    channels: ["email", "whatsapp"],
    placeholders: [
      "{{referrer_first_name}}",
      "{{reward_description}}",
      "{{redemption_code}}",
      "{{rewards_url}}",
      "{{company_name}}",
    ],
  },
  {
    key: "reward_paid",
    label: "Prêmio pago",
    description: "Disparado quando um prêmio é marcado como pago.",
    channels: ["email", "whatsapp"],
    placeholders: [
      "{{referrer_first_name}}",
      "{{reward_description}}",
      "{{reward_value}}",
      "{{company_name}}",
    ],
  },
];

export function NotificationsTab() {
  const qc = useQueryClient();

  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["notification_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_rules" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as unknown) as Rule[];
    },
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["notification_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_templates" as any).select("*");
      if (error) throw error;
      return ((data ?? []) as unknown) as Template[];
    },
  });

  const ruleMap = useMemo(() => {
    const m = new Map<string, Rule>();
    (rules ?? []).forEach((r) => m.set(r.event_key, r));
    return m;
  }, [rules]);

  const templateMap = useMemo(() => {
    const m = new Map<string, Template>();
    (templates ?? []).forEach((t) => m.set(`${t.event_key}:${t.channel}`, t));
    return m;
  }, [templates]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notification_rules"] });
    qc.invalidateQueries({ queryKey: ["notification_templates"] });
  };

  if (loadingRules || loadingTemplates) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mensagens automáticas</CardTitle>
          <CardDescription>
            Ative ou desative cada canal por evento e edite o conteúdo enviado.
            Use placeholders como <code className="text-xs">{"{{referrer_first_name}}"}</code> — eles
            são substituídos pelos valores reais no momento do envio.
          </CardDescription>
        </CardHeader>
      </Card>

      {EVENTS.map((evt) => (
        <EventCard
          key={evt.key}
          event={evt}
          rule={ruleMap.get(evt.key) ?? { event_key: evt.key, email_enabled: false, whatsapp_enabled: false }}
          emailTpl={templateMap.get(`${evt.key}:email`)}
          whatsappTpl={templateMap.get(`${evt.key}:whatsapp`)}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}

function EventCard({
  event,
  rule,
  emailTpl,
  whatsappTpl,
  onChanged,
}: {
  event: EventDef;
  rule: Rule;
  emailTpl?: Template;
  whatsappTpl?: Template;
  onChanged: () => void;
}) {
  const [emailEnabled, setEmailEnabled] = useState(rule.email_enabled);
  const [whatsEnabled, setWhatsEnabled] = useState(rule.whatsapp_enabled);

  useEffect(() => setEmailEnabled(rule.email_enabled), [rule.email_enabled]);
  useEffect(() => setWhatsEnabled(rule.whatsapp_enabled), [rule.whatsapp_enabled]);

  const toggleRule = useMutation({
    mutationFn: async (next: { email_enabled: boolean; whatsapp_enabled: boolean }) => {
      const { error } = await supabase
        .from("notification_rules" as any)
        .upsert({ event_key: event.key, ...next });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disparo atualizado");
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const handleEmailToggle = (v: boolean) => {
    setEmailEnabled(v);
    toggleRule.mutate({ email_enabled: v, whatsapp_enabled: whatsEnabled });
  };
  const handleWhatsToggle = (v: boolean) => {
    setWhatsEnabled(v);
    toggleRule.mutate({ email_enabled: emailEnabled, whatsapp_enabled: v });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">{event.label}</CardTitle>
            <CardDescription className="mt-1">{event.description}</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>E-mail</span>
              <Switch checked={emailEnabled} onCheckedChange={handleEmailToggle} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span>WhatsApp</span>
              <Switch checked={whatsEnabled} onCheckedChange={handleWhatsToggle} />
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">E-mail</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="mt-4">
            <TemplateEditor
              event={event}
              channel="email"
              template={emailTpl}
              onSaved={onChanged}
            />
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-4">
            <TemplateEditor
              event={event}
              channel="whatsapp"
              template={whatsappTpl}
              onSaved={onChanged}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  event,
  channel,
  template,
  onSaved,
}: {
  event: EventDef;
  channel: Channel;
  template?: Template;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
  }, [template?.subject, template?.body]);

  const insertPlaceholder = (ph: string) => {
    setBody((prev) => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + ph);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_templates" as any)
        .upsert({
          event_key: event.key,
          channel,
          subject: channel === "email" ? subject : null,
          body,
        });
      if (error) throw error;
      toast.success("Template salvo");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!profile) {
      toast.error("Sessão inválida");
      return;
    }
    setTesting(true);
    try {
      const sample: Record<string, unknown> = {
        inviter_name: "Time " + (profile.full_name?.split(" ")[0] ?? "Indica+"),
        signup_url: window.location.origin + "/auth",
        lead_name: "Maria Lead",
        lead_email: "maria@exemplo.com",
        campaign_name: "Campanha exemplo",
        conversion_value: "250,00 €",
        reward_description: "Voucher de 50 €",
        redemption_code: "TESTE123",
        reward_value: "50,00 €",
        rewards_url: window.location.origin + "/app/rewards",
      };
      const body: any = {
        profile_id: profile.id,
        channel,
        template: { kind: "event", event_key: event.key, data: sample },
      };
      if (channel === "whatsapp" && testTo.trim()) body.override_phone = testTo.trim();

      const { data, error } = await supabase.functions.invoke("send-notification", { body });
      if (error) throw error;
      if ((data as any)?.suppressed) {
        toast.warning(`Disparo desativado para este evento (${(data as any).reason ?? "regra"}).`);
      } else if ((data as any)?.ok) {
        toast.success(`Teste enviado via ${channel === "email" ? "e-mail" : "WhatsApp"}`);
      } else {
        toast.error((data as any)?.error ?? "Falha ao enviar");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="space-y-3">
        {channel === "email" && (
          <div>
            <Label className="text-xs">Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: 🎉 Você desbloqueou um prêmio!"
            />
          </div>
        )}
        <div>
          <Label className="text-xs">
            {channel === "email" ? "Corpo (HTML)" : "Mensagem (texto)"}
          </Label>
          <Textarea
            rows={channel === "email" ? 10 : 5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={channel === "email" ? "font-mono text-xs" : ""}
            placeholder={
              channel === "email"
                ? "<p>Olá {{referrer_first_name}}...</p>"
                : "Olá {{referrer_first_name}}..."
            }
          />
          {channel === "whatsapp" && (
            <p className="text-[11px] text-muted-foreground mt-1">{body.length} caracteres</p>
          )}
        </div>

        {channel === "whatsapp" && (
          <div>
            <Label className="text-xs">Telefone para teste (opcional)</Label>
            <Input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+5511999999999"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Se vazio, usa o telefone do seu perfil.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button onClick={sendTest} disabled={testing} size="sm" variant="outline">
            <Send className="h-3.5 w-3.5 mr-1" />
            {testing ? "Enviando..." : "Enviar teste"}
          </Button>
          {template && (
            <Button
              onClick={() => {
                setSubject(template.subject ?? "");
                setBody(template.body);
                toast.message("Alterações descartadas");
              }}
              size="sm"
              variant="ghost"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reverter
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 h-fit">
        <Label className="text-xs">Placeholders disponíveis</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {event.placeholders.map((ph) => (
            <button
              key={ph}
              type="button"
              onClick={() => insertPlaceholder(ph)}
              className="text-[11px] font-mono"
            >
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                {ph}
              </Badge>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Clique para inserir no corpo da mensagem.
        </p>
      </div>
    </div>
  );
}
