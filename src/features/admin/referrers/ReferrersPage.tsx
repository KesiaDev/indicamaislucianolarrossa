import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loading } from "@/components/shared/Loading";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Users, Ban } from "lucide-react";
import { formatBRT, formatBRTDate } from "@/lib/datetime";
import { toast } from "sonner";

type Tier = { id: string; name: string; color: string; icon: string | null };
type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  total_points: number;
  created_at: string;
  tier_id: string | null;
  loyalty_tiers: Tier | null;
};
type Referral = {
  id: string;
  status: string;
  lead_name: string | null;
  lead_email: string | null;
  created_at: string;
};
type RewardRow = {
  id: string;
  status: string;
  reward_description: string;
  unlocked_at: string;
};

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function ReferrersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search, 300);
  const [tierFilter, setTierFilter] = useState<string>("all");

  // invite dialog
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  // drawer state
  const [selected, setSelected] = useState<Profile | null>(null);

  const tiersQuery = useQuery({
    queryKey: ["admin-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("id, name, color, icon")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
    staleTime: 5 * 60_000,
  });

  const referrersQuery = useQuery({
    queryKey: ["admin-referrers", dSearch, tierFilter] as const,
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, total_points, created_at, tier_id, loyalty_tiers(id, name, color, icon)",
        )
        .eq("role", "referrer")
        .order("created_at", { ascending: false });
      if (tierFilter !== "all") q = q.eq("tier_id", tierFilter);
      if (dSearch.trim()) {
        const s = `%${dSearch.trim()}%`;
        q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Profile[];
    },
  });

  const convQuery = useQuery({
    queryKey: ["admin-referrers-conv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("referrer_id")
        .eq("status", "converted");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.referrer_id] = (map[r.referrer_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const tiers = tiersQuery.data ?? [];
  const list = referrersQuery.data ?? [];
  const convMap = convQuery.data ?? {};
  const loading = referrersQuery.isLoading;

  // Drawer details query (only fires when a referrer is selected)
  const drawerQuery = useQuery({
    queryKey: ["admin-referrer-detail", selected?.id, selected?.email] as const,
    enabled: !!selected,
    queryFn: async () => {
      const p = selected!;
      const [{ data: refs }, { data: rwds }, { data: blk }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, status, lead_name, lead_email, created_at")
          .eq("referrer_id", p.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("rewards")
          .select("id, status, reward_description, unlocked_at")
          .eq("referrer_id", p.id)
          .order("unlocked_at", { ascending: false })
          .limit(20),
        supabase.from("fraud_blocklist").select("id").eq("email", p.email).limit(1),
      ]);
      return {
        referrals: (refs ?? []) as Referral[],
        rewards: (rwds ?? []) as RewardRow[],
        banned: (blk ?? []).length > 0,
      };
    },
  });

  const referrals = drawerQuery.data?.referrals ?? [];
  const rewards = drawerQuery.data?.rewards ?? [];
  const banned = drawerQuery.data?.banned ?? false;
  const drawerLoading = drawerQuery.isLoading && !!selected;

  const inviteMut = useMutation({
    mutationFn: async () => {
      if (!inviteEmail) throw new Error("Informe o e-mail");
      // Garante sessão válida (renova o token se estiver expirado)
      const { data: sess } = await supabase.auth.getSession();
      let token = sess.session?.access_token;
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token;
      }
      if (!token) throw new Error("Sessão expirada. Entra novamente para convidar.");
      const { data, error } = await supabase.functions.invoke("invite-referrer", {
        body: { email: inviteEmail, full_name: inviteName || null },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        // Tenta extrair payload JSON do erro retornado pela edge function
        const ctx: any = (error as any).context;
        let payload: any = null;
        try { payload = await ctx?.json?.(); } catch { /* noop */ }
        const code = payload?.error;
        if (code === "resend_not_configured") {
          const err = new Error(payload?.message || "Resend não configurado");
          (err as any).code = code;
          throw err;
        }
        throw new Error(payload?.message || payload?.error || error.message);
      }
      if ((data as any)?.error === "resend_not_configured") {
        const err = new Error((data as any).message || "Resend não configurado");
        (err as any).code = "resend_not_configured";
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Convite enviado", { description: inviteEmail });
      setOpen(false);
      setInviteEmail("");
      setInviteName("");
      qc.invalidateQueries({ queryKey: ["admin-referrers"] });
    },
    onError: (e: any) => {
      if (e?.code === "resend_not_configured") {
        toast.error("Resend não configurado", {
          description: e.message,
          action: {
            label: "Configurar agora",
            onClick: () => { window.location.href = "/admin/settings"; },
          },
        });
        return;
      }
      toast.error("Erro ao convidar", { description: e?.message });
    },
  });

  const banMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("fraud_blocklist").insert({
        email: selected.email,
        reason: "banido pelo admin",
        blocked_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicador banido");
      qc.invalidateQueries({ queryKey: ["admin-referrer-detail", selected?.id] });
    },
    onError: (e: any) => toast.error("Erro ao banir", { description: e?.message }),
  });

  const initials = useMemo(() => {
    if (!selected) return "";
    const src = selected.full_name || selected.email;
    return src
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
  }, [selected]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Indicadores</h2>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Convidar indicador
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="sm:max-w-[200px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tiers</SelectItem>
            {tiers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum indicador" description="Convide indicadores para começarem a divulgar." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(p)}
                >
                  <TableCell className="font-medium">{p.full_name || "(sem nome)"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    {p.loyalty_tiers ? (
                      <Badge
                        style={{ backgroundColor: p.loyalty_tiers.color, color: "white" }}
                      >
                        {p.loyalty_tiers.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{p.total_points}</TableCell>
                  <TableCell className="text-right">{convMap[p.id] ?? 0}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatBRTDate(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar indicador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending}>
              {inviteMut.isPending ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do indicador</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{selected.full_name || "(sem nome)"}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p>{selected.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pontos</p>
                  <p className="font-medium">{selected.total_points}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tier</p>
                  {selected.loyalty_tiers ? (
                    <Badge style={{ backgroundColor: selected.loyalty_tiers.color, color: "white" }}>
                      {selected.loyalty_tiers.name}
                    </Badge>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p>{formatBRTDate(selected.created_at)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Indicações recentes</h4>
                {drawerLoading ? (
                  <Loading />
                ) : referrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem indicações.</p>
                ) : (
                  <ol className="relative border-l border-border ml-3 space-y-3">
                    {referrals.map((r) => (
                      <li key={r.id} className="ml-4">
                        <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-muted ring-4 ring-background" />
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{r.lead_name || r.lead_email || "—"}</p>
                          <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                        </div>
                        <time className="text-xs text-muted-foreground">{formatBRT(r.created_at)}</time>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Prêmios</h4>
                {drawerLoading ? null : rewards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem prêmios.</p>
                ) : (
                  <ul className="divide-y">
                    {rewards.map((r) => (
                      <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{r.reward_description}</p>
                          <p className="text-xs text-muted-foreground">{formatBRT(r.unlocked_at)}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={banned} className="w-full">
                      <Ban className="h-4 w-4 mr-2" />
                      {banned ? "Indicador banido" : "Banir indicador"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Banir este indicador?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O e-mail será adicionado à lista de bloqueio e novas indicações desse e-mail serão recusadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => banMut.mutate()}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
