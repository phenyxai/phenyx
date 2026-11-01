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
 * gifted. The single tier source for the dashboard; Constellation timeline
 * gating and polaris's monthly points fallback read from here.
 *
 * Defaults to "free" until the row resolves (and when signed out) so tier-gated UI
 * fails closed — a pro surface is never shown to an unknown/unauthenticated user.
 *
 * Tier is read directly via the supabase browser client (same path as
 * fetchProfile / the upgrade surfaces); there is no backend tier endpoint.
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
