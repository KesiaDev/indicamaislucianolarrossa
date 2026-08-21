import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Megaphone,
  Gift,
  Users,
  Settings,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSetupWizard } from "@/features/admin/onboarding/AdminSetupWizard";
import { adminRouteLoaders, type AdminRouteKey } from "@/lib/adminRoutes";

const items: Array<{
  to: string;
  end?: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  prefetch: AdminRouteKey;
}> = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard, prefetch: "dashboard" },
  { to: "/admin/campaigns", label: "Campanhas", icon: Megaphone, prefetch: "campaigns" },
  { to: "/admin/rewards-queue", label: "Prêmios", icon: Gift, prefetch: "rewardsQueue" },
  { to: "/admin/referrers", label: "Indicadores", icon: Users, prefetch: "referrers" },
  { to: "/admin/settings", label: "Configurações", icon: Settings, prefetch: "settings" },
];

const COLLAPSED_KEY = "admin.sidebar.collapsed";

function getPageTitle(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") return "Dashboard";
  if (pathname.startsWith("/admin/campaigns")) return "Campanhas";
  if (pathname.startsWith("/admin/rewards-queue")) return "Prêmios";
  if (pathname.startsWith("/admin/referrers")) return "Indicadores";
  if (pathname.startsWith("/admin/settings")) return "Configurações";
  return "";
}

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  const { data: branding } = useBranding();
  const logo = branding?.logoUrl;
  const name = branding?.companyName ?? "Indicações";

  if (collapsed) {
    return (
      <div className="px-2 py-3 border-b border-sidebar-border flex items-center justify-center">
        {logo ? (
          <img src={logo} alt={name} className="h-8 w-8 object-contain rounded" />
        ) : (
          <div className="h-8 w-8 rounded-md bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border flex items-center justify-center text-sm font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-b border-sidebar-border flex items-center min-h-[64px]">
      {logo ? (
        <img src={logo} alt={name} className="max-h-8 max-w-full object-contain" />
      ) : (
        <h1 className="text-base font-semibold truncate">{name}</h1>
      )}
    </div>
  );
}

function SidebarBody({
  onNavigate,
  onSignOut,
  email,
  collapsed,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  onSignOut: () => void;
  email?: string | null;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full">
        <BrandHeader collapsed={collapsed} />

        <nav
          className={cn(
            "flex-1 py-4 space-y-1 overflow-y-auto",
            collapsed ? "px-2 flex flex-col items-center" : "px-3",
          )}
        >
          {items.map((it) => {
            const prefetch = () => {
              try {
                adminRouteLoaders[it.prefetch]?.();
              } catch {
                /* noop */
              }
            };
            const link = (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={onNavigate}
                onMouseEnter={prefetch}
                onFocus={prefetch}
                onTouchStart={prefetch}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-md text-sm transition-colors",
                    collapsed
                      ? "justify-center h-10 w-10"
                      : "gap-3 px-3 py-2 w-full",
                    isActive
                      ? collapsed
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <it.icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </NavLink>
            );

            if (!collapsed) return link;
            return (
              <Tooltip key={it.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{it.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div
          className={cn(
            "border-t border-sidebar-border",
            collapsed ? "p-2 flex flex-col items-center gap-1" : "p-4 space-y-2",
          )}
        >
          {!collapsed && email && (
            <p className="text-xs text-sidebar-foreground/70 truncate">{email}</p>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  onClick={onSignOut}
                  aria-label="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          )}

          {onToggleCollapsed && (
            <div
              className={cn(
                collapsed
                  ? "mt-1 pt-2 border-t border-sidebar-border/50 w-full flex justify-center"
                  : "mt-2 pt-2 border-t border-sidebar-border/50",
              )}
            >
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      onClick={onToggleCollapsed}
                      aria-label="Expandir menu"
                    >
                      <PanelLeftOpen className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expandir</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  onClick={onToggleCollapsed}
                >
                  <PanelLeftClose className="h-4 w-4 mr-2" /> Recolher
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const { data: branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Auto-abrir wizard no primeiro login do admin
  useEffect(() => {
    if (
      !wizardDismissed &&
      profile?.role === "admin" &&
      branding &&
      !branding.setupCompletedAt
    ) {
      setWizardOpen(true);
    }
  }, [profile?.role, branding, wizardDismissed]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={cn(
          "hidden md:flex sticky top-0 h-screen bg-sidebar text-sidebar-foreground flex-col transition-[width] duration-200 ease-in-out shrink-0 border-r border-sidebar-border",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarBody
          onSignOut={handleSignOut}
          email={profile?.email}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-background border-b">
          <div className="flex items-center justify-between px-4 h-14">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
                <SidebarBody
                  onSignOut={async () => {
                    await handleSignOut();
                    setMobileOpen(false);
                  }}
                  onNavigate={() => setMobileOpen(false)}
                  email={profile?.email}
                  collapsed={false}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-base font-semibold">{pageTitle || "Indicações"}</h1>
            <ThemeToggle />
          </div>
        </header>
        <header className="hidden md:flex sticky top-0 z-20 bg-background/80 backdrop-blur border-b h-14 items-center justify-between px-6 gap-2">
          <h2 className="text-sm font-semibold text-foreground/90">{pageTitle}</h2>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <AdminSetupWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardDismissed(true);
        }}
      />
    </div>
  );
}
