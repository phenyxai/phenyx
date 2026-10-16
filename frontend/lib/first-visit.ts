"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import type { DashboardTabId } from "@/lib/dashboard-nav";
import { introBannerKeys, isBannerSeen } from "@/lib/first-visit-keys";

// ============================================================================
// First-visit orientation state (PHE-33)
// ----------------------------------------------------------------------------
// One-time, per-user localStorage flags that gate the per-tab intro banners.
// Keys are namespaced by the signed-in user's id so two users sharing a
// browser keep independent first-visit state: `phenyx:{userId}:intro:{tab}`.
// Keys live in lib/first-visit-keys; a flag set under a tab's former id (the
// insights banner was `intro:you`) still counts as seen.
//
// SSR/hydration: localStorage is only read inside effects, and visibility
// starts `false`, so the server render (and the first client render) show
// nothing — no hydration mismatch, no flash of a banner that is later hidden.
// ============================================================================

export type DashboardTab = DashboardTabId;

/** True when the flag has been set (i.e. the surface has already been seen). */
function isSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) != null;
  } catch {
    // Private mode / storage disabled — treat as "seen" so we never nag.
    return true;
  }
}

/** Persist the flag; swallow storage errors (quota / disabled). */
function markSeen(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // no-op
  }
}

/** Resolve the signed-in user's id (null while pending / signed out). */
function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (active) setUserId(user?.id ?? null);
      })
      .catch(() => {
        if (active) setUserId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return userId;
}

/**
 * Shared first-visit gate: returns whether a one-time surface should show for
 * the resolved `keys` (its own key first, then any former keys), and marks its
 * own key seen on the first render that surfaces it. A flag found only under a
 * former key is copied to the current key, so the former key can later go.
 *
 * A `useRef` guard makes the decision exactly once per mounted instance so that
 * React strict-mode's double-invoked effect (which would otherwise re-read a
 * flag we just wrote and hide the surface) keeps the surface visible. A genuine
 * revisit is a fresh mount with a fresh ref, so the now-set flag hides it.
 */
function useFirstVisit(keys: readonly string[] | null): boolean {
  const [visible, setVisible] = useState(false);
  const decided = useRef(false);
  const current = keys?.[0] ?? null;
  const signature = keys?.join("|") ?? null;

  useEffect(() => {
    if (!keys || !current || decided.current) return;
    decided.current = true;
    const seen = isBannerSeen(keys, isSeen);
    // Visiting the surface marks it seen — it never reappears after this.
    if (!isSeen(current)) markSeen(current);
    if (!seen) setVisible(true);
    // `signature` stands in for `keys`, which is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return visible;
}

/**
 * Per-tab intro banner state. `visible` is true only on the tab's first visit
 * (and stays true across a strict-mode remount); `dismiss` hides it now and
 * ensures the flag is persisted so it never returns.
 */
export function useIntroBanner(tab: DashboardTab): {
  visible: boolean;
  dismiss: () => void;
} {
  const userId = useUserId();
  const keys = userId ? introBannerKeys(userId, tab) : null;
  const gateVisible = useFirstVisit(keys);
  const [dismissed, setDismissed] = useState(false);

  const dismiss = () => {
    if (keys) markSeen(keys[0]);
    setDismissed(true);
  };

  return { visible: gateVisible && !dismissed, dismiss };
}
