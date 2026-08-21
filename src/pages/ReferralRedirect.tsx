import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loading } from "@/components/shared/Loading";
import { LinkIcon, Gift } from "lucide-react";

interface LinkData {
  code: string;
  referrer_id: string;
  campaign_id: string;
  profiles: { full_name: string | null } | null;
  campaigns: {
    name: string;
    landing_page_url: string | null;
    description: string | null;
    status: string;
  } | null;
}

const LeadSchema = z.object({
  lead_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  lead_email: z.string().trim().email("Email inválido").max(255),
  lead_phone: z.string().trim().max(20).optional().or(z.literal("")),
});
type LeadForm = z.infer<typeof LeadSchema>;

export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const variantId = searchParams.get("v");
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState<{ company_name: string; logo_url: string | null } | null>(null);
  const redirectedRef = useRef(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<LeadForm>({
    resolver: zodResolver(LeadSchema),
  });

  useEffect(() => {
    if (!code) { setInvalid(true); setLoading(false); return; }
    (async () => {
      try {
        const [{ data }, { data: b }] = await Promise.all([
          supabase
            .from("referral_links")
            .select("code, referrer_id, campaign_id, profiles!inner(full_name), campaigns!inner(name, landing_page_url, description, status)")
            .eq("code", code)
            .maybeSingle(),
          supabase.from("app_branding").select("company_name, logo_url").eq("id", "singleton").maybeSingle(),
        ]);
        if (!data || !(data as any).campaigns || (data as any).campaigns.status !== "active") {
          setInvalid(true);
        } else {
          setLink(data as any);
          setBranding((b as any) ?? null);
          // Se há URL externa, abre dialog e redireciona; senão, fica na landing interna
          if ((data as any).campaigns.landing_page_url) {
            setTimeout(() => setDialogOpen(true), 300);
          }
        }
      } catch {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  // Track click sempre (para landing interna ou externa)
  useEffect(() => {
    if (!link || !code) return;
    supabase.functions
      .invoke("track-click", { body: { code, variant_id: variantId || undefined } })
      .catch(() => {});
  }, [link, code, variantId]);

  const doRedirect = () => {
    if (redirectedRef.current || !link?.campaigns?.landing_page_url || !code) return;
    redirectedRef.current = true;
    try {
      const url = new URL(link.campaigns.landing_page_url);
      url.searchParams.set("ref", code);
      if (variantId) url.searchParams.set("v", variantId);
      const incoming = new URLSearchParams(window.location.search);
      incoming.forEach((v, k) => { if (k !== "ref" && k !== "v") url.searchParams.set(k, v); });
      window.location.replace(url.toString());
    } catch {
      window.location.replace("/");
    }
  };

  // Timer de redirect só faz sentido quando há URL externa
  useEffect(() => {
    if (!link?.campaigns?.landing_page_url || dialogOpen) return;
    const t = setTimeout(doRedirect, 1500);
    return () => clearTimeout(t);
  }, [link, dialogOpen]);

  const onSubmit = async (values: LeadForm) => {
    if (!code) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-referral", {
        body: {
          code,
          lead_name: values.lead_name,
          lead_email: values.lead_email,
          lead_phone: values.lead_phone || undefined,
          variant_id: variantId || undefined,
        },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        toast.error(`Erro: ${(data as any).error ?? "tente novamente"}`);
      } else {
        toast.success("Indicação registrada! 🚀");
      }
      setDialogOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar");
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <EmptyState
              icon={LinkIcon}
              title="Link indisponível"
              description="Este link não existe ou a campanha foi encerrada."
              action={<Button onClick={() => navigate("/")}>Ir para o site</Button>}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const referrerName = link?.profiles?.full_name || "um amigo";
  const campaignName = link?.campaigns?.name;
  const hasExternalUrl = !!link?.campaigns?.landing_page_url;

  // Modo redirect (URL externa configurada)
  if (hasExternalUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-accent/20">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full text-center space-y-4"
        >
          <h1 className="text-3xl font-bold">Bem-vindo! 👋</h1>
          <p className="text-lg text-muted-foreground">
            Você foi indicado por <strong className="text-foreground">{referrerName}</strong>
          </p>
          {campaignName && <p className="text-sm text-muted-foreground">Campanha: {campaignName}</p>}
          <p className="text-xs text-muted-foreground pt-2">Redirecionando…</p>
        </motion.div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receba uma oferta especial 🎁</DialogTitle>
              <DialogDescription>
                Deixe seus dados para garantir benefícios exclusivos da indicação.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <Label htmlFor="lead_name">Nome</Label>
                <Input id="lead_name" {...register("lead_name")} autoFocus />
                {errors.lead_name && <p className="text-xs text-destructive mt-1">{errors.lead_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="lead_email">Email</Label>
                <Input id="lead_email" type="email" {...register("lead_email")} />
                {errors.lead_email && <p className="text-xs text-destructive mt-1">{errors.lead_email.message}</p>}
              </div>
              <div>
                <Label htmlFor="lead_phone">WhatsApp (opcional)</Label>
                <Input id="lead_phone" placeholder="(11) 99999-9999" {...register("lead_phone")} />
                {errors.lead_phone && <p className="text-xs text-destructive mt-1">{errors.lead_phone.message}</p>}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Pular e continuar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar e continuar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Modo landing interna (sem URL externa configurada)
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/20 px-4 py-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-lg w-full"
      >
        <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6 text-center">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={branding.company_name} className="h-12 mx-auto object-contain" />
            ) : branding?.company_name ? (
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {branding.company_name}
              </p>
            ) : null}

            <div className="space-y-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
                <Gift className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Você foi indicado por {referrerName}! 🎉
              </h1>
              {campaignName && (
                <p className="text-base text-muted-foreground font-medium">{campaignName}</p>
              )}
              {link?.campaigns?.description && (
                <p className="text-sm text-muted-foreground pt-2">{link.campaigns.description}</p>
              )}
            </div>

            <Button size="lg" className="w-full" onClick={() => setDialogOpen(true)}>
              Quero participar
            </Button>

            <p className="text-xs text-muted-foreground">
              Deixe seus dados e a {branding?.company_name || "marca"} entra em contato.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quase lá! ✨</DialogTitle>
            <DialogDescription>
              Preencha seus dados para garantir os benefícios da indicação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label htmlFor="lead_name2">Nome</Label>
              <Input id="lead_name2" {...register("lead_name")} autoFocus />
              {errors.lead_name && <p className="text-xs text-destructive mt-1">{errors.lead_name.message}</p>}
            </div>
            <div>
              <Label htmlFor="lead_email2">Email</Label>
              <Input id="lead_email2" type="email" {...register("lead_email")} />
              {errors.lead_email && <p className="text-xs text-destructive mt-1">{errors.lead_email.message}</p>}
            </div>
            <div>
              <Label htmlFor="lead_phone2">WhatsApp (opcional)</Label>
              <Input id="lead_phone2" placeholder="(11) 99999-9999" {...register("lead_phone")} />
              {errors.lead_phone && <p className="text-xs text-destructive mt-1">{errors.lead_phone.message}</p>}
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
