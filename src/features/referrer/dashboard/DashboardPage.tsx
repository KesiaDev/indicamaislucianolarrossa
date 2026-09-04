import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HeroSkeleton, CardGridSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { TierBadge } from "@/components/shared/TierBadge";
import { RewardCard } from "@/components/shared/RewardCard";
import { ProgressRing } from "./ProgressRing";
import { CampaignPrizes } from "@/components/shared/CampaignPrizes";
import { celebrate } from "@/lib/celebrate";
import { useBranding } from "@/hooks/useBranding";
import {
  Share2,
  MousePointerClick,
  Inbox,
  CheckCircle2,
  Gift,
  Megaphone,
} from "lucide-react";
import { tierColorFor } from "@/lib/tiers";

interface DashboardData {
  profile?: any;
  summary?: any;
  next_tier?: {
    id: string;
    name: string;
    min_points: number;
    color: string;
    icon?: string;
    points_to_go: number;
  } | null;
  current_tier?: {
    id: string;
    name: string;
    min_points: number;
    color: string;
    icon?: string;
  } | null;
  campaigns?: Array<{
    id: string;
    name: string;
    status: string;
    clicks?: number;
    referrals?: number;
    conversions?: number;
    next_reward?: { progress: number; target: number; reward_description: string } | null;
  }>;
  recent_rewards?: Array<{
    id: string;
    reward_description: string;
    status: "pending" | "approved" | "paid" | "rejected";
    unlocked_at: string;
  }>;
}

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: branding } = useBranding();

  const { data, isLoading } = useQuery({
    queryKey: ["referrer-dashboard", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data: rpc, error } = await supabase.rpc("get_referrer_dashboard");
      if (error) {
        toast.error("Erro ao carregar dashboard");
        throw error;
      }
      const d = (rpc as any) as DashboardData;
      const ids = (d?.campaigns ?? []).map((c) => c.id);
      const slugMap: Record<string, string> = {};
      if (ids.length) {
        const { data: rows } = await supabase
          .from("campaigns")
          .select("id,slug")
          .in("id", ids);
        (rows ?? []).forEach((r: any) => {
          slugMap[r.id] = r.slug;
        });
      }
      return { dash: d, slugMap };
    },
  });

  const dash = data?.dash;
  const slugMap = data?.slugMap ?? {};

  // Confete novo prêmio
  useEffect(() => {
    if (!dash?.recent_rewards?.length) return;
    const KEY = "referrer.lastSeenRewards";
    const lastSeen = localStorage.getItem(KEY);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
    const hasNew = dash.recent_rewards.some((r) => new Date(r.unlocked_at) > lastSeenDate);
    if (hasNew && lastSeen) {
      setTimeout(() => {
        celebrate("reward");
        toast.success("🎉 Você desbloqueou um novo prêmio!");
      }, 400);
    }
    localStorage.setItem(KEY, new Date().toISOString());
  }, [dash]);

  const points = profile?.total_points ?? 0;
  const current = dash?.current_tier ?? null;
  const next = dash?.next_tier ?? null;
  const progressToNext = useMemo(() => {
    if (!next) return 100;
    const min = current?.min_points ?? 0;
    const span = next.min_points - min;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, ((points - min) / span) * 100));
  }, [points, current, next]);

  const firstName = (profile?.full_name || profile?.email || "").split(" ")[0];
  const tierRingColor = current ? tierColorFor(current.name, current.color) : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HeroSkeleton />
        <CardGridSkeleton count={2} columns="" />
      </div>
    );
  }

  const campaigns = (dash?.campaigns ?? []).filter((c) => c.status === "active");
  const rewards = (dash?.recent_rewards ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-0 shadow-card rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-secondary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Avatar
                className="h-20 w-20 border-2 border-background shadow"
                style={tierRingColor ? { boxShadow: `0 0 0 4px ${tierRingColor}` } : undefined}
              >
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback
                  className="text-xl"
                  style={tierRingColor ? { backgroundColor: tierRingColor, color: "#fff" } : undefined}
                >
                  {initials(profile?.full_name, profile?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">
                  {branding?.heroTitle?.replace(/\{\{nome\}\}/gi, firstName) ||
                    `${greeting()}, ${firstName}! 👋`}
                </h2>
                {branding?.heroSubtitle && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {branding.heroSubtitle.replace(/\{\{nome\}\}/gi, firstName)}
                  </p>
                )}
                {current && (
                  <div className="mt-1.5">
                    <TierBadge
                      name={current.name}
                      icon={current.icon}
                      fallbackColor={current.color}
                      size="md"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold tabular-nums">{points}</span>
              <span className="text-sm text-muted-foreground font-medium">pontos</span>
            </div>

            {next ? (
              <>
                <Progress
                  value={progressToNext}
                  className="mb-2 h-3 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-accent"
                />
                <p className="text-xs text-muted-foreground font-medium">
                  {next.points_to_go <= 10
                    ? `Falta só ${next.points_to_go} pra virar ${next.name}! 🚀`
                    : `Faltam ${next.points_to_go} pontos pra virar ${next.name} 💪`}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-primary">Tier máximo atingido! 👑</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Campanhas */}
      <section>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Campanhas ativas
        </h3>
        {campaigns.length === 0 ? (
          <Card className="rounded-2xl shadow-card">
            <CardContent className="p-6">
              <EmptyState
                icon={Megaphone}
                title="Nada rolando agora 👀"
                description="Fica de olho — novas campanhas vêm por aí!"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((c, i) => {
              const slug = slugMap[c.id];
              const nr = c.next_reward;
              const remaining = nr ? Math.max(0, nr.target - nr.progress) : null;
              const motivational = !nr
                ? "Compartilhe e comece a ganhar! 🚀"
                : remaining === 0
                  ? "Recompensa desbloqueada! 🎉"
                  : remaining === 1
                    ? `Falta só 1 indicação${nr.reward_description ? ` pra ganhar ${nr.reward_description}` : ""}! 🎁`
                    : remaining! <= 3
                      ? `Faltam ${remaining}! Você tá voando 🚀`
                      : `Faltam ${remaining} indicações${nr.reward_description ? ` pra ganhar ${nr.reward_description}` : ""} 🎁`;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                >
                  <Card className="rounded-2xl shadow-card overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold truncate">{c.name}</h4>
                        <Badge variant="secondary" className="capitalize">
                          {c.status}
                        </Badge>
                      </div>
                      {nr && (
                        <div className="flex justify-center mb-4">
                          <ProgressRing progress={nr.progress} target={nr.target} label="amigos" />
                        </div>
                      )}
                      <p className="text-sm text-center font-medium mb-4">{motivational}</p>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          size="lg"
                          className="w-full min-h-[52px] shadow-glow-primary text-base"
                          onClick={() => slug && navigate(`/app/share/${slug}`)}
                          disabled={!slug}
                        >
                          <Share2 className="h-5 w-5 mr-2" /> Compartilhar
                        </Button>
                      </motion.div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary/10">
                          <MousePointerClick className="h-4 w-4 text-secondary" />
                          <span className="text-sm font-bold">{c.clicks ?? 0}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">cliques</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-accent/15">
                          <Inbox className="h-4 w-4 text-accent-foreground" />
                          <span className="text-sm font-bold">{c.referrals ?? 0}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">indicações</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-primary/10">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold">{c.conversions ?? 0}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">amigos</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <CampaignPrizes
                    campaignId={c.id}
                    conversions={c.conversions ?? 0}
                    limit={3}
                    className="mt-3"
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recompensas recentes */}
      {rewards.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Recompensas recentes
          </h3>
          <div className="grid gap-3">
            {rewards.map((r, i) => (
              <RewardCard
                key={r.id}
                description={r.reward_description}
                status={r.status}
                unlockedAt={r.unlocked_at}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
