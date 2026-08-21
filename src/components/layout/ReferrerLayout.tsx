import { useEffect, useState, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Trophy, Gift, User, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tier, tierColorFor } from "@/lib/tiers";
import { TierBadge } from "@/components/shared/TierBadge";
import { useBranding } from "@/hooks/useBranding";

const SEEN_KEY = "rewards.seen";

const navItems = [
  { to: "/app", end: true, label: "Início", icon: Home, key: "home" },
  { to: "/app/ranking", label: "Ranking", icon: Trophy, key: "ranking" },
  { to: "/app/rewards", label: "Prêmios", icon: Gift, key: "rewards" },
  { to: "/app/profile", label: "Perfil", icon: User, key: "profile" },
];

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  return src.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function getSeen(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function ReferrerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: branding } = useBranding();
  const [tier, setTier] = useState<Tier | null>(null);
  const [newRewardsCount, setNewRewardsCount] = useState(0);

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

  const refreshNewRewards = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("rewards")
      .select("id")
      .eq("referrer_id", profile.id)
      .eq("status", "approved");
    const ids = (data ?? []).map((r: any) => r.id as string);
    const seen = getSeen();
    setNewRewardsCount(ids.filter((id) => !seen.has(id)).length);
  }, [profile]);

  useEffect(() => {
    refreshNewRewards();
    const onFocus = () => refreshNewRewards();
    const onSeen = () => refreshNewRewards();
    window.addEventListener("focus", onFocus);
    window.addEventListener("rewards-seen-updated", onSeen as any);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("rewards-seen-updated", onSeen as any);
    };
  }, [refreshNewRewards]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const tierRingColor = tier ? tierColorFor(tier.name, tier.color) : undefined;

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu do usuário"
          className="group flex items-center gap-3 min-w-0 rounded-xl px-2 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Avatar
            className="h-10 w-10 ring-2 ring-offset-2 ring-offset-background shrink-0"
            style={tierRingColor ? { boxShadow: `0 0 0 2px ${tierRingColor}` } : undefined}
          >
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback
              style={tier ? { backgroundColor: tierRingColor, color: "#fff" } : undefined}
            >
              {initials(profile?.full_name, profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-semibold truncate">
              {profile?.full_name || profile?.email}
            </p>
            {tier && (
              <TierBadge name={tier.name} icon={tier.icon} fallbackColor={tier.color} />
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ============== MOBILE HEADER (< md) ============== */}
      <header className="md:hidden bg-gradient-to-b from-background to-muted/30 border-b sticky top-0 z-30 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="h-8 max-w-[120px] object-contain shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 flex justify-end">{userMenu}</div>
        </div>
      </header>

      {/* ============== DESKTOP TOPBAR (>= md) ============== */}
      <header className="hidden md:block border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-9 max-w-[160px] object-contain"
              />
            ) : (
              <span className="font-bold text-lg">{branding?.companyName ?? "Indique"}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {userMenu}
          </div>
        </div>
      </header>

      {/* ============== DESKTOP BODY (sidebar + content) ============== */}
      <div className="flex-1 flex w-full">
        {/* Sidebar (desktop) */}
        <aside
          aria-label="Navegação principal"
          className="hidden md:flex flex-col w-60 shrink-0 border-r bg-muted/30 sticky top-16 self-start h-[calc(100vh-4rem)] py-6 px-3"
        >
          <nav className="flex flex-col gap-1">
            {navItems.map((it) => {
              const Icon = it.icon;
              const showBadge = it.key === "rewards" && newRewardsCount > 0;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill-desktop"
                          className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <div className="relative">
                        <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                        {showBadge && (
                          <span
                            aria-label={`${newRewardsCount} novos prêmios`}
                            className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center shadow-glow-accent"
                          >
                            {newRewardsCount}
                          </span>
                        )}
                      </div>
                      <span>{it.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl md:max-w-5xl mx-auto w-full px-4 md:px-8 pb-28 md:pb-12 pt-4 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ============== MOBILE BOTTOM NAV (< md) ============== */}
      <nav
        aria-label="Navegação principal"
        className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t z-30 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgb(0_0_0/0.04)]"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-4 px-2 pt-2 pb-1">
          {navItems.map((it) => {
            const Icon = it.icon;
            const showBadge = it.key === "rewards" && newRewardsCount > 0;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                aria-label={it.label}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-1 py-2 mx-1 rounded-2xl transition-colors min-h-[52px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill-mobile"
                        className="absolute inset-0 bg-primary/10 rounded-2xl -z-10"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <div className="relative">
                      <Icon className="h-7 w-7" strokeWidth={isActive ? 2.4 : 2} />
                      {showBadge && (
                        <span
                          aria-label={`${newRewardsCount} novos prêmios`}
                          className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center shadow-glow-accent animate-pulse"
                        >
                          {newRewardsCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] leading-none font-semibold">{it.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
