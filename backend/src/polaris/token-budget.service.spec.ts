import { test } from "node:test";
import assert from "node:assert/strict";
import { POINT_COSTS, TokenBudgetService, turnCost } from "./token-budget.service";
import { BillingService } from "../stripe/billing.service";
import type { SupabaseService } from "../supabase/supabase.service";

/**
 * PHE-129 — Polaris points. The monthly allowance comes from the single
 * authority `BillingService.capabilitiesFor(tier).polarisMonthlyPoints`; a turn
 * costs by its kind; the month's points are spent before bought ones. These
 * tests stub the profile row and `polaris_points` so the service runs without
 * a DB.
 */

interface PointsRow {
  user_id: string;
  month: string;
  used: number;
}

type Profile = { tier: string; purchased_points: number };

function fakeSupabase(profile: Profile | null, rows: PointsRow[] = []) {
  const chain = (table: string) => {
    const filters: Record<string, unknown> = {};
    const q = {
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return q;
      },
      maybeSingle() {
        if (table === "user_profiles") return Promise.resolve({ data: profile && { tier: profile.tier } });
        if (table === "purchased_balances") return Promise.resolve({ data: profile && { points: profile.purchased_points } });
        const hit = rows.find((r) => r.user_id === filters.user_id && r.month === filters.month);
        return Promise.resolve({ data: hit ? { used: hit.used } : null });
      },
      upsert(row: PointsRow) {
        const i = rows.findIndex((r) => r.user_id === row.user_id && r.month === row.month);
        if (i >= 0) rows[i] = row;
        else rows.push(row);
        return Promise.resolve({ data: null, error: null });
      },
      update(patch: { points: number }) {
        if (profile && table === "purchased_balances") profile.purchased_points = patch.points;
        return q;
      },
    };
    return q;
  };
  const client = { from: (table: string) => chain(table) };
  return { getClient: () => client } as unknown as SupabaseService;
}

const service = (profile: Profile | null, rows: PointsRow[] = []) =>
  new TokenBudgetService(fakeSupabase(profile, rows), new BillingService());

test("turnCost: 3, 4 or 5 by mode, 4 for a typed opening question, 2 for a follow-up", () => {
  assert.equal(turnCost(false, "clarify"), 3);
  assert.equal(turnCost(false, "understand"), 4);
  assert.equal(turnCost(false, "decide"), 5);
  assert.equal(turnCost(false, null), POINT_COSTS.understand);
  assert.equal(turnCost(true, "decide"), 2);
});

test("monthStart is the first of the month (UTC) and points reset on the first of the next", () => {
  const s = service(null);
  assert.equal(s.monthStart(new Date("2026-10-21T23:30:00Z")), "2026-10-01");
  assert.equal(s.nextMonth("2026-10-01"), "2026-11-01");
  assert.equal(s.nextMonth("2026-12-01"), "2027-01-01");
});

test("check: 30 on free and 300 on full, plus the bought balance; unknown profile reads as free", async () => {
  const free = await service({ tier: "free", purchased_points: 0 }).check("u");
  assert.equal(free.limit, 30);
  assert.equal(free.remaining, 30);
  const full = await service({ tier: "pro", purchased_points: 100 }).check("u");
  assert.equal(full.limit, 300);
  assert.equal(full.remaining, 400);
  assert.equal((await service(null).check("u")).limit, 30);
});

test("debit spends the month's points first, then the bought ones", async () => {
  const profile = { tier: "free", purchased_points: 10 };
  const rows: PointsRow[] = [];
  const s = service(profile, rows);
  const month = s.monthStart();
  rows.push({ user_id: "u", month, used: 28 });
  const before = await s.check("u");
  assert.equal(before.monthly_left, 2);
  const after = await s.debit("u", before, 5);
  assert.equal(after.used, 30);
  assert.equal(after.monthly_left, 0);
  assert.equal(after.purchased, 7);
  assert.equal(profile.purchased_points, 7);
  assert.equal(rows[0].used, 30);
});

test("limit_reached only once nothing is left to spend", async () => {
  const rows: PointsRow[] = [];
  const s = service({ tier: "free", purchased_points: 0 }, rows);
  rows.push({ user_id: "u", month: s.monthStart(), used: 31 });
  const a = await s.check("u");
  assert.equal(a.monthly_left, 0);
  assert.equal(a.remaining, 0);
  assert.equal(a.limit_reached, true);
});
