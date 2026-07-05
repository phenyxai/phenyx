import { HttpException, Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { BillingService } from "./billing.service";
import { BudgetDecision, evaluateBudget, isoWeekStart } from "./polaris-budget";

/**
 * PHE-41 — weekly Polaris token gate, exposed as reusable service methods.
 *
 * The Polaris turn handler does NOT exist yet (Lane 5 / `05-polaris.md`
 * unstarted). This is the documented SEAM it will consume; there is no turn flow
 * here. Expected handler usage per turn:
 *
 *   1. estimate tokens for the request (`messages.count_tokens`);
 *   2. `const decision = await budget.assertPolarisBudget(userId, est)` — throws
 *      402 with upgrade-modal copy if over budget, so no model call happens and
 *      the meter is untouched (AC: block, no increment);
 *   3. run the Polaris turn;
 *   4. `await budget.recordPolarisUsage(userId, actualTokens)` reconciling the
 *      estimate with the real `usage` from the model response.
 *
 * `polaris_token_usage(user_id, week)` already exists (phe31 migration); this
 * never creates it. `week` is the ISO-week Monday (UTC) from {@link isoWeekStart}.
 */
@Injectable()
export class PolarisBudgetService {
  private readonly logger = new Logger(PolarisBudgetService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billing: BillingService
  ) {}

  /**
   * Soft check: resolve the tier budget, read this week's usage, and return the
   * {@link BudgetDecision} without throwing. Use when the caller wants to branch
   * on `allowed` itself; use {@link assertPolarisBudget} to hard-block a turn.
   */
  async checkPolarisBudget(
    userId: string,
    estimatedTokens: number
  ): Promise<BudgetDecision> {
    const [tier, used] = await Promise.all([
      this.getUserTier(userId),
      this.readWeekUsage(userId, isoWeekStart(new Date())),
    ]);
    const limit = this.billing.capabilitiesFor(tier).polarisWeeklyTokens;
    return evaluateBudget(used, estimatedTokens, limit);
  }

  /**
   * Hard gate for a prospective turn. Returns the decision when the turn fits the
   * budget; throws HTTP 402 with upgrade-modal copy when it does not — the caller
   * must abort BEFORE any model call, and must NOT record usage.
   */
  async assertPolarisBudget(
    userId: string,
    estimatedTokens: number
  ): Promise<BudgetDecision> {
    const decision = await this.checkPolarisBudget(userId, estimatedTokens);
    if (!decision.allowed) {
      throw new HttpException(
        {
          error: "polaris_weekly_budget_exceeded",
          upgradeRequired: true,
          message:
            "You've reached this week's Polaris limit. Upgrade to keep the conversation going — your weekly budget resets Monday.",
          used: decision.used,
          limit: decision.limit,
          remaining: decision.remaining,
        },
        402
      );
    }
    return decision;
  }

  /**
   * Add `delta` tokens to this week's meter, creating the row if absent.
   *
   * Concurrency note: the true-atomic form is a DB-side `tokens_used =
   * tokens_used + $delta` (a Postgres function / `ON CONFLICT DO UPDATE`), which
   * would need a migration this ticket is scoped out of adding. Polaris turns are
   * serialized per user (one in-flight message at a time), so this read-then-upsert
   * is race-safe in practice; when the Lane 5 handler lands with real concurrency,
   * promote this to a DB-side increment.
   */
  async recordPolarisUsage(userId: string, delta: number): Promise<void> {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const supabase = this.supabaseService.getClient();
    const week = isoWeekStart(new Date());
    const current = await this.readWeekUsage(userId, week);

    const { error } = await supabase.from("polaris_token_usage").upsert(
      {
        user_id: userId,
        week,
        tokens_used: current + delta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week" }
    );
    if (error) {
      this.logger.error(
        `recordPolarisUsage failed for ${userId} week=${week}: ${error.message}`
      );
      throw error;
    }
  }

  /** Tokens already spent by `userId` in the given ISO-week bucket (0 if none). */
  private async readWeekUsage(userId: string, week: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("polaris_token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .eq("week", week)
      .maybeSingle();
    return (data?.tokens_used as number) ?? 0;
  }

  /** `user_profiles` is keyed by `id` (= auth.users.id), not `user_id`. */
  private async getUserTier(userId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    return (data?.tier as string) ?? "free";
  }
}
