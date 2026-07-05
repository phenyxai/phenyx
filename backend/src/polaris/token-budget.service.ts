import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { BillingService } from "../stripe/billing.service";

// PHE-27 — weekly Polaris token allowance by access tier (05-polaris.md). Free is
// metered tightly; pro/gifted get the full weekly budget. The budget numbers
// (80 free / 8000 pro|gifted) live in ONE authority —
// BillingService.capabilitiesFor(tier).polarisWeeklyTokens (PHE-41) — and are read
// at CHECK time from the live tier, so a mid-week upgrade widens the ceiling on the
// very next ask.

// Verbatim graceful at-limit copy (ticket §6). Returned on the over-budget
// short-circuit; the chat surface also renders this line at its at-limit mount.
export const AT_LIMIT_MESSAGE =
  "you've reached this week's polaris limit — upgrade for more";

/** A snapshot of a user's weekly Polaris allowance, surfaced to the client. */
export interface WeeklyAllowance {
  /** ISO week start (Monday) in UTC — the polaris_token_usage.week PK component. */
  week: string;
  /** Tokens debited this week so far. */
  used: number;
  /** Tier-derived weekly limit (80 free / 8000 pro|gifted). */
  limit: number;
  /** max(0, limit - used). */
  remaining: number;
  /** True once used >= limit — the ask pipeline short-circuits with no Claude call. */
  limit_reached: boolean;
}

/**
 * PHE-27 — weekly token budget for Polaris. Owns the pre-call gate, the post-call
 * debit, and the (lazy) weekly reset against `polaris_token_usage` (PK
 * `user_id, week`). The tier source of truth is the billing/tier record on
 * `user_profiles.tier` via BillingService — this service never invents its own
 * tier notion. The counter stores integer token totals only, never message content.
 */
@Injectable()
export class TokenBudgetService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billing: BillingService,
  ) {}

  /**
   * ISO week start (Monday) in UTC, as a YYYY-MM-DD date string — matches
   * `polaris_token_usage.week` (date, Monday week start, UTC). The reset is lazy:
   * the first ask of a new week keys a fresh row that starts at 0.
   */
  weekStart(now: Date = new Date()): string {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    // getUTCDay: 0=Sun..6=Sat. Shift so Monday is the week start.
    const day = d.getUTCDay();
    const diff = (day + 6) % 7; // days since Monday
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Tier-derived weekly limit, read at check time (never frozen on the usage row),
   * so a free→pro upgrade widens the ceiling on the very next ask. Gifted is treated
   * identically to pro. Unknown/absent tier fails closed to the free budget.
   */
  async weeklyLimit(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    return this.billing.capabilitiesFor(data?.tier as string | null | undefined)
      .polarisWeeklyTokens;
  }

  /** Tokens debited so far for a user's week (0 when the week has no row yet). */
  async readWeeklyTokens(userId: string, week: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("polaris_token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .eq("week", week)
      .maybeSingle();
    return (data?.tokens_used as number) ?? 0;
  }

  /**
   * Pre-call gate snapshot: the current week's usage vs the tier limit. The caller
   * short-circuits (no Claude call, no debit) when `limit_reached` is true.
   */
  async check(userId: string): Promise<WeeklyAllowance> {
    const week = this.weekStart();
    const [used, limit] = await Promise.all([
      this.readWeeklyTokens(userId, week),
      this.weeklyLimit(userId),
    ]);
    return this.snapshot(week, used, limit);
  }

  /**
   * Post-call debit: `tokens_used += delta`, where `delta` is the ACTUAL total
   * Claude usage (input + output + cache-read + cache-creation), summed by the
   * caller — cache-read tokens count toward the budget by documented policy. The
   * upsert keys on `(user_id, week)`, so concurrent first-asks in a new week
   * remain idempotent. Returns the refreshed allowance for display. `limit` is
   * threaded through from the pre-call check to avoid a second tier read.
   */
  async debit(
    userId: string,
    week: string,
    limit: number,
    delta: number,
  ): Promise<WeeklyAllowance> {
    if (delta <= 0) {
      return this.snapshot(week, await this.readWeeklyTokens(userId, week), limit);
    }
    const supabase = this.supabaseService.getClient();
    const current = await this.readWeeklyTokens(userId, week);
    const next = current + delta;
    await supabase.from("polaris_token_usage").upsert(
      {
        user_id: userId,
        week,
        tokens_used: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week" },
    );
    return this.snapshot(week, next, limit);
  }

  private snapshot(week: string, used: number, limit: number): WeeklyAllowance {
    return {
      week,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      limit_reached: used >= limit,
    };
  }
}
