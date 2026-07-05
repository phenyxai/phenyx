import { Injectable } from "@nestjs/common";

/** Subscription / purchase tier stored on `user_profiles.tier`. */
export type PaidAccessTier = "pro" | "gifted";

/**
 * The single, centralized capability resolver for a tier (PHE-41). Every gated
 * read consumes this instead of scattering `if (tier === "free")` checks, so the
 * free/paid boundary lives in exactly one place. `user_profiles.tier ∈
 * {free,pro,gifted}` is the source of truth, flipped by the Stripe webhooks in
 * {@link ../stripe/stripe.controller.ts}.
 *
 * A tier change takes effect on the NEXT gated read: capabilities are resolved
 * per-request from the freshly-read tier, never cached.
 */
export interface TierCapabilities {
  /**
   * How many observations are served unlocked. Free unlocks exactly the freshest
   * one; pro/gifted unlock everything. `Infinity` (not a magic large number) so a
   * read gate can express "all" as `index < observationsUnlocked`.
   */
  observationsUnlocked: number;
  /** Weekly Polaris token budget (consumed by the Polaris lane's TokenBudgetService). */
  polarisWeeklyTokens: number;
  /** Whether served observation payloads include `source_platforms` citations. */
  crossPlatformCitations: boolean;
  /** Whether the full synthesis-version history is readable (not just the latest). */
  trackingOverTime: boolean;
  /** Whether served payloads include provenance (`meta_label`) fields. */
  fullProvenance: boolean;
}

@Injectable()
export class BillingService {
  /**
   * Resolve the capability set for a tier. This is the read-side counterpart to
   * the generation-time `locked_for_free` flag (PHE-37): the two MUST agree that
   * free unlocks exactly one observation.
   */
  capabilitiesFor(tier: string | null | undefined): TierCapabilities {
    const free = tier !== "pro" && tier !== "gifted";
    return {
      observationsUnlocked: free ? 1 : Infinity,
      polarisWeeklyTokens: free ? 80 : 8000,
      crossPlatformCitations: !free,
      trackingOverTime: !free,
      fullProvenance: !free,
    };
  }

  /**
   * Thin wrapper kept for the generation-time gate (`buildInsertRows`) and any
   * remaining binary callers. Derived from {@link capabilitiesFor} so there is a
   * single source of truth for the free/paid split.
   */
  hasFullAccess(tier: string | null | undefined): boolean {
    return this.capabilitiesFor(tier).crossPlatformCitations;
  }
}
