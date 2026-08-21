import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loading } from "@/components/shared/Loading";
import { EmptyState } from "@/components/shared/EmptyState";
import { RewardCard } from "@/components/shared/RewardCard";
import { celebrate, vibrate } from "@/lib/celebrate";
import { Gift, Clock } from "lucide-react";

const COPIED_KEY = "rewards.copied";
const SEEN_KEY = "rewards.seen";

type Row = {
  id: string;
  status: "pending" | "approved" | "paid" | "rejected";
  reward_description: string;
  reward_type: "cash" | "discount" | "gift_card" | "product" | null;
  reward_value: number | null;
  redemption_code: string | null;
  unlocked_at: string;
  paid_at: string | null;
  notes: string | null;
  campaigns: { name: string } | null;
};

function getCopied(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(COPIED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function setCopiedSet(s: Set<string>) {
  localStorage.setItem(COPIED_KEY, JSON.stringify([...s]));
}

export default function RewardsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("rewards")
        .select(
          "id, status, reward_description, reward_type, reward_value, redemption_code, unlocked_at, paid_at, notes, campaigns(name)",
        )
        .eq("referrer_id", profile.id)
        .order("unlocked_at", { ascending: false });
      setRows((data ?? []) as any);
      setLoading(false);
    })();
  }, [profile]);

  // Marca como "vistos" todos approved ao abrir esta página
  useEffect(() => {
    if (loading) return;
    const approvedIds = rows.filter((r) => r.status === "approved").map((r) => r.id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(approvedIds));
    window.dispatchEvent(new Event("rewards-seen-updated"));
  }, [rows, loading]);

  const available = useMemo(
    () => rows.filter((r) => r.status === "approved" || r.status === "paid"),
    [rows],
  );
  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);

  const handleCopy = async (r: Row) => {
    if (!r.redemption_code) return;
    try {
      await navigator.clipboard.writeText(r.redemption_code);
      setJustCopied(r.id);
      setTimeout(() => setJustCopied(null), 2000);
      const copied = getCopied();
      const isFirst = !copied.has(r.id);
      if (isFirst) {
        copied.add(r.id);
        setCopiedSet(copied);
        celebrate("reward");
      }
      vibrate(10);
      toast.success("Código copiado! 🎁");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const renderCard = (r: Row, i: number) => (
    <RewardCard
      key={r.id}
      description={r.reward_description}
      status={r.status}
      type={r.reward_type ?? undefined}
      value={r.reward_value}
      campaignName={r.campaigns?.name}
      unlockedAt={r.unlocked_at}
      paidAt={r.paid_at}
      redemptionCode={r.redemption_code}
      notes={r.notes}
      index={i}
      onCopy={r.status === "approved" ? () => handleCopy(r) : undefined}
      copied={justCopied === r.id}
    />
  );

  if (loading) return <Loading />;

  const TabPill = ({ count }: { count: number }) => (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
      {count}
    </span>
  );

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold">Meus prêmios 🎁</h2>
        <p className="text-sm text-muted-foreground font-medium">
          Acompanhe e resgate suas recompensas.
        </p>
      </motion.div>

      <Tabs defaultValue="available">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="available">
            Disponíveis <TabPill count={available.length} />
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendentes <TabPill count={pending.length} />
          </TabsTrigger>
          <TabsTrigger value="all">
            Histórico <TabPill count={rows.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-3 mt-4">
          {available.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="Ainda nada por aqui"
              description="Bora compartilhar pra começar a desbloquear prêmios! 🚀"
            />
          ) : (
            available.map(renderCard)
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 ? (
            <EmptyState icon={Clock} title="Nenhum prêmio pendente" />
          ) : (
            pending.map(renderCard)
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="Sem histórico ainda"
              description="Comece compartilhando pra ver seus prêmios aqui!"
            />
          ) : (
            rows.map(renderCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
