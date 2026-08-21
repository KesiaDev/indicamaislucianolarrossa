import { Award, Medal, Trophy, Gem, type LucideIcon } from "lucide-react";

export interface Tier {
  id: string;
  name: string;
  min_points: number;
  color: string;
  icon: string | null;
  perks: string[] | null;
  sort_order: number;
}

export function getTierForPoints(points: number, tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => b.min_points - a.min_points);
  return sorted.find((t) => points >= t.min_points) ?? null;
}

export function getNextTier(points: number, tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => a.min_points - b.min_points);
  return sorted.find((t) => points < t.min_points) ?? null;
}

export const tierIconMap: Record<string, LucideIcon> = {
  award: Award,
  medal: Medal,
  trophy: Trophy,
  gem: Gem,
};

/**
 * Paleta fixa de tiers — ignora dark mode propositalmente.
 * Mapeia por nome (case-insensitive, em PT e EN).
 */
export const TIER_PALETTE: Record<string, string> = {
  bronze: "#CD7F32",
  prata: "#C0C0C0",
  silver: "#C0C0C0",
  ouro: "#FFD700",
  gold: "#FFD700",
  diamante: "#B9F2FF",
  diamond: "#B9F2FF",
};

/**
 * Retorna a cor canônica do tier pelo nome; cai no fallback (ex.: cor do banco).
 */
export function tierColorFor(name?: string | null, fallback = "#888"): string {
  if (!name) return fallback;
  const key = name.trim().toLowerCase();
  return TIER_PALETTE[key] ?? fallback;
}

/**
 * Cor de texto legível sobre um background hex.
 * Tiers claros (ouro/diamante) usam texto escuro; bronze/prata usam branco.
 */
export function tierTextColor(bgHex: string): string {
  const hex = bgHex.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Luminância relativa
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? "#1a1a1a" : "#ffffff";
}
