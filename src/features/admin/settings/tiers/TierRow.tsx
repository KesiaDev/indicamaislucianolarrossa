import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/shared/TierBadge";
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
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Tier = {
  id: string;
  name: string;
  min_points: number;
  color: string;
  icon: string | null;
  perks: string[] | null;
  sort_order: number;
};

interface Props {
  tier: Tier;
  nextMinPoints: number | null;
  indicatorsCount: number;
  onEdit: () => void;
}

export function TierRow({ tier, nextMinPoints, indicatorsCount, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const qc = useQueryClient();

  const range =
    nextMinPoints === null
      ? `${tier.min_points.toLocaleString("pt-PT")}+ pts`
      : `${tier.min_points.toLocaleString("pt-PT")} – ${(nextMinPoints - 1).toLocaleString("pt-PT")} pts`;

  const perksCount = tier.perks?.length ?? 0;
  const canDelete = indicatorsCount === 0;

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loyalty_tiers").delete().eq("id", tier.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tier excluído");
      qc.invalidateQueries({ queryKey: ["loyalty_tiers"] });
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
        <div className="min-w-[120px]">
          <TierBadge name={tier.name} icon={tier.icon} fallbackColor={tier.color} size="md" />
        </div>
        <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Faixa</div>
            <div className="font-medium">{range}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Benefícios</div>
            <div className="font-medium">
              {perksCount} {perksCount === 1 ? "benefício" : "benefícios"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Indicadores</div>
            <div className="font-medium">{indicatorsCount}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tier "{tier.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {canDelete
                ? "Esta ação não pode ser desfeita."
                : `${indicatorsCount} ${indicatorsCount === 1 ? "indicador está" : "indicadores estão"} neste tier. Mude-os antes de excluir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (canDelete) del.mutate();
              }}
            >
              {del.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
