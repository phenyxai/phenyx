// ============================================================================
// Dashboard navigation (PHE-96)
// ----------------------------------------------------------------------------
// The one source for the signed-in app's tabs. The desktop sidebar and the
// phone bottom nav both render DASHBOARD_TABS in array order, never sorted:
// constellation, polaris, discover, insights (PHE-129 rebuild doc). Constellation is the
// home route. Settings is reached from the sidebar foot (desktop) or the top bar
// gear (phones), not from a tab.
//
// No runtime imports, so this module runs under `node --test` and next.config.ts
// can import LEGACY_REDIRECTS directly.
// ============================================================================

export const DASHBOARD_TABS = [
  { id: "constellation", label: "constellation", href: "/dashboard/constellation" },
  { id: "polaris", label: "polaris", href: "/dashboard/polaris" },
  { id: "discover", label: "discover", href: "/dashboard/discover" },
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
 * insights; /dashboard/profile already pointed at you. Sign-in is google only
 * (PHE-129), so the email sign-up at /join leads to it. next.config.ts turns
 * each into a `<source>/:path*` redirect, covering the route and its subpaths.
 */
export const LEGACY_REDIRECTS: readonly { source: string; destination: string }[] = [
  { source: "/dashboard/daily", destination: DASHBOARD_HOME },
  { source: "/dashboard/you", destination: "/dashboard/insights" },
  { source: "/dashboard/profile", destination: "/dashboard/insights" },
  { source: "/daily", destination: DASHBOARD_HOME },
  { source: "/join", destination: "/signin" },
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

/** Which tab the visitor is on and since when (ms epoch). */
export interface TabClock {
  tab: DashboardSegment | null;
  enteredAt: number;
}

export interface TabTransition {
  clock: TabClock;
  /** Time on the tab being left, for tab_duration. */
  duration: { tab: DashboardSegment; seconds: number } | null;
  /** The tab arrived at, for tab_visit. */
  visit: { tab: DashboardSegment; previous: DashboardSegment | null } | null;
}

/**
 * Tab engagement for a route segment change (PHE-35, PHE-96). Leaving a tab
 * always closes out its duration, even when the next segment is unknown; an
 * unknown segment then gets no visit and resets the clock, so time spent there
 * is never charged to the tab before it. Staying put changes nothing.
 */
export function tabTransition(clock: TabClock, segment: string | null, now: number): TabTransition {
  const next = segmentTab(segment);
  if (next === clock.tab) return { clock, duration: null, visit: null };
  return {
    clock: { tab: next, enteredAt: now },
    duration:
      clock.tab === null
        ? null
        : { tab: clock.tab, seconds: Math.max(0, Math.round((now - clock.enteredAt) / 1000)) },
    visit: next === null ? null : { tab: next, previous: clock.tab },
  };
}
