import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PodiumSkeleton, ListSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { TierBadge } from "@/components/shared/TierBadge";
import { LeaderboardRow } from "@/components/shared/LeaderboardRow";
import { Trophy, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RankRow {
  position: number | null;
  conversions_count: number;
  total_points: number;
  referrer_id: string;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    loyalty_tiers: { name: string; color: string; icon: string | null } | null;
  } | null;
}

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Medalhas SVG por posição
function Medal({ place }: { place: 1 | 2 | 3 }) {
  const colors: Record<number, [string, string, string]> = {
    1: ["#FFD700", "#FFB300", "#7A5A00"], // ouro
    2: ["#E0E0E0", "#A0A0A0", "#3A3A3A"], // prata
    3: ["#E89A5C", "#A55A1F", "#3E1F00"], // bronze
  };
  const [c1, c2, txt] = colors[place];
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12 drop-shadow" aria-hidden>
      <defs>
        <linearGradient id={`medal-${place}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="36" r="22" fill={`url(#medal-${place})`} stroke={c2} strokeWidth="2" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        fill={txt}
      >
        {place}
      </text>
    </svg>
  );
}

const PODIUM_HEIGHTS = ["h-28", "h-20", "h-16"];

export default function RankingPage() {
  const { profile } = useAuth();

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ranking", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_rankings")
        .select(
          "position,conversions_count,total_points,referrer_id, profiles!inner(full_name,email,avatar_url, loyalty_tiers(name,color,icon))",
        )
        .eq("year", year)
        .eq("month", month)
        .order("position", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as RankRow[];
    },
  });

  const me = rows.find((r) => r.referrer_id === profile?.id);
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as RankRow[];
  const podiumPlace = (r: RankRow): 1 | 2 | 3 =>
    ((top3.findIndex((x) => x.referrer_id === r.referrer_id) + 1) as 1 | 2 | 3);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold">Disputa do mês 🏆</h2>
        <p className="text-sm text-muted-foreground font-medium">
          Quem indica mais sobe no ranking. Bora subir!
        </p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABELS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 ml-auto">
                <Switch id="region-only" disabled />
                <Label
                  htmlFor="region-only"
                  className="text-xs text-muted-foreground cursor-not-allowed font-medium"
                >
                  Só minha região
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <PodiumSkeleton />
          <ListSkeleton rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Ranking ainda não disponível"
          description="O ranking deste mês será atualizado em breve. Continue indicando!"
        />
      ) : (
        <>
          {me && (
            <Card className="border-l-4 border-l-primary bg-primary/5 shadow-card rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-glow-primary">
                  #{me.position ?? "—"}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={me.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {initials(me.profiles?.full_name, me.profiles?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate flex items-center gap-1.5">
                    Sua posição
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold">
                      <Star className="h-3 w-3" /> você
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {me.conversions_count} amigos · {me.total_points} pts
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pódio */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              {podiumOrder.map((r) => {
                const place = podiumPlace(r);
                const idx = place - 1;
                const isMe = r.referrer_id === profile?.id;
                const tier = r.profiles?.loyalty_tiers;
                return (
                  <motion.div
                    key={r.referrer_id}
                    layout
                    layoutId={`podium-${r.referrer_id}`}
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.35, ease: "easeOut" }}
                    className={cn(
                      "flex flex-col",
                      idx === 0 ? "sm:order-2" : idx === 1 ? "sm:order-1" : "sm:order-3",
                    )}
                  >
                    <Card
                      className={cn(
                        "rounded-2xl border bg-gradient-to-br from-card to-muted/30 overflow-hidden",
                        place === 1 && "shadow-glow-accent border-accent/40",
                        place === 2 && "shadow-card",
                        place === 3 && "shadow-card",
                        isMe && "ring-2 ring-primary",
                      )}
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <Medal place={place} />
                        <Avatar
                          className={cn(
                            "ring-2 ring-background",
                            place === 1 ? "h-16 w-16" : "h-14 w-14",
                          )}
                        >
                          <AvatarImage src={r.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {initials(r.profiles?.full_name, r.profiles?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-bold text-sm truncate w-full">
                          {r.profiles?.full_name || r.profiles?.email}
                        </p>
                        {tier && (
                          <TierBadge name={tier.name} icon={tier.icon} fallbackColor={tier.color} />
                        )}
                        {isMe && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold">
                            <Star className="h-3 w-3" /> você
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground font-medium">
                          {r.conversions_count} amigos · {r.total_points} pts
                        </p>
                      </CardContent>
                    </Card>
                    <div
                      className={cn("hidden sm:block rounded-b-md mx-3", PODIUM_HEIGHTS[idx])}
                      style={{
                        background:
                          place === 1
                            ? "linear-gradient(180deg, hsl(var(--accent) / 0.4), hsl(var(--accent) / 0.1))"
                            : place === 2
                              ? "linear-gradient(180deg, #C0C0C066, #C0C0C01a)"
                              : "linear-gradient(180deg, #CD7F324d, #CD7F321a)",
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Restante */}
          {rest.length > 0 && (
            <Card className="rounded-2xl shadow-card">
              <CardContent className="p-2">
                <ul className="divide-y">
                  {rest.map((r, i) => (
                    <li key={r.referrer_id}>
                      <LeaderboardRow
                        position={r.position}
                        name={r.profiles?.full_name ?? ""}
                        email={r.profiles?.email}
                        avatarUrl={r.profiles?.avatar_url}
                        conversions={r.conversions_count}
                        points={r.total_points}
                        isMe={r.referrer_id === profile?.id}
                        tier={r.profiles?.loyalty_tiers ?? null}
                        index={i}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
