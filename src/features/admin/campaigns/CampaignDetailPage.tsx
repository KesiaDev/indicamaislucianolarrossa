import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Target, Percent, UserCheck, CalendarIcon, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loading } from "@/components/shared/Loading";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatBRT, formatSP } from "@/lib/datetime";
import { formatEUR } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { CampaignFormDialog } from "./CampaignFormDialog";
import { RewardRuleFormDialog } from "./RewardRuleFormDialog";
import type { Database } from "@/types/supabase";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type Status = Database["public"]["Enums"]["campaign_status"];
type RewardRule = Database["public"]["Tables"]["reward_rules"]["Row"];
type ReferralStatus = Database["public"]["Enums"]["referral_status"];

const statusVariant: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", draft: "secondary", paused: "outline", ended: "destructive",
};
const statusLabel: Record<Status, string> = {
  active: "Ativa", draft: "Rascunho", paused: "Pausada", ended: "Encerrada",
};
const referralStatusLabel: Record<ReferralStatus, string> = {
  pending: "Pendente", converted: "Convertida", expired: "Expirada", rejected: "Rejeitada",
};
const referralStatusVariant: Record<ReferralStatus, "default" | "secondary" | "destructive" | "outline"> = {
  converted: "default", pending: "secondary", expired: "outline", rejected: "destructive",
};
const rewardTypeLabel: Record<string, string> = {
  cash: "Dinheiro", discount: "Desconto", gift_card: "Gift card", product: "Produto",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const loadCampaign = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (error) toast.error(error.message);
    setCampaign((data as Campaign) ?? null);
    setLoading(false);
  };

  useEffect(() => { loadCampaign(); }, [id]);

  const handleNotify = async () => {
    if (!campaign) return;
    setNotifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-campaign-launched", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;
      const dispatched = (data as any)?.dispatched ?? 0;
      const failed = (data as any)?.failed ?? 0;
      const total = (data as any)?.total_referrers ?? 0;
      toast.success(
        `Aviso enviado a ${dispatched}/${total} indicadores${failed ? ` (${failed} falha(s))` : ""}`,
      );
    } catch (e: any) {
      toast.error("Erro ao avisar indicadores: " + (e?.message ?? "desconhecido"));
    } finally {
      setNotifying(false);
      setNotifyOpen(false);
    }
  };

  if (loading) return <Loading />;
  if (!campaign) return <EmptyState title="Campanha não encontrada" />;

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-semibold truncate">{campaign.name}</h2>
            <Badge variant={statusVariant[campaign.status as Status]}>{statusLabel[campaign.status as Status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">/{campaign.slug}</p>
        </div>
        {campaign.status === "active" && (
          <Button variant="outline" onClick={() => setNotifyOpen(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Avisar indicadores
          </Button>
        )}
        <Button variant="outline" onClick={() => setEditOpen(true)}>Editar</Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="referrers">Indicadores</TabsTrigger>
          <TabsTrigger value="referrals">Indicações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RulesTab campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <MessagesTab campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="referrers" className="mt-4">
          <ReferrersTab campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="referrals" className="mt-4">
          <ReferralsTab campaignId={campaign.id} />
        </TabsContent>
      </Tabs>

      <CampaignFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={campaign}
        onSaved={loadCampaign}
      />

      <AlertDialog open={notifyOpen} onOpenChange={(o) => !notifying && setNotifyOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avisar todos os indicadores?</AlertDialogTitle>
            <AlertDialogDescription>
              Será enviada uma notificação por e-mail e WhatsApp (conforme as regras configuradas)
              para cada indicador registado, divulgando a campanha "{campaign.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleNotify} disabled={notifying}>
              {notifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar agora"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Tab 1: Overview ---------------- */
function OverviewTab({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ referrers: 0, total: 0, converted: 0 });
  const [series, setSeries] = useState<{ day: string; conversions: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 29);
      since.setHours(0, 0, 0, 0);

      const [{ data: refs }, { data: convs }] = await Promise.all([
        supabase.from("referrals").select("referrer_id, status").eq("campaign_id", campaignId),
        supabase.from("referrals").select("converted_at").eq("campaign_id", campaignId)
          .eq("status", "converted").gte("converted_at", since.toISOString()),
      ]);

      const referrers = new Set<string>();
      let total = 0, converted = 0;
      (refs ?? []).forEach((r: any) => {
        referrers.add(r.referrer_id);
        total += 1;
        if (r.status === "converted") converted += 1;
      });
      setKpis({ referrers: referrers.size, total, converted });

      const buckets = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        buckets.set(formatSP(d, "dd/MM"), 0);
      }
      (convs ?? []).forEach((c: any) => {
        if (!c.converted_at) return;
        const k = formatSP(c.converted_at, "dd/MM");
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      });
      setSeries(Array.from(buckets.entries()).map(([day, conversions]) => ({ day, conversions })));
      setLoading(false);
    })();
  }, [campaignId]);

  if (loading) return <Loading />;
  const rate = kpis.total > 0 ? Math.round((kpis.converted / kpis.total) * 100) : 0;
  const hasData = series.some((s) => s.conversions > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Indicadores únicos" value={kpis.referrers} icon={Users} />
        <KpiCard label="Indicações totais" value={kpis.total} icon={UserCheck} />
        <KpiCard label="Conversões" value={kpis.converted} icon={Target} />
        <KpiCard label="Taxa de conversão" value={`${rate}%`} icon={Percent} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Conversões — últimos 30 dias</CardTitle></CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyState title="Sem conversões no período" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="conversions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Tab 2: Rules ---------------- */
function RulesTab({ campaignId }: { campaignId: string }) {
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<RewardRule | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("reward_rules").select("*")
      .eq("campaign_id", campaignId).order("trigger_count");
    if (error) toast.error(error.message);
    setRules((data ?? []) as RewardRule[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [campaignId]);

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("reward_rules").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); setDeleting(null); return; }
    toast.success("Regra removida");
    setDeleting(null);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Regras de recompensa</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar regra
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading />
        ) : rules.length === 0 ? (
          <EmptyState title="Sem regras" description="Adicione regras para liberar prêmios automaticamente." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>A cada</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Pts/conv</TableHead>
                <TableHead>Recorrente</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.trigger_count}</TableCell>
                  <TableCell>{rewardTypeLabel[r.reward_type] ?? r.reward_type}</TableCell>
                  <TableCell>{r.reward_value ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.reward_description}</TableCell>
                  <TableCell>{r.points_per_conversion}</TableCell>
                  <TableCell>{r.is_recurring ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <RewardRuleFormDialog open={open} onOpenChange={setOpen} campaignId={campaignId} onSaved={load} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.name}" será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ---------------- Tab 3: Referrers ---------------- */
interface ReferrerRow {
  referrer_id: string;
  full_name: string | null;
  email: string;
  code: string;
  clicks: number;
  total: number;
  converted: number;
  points: number;
}

function ReferrersTab({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<ReferrerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: links }, { data: refs }, { data: rules }] = await Promise.all([
        supabase.from("referral_links")
          .select("referrer_id, code, clicks_count, profiles:referrer_id(full_name, email)")
          .eq("campaign_id", campaignId),
        supabase.from("referrals").select("referrer_id, status").eq("campaign_id", campaignId),
        supabase.from("reward_rules").select("points_per_conversion").eq("campaign_id", campaignId),
      ]);

      const avgPoints = rules && rules.length
        ? Math.round(rules.reduce((s: number, r: any) => s + (r.points_per_conversion ?? 0), 0) / rules.length)
        : 0;

      const stats = new Map<string, { total: number; converted: number }>();
      (refs ?? []).forEach((r: any) => {
        const cur = stats.get(r.referrer_id) ?? { total: 0, converted: 0 };
        cur.total += 1;
        if (r.status === "converted") cur.converted += 1;
        stats.set(r.referrer_id, cur);
      });

      const rs: ReferrerRow[] = (links ?? []).map((l: any) => {
        const s = stats.get(l.referrer_id) ?? { total: 0, converted: 0 };
        return {
          referrer_id: l.referrer_id,
          full_name: l.profiles?.full_name ?? null,
          email: l.profiles?.email ?? "",
          code: l.code,
          clicks: l.clicks_count ?? 0,
          total: s.total,
          converted: s.converted,
          points: s.converted * avgPoints,
        };
      }).sort((a, b) => b.converted - a.converted);

      setRows(rs);
      setLoading(false);
    })();
  }, [campaignId]);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState icon={Users} title="Nenhum indicador ainda" />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Indicações</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
              <TableHead className="text-right">Pontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.referrer_id}>
                <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="text-right">{r.clicks}</TableCell>
                <TableCell className="text-right">{r.total}</TableCell>
                <TableCell className="text-right">{r.converted}</TableCell>
                <TableCell className="text-right">{r.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Tab 4: Referrals ---------------- */
const PAGE_SIZE = 20;

function ReferralsTab({ campaignId }: { campaignId: string }) {
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>("all");
  const [emailQ, setEmailQ] = useState("");
  const [emailDeb, setEmailDeb] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setEmailDeb(emailQ.trim()), 300);
    return () => clearTimeout(t);
  }, [emailQ]);

  useEffect(() => { setPage(0); }, [statusFilter, emailDeb, from, to]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("referrals")
        .select("id, lead_name, lead_email, status, created_at, converted_at, conversion_value, referrer_id, profiles:referrer_id(full_name, email)", { count: "exact" })
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (emailDeb) q = q.ilike("lead_email", `%${emailDeb}%`);
      if (from) q = q.gte("created_at", from.toISOString());
      if (to) {
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      const start = page * PAGE_SIZE;
      q = q.range(start, start + PAGE_SIZE - 1);

      const { data, count: c, error } = await q;
      if (error) toast.error(error.message);
      setRows(data ?? []);
      setCount(c ?? 0);
      setLoading(false);
    })();
  }, [campaignId, statusFilter, emailDeb, from, to, page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="converted">Convertida</SelectItem>
              <SelectItem value="expired">Expirada</SelectItem>
              <SelectItem value="rejected">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar por email..." value={emailQ} onChange={(e) => setEmailQ(e.target.value)} />
          <DateFilter label="De" value={from} onChange={setFrom} />
          <DateFilter label="Até" value={to} onChange={setTo} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6"><Loading /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma indicação" description="Ajuste os filtros ou aguarde novas indicações." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead>Convertida</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.lead_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.lead_email ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{r.profiles?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.profiles?.email ?? ""}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={referralStatusVariant[r.status as ReferralStatus]}>
                      {referralStatusLabel[r.status as ReferralStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatBRT(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{formatBRT(r.converted_at)}</TableCell>
                  <TableCell className="text-right">
                    {r.conversion_value != null ? formatEUR(r.conversion_value) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {count > PAGE_SIZE && (
        <div className="p-3 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={cn(page === 0 && "pointer-events-none opacity-50", "cursor-pointer")}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive>
                  {page + 1} / {totalPages}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className={cn(page >= totalPages - 1 && "pointer-events-none opacity-50", "cursor-pointer")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          {value ? format(value, "dd/MM/yyyy") : <span>{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
        {value && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>Limpar</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Tab: Messages (variantes + performance) ---------------- */
interface VariantPerf {
  variant_id: string;
  label: string | null;
  content: string;
  is_active: boolean;
  clicks: number;
  referrals: number;
  conversions: number;
}

function MessagesTab({ campaignId }: { campaignId: string }) {
  const [rows, setRows] = useState<VariantPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)("get_variant_performance", { p_campaign_id: campaignId });
      if (error) toast.error(error.message);
      const list = ((data ?? []) as any[]).map((r) => ({
        variant_id: r.variant_id,
        label: r.label,
        content: r.content,
        is_active: r.is_active,
        clicks: Number(r.clicks ?? 0),
        referrals: Number(r.referrals ?? 0),
        conversions: Number(r.conversions ?? 0),
      }));
      setRows(list);
      setLoading(false);
    })();
  }, [campaignId]);

  if (loading) return <Loading />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sem variantes ainda"
        description="Crie variantes ao editar a campanha — você verá aqui o desempenho de cada uma."
      />
    );
  }

  // calcula a melhor por taxa de conversão sobre cliques
  const best = rows.reduce((acc, r) => {
    const rate = r.clicks > 0 ? r.conversions / r.clicks : 0;
    const accRate = acc && acc.clicks > 0 ? acc.conversions / acc.clicks : 0;
    return rate > accRate ? r : acc;
  }, rows[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desempenho por variante</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Indicações</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const rate = r.clicks > 0 ? Math.round((r.conversions / r.clicks) * 100) : 0;
              const isBest = r.variant_id === best?.variant_id && r.clicks > 0;
              return (
                <TableRow key={r.variant_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.label || "—"}</span>
                      {isBest && <Badge variant="default" className="text-[10px]">Top</Badge>}
                      {!r.is_active && <Badge variant="outline" className="text-[10px]">Off</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                  </TableCell>
                  <TableCell className="text-right">{r.clicks}</TableCell>
                  <TableCell className="text-right">{r.referrals}</TableCell>
                  <TableCell className="text-right">{r.conversions}</TableCell>
                  <TableCell className="text-right font-medium">{rate}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
