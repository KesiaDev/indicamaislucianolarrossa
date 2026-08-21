import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Megaphone,
  Users,
  CheckCircle2,
  Percent,
  Gift,
  UserCheck,
  Inbox,
} from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiRowSkeleton, TableSkeleton, ListSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { formatBRT } from "@/lib/datetime";
import { toast } from "sonner";

type Funnel = { pending: number; converted: number; expired: number; rejected: number };
type Kpis = {
  active_campaigns: number;
  total_referrers: number;
  total_conversions_mtd: number;
  conversion_rate: number;
  total_rewards_paid_mtd: number;
};
type CampPerf = {
  id: string;
  name: string;
  status: string;
  referrers: number;
  referrals: number;
  conversions: number;
  conversion_rate: number;
};
type TopRef = {
  referrer_id: string;
  full_name: string | null;
  email: string;
  conversions: number;
  points: number;
  position: number;
};
type Activity = { kind: "referral" | "reward"; id: string; status: string; ts: string };

const STATUS_COLORS: Record<keyof Funnel, string> = {
  pending: "hsl(45 93% 47%)",
  converted: "hsl(142 71% 45%)",
  expired: "hsl(220 9% 46%)",
  rejected: "hsl(0 72% 51%)",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendentes",
  converted: "Convertidas",
  expired: "Expiradas",
  rejected: "Rejeitadas",
};

const CAMP_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  draft: "secondary",
  paused: "outline",
  ended: "destructive",
};

export default function DashboardPage() {
  const { data: dash, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_dashboard");
      if (error) throw error;
      return data as any;
    },
  });

  if (error) {
    toast.error("Erro ao carregar dashboard", { description: (error as Error).message });
  }

  const kpis: Kpis | null = dash?.kpis ?? null;
  const funnel: Funnel | null = dash?.funnel ?? null;
  const camps: CampPerf[] = dash?.campaigns_performance ?? [];
  const top: TopRef[] = dash?.top_referrers ?? [];
  const recent: Activity[] = dash?.recent_activity ?? [];

  if (isLoading) {
    return (
      <>
        <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
        <div className="mb-8"><KpiRowSkeleton count={5} /></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TableSkeleton rows={4} cols={2} />
          <TableSkeleton rows={4} cols={6} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListSkeleton rows={6} />
          <ListSkeleton rows={6} />
        </div>
      </>
    );
  }

  const funnelData = funnel
    ? (Object.keys(STATUS_COLORS) as (keyof Funnel)[]).map((k) => ({
        status: STATUS_LABEL[k],
        key: k,
        value: funnel[k] ?? 0,
      }))
    : [];

  return (
    <>
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Campanhas ativas" value={kpis?.active_campaigns ?? 0} icon={Megaphone} />
        <KpiCard label="Indicadores" value={kpis?.total_referrers ?? 0} icon={Users} />
        <KpiCard label="Conversões (mês)" value={kpis?.total_conversions_mtd ?? 0} icon={CheckCircle2} />
        <KpiCard label="Taxa de conversão" value={`${kpis?.conversion_rate ?? 0}%`} icon={Percent} />
        <KpiCard label="Prêmios pagos (mês)" value={kpis?.total_rewards_paid_mtd ?? 0} icon={Gift} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader><CardTitle>Funil de indicações</CardTitle></CardHeader>
          <CardContent>
            {funnelData.every((d) => d.value === 0) ? (
              <EmptyState title="Sem dados" description="Ainda não há indicações registradas." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={12} width={90} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funnelData.map((d) => (
                        <Cell key={d.key} fill={STATUS_COLORS[d.key as keyof Funnel]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Performance por campanha</CardTitle></CardHeader>
          <CardContent>
            {camps.length === 0 ? (
              <EmptyState title="Nenhuma campanha" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Indic.</TableHead>
                      <TableHead className="text-right">Indica.</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {camps.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant={CAMP_STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.referrers}</TableCell>
                        <TableCell className="text-right">{c.referrals}</TableCell>
                        <TableCell className="text-right">{c.conversions}</TableCell>
                        <TableCell className="text-right">{c.conversion_rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Top 10 do mês</CardTitle></CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <EmptyState title="Sem ranking" description="Aguardando conversões deste mês." />
            ) : (
              <ul className="divide-y">
                {top.map((r) => {
                  const podium = r.position <= 3;
                  return (
                    <li key={r.referrer_id} className="flex items-center gap-3 py-2.5">
                      <Badge
                        variant={podium ? "default" : "secondary"}
                        className="min-w-10 justify-center"
                      >
                        #{r.position}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.full_name || r.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{r.conversions} conv.</p>
                        <p className="text-xs text-muted-foreground">{r.points} pts</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Atividade recente</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState icon={Inbox} title="Sem atividade" />
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4">
                {recent.map((a) => {
                  const Icon = a.kind === "referral" ? UserCheck : Gift;
                  return (
                    <li key={`${a.kind}-${a.id}`} className="ml-4">
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-4 ring-background">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                      </span>
                      <p className="text-sm">
                        {a.kind === "referral" ? "Indicação" : "Prêmio"}{" "}
                        <span className="text-muted-foreground">{a.status}</span>
                      </p>
                      <time className="text-xs text-muted-foreground">{formatBRT(a.ts)}</time>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
