// ============================================================================
// Dashboard navigation (PHE-96)
// ----------------------------------------------------------------------------
// The one source for the signed-in app's tabs. The desktop sidebar and the
// phone bottom nav both render DASHBOARD_TABS in array order, never sorted:
// constellation, discover, polaris, insights (spec doc 1). Constellation is the
// home route. Settings is reached from the account row (desktop) or the top bar
// gear (phones), not from a tab.
//
// No runtime imports, so this module runs under `node --test` and next.config
// can mirror LEGACY_REDIRECTS (lib/dashboard-nav.test.ts keeps the two in sync).
// ============================================================================

export const DASHBOARD_TABS = [
  { id: "constellation", label: "constellation", href: "/dashboard/constellation" },
  { id: "discover", label: "discover", href: "/dashboard/discover" },
  { id: "polaris", label: "polaris", href: "/dashboard/polaris" },
  { id: "insights", label: "insights", href: "/dashboard/insights" },
] as const;

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

/** Every segment the nav and tab analytics know about: the four tabs plus settings. */
export type DashboardSegment = DashboardTabId | "settings";

/** Where /dashboard, the logo, and any in-app "home" link land. */
export const DASHBOARD_HOME = "/dashboard/constellation";

export const SETTINGS_HREF = "/dashboard/settings";

/**
 * Old paths kept alive for bookmarks. Daily was removed and the you tab became
 * insights; /dashboard/profile already pointed at you. Mirrored (with a
 * `/:path*` twin for each) in next.config.mjs `redirects()`.
 */
export const LEGACY_REDIRECTS: readonly { source: string; destination: string }[] = [
  { source: "/dashboard/daily", destination: DASHBOARD_HOME },
  { source: "/dashboard/you", destination: "/dashboard/insights" },
  { source: "/dashboard/profile", destination: "/dashboard/insights" },
  { source: "/daily", destination: DASHBOARD_HOME },
];

const SEGMENTS: readonly string[] = [...DASHBOARD_TABS.map((t) => t.id), "settings"];

/**
 * The active nav item for a dashboard route segment, which is also the `tab`
 * value on tab_visit / tab_duration events. The index route (null) is home;
 * an unknown segment has no active item and is not tracked.
 */
export function segmentTab(segment: string | null): DashboardSegment | null {
  if (segment === null) return "constellation";
  return SEGMENTS.includes(segment) ? (segment as DashboardSegment) : null;
}
