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
 * PHE-129 commercial model (Oct 21 rebuild doc and company overview): "free
 * covers the moment, full covers the whole view".
 * - Free sees every point and every moment, with what happened and its dated
 *   sources, and the whole insights page. Full adds the reading under each
 *   moment (why it matters, what connects).
 * - Polaris runs on points per calendar month: 30 on free, 300 on full. Points
 *   bought on either plan are a separate balance that never expires; see
 *   {@link ../polaris/token-budget.service.ts}.
 * - New discoveries: 1 a week on free, 10 on full, refreshing Monday 9am in the
 *   person's local time; bought discoveries stay until used.
 * - Full (`pro` in the DB) is $12.99/month or $132.50/year. The person only ever
 *   reads "full"; "pro" is the enum value, never product copy.
 * - Grandfathered `gifted` rows resolve identically to pro. The word "gifted"
 *   is never product copy.
 */
export interface TierCapabilities {
  /**
   * Whether this is a paid tier (pro or gifted). The single binary free/full
   * split — {@link BillingService.hasFullAccess} derives from it.
   */
  paid: boolean;
  /**
   * How many observation *bodies* are served. Infinity for every tier: free
   * reads every moment. `Infinity` (not a magic large number) so a read gate can
   * express "all" as `index < observationsUnlocked`.
   */
  observationsUnlocked: number;
  /**
   * How many evidence traces (the dated sources behind a moment) leave the
   * server. Infinity on both tiers since PHE-129: free sees the sources too.
   */
  evidenceTracesPerDay: number;
  /** Whether a moment's reading (why it matters, what connects) is served. Full only. */
  momentReading: boolean;
  /** Polaris points per calendar month (PHE-129). Free: 30. Pro: 300. */
  polarisMonthlyPoints: number;
  /** New discoveries per week, refreshing Monday 9am local (PHE-129). Free: 1. Pro: 10. */
  weeklyDiscoveries: number;
  /** Whether Polaris is usable at all (composer, threads, ask). True on every tier. */
  polarisAccess: boolean;
  /** Whether served observation payloads include `source_platforms` citations. */
  crossPlatformCitations: boolean;
  /** Whether the full synthesis-version history is readable (not just the latest). */
  trackingOverTime: boolean;
  /** Whether served payloads include provenance (`meta_label`) fields. */
  fullProvenance: boolean;
  /** Full-only underneath / "what sits under this" readings. */
  underneath: boolean;
  /** Pro-only daily pillar focus. */
  dailyFocus: boolean;
  /** Pro-only weekly constellation synthesis. */
  weeklySynthesis: boolean;
  /** Pro + one-year tenure yearly recap. Capability flag only; tenure is separate. */
  yearlyRecap: boolean;
  /** Max observation entries per constellation cluster. Infinity on both tiers: every moment shows. */
  clusterEntries: number;
}

const PRO_CAPABILITIES: TierCapabilities = {
  paid: true,
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: Infinity,
  momentReading: true,
  polarisMonthlyPoints: 300,
  weeklyDiscoveries: 10,
  polarisAccess: true,
  crossPlatformCitations: true,
  trackingOverTime: true,
  fullProvenance: true,
  underneath: true,
  dailyFocus: true,
  weeklySynthesis: true,
  yearlyRecap: true,
  clusterEntries: Infinity,
};

const FREE_CAPABILITIES: TierCapabilities = {
  paid: false,
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: Infinity,
  momentReading: false,
  polarisMonthlyPoints: 30,
  weeklyDiscoveries: 1,
  polarisAccess: true,
  crossPlatformCitations: true,
  trackingOverTime: false,
  fullProvenance: false,
  underneath: false,
  dailyFocus: false,
  weeklySynthesis: false,
  yearlyRecap: false,
  clusterEntries: Infinity,
};

@Injectable()
export class BillingService {
  /**
   * Resolve the capability set for a tier. This is the read-side counterpart to
   * the generation-time `locked_for_free` flag: free never withholds a moment's
   * body or its sources, only the reading under it (PHE-129).
   */
  capabilitiesFor(tier: string | null | undefined): TierCapabilities {
    const paid = tier === "pro" || tier === "gifted";
    return paid ? PRO_CAPABILITIES : FREE_CAPABILITIES;
  }

  /**
   * Thin wrapper kept for remaining binary callers. Derived from
   * {@link capabilitiesFor}'s `paid` flag so there is a single source of truth
   * for the free/full split. Gifted is pro-equivalent.
   */
  hasFullAccess(tier: string | null | undefined): boolean {
    return this.capabilitiesFor(tier).paid;
  }
}
