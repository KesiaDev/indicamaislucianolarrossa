import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { KpiCard } from "@/components/shared/KpiCard";
import { ShareButton } from "@/components/shared/ShareButton";
import { CampaignPrizes } from "@/components/shared/CampaignPrizes";
import { celebrate, vibrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import {
  Copy,
  Check,
  Share2,
  ShoppingBag,
  Gift,
  MessageCircle,
  MousePointerClick,
  Inbox,
  CheckCircle2,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  slug: string;
  pre_written_message: string | null;
  landing_page_url: string | null;
  status: string;
}

interface ReferralLink {
  id: string;
  code: string;
  clicks_count: number;
}

interface Variant {
  id: string;
  label: string | null;
  content: string;
}

export default function SharePage() {
  const { campaignSlug } = useParams();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [link, setLink] = useState<ReferralLink | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ clicks: 0, referrals: 0, conversions: 0 });
  const canShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!campaignSlug || !profile) return;
      setLoading(true);
      const { data: c } = await supabase
        .from("campaigns")
        .select("id,name,slug,pre_written_message,landing_page_url,status")
        .eq("slug", campaignSlug)
        .maybeSingle();
      if (cancelled) return;
      if (!c || c.status !== "active") {
        setCampaign(null);
        setLoading(false);
        return;
      }
      setCampaign(c as Campaign);

      const [{ data: l, error }, { data: vs }] = await Promise.all([
        supabase.rpc("ensure_referral_link", { _campaign_id: c.id }),
        supabase
          .from("campaign_message_variants")
          .select("id, label, content")
          .eq("campaign_id", c.id)
          .eq("is_active", true)
          .order("created_at"),
      ]);
      if (cancelled) return;
      if (error || !l) {
        toast.error("Erro ao gerar link");
        setLoading(false);
        return;
      }
      const linkRow = (l as any) as ReferralLink;
      setLink(linkRow);
      const vlist = (vs ?? []) as Variant[];
      setVariants(vlist);
      setSelectedVariantId(vlist[0]?.id ?? null);

      const [{ count: refTotal }, { count: convTotal }] = await Promise.all([
        supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .eq("referrer_id", profile.id),
        supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .eq("referrer_id", profile.id)
          .eq("status", "converted"),
      ]);
      if (cancelled) return;
      setStats({
        clicks: linkRow.clicks_count ?? 0,
        referrals: refTotal ?? 0,
        conversions: convTotal ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignSlug, profile]);

  if (loading) return <Loading />;
  if (!campaign || !link) {
    return (
      <EmptyState
        icon={Share2}
        title="Campanha indisponível"
        description="Esta campanha não está ativa ou não foi encontrada."
      />
    );
  }

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const fullUrl = `${window.location.origin}/r/${link.code}${selectedVariantId ? `?v=${selectedVariantId}` : ""}`;
  const message =
    selectedVariant?.content ||
    campaign.pre_written_message ||
    "Olha esse achado, vai te interessar!";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      celebrate("share");
      vibrate(10);
      toast.success("Link copiado! 🎉");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message + " " + fullUrl)}`;
    window.open(url, "_blank");
    vibrate(10);
    toast.success("Boa! Compartilhado no WhatsApp 💚");
  };

  const handleNativeShare = async () => {
    try {
      await (navigator as any).share({ title: campaign.name, text: message, url: fullUrl });
      vibrate(10);
      toast.success("Compartilhado! 🚀");
    } catch {
      /* utilizador cancelou */
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold">Bora compartilhar e ganhar! 🚀</h2>
        <p className="text-sm text-muted-foreground mt-1 font-medium">{campaign.name}</p>
      </motion.div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-0 shadow-card rounded-2xl bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15">
          <CardContent className="p-6 space-y-5">
            <div className="flex justify-center">
              <div className="rounded-xl bg-background shadow-card p-4">
                <QRCodeSVG
                  value={fullUrl}
                  size={180}
                  bgColor="transparent"
                  fgColor="hsl(var(--foreground))"
                />
              </div>
            </div>

            <div className="bg-secondary/10 rounded-xl p-3 flex items-center gap-2">
              <code className="font-mono text-sm sm:text-base flex-1 truncate text-foreground">
                {fullUrl}
              </code>
              <Button
                onClick={handleCopy}
                variant="default"
                size="icon"
                className="shrink-0 shadow-glow-primary"
                aria-label="Copiar link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div
              className={`grid gap-3 ${canShare ? "grid-cols-3" : "grid-cols-2"}`}
            >
              <ShareButton
                icon={MessageCircle}
                label="WhatsApp"
                tone="whatsapp"
                onClick={handleWhatsApp}
              />
              <ShareButton
                icon={copied ? Check : Copy}
                label={copied ? "Copiado!" : "Copiar"}
                tone="copy"
                onClick={handleCopy}
              />
              {canShare && (
                <ShareButton
                  icon={Share2}
                  label="Compartilhar"
                  tone="native"
                  onClick={handleNativeShare}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Variantes de mensagem */}
      {variants.length > 0 && (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div>
              <h3 className="font-bold text-base">Sua mensagem ✍️</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha o tom que mais combina com você.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                    selectedVariantId === v.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border text-muted-foreground",
                  )}
                >
                  {v.label || "Mensagem"}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              {message}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="cliques" value={stats.clicks} icon={MousePointerClick} tone="secondary" />
        <KpiCard label="indicações" value={stats.referrals} icon={Inbox} tone="accent" />
        <KpiCard label="amigos" value={stats.conversions} icon={CheckCircle2} tone="success" />
      </div>

      {/* Prémios da campanha */}
      <CampaignPrizes campaignId={campaign.id} conversions={stats.conversions} />

      {/* Tutorial */}
      <Card className="shadow-card rounded-2xl">
        <CardContent className="p-5">
          <h3 className="font-bold mb-4 text-lg">Como funciona? 💡</h3>
          <div className="space-y-4">
            {[
              {
                n: 1,
                icon: Share2,
                title: "Compartilhe seu link",
                desc: "Envie pra galera no WhatsApp ou redes sociais.",
              },
              {
                n: 2,
                icon: ShoppingBag,
                title: "Seu amigo compra",
                desc: "Quando ele comprar pelo seu link, a gente conta na hora.",
              },
              {
                n: 3,
                icon: Gift,
                title: "Você ganha o prêmio",
                desc: "Bate a meta da campanha e desbloqueia a recompensa.",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 shadow-glow-primary">
                    {s.n}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {s.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
