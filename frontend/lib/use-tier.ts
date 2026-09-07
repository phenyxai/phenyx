"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { hasFullAccess } from "@/lib/billing";

export type Tier = "free" | "pro" | "gifted";

export interface TierState {
  /** Raw tier from user_profiles.tier (free | pro | gifted). */
  tier: Tier;
  /** Entitlement gate — true for pro and gifted (gifted is pro-equivalent). */
  isPro: boolean;
}

/**
 * Reads the signed-in user's tier from user_profiles (keyed by `id`, = auth.users.id)
 * and exposes { tier, isPro } where isPro = hasFullAccess(tier) — true for pro and
 * gifted. The single tier source for the dashboard; Daily observation gating,
 * Constellation timeline gating, and the you tab's plan badge all read from here.
 *
 * Defaults to "free" until the row resolves (and when signed out) so tier-gated UI
 * fails closed — a pro surface is never shown to an unknown/unauthenticated user.
 *
 * Tier is read directly via the supabase browser client (same path as
 * fetchProfile / the upgrade + daily surfaces); there is no backend tier endpoint.
 */
export function useTier(): TierState {
  const [tier, setTier] = useState<Tier>("free");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("tier")
        .eq("id", user.id)
        .maybeSingle();
      if (active && data?.tier) setTier(data.tier as Tier);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { tier, isPro: hasFullAccess(tier) };
}

/**
 * The single authority for tier-dependent shell UI. A pure function of `tier`:
 * sets the plan pill's label/attribute (and, where a surface still renders one,
 * the upgrade button's visibility) by mutating the DOM (display + textContent +
 * data-tier) on stable elements — never unmounting them — so the pill keeps DOM
 * identity across passes. Called on load and on any tier change.
 *
 *   - upgrade button (optional): display:none when isPro, else visible. The v244
 *     sidebar has no upgrade button, so this branch is a no-op when the element
 *     is absent.
 *   - plan pill: text reads isPro ? "full" : "free" (gifted → "full"; neither
 *     "gifted" nor "pro" is ever surfaced as product copy). data-tier carries
 *     the raw tier for styling and analytics.
 */
export function applyTierUI(
  tier: string,
  els: { upgradeButton?: HTMLElement | null; badge: HTMLElement | null },
): void {
  const isPro = hasFullAccess(tier);
  if (els.upgradeButton) {
    els.upgradeButton.style.display = isPro ? "none" : "";
  }
  if (els.badge) {
    els.badge.textContent = isPro ? "full" : "free";
    els.badge.dataset.tier = tier;
  }
}
