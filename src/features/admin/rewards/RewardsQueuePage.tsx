import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatBRT } from "@/lib/datetime";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { Gift } from "lucide-react";
import { formatEUR } from "@/lib/currency";

type Status = "pending" | "approved" | "paid" | "rejected";
type Reward = {
  id: string;
  status: Status;
  reward_type: "cash" | "discount" | "gift_card" | "product";
  reward_value: number | null;
  reward_description: string;
  redemption_code: string | null;
  unlocked_at: string;
  notes: string | null;
  reward_rules: { name: string } | null;
  campaigns: { name: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  const buf = crypto.getRandomValues(new Uint8Array(6));
  return "RFR-" + Array.from(buf, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function formatValue(r: Reward) {
  if (r.reward_value == null) return "—";
  if (r.reward_type === "cash") return formatEUR(r.reward_value);
  if (r.reward_type === "discount") return `${r.reward_value}%`;
  return String(r.reward_value);
}

const rewardsKey = (tab: Status) => ["admin-rewards", tab] as const;

export default function RewardsQueuePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const query = useQuery({
    queryKey: rewardsKey(tab),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select(
          "id, status, reward_type, reward_value, reward_description, redemption_code, unlocked_at, notes, reward_rules(name), campaigns(name), profiles:referrer_id(full_name, email)",
        )
        .eq("status", tab)
        .order("unlocked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Reward[];
    },
  });

  const list = query.data ?? [];
  const loading = query.isLoading;

  const invalidateAll = () => {
    (["pending", "approved", "paid", "rejected"] as Status[]).forEach((s) =>
      qc.invalidateQueries({ queryKey: rewardsKey(s) }),
    );
    setSelected(new Set());
  };

  const approveMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const items = list.filter((r) => ids.includes(r.id));
      const now = new Date().toISOString();
      let ok = 0;
      for (const r of items) {
        const needsCode =
          (r.reward_type === "discount" || r.reward_type === "gift_card") && !r.redemption_code;
        const payload: any = { status: "approved", approved_at: now, approved_by: uid };
        if (needsCode) payload.redemption_code = genCode();
        const { error } = await supabase.from("rewards").update(payload).eq("id", r.id);
        if (error) toast.error("Falha ao aprovar", { description: error.message });
        else ok++;
      }
      return ok;
    },
    onSuccess: (ok) => {
      if (ok > 0) toast.success(`${ok} prêmio(s) aprovado(s)`);
      invalidateAll();
    },
  });

  const payMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("rewards")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} prêmio(s) marcado(s) como pago`);
      invalidateAll();
    },
    onError: (e: any) => toast.error("Erro", { description: e?.message }),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      const { error } = await supabase
        .from("rewards")
        .update({ status: "rejected", notes: reason })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} prêmio(s) rejeitado(s)`);
      setRejectOpen(false);
      setRejectReason("");
      invalidateAll();
    },
    onError: (e: any) => toast.error("Erro", { description: e?.message }),
  });

  const busy = approveMut.isPending || payMut.isPending || rejectMut.isPending;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(list.map((r) => r.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const submitReject = () => {
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    rejectMut.mutate({ ids: Array.from(selected), reason: rejectReason.trim() });
  };

  const allChecked = list.length > 0 && selected.size === list.length;
  const anySelected = selected.size > 0;

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6">Prêmios</h2>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Status);
          setSelected(new Set());
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="paid">Pagos</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
        </TabsList>
      </Tabs>

      {anySelected && (
        <div className="flex items-center gap-2 mb-3 p-3 rounded-md border bg-muted/40">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <div className="flex gap-2 ml-auto">
            {tab === "pending" && (
              <>
                <Button size="sm" onClick={() => approveMut.mutate(Array.from(selected))} disabled={busy}>
                  Aprovar selecionados
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                >
                  Rejeitar selecionados
                </Button>
              </>
            )}
            {tab === "approved" && (
              <Button size="sm" onClick={() => payMut.mutate(Array.from(selected))} disabled={busy}>
                Marcar como pago
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={tab === "rejected" ? 10 : 9} />
      ) : list.length === 0 ? (
        <EmptyState icon={Gift} title="Nenhum prêmio" description="Nada nesta fila no momento." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} />
                </TableHead>
                <TableHead>Desbloqueado</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Código</TableHead>
                {tab === "rejected" && <TableHead>Motivo</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(v) => toggleOne(r.id, !!v)}
                    />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatBRT(r.unlocked_at)}</TableCell>
                  <TableCell className="text-sm">
                    <p className="font-medium">{r.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.profiles?.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{r.campaigns?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.reward_rules?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{r.reward_description}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatValue(r)}</TableCell>
                  <TableCell className="text-xs">
                    {r.redemption_code ? <code>{r.redemption_code}</code> : "—"}
                  </TableCell>
                  {tab === "rejected" && (
                    <TableCell className="text-xs max-w-xs truncate">{r.notes ?? "—"}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar prêmios</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marcará os prêmios selecionados como rejeitados e o motivo será salvo no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explique o motivo (será salvo no histórico do prêmio)"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitReject}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
