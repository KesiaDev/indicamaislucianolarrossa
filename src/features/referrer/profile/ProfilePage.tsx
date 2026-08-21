import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/shared/Loading";
import { TierBadge } from "@/components/shared/TierBadge";
import { LogOut, Camera, CheckCircle2 } from "lucide-react";
import { tierIconMap, tierColorFor, type Tier } from "@/lib/tiers";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100, "Máximo 100"),
  phone: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.replace(/\D/g, "").length >= 10,
      "Telefone deve ter DDD + número (mín. 10 dígitos)",
    ),
});
type ProfileForm = z.infer<typeof ProfileSchema>;

export default function ProfilePage() {
  const { profile, signOut, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [tier, setTier] = useState<Tier | null>(null);
  const [conversions, setConversions] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { full_name: "", phone: "" },
  });

  useEffect(() => {
    if (profile) {
      reset({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
    }
  }, [profile, reset]);

  useEffect(() => {
    if (!profile?.tier_id) {
      setTier(null);
      return;
    }
    supabase
      .from("loyalty_tiers")
      .select("*")
      .eq("id", profile.tier_id)
      .maybeSingle()
      .then(({ data }) => setTier((data as Tier) ?? null));
  }, [profile?.tier_id]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", profile.id)
      .eq("status", "converted")
      .then(({ count }) => setConversions(count ?? 0));
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("Avatar atualizado! 📸");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar avatar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = async (values: ProfileForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, phone: values.phone || null })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil salvo ✨");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <Loading />;
  const TierIcon = tier ? tierIconMap[tier.icon ?? "award"] ?? tierIconMap.award : null;
  const tierRingColor = tier ? tierColorFor(tier.name, tier.color) : undefined;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Perfil</h2>

      {/* Card 1: Avatar + edição */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Alterar foto de perfil"
            >
              <Avatar
                className="h-24 w-24"
                style={tierRingColor ? { boxShadow: `0 0 0 4px ${tierRingColor}` } : undefined}
              >
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xl">
                  {initials(profile.full_name, profile.email)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-primary border-2 border-background transition-transform group-hover:scale-110">
                <Camera className="h-4 w-4" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {uploading && <p className="text-xs text-muted-foreground">Enviando...</p>}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} readOnly disabled />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" placeholder="(11) 99999-9999" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={saving || !isDirty}
              className="w-full min-h-[44px] shadow-glow-primary"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card 2: Stats */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums">{conversions}</p>
            <p className="text-xs text-muted-foreground font-medium">Amigos</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{profile.total_points}</p>
            <p className="text-xs text-muted-foreground font-medium">Pontos</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            {tier ? (
              <TierBadge name={tier.name} icon={tier.icon} fallbackColor={tier.color} />
            ) : (
              <span className="text-xs text-muted-foreground">Sem tier</span>
            )}
            <p className="text-xs text-muted-foreground font-medium">Tier atual</p>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Tier perks */}
      {tier && (
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {TierIcon && (
                <span
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: tierRingColor, color: "#fff" }}
                >
                  <TierIcon className="h-4 w-4" />
                </span>
              )}
              <span>Benefícios do tier {tier.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tier.perks && tier.perks.length > 0 ? (
              <ul className="space-y-2">
                {tier.perks.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum benefício listado.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 4: Aparência + Sair */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-4 space-y-2">
          <ThemeToggle variant="full" className="w-full justify-start min-h-[44px]" />
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full text-destructive hover:text-destructive min-h-[44px]"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
