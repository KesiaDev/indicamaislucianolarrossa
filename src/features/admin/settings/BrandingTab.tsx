import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading } from "@/components/shared/Loading";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function BrandingTab() {
  const { data: branding, isLoading } = useBranding();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setCompanyName(branding.companyName ?? "");
    setHeroTitle(branding.heroTitle ?? "");
    setHeroSubtitle(branding.heroSubtitle ?? "");
    setLogoUrl(branding.logoUrl);
  }, [branding]);

  if (isLoading) return <Loading />;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["app-branding"] });

  const handleUpload = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPEG, SVG ou WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", { description: "Máximo 2MB." });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error("Erro no upload", { description: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("app_branding")
      .update({ logo_url: url })
      .eq("id", "singleton");
    setUploading(false);
    if (updErr) {
      toast.error("Erro ao salvar logo", { description: updErr.message });
      return;
    }
    setLogoUrl(url);
    invalidate();
    toast.success("Logo atualizado");
  };

  const removeLogo = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("app_branding")
      .update({ logo_url: null })
      .eq("id", "singleton");
    setBusy(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    setLogoUrl(null);
    invalidate();
    toast.success("Logo removido");
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("app_branding")
      .update({
        company_name: companyName.trim() || "Indica+",
        hero_title: heroTitle.trim() || null,
        hero_subtitle: heroSubtitle.trim() || null,
      })
      .eq("id", "singleton");
    setBusy(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    invalidate();
    toast.success("Marca atualizada");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade da empresa</CardTitle>
        <CardDescription>
          Logo, nome e textos que aparecem no painel admin e no app dos indicadores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded border bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando…" : logoUrl ? "Trocar" : "Enviar logo"}
              </Button>
              {logoUrl && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={removeLogo}>
                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, SVG ou WebP. Máximo 2MB.
          </p>
        </div>

        <div>
          <Label>Nome da empresa</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex: Minha Empresa"
          />
        </div>

        <div>
          <Label>Título do hero (app do indicador)</Label>
          <Textarea
            rows={2}
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder="Ex: Indique e ganhe, {{nome}}! 🎉"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use <code>{"{{nome}}"}</code> para incluir o primeiro nome do indicador.
          </p>
        </div>

        <div>
          <Label>Subtítulo do hero</Label>
          <Textarea
            rows={2}
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
            placeholder="Ex: Compartilhe com amigos e conquiste prêmios"
          />
        </div>

        <Button onClick={save} disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
