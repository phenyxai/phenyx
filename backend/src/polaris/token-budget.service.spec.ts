import { test } from "node:test";
import assert from "node:assert/strict";
import { TokenBudgetService } from "./token-budget.service";
import { BillingService } from "../stripe/billing.service";
import type { SupabaseService } from "../supabase/supabase.service";

/**
 * PHE-41 / PHE-69 / PHE-94 — the weekly Polaris allowance must derive its 3/40
 * numbers from the single authority
 * `BillingService.capabilitiesFor(tier).polarisWeeklyQuestions`, not from
 * constants local to the Polaris lane, and the meter must count QUESTIONS: one
 * completed ask debits exactly one, whatever the token cost. These tests stub the
 * tier read and the `polaris_token_usage` row so the service runs without a DB.
 */

interface UsageRow {
  user_id: string;
  week: string;
  tokens_used: number;
  updated_at: string;
}

/**
 * Minimal in-memory stand-in for the two Supabase chains the service uses:
 *   from("user_profiles").select("tier").eq("id", u).maybeSingle()
 *   from("polaris_token_usage").select("tokens_used").eq(...).eq(...).maybeSingle()
 *   from("polaris_token_usage").upsert(row, { onConflict })
 */
function fakeSupabase(tier: string | null, rows: UsageRow[] = []) {
  const upserts: UsageRow[] = [];
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
        if (table === "user_profiles") {
          return Promise.resolve({ data: tier === null ? null : { tier } });
        }
        const hit = rows.find(
          (r) => r.user_id === filters.user_id && r.week === filters.week,
        );
        return Promise.resolve({ data: hit ? { tokens_used: hit.tokens_used } : null });
      },
      upsert(row: UsageRow) {
        upserts.push(row);
        const i = rows.findIndex(
          (r) => r.user_id === row.user_id && r.week === row.week,
        );
        if (i >= 0) rows[i] = row;
        else rows.push(row);
        return Promise.resolve({ data: null, error: null });
      },
    };
    return q;
  };
  const client = { from: (table: string) => chain(table) };
  const supabase = { getClient: () => client } as unknown as SupabaseService;
  return { supabase, rows, upserts };
}

function budgetServiceForTier(tier: string | null, rows: UsageRow[] = []) {
  const fake = fakeSupabase(tier, rows);
  return {
    service: new TokenBudgetService(fake.supabase, new BillingService()),
    ...fake,
  };
}

const billing = new BillingService();

test("weeklyLimit derives from capabilitiesFor for free/pro/gifted", async () => {
  for (const tier of ["free", "pro", "gifted"] as const) {
    const expected = billing.capabilitiesFor(tier).polarisWeeklyQuestions;
    assert.equal(await budgetServiceForTier(tier).service.weeklyLimit("u"), expected);
  }
});

test("weeklyLimit is 3 questions on free and 40 on pro/gifted", async () => {
  assert.equal(await budgetServiceForTier("free").service.weeklyLimit("u"), 3);
  assert.equal(await budgetServiceForTier("pro").service.weeklyLimit("u"), 40);
  assert.equal(await budgetServiceForTier("gifted").service.weeklyLimit("u"), 40);
});

test("weeklyLimit fails closed to the free allowance for unknown/absent tier", async () => {
  const freeLimit = billing.capabilitiesFor("free").polarisWeeklyQuestions;
  assert.equal(await budgetServiceForTier(null).service.weeklyLimit("u"), freeLimit);
  assert.equal(await budgetServiceForTier("garbage").service.weeklyLimit("u"), freeLimit);
});

test("weekStart is the ISO Monday (UTC) of the given date", () => {
  const svc = budgetServiceForTier("free").service;
  // 2026-09-07 is a Monday.
  assert.equal(svc.weekStart(new Date("2026-09-07T00:00:00Z")), "2026-09-07");
  assert.equal(svc.weekStart(new Date("2026-09-10T15:30:00Z")), "2026-09-07");
  assert.equal(svc.weekStart(new Date("2026-09-13T23:59:59Z")), "2026-09-07");
  assert.equal(svc.weekStart(new Date("2026-09-14T00:00:00Z")), "2026-09-14");
});

test("check on a fresh week reports the full allowance and no limit", async () => {
  const { service } = budgetServiceForTier("free");
  const a = await service.check("u");
  assert.equal(a.used, 0);
  assert.equal(a.limit, 3);
  assert.equal(a.remaining, 3);
  assert.equal(a.limit_reached, false);
  assert.equal(a.week, service.weekStart());
});

test("debit adds exactly one question per completed ask, whatever the token cost", async () => {
  const { service, rows, upserts } = budgetServiceForTier("pro");
  const week = service.weekStart();

  const first = await service.debit("u", week, 40);
  assert.equal(first.used, 1);
  assert.equal(first.remaining, 39);
  assert.equal(first.limit_reached, false);

  const second = await service.debit("u", week, 40);
  assert.equal(second.used, 2);
  assert.equal(second.remaining, 38);

  assert.equal(upserts.length, 2);
  assert.deepEqual(
    upserts.map((r) => r.tokens_used),
    [1, 2],
    "the reused tokens_used column holds the question count",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, "u");
  assert.equal(rows[0].week, week);
});

test("a free account can ask three questions in a week and the fourth is refused", async () => {
  const { service } = budgetServiceForTier("free");
  const week = service.weekStart();

  for (let i = 1; i <= 3; i++) {
    const before = await service.check("u");
    assert.equal(before.limit_reached, false, `ask ${i} should be allowed`);
    const after = await service.debit("u", week, before.limit);
    assert.equal(after.used, i);
    assert.equal(after.remaining, 3 - i);
  }

  const fourth = await service.check("u");
  assert.equal(fourth.used, 3);
  assert.equal(fourth.limit, 3);
  assert.equal(fourth.remaining, 0);
  assert.equal(fourth.limit_reached, true);
});

test("a mid-week upgrade widens the ceiling on the next check without touching the row", async () => {
  const week = budgetServiceForTier("free").service.weekStart();
  const rows: UsageRow[] = [
    { user_id: "u", week, tokens_used: 3, updated_at: new Date().toISOString() },
  ];
  const asFree = budgetServiceForTier("free", rows).service;
  assert.equal((await asFree.check("u")).limit_reached, true);

  const asPro = budgetServiceForTier("pro", rows).service;
  const a = await asPro.check("u");
  assert.equal(a.used, 3);
  assert.equal(a.limit, 40);
  assert.equal(a.remaining, 37);
  assert.equal(a.limit_reached, false);
});

test("remaining never goes negative when usage exceeds a lowered limit", async () => {
  const week = budgetServiceForTier("free").service.weekStart();
  const rows: UsageRow[] = [
    { user_id: "u", week, tokens_used: 12, updated_at: new Date().toISOString() },
  ];
  const a = await budgetServiceForTier("free", rows).service.check("u");
  assert.equal(a.remaining, 0);
  assert.equal(a.limit_reached, true);
});
