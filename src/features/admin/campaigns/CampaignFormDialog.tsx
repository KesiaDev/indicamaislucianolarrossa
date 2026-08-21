import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Sparkles, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import type { Database } from "@/types/supabase";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type Status = Database["public"]["Enums"]["campaign_status"];

const schema = z
  .object({
    name: z.string().trim().min(3, "Mínimo 3 caracteres").max(100),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen")
      .min(3)
      .max(60),
    description: z.string().max(500).optional().or(z.literal("")),
    landing_page_url: z
      .string()
      .trim()
      .max(500)
      .url("URL inválida")
      .optional()
      .or(z.literal("")),
    starts_at: z.date({ required_error: "Data de início obrigatória" }),
    ends_at: z.date().optional().nullable(),
    status: z.enum(["draft", "active", "paused", "ended"]),
  })
  .refine((v) => !v.ends_at || v.ends_at > v.starts_at, {
    message: "Fim deve ser após início",
    path: ["ends_at"],
  });

type FormValues = z.infer<typeof schema>;

interface VariantDraft {
  id?: string; // existing row id
  tempId: string; // for keys
  label: string;
  content: string;
  is_active: boolean;
  _deleted?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Campaign | null;
  onSaved?: () => void;
}

const newTempId = () => Math.random().toString(36).slice(2, 10);

export function CampaignFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { profile } = useAuth();
  const slugTouched = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ label: string; content: string; selected: boolean }[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      landing_page_url: "",
      starts_at: new Date(),
      ends_at: null,
      status: "draft",
    },
  });

  useEffect(() => {
    if (!open) return;
    slugTouched.current = !!editing;
    form.reset(
      editing
        ? {
            name: editing.name,
            slug: editing.slug,
            description: editing.description ?? "",
            landing_page_url: editing.landing_page_url ?? "",
            starts_at: new Date(editing.starts_at),
            ends_at: editing.ends_at ? new Date(editing.ends_at) : null,
            status: editing.status as Status,
          }
        : {
            name: "",
            slug: "",
            description: "",
            landing_page_url: "",
            starts_at: new Date(),
            ends_at: null,
            status: "draft",
          },
    );

    // load variantes
    if (editing) {
      supabase
        .from("campaign_message_variants")
        .select("id, label, content, is_active")
        .eq("campaign_id", editing.id)
        .order("created_at")
        .then(({ data }) => {
          setVariants(
            (data ?? []).map((v: any) => ({
              id: v.id,
              tempId: newTempId(),
              label: v.label ?? "",
              content: v.content,
              is_active: v.is_active,
            })),
          );
        });
    } else {
      // Pré-popula da pre_written_message? Não — começa vazio para campanhas novas
      setVariants([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const nameValue = form.watch("name");
  useEffect(() => {
    if (!slugTouched.current && nameValue) {
      form.setValue("slug", slugify(nameValue), { shouldValidate: true });
    }
  }, [nameValue, form]);

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { tempId: newTempId(), label: "", content: "", is_active: true },
    ]);
  };

  const updateVariant = (tempId: string, patch: Partial<VariantDraft>) => {
    setVariants((prev) => prev.map((v) => (v.tempId === tempId ? { ...v, ...patch } : v)));
  };

  const removeVariant = (tempId: string) => {
    setVariants((prev) =>
      prev
        .map((v) => (v.tempId === tempId ? { ...v, _deleted: true } : v))
        .filter((v) => v.id || !v._deleted), // novas: remove direto; existentes: marca para delete
    );
  };

  const generateAI = async () => {
    const name = form.getValues("name");
    if (!name || name.trim().length < 3) {
      toast.error("Preencha o nome da campanha primeiro");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-message-variants", {
        body: {
          campaign_name: name,
          campaign_description: form.getValues("description") || "",
          count: 3,
        },
      });
      if (error) throw error;
      const list = (data as any)?.variants ?? [];
      if (!list.length) {
        toast.error("A IA não retornou sugestões. Tente novamente.");
        return;
      }
      setAiSuggestions(list.map((v: any) => ({ ...v, selected: true })));
      setAiOpen(true);
    } catch (e: any) {
      const msg = e?.context?.body
        ? typeof e.context.body === "string"
          ? e.context.body
          : JSON.stringify(e.context.body)
        : e?.message || "Erro ao gerar com IA";
      if (msg.includes("rate_limited")) toast.error("Muitas requisições — aguarde alguns segundos.");
      else if (msg.includes("payment_required")) toast.error("Créditos do AI Gateway esgotados.");
      else toast.error("Erro ao gerar sugestões");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAISuggestions = () => {
    const accepted = aiSuggestions.filter((s) => s.selected);
    setVariants((prev) => [
      ...prev,
      ...accepted.map((s) => ({
        tempId: newTempId(),
        label: s.label,
        content: s.content,
        is_active: true,
      })),
    ]);
    setAiOpen(false);
    setAiSuggestions([]);
    toast.success(`${accepted.length} variante(s) adicionada(s)`);
  };

  const onSubmit = async (values: FormValues) => {
    // valida variantes
    const activeVariants = variants.filter((v) => !v._deleted);
    for (const v of activeVariants) {
      if (v.content.trim().length === 0) {
        toast.error("Variantes não podem ter mensagem vazia");
        return;
      }
      if (v.content.length > 500) {
        toast.error("Variante muito longa (máx. 500 caracteres)");
        return;
      }
    }

    setSubmitting(true);
    const firstActive = activeVariants.find((v) => v.is_active);
    const payload = {
      name: values.name,
      slug: values.slug,
      description: values.description || null,
      landing_page_url: values.landing_page_url ? values.landing_page_url : null,
      pre_written_message: firstActive?.content ?? null, // compat
      starts_at: values.starts_at.toISOString(),
      ends_at: values.ends_at ? values.ends_at.toISOString() : null,
      status: values.status,
    };

    let campaignId = editing?.id;
    // Decide se devemos avisar indicadores: criação já em active, ou draft -> active
    const previousStatus = editing?.status;
    const shouldNotify =
      values.status === "active" &&
      (!editing || (previousStatus !== "active" && previousStatus !== undefined));

    if (editing) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
      if (error) {
        setSubmitting(false);
        toast.error(error.message.includes("campaigns_slug") ? "Slug já existe" : error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...payload, created_by: profile?.id ?? null })
        .select("id")
        .single();
      if (error || !data) {
        setSubmitting(false);
        toast.error(error?.message.includes("campaigns_slug") ? "Slug já existe" : error?.message ?? "Erro");
        return;
      }
      campaignId = data.id;
    }

    if (campaignId) {
      // Persiste variantes em batch
      const ops: Promise<any>[] = [];
      for (const v of variants) {
        if (v._deleted && v.id) {
          ops.push(Promise.resolve(supabase.from("campaign_message_variants").delete().eq("id", v.id)));
        } else if (v.id) {
          ops.push(
            Promise.resolve(
              supabase
                .from("campaign_message_variants")
                .update({ label: v.label || null, content: v.content, is_active: v.is_active })
                .eq("id", v.id),
            ),
          );
        } else if (!v._deleted) {
          ops.push(
            Promise.resolve(
              supabase.from("campaign_message_variants").insert({
                campaign_id: campaignId,
                label: v.label || null,
                content: v.content,
                is_active: v.is_active,
                created_by: profile?.id ?? null,
              }),
            ),
          );
        }
      }
      const results = await Promise.all(ops);
      const firstErr = results.find((r: any) => r?.error);
      if (firstErr) {
        setSubmitting(false);
        toast.error("Erro ao salvar variantes: " + firstErr.error.message);
        return;
      }
    }

    setSubmitting(false);
    toast.success(editing ? "Campanha atualizada" : "Campanha criada");
    onOpenChange(false);
    onSaved?.();

    // Disparo automático para indicadores quando a campanha entra no ar
    if (shouldNotify && campaignId) {
      try {
        const { data: notifyData, error: notifyErr } = await supabase.functions.invoke(
          "notify-campaign-launched",
          { body: { campaign_id: campaignId } },
        );
        if (notifyErr) throw notifyErr;
        const dispatched = (notifyData as any)?.dispatched ?? 0;
        const failed = (notifyData as any)?.failed ?? 0;
        toast.success(
          `Indicadores avisados: ${dispatched}${failed ? ` (${failed} falha(s))` : ""}`,
        );
      } catch (e: any) {
        toast.error("Não foi possível avisar os indicadores: " + (e?.message ?? "erro"));
      }
    }
  };

  const visibleVariants = variants.filter((v) => !v._deleted);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          slugTouched.current = true;
                          field.onChange(e);
                        }}
                        placeholder="auto a partir do nome"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="landing_page_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da landing (opcional)</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                    <FormDescription>
                      Se vazio, usaremos uma página de destino interna gerada automaticamente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Variantes de mensagem */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Mensagens pré-prontas</p>
                    <p className="text-xs text-muted-foreground">
                      Crie variantes para o WhatsApp. O sistema mede qual converte mais.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={generateAI} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    Gerar 3 com IA
                  </Button>
                </div>

                {visibleVariants.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma variante ainda.</p>
                )}

                {visibleVariants.map((v) => (
                  <div key={v.tempId} className="rounded-md border p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Tom (ex: Amigável)"
                        value={v.label}
                        onChange={(e) => updateVariant(v.tempId, { label: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={v.is_active}
                          onCheckedChange={(c) => updateVariant(v.tempId, { is_active: c })}
                        />
                        <span className="text-xs text-muted-foreground">{v.is_active ? "Ativa" : "Off"}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeVariant(v.tempId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Mensagem (sem o link — é adicionado automático)"
                      value={v.content}
                      onChange={(e) => updateVariant(v.tempId, { content: e.target.value })}
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{v.content.length}/500</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Início</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecionar data</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fim (opcional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecionar data</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={(d) => field.onChange(d ?? null)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-muted-foreground self-start"
                          onClick={() => field.onChange(null)}
                        >
                          Limpar
                        </Button>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                        <SelectItem value="ended">Encerrada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sub-dialog de sugestões IA */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sugestões da IA ✨</DialogTitle>
            <DialogDescription>Selecione quais quer adicionar às variantes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {aiSuggestions.map((s, i) => (
              <label
                key={i}
                className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={s.selected}
                  onCheckedChange={(c) =>
                    setAiSuggestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, selected: !!c } : x)))
                  }
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary">{s.label}</p>
                  <p className="text-sm">{s.content}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancelar</Button>
            <Button onClick={acceptAISuggestions}>Adicionar selecionadas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
