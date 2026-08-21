import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Percent,
  DollarSign,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  type LucideIcon,
} from "lucide-react";
import { formatBRT, formatBRTDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type RewardStatus = "pending" | "approved" | "paid" | "rejected";
export type RewardType = "cash" | "discount" | "gift_card" | "product";

interface Props {
  description: string;
  status: RewardStatus;
  type?: RewardType | null;
  value?: number | null;
  campaignName?: string | null;
  unlockedAt?: string | null;
  paidAt?: string | null;
  redemptionCode?: string | null;
  notes?: string | null;
  index?: number;
  onCopy?: () => void;
  copied?: boolean;
}

const STATUS_BORDER: Record<RewardStatus, string> = {
  pending: "border-l-warning",
  approved: "border-l-primary",
  paid: "border-l-success",
  rejected: "border-l-destructive",
};

const STATUS_BG: Record<RewardStatus, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  approved: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<RewardStatus, string> = {
  pending: "pendente",
  approved: "disponível",
  paid: "pago",
  rejected: "rejeitado",
};

const TYPE_ICON: Record<RewardType, LucideIcon> = {
  cash: DollarSign,
  discount: Percent,
  gift_card: Gift,
  product: Package,
};

export function RewardCard({
  description,
  status,
  type,
  value,
  campaignName,
  unlockedAt,
  paidAt,
  redemptionCode,
  notes,
  index = 0,
  onCopy,
  copied,
}: Props) {
  const StatusIcon =
    status === "pending"
      ? Clock
      : status === "paid"
        ? CheckCircle2
        : status === "rejected"
          ? XCircle
          : type
            ? TYPE_ICON[type]
            : Gift;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "border-l-4 shadow-card overflow-hidden",
          STATUS_BORDER[status],
          status === "approved" && "shadow-glow-primary",
          status === "pending" && "opacity-95",
        )}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center shrink-0",
                  STATUS_BG[status],
                )}
                aria-hidden
              >
                <StatusIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{description}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {campaignName ? `${campaignName} · ` : ""}
                  {unlockedAt ? formatBRT(unlockedAt) : ""}
                </p>
                {value != null && (
                  <p className="text-xs text-muted-foreground font-medium">
                    Valor: R$ {Number(value).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={
                status === "paid"
                  ? "default"
                  : status === "approved"
                    ? "secondary"
                    : status === "rejected"
                      ? "destructive"
                      : "outline"
              }
              className="shrink-0 capitalize"
            >
              {STATUS_LABEL[status]}
            </Badge>
          </div>

          {status === "approved" && redemptionCode && (
            <div className="rounded-lg bg-secondary/10 p-3 flex items-center gap-3">
              <code className="text-xl font-mono font-bold flex-1 truncate tracking-wider">
                {redemptionCode}
              </code>
              {onCopy && (
                <Button
                  size="sm"
                  onClick={onCopy}
                  className="shadow-glow-primary"
                  aria-label="Copiar código"
                >
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              )}
            </div>
          )}

          {status === "pending" && (
            <p className="text-xs text-muted-foreground font-medium">
              ⏳ Aguardando aprovação do gestor
            </p>
          )}

          {status === "paid" && (
            <div className="space-y-1">
              <p className="text-xs text-success font-semibold">
                ✓ Pago em {paidAt ? formatBRTDate(paidAt) : "—"}
              </p>
              {redemptionCode && (
                <code className="block text-sm font-mono text-muted-foreground">
                  {redemptionCode}
                </code>
              )}
            </div>
          )}

          {status === "rejected" && notes && (
            <p className="text-xs text-destructive font-medium">Motivo: {notes}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
