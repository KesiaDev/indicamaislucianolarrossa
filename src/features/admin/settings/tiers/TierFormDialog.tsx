import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TierBadge } from "@/components/shared/TierBadge";
import { TIER_PALETTE, tierIconMap } from "@/lib/tiers";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tier?: Tier | null;
  allTiers: Tier[];
}

const ICON_OPTIONS = Object.keys(tierIconMap);

export function TierFormDialog({ open, onOpenChange, tier, allTiers }: Props) {
  const isEdit = !!tier;
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("award");
  const [color, setColor] = useState("#6366f1");
  const [minPts, setMinPts] = useState("0");
  const [perks, setPerks] = useState<string[]>([""]);

  useEffect(() => {
    if (open) {
      setName(tier?.name ?? "");
      setIcon(tier?.icon ?? "award");
      setColor(tier?.color ?? "#6366f1");
      setMinPts(String(tier?.min_points ?? 0));
      setPerks(tier?.perks?.length ? [...tier.perks] : [""]);
    }
  }, [open, tier]);

  const canonicalKey = name.trim().toLowerCase();
  const canonicalColor = TIER_PALETTE[canonicalKey];
  const effectiveColor = canonicalColor ?? color;

  const save = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Informe o nome do tier");

      const points = Number(minPts);
      if (Number.isNaN(points) || points < 0) throw new Error("Pontos mínimos inválidos");

      // Uniqueness checks
      const others = allTiers.filter((t) => t.id !== tier?.id);
      if (others.some((t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        throw new Error("Já existe um tier com esse nome");
      }
      if (others.some((t) => t.min_points === points)) {
        throw new Error("Já existe um tier com esse número de pontos mínimos");
      }

      const cleanedPerks = perks.map((p) => p.trim()).filter(Boolean);
      const payload = {
        name: trimmedName,
        icon,
        color: effectiveColor,
        min_points: points,
        perks: cleanedPerks,
      };

      if (isEdit && tier) {
        const { error } = await supabase.from("loyalty_tiers").update(payload).eq("id", tier.id);
        if (error) throw error;
      } else {
        const nextOrder = (allTiers.at(-1)?.sort_order ?? 0) + 1;
        const { error } = await supabase
          .from("loyalty_tiers")
          .insert({ ...payload, sort_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tier atualizado" : "Tier criado");
      qc.invalidateQueries({ queryKey: ["loyalty_tiers"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updatePerk = (i: number, v: string) =>
    setPerks((arr) => arr.map((p, idx) => (idx === i ? v : p)));
  const removePerk = (i: number) =>
    setPerks((arr) => (arr.length === 1 ? [""] : arr.filter((_, idx) => idx !== i)));
  const addPerk = () => setPerks((arr) => [...arr, ""]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tier" : "Novo tier"}</DialogTitle>
          <DialogDescription>Configure o nível e os benefícios.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <TierBadge
            name={name || "Preview"}
            icon={icon}
            fallbackColor={effectiveColor}
            size="lg"
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ouro" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ícone</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((key) => {
                    const Icon = tierIconMap[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2 capitalize">
                          <Icon className="h-4 w-4" />
                          {key}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pontos mínimos</Label>
              <Input
                type="number"
                min={0}
                value={minPts}
                onChange={(e) => setMinPts(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Cor</Label>
            <Input
              type="color"
              value={effectiveColor}
              onChange={(e) => setColor(e.target.value)}
              disabled={!!canonicalColor}
              className="h-10 p-1"
            />
            {canonicalColor && (
              <p className="text-xs text-muted-foreground mt-1">
                Cor canônica aplicada automaticamente para "{name.trim()}".
              </p>
            )}
          </div>

          <div>
            <Label>Benefícios</Label>
            <div className="space-y-2">
              {perks.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p}
                    onChange={(e) => updatePerk(i, e.target.value)}
                    placeholder="Ex: 10% extra em todos os prêmios"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePerk(i)}
                    aria-label="Remover benefício"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addPerk}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar benefício
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
