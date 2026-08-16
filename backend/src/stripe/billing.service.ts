import { Injectable } from "@nestjs/common";

/** Subscription / purchase tier stored on `user_profiles.tier`. */
export type PaidAccessTier = "pro" | "gifted";

/**
 * The single, centralized capability resolver for a tier (PHE-69 / v67).
 * Every gated read consumes this instead of scattering `if (tier === "free")`
 * checks. `user_profiles.tier ∈ {free,pro,gifted}` is the source of truth,
 * flipped by the Stripe webhooks in {@link ../stripe/stripe.controller.ts}.
 *
 * A tier change takes effect on the NEXT gated read: capabilities are resolved
 * per-request from the freshly-read tier, never cached.
 *
 * v67 commercial model:
 * - Free sees every observation body. Evidence traces are limited to the first
 *   two of the local day. Underneath, Polaris, daily focus, weekly synthesis,
 *   and yearly recap are Pro.
 * - Pro is $12.99/month or $99/year; 800 weekly Polaris tokens; $4.99 top-up.
 * - Grandfathered `gifted` rows resolve identically to pro. The word "gifted"
 *   is never product copy.
 */
export interface TierCapabilities {
  /**
   * How many observation *bodies* are served. v67: Infinity for every tier —
   * free reads the full daily feed. `Infinity` (not a magic large number) so a
   * read gate can express "all" as `index < observationsUnlocked`.
   */
  observationsUnlocked: number;
  /**
   * How many evidence traces (`where this comes from` / citations / provenance)
   * leave the server per local day. Free: 2. Pro: Infinity.
   */
  evidenceTracesPerDay: number;
  /** Weekly Polaris token budget. Free: 0 (Polaris locked). Pro: 800. */
  polarisWeeklyTokens: number;
  /** Whether Polaris is usable at all (composer, threads, ask). */
  polarisAccess: boolean;
  /** Whether served observation payloads include `source_platforms` citations. */
  crossPlatformCitations: boolean;
  /** Whether the full synthesis-version history is readable (not just the latest). */
  trackingOverTime: boolean;
  /** Whether served payloads include provenance (`meta_label`) fields. */
  fullProvenance: boolean;
  /** Pro-only underneath / "something sits under this one" readings. */
  underneath: boolean;
  /** Pro-only daily pillar focus. */
  dailyFocus: boolean;
  /** Pro-only weekly constellation synthesis. */
  weeklySynthesis: boolean;
  /** Pro + one-year tenure yearly recap. Capability flag only; tenure is separate. */
  yearlyRecap: boolean;
  /** Max observation entries per constellation cluster. Free: 2. Pro: Infinity. */
  clusterEntries: number;
  /** Whether $4.99 weekly token top-ups are offered. */
  tokenTopupEnabled: boolean;
}

const PRO_CAPABILITIES: TierCapabilities = {
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: Infinity,
  polarisWeeklyTokens: 800,
  polarisAccess: true,
  crossPlatformCitations: true,
  trackingOverTime: true,
  fullProvenance: true,
  underneath: true,
  dailyFocus: true,
  weeklySynthesis: true,
  yearlyRecap: true,
  clusterEntries: Infinity,
  tokenTopupEnabled: true,
};

const FREE_CAPABILITIES: TierCapabilities = {
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: 2,
  polarisWeeklyTokens: 0,
  polarisAccess: false,
  crossPlatformCitations: false,
  trackingOverTime: false,
  fullProvenance: false,
  underneath: false,
  dailyFocus: false,
  weeklySynthesis: false,
  yearlyRecap: false,
  clusterEntries: 2,
  tokenTopupEnabled: false,
};

@Injectable()
export class BillingService {
  /**
   * Resolve the capability set for a tier. This is the read-side counterpart to
   * the generation-time `locked_for_free` flag: the two MUST agree that free
   * never withholds observation bodies, only traces after the daily budget.
   */
  capabilitiesFor(tier: string | null | undefined): TierCapabilities {
    const paid = tier === "pro" || tier === "gifted";
    return paid ? PRO_CAPABILITIES : FREE_CAPABILITIES;
  }

  /**
   * Thin wrapper kept for remaining binary callers. Derived from
   * {@link capabilitiesFor} so there is a single source of truth for the
   * free/paid split. Gifted is pro-equivalent.
   */
  hasFullAccess(tier: string | null | undefined): boolean {
    return this.capabilitiesFor(tier).polarisAccess;
  }
}
