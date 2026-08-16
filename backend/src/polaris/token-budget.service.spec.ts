import { test } from "node:test";
import assert from "node:assert/strict";
import { TokenBudgetService } from "./token-budget.service";
import { BillingService } from "../stripe/billing.service";
import type { SupabaseService } from "../supabase/supabase.service";

/**
 * PHE-41 / PHE-69 — the weekly Polaris budget must derive its 0/800 numbers from the
 * single authority `BillingService.capabilitiesFor(tier).polarisWeeklyTokens`,
 * not from constants local to the Polaris lane. These tests stub the tier read so
 * `weeklyLimit` can be checked without a live DB.
 */

/** Minimal stub of the `user_profiles.tier` read chain used by weeklyLimit. */
function budgetServiceForTier(tier: string | null): TokenBudgetService {
  const client = {
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: tier === null ? null : { tier } });
    },
  };
  const supabase = { getClient: () => client } as unknown as SupabaseService;
  return new TokenBudgetService(supabase, new BillingService());
}

const billing = new BillingService();

test("weeklyLimit derives from capabilitiesFor for free/pro/gifted", async () => {
  for (const tier of ["free", "pro", "gifted"] as const) {
    const expected = billing.capabilitiesFor(tier).polarisWeeklyTokens;
    assert.equal(await budgetServiceForTier(tier).weeklyLimit("u"), expected);
  }
});

test("weeklyLimit fails closed to the free budget for unknown/absent tier", async () => {
  const freeLimit = billing.capabilitiesFor("free").polarisWeeklyTokens;
  assert.equal(await budgetServiceForTier(null).weeklyLimit("u"), freeLimit);
  assert.equal(await budgetServiceForTier("garbage").weeklyLimit("u"), freeLimit);
});
