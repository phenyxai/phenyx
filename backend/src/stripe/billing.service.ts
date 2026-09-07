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
 * v244 commercial model (PHE-92, PHE-94; v67 gave free two traces a day and
 * no Polaris):
 * - Free sees every observation of the day, every body, and the time span each
 *   one rests on. The evidence trace is never served to free: the door is shown
 *   on every card and opens none. Underneath, daily focus, weekly synthesis,
 *   and yearly recap are full-only.
 * - Polaris is open on both tiers and metered by QUESTIONS, not tokens: 3 a
 *   week on free, 40 a week on full. Free hits the upgrade modal at the limit;
 *   full is offered the $4.99 top-up.
 * - Full (`pro` in the DB) is $12.99/month or $99/year. The person only ever
 *   reads "full"; "pro" is the enum value, never product copy.
 * - Grandfathered `gifted` rows resolve identically to pro. The word "gifted"
 *   is never product copy.
 */
export interface TierCapabilities {
  /**
   * Whether this is a paid tier (pro or gifted). The single binary free/full
   * split — {@link BillingService.hasFullAccess} derives from it, so a
   * capability that free also has (Polaris access, since v244) never doubles
   * as the paid flag.
   */
  paid: boolean;
  /**
   * How many observation *bodies* are served. v67: Infinity for every tier —
   * free reads the full daily feed. `Infinity` (not a magic large number) so a
   * read gate can express "all" as `index < observationsUnlocked`.
   */
  observationsUnlocked: number;
  /**
   * How many evidence traces (`what this rests on` / citations / provenance)
   * leave the server. Free: 0 (v244: the trace is wholly behind full; a served
   * free row keeps `{ sig, recs }` and its time span so the door has a name).
   * Pro: Infinity. The gate indexes the all-time `surfaced_at DESC` list, so a
   * finite budget means "the N freshest rows", not N fresh ones each day.
   */
  evidenceTracesPerDay: number;
  /**
   * Weekly Polaris QUESTION allowance (PHE-94). Free: 3. Pro: 40. One completed
   * ask debits one question regardless of its token cost; see
   * {@link ../polaris/token-budget.service.ts}.
   */
  polarisWeeklyQuestions: number;
  /**
   * Whether Polaris is usable at all (composer, threads, ask). True on every
   * tier since v244 — the weekly question allowance is the only gate.
   */
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
  /** Max observation entries per constellation cluster. Free: 2. Pro: Infinity. */
  clusterEntries: number;
  /** Whether the $4.99 weekly question top-up is offered (full only). */
  tokenTopupEnabled: boolean;
}

const PRO_CAPABILITIES: TierCapabilities = {
  paid: true,
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: Infinity,
  polarisWeeklyQuestions: 40,
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
  paid: false,
  observationsUnlocked: Infinity,
  evidenceTracesPerDay: 0,
  polarisWeeklyQuestions: 3,
  polarisAccess: true,
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
   * never withholds observation bodies, only the evidence trace behind them.
   */
  capabilitiesFor(tier: string | null | undefined): TierCapabilities {
    const paid = tier === "pro" || tier === "gifted";
    return paid ? PRO_CAPABILITIES : FREE_CAPABILITIES;
  }

  /**
   * Thin wrapper kept for remaining binary callers. Derived from
   * {@link capabilitiesFor}'s `paid` flag so there is a single source of truth
   * for the free/full split. Gifted is pro-equivalent. (Before PHE-94 this read
   * `polarisAccess`, which is now true on free too.)
   */
  hasFullAccess(tier: string | null | undefined): boolean {
    return this.capabilitiesFor(tier).paid;
  }
}
