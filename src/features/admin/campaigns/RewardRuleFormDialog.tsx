import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z
  .object({
    name: z.string().trim().min(3, "Mínimo 3 caracteres").max(100),
    trigger_count: z.coerce.number().int().min(1, "Mínimo 1"),
    reward_type: z.enum(["cash", "discount", "gift_card", "product"]),
    reward_value: z.coerce.number().min(0).optional().nullable(),
    reward_description: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
    points_per_conversion: z.coerce.number().int().min(0).default(10),
    is_recurring: z.boolean().default(true),
  })
  .refine(
    (v) => !["cash", "discount"].includes(v.reward_type) || (v.reward_value != null && v.reward_value > 0),
    { message: "Valor obrigatório para dinheiro/desconto", path: ["reward_value"] },
  );

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  onSaved?: () => void;
}

export function RewardRuleFormDialog({ open, onOpenChange, campaignId, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      trigger_count: 1,
      reward_type: "discount",
      reward_value: 0,
      reward_description: "",
      points_per_conversion: 10,
      is_recurring: true,
    },
  });

  useEffect(() => {
    if (open) form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rewardType = form.watch("reward_type");
  const showValue = rewardType === "cash" || rewardType === "discount";
  const valueSuffix = rewardType === "cash" ? "R$" : rewardType === "discount" ? "%" : "";

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.from("reward_rules").insert({
      campaign_id: campaignId,
      name: values.name,
      trigger_count: values.trigger_count,
      reward_type: values.reward_type,
      reward_value: showValue ? values.reward_value ?? null : null,
      reward_description: values.reward_description,
      points_per_conversion: values.points_per_conversion,
      is_recurring: values.is_recurring,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Regra adicionada");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar regra de recompensa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Cupom 50% a cada 5 indicações" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="trigger_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A cada N conversões</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="points_per_conversion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pontos / conversão</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reward_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de recompensa</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="discount">Desconto</SelectItem>
                      <SelectItem value="gift_card">Gift card</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showValue && (
              <FormField
                control={form.control}
                name="reward_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor ({valueSuffix})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="reward_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Input placeholder="Ex.: Cupom 50% OFF" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="text-sm">Recorrente</FormLabel>
                    <p className="text-xs text-muted-foreground">A cada N conversões libera uma nova recompensa</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Adicionar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
