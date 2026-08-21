import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Megaphone, MoreVertical, Pause, Play, StopCircle, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { formatBRTDate } from "@/lib/datetime";
import { randomSlug } from "@/lib/slug";
import { CampaignFormDialog } from "./CampaignFormDialog";
import type { Database } from "@/types/supabase";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type Status = Database["public"]["Enums"]["campaign_status"];

interface Metrics { referrers: number; total: number; converted: number }

const statusVariant: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  draft: "secondary",
  paused: "outline",
  ended: "destructive",
};
const statusLabel: Record<Status, string> = {
  active: "Ativa", draft: "Rascunho", paused: "Pausada", ended: "Encerrada",
};

const CAMPAIGNS_KEY = ["admin-campaigns"] as const;
const METRICS_KEY = ["admin-campaigns-metrics"] as const;

export default function CampaignsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const campaignsQuery = useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const metricsQuery = useQuery({
    queryKey: METRICS_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_campaigns_with_metrics");
      if (error) throw error;
      const m = new Map<string, Metrics>();
      (data ?? []).forEach((row: any) => {
        m.set(row.campaign_id, {
          referrers: Number(row.referrers_count ?? 0),
          total: Number(row.total_count ?? 0),
          converted: Number(row.converted_count ?? 0),
        });
      });
      return m;
    },
  });

  const list = campaignsQuery.data ?? [];
  const metrics = metricsQuery.data ?? new Map<string, Metrics>();
  const loading = campaignsQuery.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    qc.invalidateQueries({ queryKey: METRICS_KEY });
  };

  const setStatusMut = useMutation({
    mutationFn: async ({ c, status }: { c: Campaign; status: Status }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", c.id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(`Campanha ${statusLabel[status].toLowerCase()}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const duplicateMut = useMutation({
    mutationFn: async (c: Campaign) => {
      const { data: created, error } = await supabase
        .from("campaigns")
        .insert({
          name: `${c.name} (cópia)`,
          slug: `${c.slug}-${randomSlug("copia")}`.slice(0, 60),
          description: c.description,
          landing_page_url: c.landing_page_url,
          pre_written_message: c.pre_written_message,
          starts_at: new Date().toISOString(),
          ends_at: null,
          status: "draft",
        })
        .select()
        .single();
      if (error || !created) throw error ?? new Error("Falha ao duplicar");
      const { data: rules } = await supabase.from("reward_rules").select("*").eq("campaign_id", c.id);
      if (rules && rules.length) {
        const inserts = rules.map((r) => ({
          campaign_id: created.id,
          name: r.name,
          trigger_count: r.trigger_count,
          reward_type: r.reward_type,
          reward_value: r.reward_value,
          reward_description: r.reward_description,
          points_per_conversion: r.points_per_conversion,
          is_recurring: r.is_recurring,
        }));
        await supabase.from("reward_rules").insert(inserts);
      }
    },
    onSuccess: () => {
      toast.success("Campanha duplicada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao duplicar"),
  });

  const removeMut = useMutation({
    mutationFn: async (c: Campaign) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha excluída");
      setDeleting(null);
      invalidate();
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Falha ao excluir");
      setDeleting(null);
    },
  });

  const cards = useMemo(() => list, [list]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Campanhas</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova campanha
        </Button>
      </div>

      {loading ? (
        <CardGridSkeleton count={4} columns="md:grid-cols-2" />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Crie sua primeira campanha para começar a indicar."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova campanha
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const m = metrics.get(c.id) ?? { referrers: 0, total: 0, converted: 0 };
            const rate = m.total > 0 ? Math.round((m.converted / m.total) * 100) : 0;
            return (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        <Badge variant={statusVariant[c.status as Status]}>{statusLabel[c.status as Status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatBRTDate(c.starts_at)} → {c.ends_at ? formatBRTDate(c.ends_at) : "sem fim"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status !== "active" && (
                          <DropdownMenuItem onClick={() => setStatusMut.mutate({ c, status: "active" })}>
                            <Play className="h-4 w-4 mr-2" /> Ativar
                          </DropdownMenuItem>
                        )}
                        {c.status === "active" && (
                          <DropdownMenuItem onClick={() => setStatusMut.mutate({ c, status: "paused" })}>
                            <Pause className="h-4 w-4 mr-2" /> Pausar
                          </DropdownMenuItem>
                        )}
                        {c.status !== "ended" && (
                          <DropdownMenuItem onClick={() => setStatusMut.mutate({ c, status: "ended" })}>
                            <StopCircle className="h-4 w-4 mr-2" /> Encerrar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => duplicateMut.mutate(c)}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(c)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center pb-3">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">Indicadores</p>
                    <p className="text-lg font-semibold">{m.referrers}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">Conversões</p>
                    <p className="text-lg font-semibold">{m.converted}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">Taxa</p>
                    <p className="text-lg font-semibold">{rate}%</p>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 mt-auto flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/admin/campaigns/${c.id}`)}>
                    Ver detalhes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
                    Editar
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente "{deleting?.name}" e suas regras. Indicações vinculadas podem impedir a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && removeMut.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
