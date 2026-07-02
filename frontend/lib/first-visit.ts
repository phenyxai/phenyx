"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

// ============================================================================
// First-visit orientation state (PHE-33)
// ----------------------------------------------------------------------------
// One-time, per-user localStorage flags that gate the Daily signpost and the
// four per-tab intro banners. Keys are namespaced by the signed-in user's id so
// two users sharing a browser keep independent first-visit state:
//   - signpost: `phenyx:{userId}:signpost:daily`
//   - banners:  `phenyx:{userId}:intro:{tab}`
//
// SSR/hydration: localStorage is only read inside effects, and visibility
// starts `false`, so the server render (and the first client render) show
// nothing — no hydration mismatch, no flash of a banner that is later hidden.
// ============================================================================

export type DashboardTab = "daily" | "polaris" | "constellation" | "profile";

const NS = "phenyx";

function bannerKey(userId: string, tab: DashboardTab): string {
  return `${NS}:${userId}:intro:${tab}`;
}

function signpostKey(userId: string): string {
  return `${NS}:${userId}:signpost:daily`;
}

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
 * the resolved `key`, and marks it seen on the first render that surfaces it.
 *
 * A `useRef` guard makes the decision exactly once per mounted instance so that
 * React strict-mode's double-invoked effect (which would otherwise re-read a
 * flag we just wrote and hide the surface) keeps the surface visible. A genuine
 * revisit is a fresh mount with a fresh ref, so the now-set flag hides it.
 */
function useFirstVisit(key: string | null): boolean {
  const [visible, setVisible] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!key || decided.current) return;
    decided.current = true;
    if (!isSeen(key)) {
      // Visiting the surface marks it seen — it never reappears after this.
      markSeen(key);
      setVisible(true);
    }
  }, [key]);

  return visible;
}

/**
 * Daily first-visit signpost. Shows once, on the user's first Daily render, and
 * is keyed independently of the Daily intro banner.
 */
export function useDailySignpost(): boolean {
  const userId = useUserId();
  return useFirstVisit(userId ? signpostKey(userId) : null);
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
  const key = userId ? bannerKey(userId, tab) : null;
  const gateVisible = useFirstVisit(key);
  const [dismissed, setDismissed] = useState(false);

  const dismiss = () => {
    if (key) markSeen(key);
    setDismissed(true);
  };

  return { visible: gateVisible && !dismissed, dismiss };
}
