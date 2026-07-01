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
 * Constellation timeline gating, and the Profile tier card all read from here.
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
 * toggles the upgrade button's visibility and the tier badge's label/attribute by
 * mutating the DOM (display + textContent + data-tier) on stable elements — never
 * unmounting them — so badge/button keep DOM identity across passes. Called on
 * load and on any tier change.
 *
 *   - upgrade button: display:none when isPro, else visible.
 *   - tier badge: text reads isPro ? "pro" : "free" (gifted → "pro"; the word
 *     "gifted" is never surfaced as product copy). data-tier carries the raw tier
 *     for styling and analytics.
 */
export function applyTierUI(
  tier: string,
  els: { upgradeButton: HTMLElement | null; badge: HTMLElement | null },
): void {
  const isPro = hasFullAccess(tier);
  if (els.upgradeButton) {
    els.upgradeButton.style.display = isPro ? "none" : "";
  }
  if (els.badge) {
    els.badge.textContent = isPro ? "pro" : "free";
    els.badge.dataset.tier = tier;
  }
}
