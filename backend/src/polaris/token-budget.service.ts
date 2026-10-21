import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { BillingService } from "../stripe/billing.service";
import type { PolarisMode } from "./polaris.service";

// PHE-129 — Polaris points (Oct 21 rebuild doc, section 8). Each person gets a
// monthly allowance by plan (30 free, 300 full, from
// BillingService.capabilitiesFor(tier).polarisMonthlyPoints, read at check
// time so an upgrade widens it on the next ask) that refreshes on the first of
// the month (UTC). Bought points sit on `purchased_balances.points`, never
// expire, survive plan changes, and are spent only once the month's points run
// out. A turn costs points by its kind, and is debited only after a reply
// succeeds: a failed reply costs nothing.
//
// Storage: `polaris_points` (PK user_id, month) counts the month's points used.

/** What a turn costs: an opening question by its mode, then any follow-up in the thread. */
export const POINT_COSTS = { clarify: 3, understand: 4, decide: 5, followUp: 2 } as const;

/**
 * The cost of one turn. A follow-up (a chip or a typed reply in an open
 * thread) costs 2. An opening question costs its mode; a typed one, whose mode
 * polaris chooses from how it was asked, costs what understand does.
 */
// ponytail: a typed opening question is priced as understand; have polaris report its chosen mode if pricing needs to be exact.
export function turnCost(followUp: boolean, mode: PolarisMode | null): number {
  if (followUp) return POINT_COSTS.followUp;
  return mode ? POINT_COSTS[mode] : POINT_COSTS.understand;
}

/** A person's points this month, surfaced to the client. */
export interface PointsAllowance {
  /** First of the month (UTC), YYYY-MM-01: the polaris_points.month key. */
  month: string;
  /** When the monthly points come back: the first of next month, YYYY-MM-DD. */
  resets: string;
  /** The month's allowance by plan (30 free / 300 full). */
  limit: number;
  /** The month's points used so far. */
  used: number;
  /** max(0, limit - used). */
  monthly_left: number;
  /** Bought points still available. */
  purchased: number;
  /** monthly_left + purchased: what the next turns can spend. */
  remaining: number;
  /** True once nothing is left to spend. */
  limit_reached: boolean;
  /** Whether the plan is full (questions to return to, and the upgrade line, key off it). */
  full: boolean;
}

@Injectable()
export class TokenBudgetService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billing: BillingService,
  ) {}

  /** First of the month in UTC, YYYY-MM-01. The reset is lazy: a new month keys a fresh row. */
  monthStart(now: Date = new Date()): string {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }

  /** The first of the month after `month`. */
  nextMonth(month: string): string {
    const d = new Date(`${month}T00:00:00Z`);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }

  /** The tier's monthly points and the bought balance. Unknown tier reads as free. */
  private async profilePoints(userId: string): Promise<{ limit: number; purchased: number; full: boolean }> {
    const supabase = this.supabaseService.getClient();
    const [{ data: profile }, { data: balance }] = await Promise.all([
      supabase.from("user_profiles").select("tier").eq("id", userId).maybeSingle(),
      supabase.from("purchased_balances").select("points").eq("user_id", userId).maybeSingle(),
    ]);
    const caps = this.billing.capabilitiesFor(profile?.tier as string | null | undefined);
    return {
      limit: caps.polarisMonthlyPoints,
      purchased: Math.max(0, Number(balance?.points ?? 0)),
      full: caps.paid,
    };
  }

  private async monthlyUsed(userId: string, month: string): Promise<number> {
    const { data } = await this.supabaseService
      .getClient()
      .from("polaris_points")
      .select("used")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    return Number(data?.used ?? 0);
  }

  /** The pre-call snapshot. The caller short-circuits (no Claude call, no debit) when `remaining` is below the turn's cost. */
  async check(userId: string): Promise<PointsAllowance> {
    const month = this.monthStart();
    const [{ limit, purchased, full }, used] = await Promise.all([
      this.profilePoints(userId),
      this.monthlyUsed(userId, month),
    ]);
    return this.snapshot(month, limit, used, purchased, full);
  }

  /**
   * Post-call debit, only after a reply succeeded: the month's points first,
   * then the bought balance for whatever is left. Returns the refreshed
   * allowance for display.
   */
  // ponytail: read-then-write, like the weekly meter before it; two replies landing at once can under-count by a turn. Move to an RPC if that shows up.
  async debit(userId: string, before: PointsAllowance, cost: number): Promise<PointsAllowance> {
    const fromMonth = Math.min(cost, before.monthly_left);
    const fromPurchased = Math.min(before.purchased, cost - fromMonth);
    const supabase = this.supabaseService.getClient();
    const used = before.used + fromMonth;
    const purchased = before.purchased - fromPurchased;
    if (fromMonth > 0) {
      await supabase
        .from("polaris_points")
        .upsert(
          { user_id: userId, month: before.month, used, updated_at: new Date().toISOString() },
          { onConflict: "user_id,month" },
        );
    }
    if (fromPurchased > 0) {
      await supabase
        .from("purchased_balances")
        .update({ points: purchased, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    return this.snapshot(before.month, before.limit, used, purchased, before.full);
  }

  private snapshot(month: string, limit: number, used: number, purchased: number, full: boolean): PointsAllowance {
    const monthly_left = Math.max(0, limit - used);
    const remaining = monthly_left + purchased;
    return {
      month,
      resets: this.nextMonth(month),
      limit,
      used,
      monthly_left,
      purchased,
      remaining,
      limit_reached: remaining <= 0,
      full,
    };
  }
}
