// ============================================================================
// Intro banner storage keys (PHE-33, PHE-96)
// ----------------------------------------------------------------------------
// Pure key helpers for lib/first-visit, kept free of runtime imports so they
// run under `node --test`. A tab's own key comes first; any older keys follow,
// so a banner dismissed before a rename stays dismissed after it.
// ============================================================================

import type { DashboardTabId } from "./dashboard-nav";

const NS = "phenyx";

/** Former tab ids whose banner flags still count. Insights was the you tab. */
const FORMER_IDS: Partial<Record<DashboardTabId, readonly string[]>> = {
  insights: ["you"],
};

/** `phenyx:{userId}:intro:{tab}`, then the keys of the tab's former ids. */
export function introBannerKeys(userId: string, tab: DashboardTabId): string[] {
  return [tab, ...(FORMER_IDS[tab] ?? [])].map((id) => `${NS}:${userId}:intro:${id}`);
}

/** Seen when any of the keys is set. */
export function isBannerSeen(keys: readonly string[], isSet: (key: string) => boolean): boolean {
  return keys.some(isSet);
}
