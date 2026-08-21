import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { RouteFallback } from "@/components/shared/RouteFallback";
import { adminRouteLoaders } from "@/lib/adminRoutes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ReferralRedirect from "./pages/ReferralRedirect";
import LoginPage from "./features/auth/LoginPage";
import ApplyPage from "./features/auth/ApplyPage";
import ConfirmSignupPage from "./features/auth/ConfirmSignupPage";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ReferrerLayout } from "@/components/layout/ReferrerLayout";

// Referrer pages (small + frequent: keep eager)
import ReferrerDashboard from "./features/referrer/dashboard/DashboardPage";
import ReferrerShare from "./features/referrer/share/SharePage";
import ReferrerRanking from "./features/referrer/ranking/RankingPage";
import ReferrerRewards from "./features/referrer/rewards/RewardsPage";
import ReferrerProfile from "./features/referrer/profile/ProfilePage";

// Admin pages (lazy, prefetchable via adminRouteLoaders)
const AdminDashboard = lazy(adminRouteLoaders.dashboard);
const AdminCampaigns = lazy(adminRouteLoaders.campaigns);
const AdminCampaignDetail = lazy(adminRouteLoaders.campaignDetail);
const AdminRewardsQueue = lazy(adminRouteLoaders.rewardsQueue);
const AdminReferrers = lazy(adminRouteLoaders.referrers);
const AdminSettings = lazy(adminRouteLoaders.settings);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth" element={<Navigate to="/login" replace />} />
              <Route path="/quero-indicar" element={<ApplyPage />} />
              <Route path="/indicador/confirmar" element={<ConfirmSignupPage />} />
              <Route path="/r/:code" element={<ReferralRedirect />} />

              <Route
                path="/admin"
                element={
                  <RequireAuth role="admin">
                    <ErrorBoundary>
                      <Suspense fallback={<RouteFallback />}>
                        <AdminLayout />
                      </Suspense>
                    </ErrorBoundary>
                  </RequireAuth>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="campaigns" element={<AdminCampaigns />} />
                <Route path="campaigns/:id" element={<AdminCampaignDetail />} />
                <Route path="rewards-queue" element={<AdminRewardsQueue />} />
                <Route path="referrers" element={<AdminReferrers />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              <Route
                path="/app"
                element={
                  <RequireAuth role="referrer">
                    <ErrorBoundary>
                      <ReferrerLayout />
                    </ErrorBoundary>
                  </RequireAuth>
                }
              >
                <Route index element={<ReferrerDashboard />} />
                <Route path="share/:campaignSlug" element={<ReferrerShare />} />
                <Route path="ranking" element={<ReferrerRanking />} />
                <Route path="rewards" element={<ReferrerRewards />} />
                <Route path="profile" element={<ReferrerProfile />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
