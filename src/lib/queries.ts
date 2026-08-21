import { supabase } from "./supabase";
import type { Database } from "@/types/supabase";

type Fns = Database["public"]["Functions"];
type Args<K extends keyof Fns> = Fns[K] extends { Args: infer A } ? A : never;
type Ret<K extends keyof Fns> = Fns[K] extends { Returns: infer R } ? R : never;

async function rpc<K extends keyof Fns>(name: K, args?: Args<K>) {
  const { data, error } = await (supabase.rpc as any)(name, args ?? {});
  if (error) throw error;
  return data as Ret<K>;
}

export const queries = {
  getAdminDashboard: () => rpc("get_admin_dashboard"),
  getReferrerDashboard: (p_referrer_id?: string) =>
    rpc("get_referrer_dashboard", { p_referrer_id: p_referrer_id ?? undefined } as Args<"get_referrer_dashboard">),
  createReferralLink: (p_campaign_id: string) =>
    rpc("create_referral_link", { p_campaign_id }),
  ensureReferralLink: (_campaign_id: string) =>
    rpc("ensure_referral_link", { _campaign_id }),
  registerReferral: (args: Args<"register_referral">) =>
    rpc("register_referral", args),
  confirmConversion: (args: Args<"confirm_conversion">) =>
    rpc("confirm_conversion", args),
  evaluateRewards: (p_campaign_id: string, p_referrer_id: string) =>
    rpc("evaluate_rewards", { p_campaign_id, p_referrer_id }),
  expireOldReferrals: () => rpc("expire_old_referrals"),
  refreshMonthlyRanking: (p_year: number, p_month: number) =>
    rpc("refresh_monthly_ranking", { p_year, p_month }),
  recomputeTier: (_profile_id: string) =>
    rpc("recompute_tier", { _profile_id }),
  isAdmin: () => rpc("is_admin"),
  hasRole: (args: Args<"has_role">) => rpc("has_role", args),
};
