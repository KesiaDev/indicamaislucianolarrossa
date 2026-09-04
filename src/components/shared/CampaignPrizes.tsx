import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/currency";
import {
  Gift,
  Percent,
  DollarSign,
  Package,
  Trophy,
  Lock,
  CheckCircle2,
  Repeat,
  type LucideIcon,
} from "lucide-react";

type RewardType = "cash" | "discount" | "gift_card" | "product";

interface Rule {
  id: string;
  name: string;
  trigger_count: number;
  reward_type: RewardType;
  reward_value: number | null;
  reward_description: string;
  points_per_conversion: number;
  is_recurring: boolean;
}

const TYPE_ICON: Record<RewardType, LucideIcon> = {
  cash: DollarSign,
  discount: Percent,
  gift_card: Gift,
  product: Package,
};

/** Regras com trigger muito alto são prémios atribuídos manualmente (ranking). */
const MANUAL_THRESHOLD = 9000;

function valueLabel(r: Rule): string | null {
  if (r.reward_value == null) return null;
  if (r.reward_type === "cash") return formatEUR(r.reward_value);
  if (r.reward_type === "discount") return `${Number(r.reward_value)}%`;
  return null;
}

interface Props {
  campaignId: string;
  /** Conversões já realizadas pelo aluno nesta campanha (para mostrar progresso). */
  conversions?: number;
  /** Mostra apenas os primeiros N prémios. */
  limit?: number;
  className?: string;
}

export function CampaignPrizes({ campaignId, conversions = 0, limit, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-prizes", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_rules")
        .select(
          "id,name,trigger_count,reward_type,reward_value,reward_description,points_per_conversion,is_recurring",
        )
        .eq("campaign_id", campaignId)
        .order("trigger_count");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  if (isLoading || !data?.length) return null;

  const rules = limit ? data.slice(0, limit) : data;

  return (
    <Card className={cn("shadow-card rounded-2xl", className)}>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> O que podes ganhar 🎁
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prémios desta campanha e o que falta para desbloquear cada um.
          </p>
        </div>

        <ul className="space-y-3">
          {rules.map((r, i) => {
            const Icon = TYPE_ICON[r.reward_type] ?? Gift;
            const manual = r.trigger_count >= MANUAL_THRESHOLD;
            const unlocked = !manual && conversions >= r.trigger_count;
            const remaining = Math.max(0, r.trigger_count - conversions);
            const pct = manual
              ? 0
              : Math.min(100, (conversions / Math.max(1, r.trigger_count)) * 100);
            const vl = valueLabel(r);
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  unlocked ? "border-success/40 bg-success/5" : "border-border bg-muted/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      unlocked ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
                    )}
                  >
                    {unlocked ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.name}</p>
                      {vl && (
                        <Badge variant="secondary" className="text-[10px]">
                          {vl}
                        </Badge>
                      )}
                      {r.is_recurring && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Repeat className="h-3 w-3" /> sempre
                        </Badge>
                      )}
                      {manual && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Trophy className="h-3 w-3" /> ranking mensal
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{r.reward_description}</p>

                    {!manual && (
                      <div className="mt-2 space-y-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {(() => {
                            const isSale = r.reward_type === "cash" || r.points_per_conversion >= 500;
                            const unit = isSale ? "venda" : "indicação";
                            const units = isSale ? "vendas" : "indicações";
                            return unlocked
                              ? "Desbloqueado! 🎉"
                              : remaining === 1
                                ? `Falta só 1 ${unit} 🚀`
                                : `Faltam ${remaining} ${units}`;
                          })()}
                          {r.points_per_conversion > 0 &&
                            ` · +${r.points_per_conversion} pontos por venda`}
                        </p>
                      </div>
                    )}
                    {manual && (
                      <p className="text-[11px] font-medium text-muted-foreground mt-2 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Atribuído no fecho do mês, conforme o ranking
                      </p>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
