// Centralizes lazy admin route imports so they can be prefetched on hover.
export const adminRouteLoaders = {
  dashboard: () => import("@/features/admin/dashboard/DashboardPage"),
  campaigns: () => import("@/features/admin/campaigns/CampaignsPage"),
  campaignDetail: () => import("@/features/admin/campaigns/CampaignDetailPage"),
  rewardsQueue: () => import("@/features/admin/rewards/RewardsQueuePage"),
  referrers: () => import("@/features/admin/referrers/ReferrersPage"),
  settings: () => import("@/features/admin/settings/SettingsPage"),
};

export type AdminRouteKey = keyof typeof adminRouteLoaders;
