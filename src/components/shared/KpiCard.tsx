import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "destructive" | "muted";

interface Props {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: string;
  /** Sinal do delta para colorização: 'up' verde, 'down' vermelho, undefined neutro */
  deltaTrend?: "up" | "down";
  className?: string;
}

const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  accent: "bg-accent/20 text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  deltaTrend,
  className,
}: Props) {
  const TrendIcon = deltaTrend === "up" ? ArrowUp : deltaTrend === "down" ? ArrowDown : null;
  const trendColor =
    deltaTrend === "up"
      ? "text-success"
      : deltaTrend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-muted/40 to-transparent shadow-card border rounded-xl",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{value}</p>
            {delta && (
              <p className={cn("text-xs mt-1.5 flex items-center gap-1 font-medium", trendColor)}>
                {TrendIcon && <TrendIcon className="h-3 w-3" />}
                <span>{delta}</span>
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                TONE_BG[tone],
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
