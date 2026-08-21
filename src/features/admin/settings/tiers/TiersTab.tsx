import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertTriangle } from "lucide-react";
import { TierRow } from "./TierRow";
import { TierFormDialog } from "./TierFormDialog";

type Tier = {
  id: string;
  name: string;
  min_points: number;
  color: string;
  icon: string | null;
  perks: string[] | null;
  sort_order: number;
};

export function TiersTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);

  const tiersQuery = useQuery({
    queryKey: ["loyalty_tiers"],
    queryFn: async () => {
      const [tiersRes, profilesRes] = await Promise.all([
        supabase
          .from("loyalty_tiers")
          .select("id, name, min_points, color, icon, perks, sort_order"),
        supabase.from("profiles").select("tier_id"),
      ]);
      if (tiersRes.error) throw tiersRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const counts = new Map<string, number>();
      for (const p of profilesRes.data ?? []) {
        if (p.tier_id) counts.set(p.tier_id, (counts.get(p.tier_id) ?? 0) + 1);
      }

      const sorted = ((tiersRes.data ?? []) as Tier[]).sort(
        (a, b) => a.min_points - b.min_points,
      );

      return { tiers: sorted, counts };
    },
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: Tier) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const tiers = tiersQuery.data?.tiers ?? [];
  const counts = tiersQuery.data?.counts ?? new Map<string, number>();
  const hasZeroTier = tiers.some((t) => t.min_points === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Níveis de fidelidade</h3>
          <p className="text-sm text-muted-foreground">
            Defina os tiers que os indicadores conquistam ao acumular pontos.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo tier
        </Button>
      </div>

      {!tiersQuery.isLoading && tiers.length > 0 && !hasZeroTier && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Adicione um tier inicial com 0 pontos, senão indicadores novos ficarão sem tier.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {tiersQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : tiers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border rounded-lg">
            Nenhum tier cadastrado. Crie o primeiro nível para começar.
          </div>
        ) : (
          tiers.map((t, i) => (
            <TierRow
              key={t.id}
              tier={t}
              nextMinPoints={tiers[i + 1]?.min_points ?? null}
              indicatorsCount={counts.get(t.id) ?? 0}
              onEdit={() => openEdit(t)}
            />
          ))
        )}
      </div>

      <TierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tier={editing}
        allTiers={tiers}
      />
    </div>
  );
}
