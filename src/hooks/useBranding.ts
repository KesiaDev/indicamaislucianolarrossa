import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Branding {
  companyName: string;
  logoUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  primaryColor: string | null;
  setupCompletedAt: string | null;
}

const DEFAULT: Branding = {
  companyName: "Indica+",
  logoUrl: null,
  heroTitle: null,
  heroSubtitle: null,
  primaryColor: null,
  setupCompletedAt: null,
};

export function useBranding() {
  return useQuery({
    queryKey: ["app-branding"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Branding> => {
      const { data, error } = await supabase
        .from("app_branding")
        .select("company_name, logo_url, hero_title, hero_subtitle, primary_color, setup_completed_at")
        .eq("id", "singleton")
        .maybeSingle();
      if (error || !data) return DEFAULT;
      return {
        companyName: data.company_name ?? DEFAULT.companyName,
        logoUrl: data.logo_url,
        heroTitle: data.hero_title,
        heroSubtitle: data.hero_subtitle,
        primaryColor: data.primary_color,
        setupCompletedAt: (data as any).setup_completed_at ?? null,
      };
    },
  });
}
