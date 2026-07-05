/**
 * Pure helpers for the weekly Polaris token gate (PHE-41). Kept free of Nest DI
 * and Supabase so the two invariants the ticket calls out — ISO-week bucketing
 * and the boundary block (at exactly the limit, a turn that would exceed it is
 * refused with no increment) — are unit-testable without a live DB.
 *
 * The stateful wrapper that reads/writes `polaris_token_usage` is
 * {@link ./polaris-budget.service.ts PolarisBudgetService}, which the future
 * Polaris turn handler (Lane 5, `05-polaris.md`) consumes as a seam.
 */

/**
 * Monday 00:00 UTC of the ISO week containing `date`, as a `YYYY-MM-DD` string —
 * the `week` bucket key for `polaris_token_usage`. ISO weeks start Monday; UTC so
 * the bucket never shifts with the caller's timezone.
 */
export function isoWeekStart(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0=Sun .. 6=Sat
  // Shift back to Monday: Sunday (0) is 6 days after the week's Monday.
  const deltaToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + deltaToMonday);
  return d.toISOString().slice(0, 10);
}

/** The outcome of a budget check for a single prospective Polaris turn. */
export interface BudgetDecision {
  /** True iff the turn may proceed. */
  allowed: boolean;
  /** Tokens already spent this week. */
  used: number;
  /** The tier's weekly budget (from `capabilitiesFor(tier).polarisWeeklyTokens`). */
  limit: number;
  /** Estimated tokens the prospective turn would consume. */
  estimated: number;
  /** Tokens left this week (never negative). */
  remaining: number;
}

/**
 * Pure budget check. A turn is allowed iff `used + estimated <= limit`, so at
 * exactly `used === limit` any turn with a positive estimate is blocked. The
 * caller must NOT increment usage when `allowed` is false — no model call, no
 * meter change (per the PHE-41 acceptance criteria).
 */
export function evaluateBudget(
  used: number,
  estimated: number,
  limit: number
): BudgetDecision {
  const safeUsed = Number.isFinite(used) && used > 0 ? used : 0;
  const safeEst = Number.isFinite(estimated) && estimated > 0 ? estimated : 0;
  return {
    allowed: safeUsed + safeEst <= limit,
    used: safeUsed,
    limit,
    estimated: safeEst,
    remaining: Math.max(0, limit - safeUsed),
  };
}
