import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ProfileService,
  formatJoined,
  renewalFromSubscription,
  resolveBillingPeriod,
} from "./profile.service";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/profile/profile.service.test.ts

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

test("resolveBillingPeriod: free and gifted have no billing, yearly_paid is yearly, a live sub is monthly", () => {
  assert.equal(resolveBillingPeriod("free", null, null), null);
  assert.equal(resolveBillingPeriod("free", "canceled", "sub_stale"), null);
  assert.equal(resolveBillingPeriod("pro", "gift", null), null);
  assert.equal(resolveBillingPeriod("pro", "yearly_paid", null), "yearly");
  assert.equal(resolveBillingPeriod("pro", "active", "sub_123"), "monthly");
  assert.equal(resolveBillingPeriod("pro", "past_due", "sub_123"), "monthly");
  assert.equal(resolveBillingPeriod("pro", null, null), null);
});

test("renewalFromSubscription reads the earliest item period end, or the legacy field, else null", () => {
  const oct = Date.UTC(2026, 9, 1) / 1000;
  const nov = Date.UTC(2026, 10, 1) / 1000;
  assert.equal(
    renewalFromSubscription({
      items: { data: [{ current_period_end: nov }, { current_period_end: oct }] },
    } as any),
    new Date(oct * 1000).toISOString()
  );
  assert.equal(
    renewalFromSubscription({ items: { data: [] }, current_period_end: nov } as any),
    new Date(nov * 1000).toISOString()
  );
  assert.equal(renewalFromSubscription({ items: { data: [] } } as any), null);
  assert.equal(renewalFromSubscription({ items: undefined } as any), null);
});

test("formatJoined reads 'with PHENYX since <month year>'", () => {
  assert.equal(formatJoined("2026-02-14T10:00:00.000Z"), "with PHENYX since february 2026");
  assert.equal(formatJoined(new Date().toISOString()), "with PHENYX since this week");
  assert.equal(formatJoined(null), null);
  assert.equal(formatJoined("not a date"), null);
});

// ---------------------------------------------------------------------------
// getOverview with fakes
// ---------------------------------------------------------------------------

function makeSupabase(profile: Record<string, unknown>) {
  const tableData: Record<string, unknown> = {
    user_profiles: profile,
    user_persona: { connected_platforms: ["spotify", "reddit"] },
    onairos_connections: [{ platform: "spotify" }, { platform: "youtube" }],
    user_traits: [],
    constellation_state: null,
  };
  return {
    getClient() {
      return {
        from(table: string) {
          const result = { data: tableData[table] ?? null, error: null };
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve(result),
            then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
          };
          return chain;
        },
        auth: {
          admin: {
            getUserById: async () => ({
              data: { user: { email: "mara@example.com" } },
              error: null,
            }),
          },
        },
      };
    },
  } as any;
}

const fakePassphrase = {
  verify: async () => true,
} as any;

function makeStripe(retrieve: (id: string) => Promise<unknown>) {
  const calls: string[] = [];
  const stripe = {
    getClient: () => ({
      subscriptions: {
        retrieve: (id: string) => {
          calls.push(id);
          return retrieve(id);
        },
      },
    }),
  } as any;
  return { stripe, calls };
}

const PERIOD_END = Date.UTC(2026, 9, 1) / 1000;

test("getOverview on a monthly subscription reads renews_at from Stripe", async () => {
  const { stripe, calls } = makeStripe(async () => ({
    items: { data: [{ current_period_end: PERIOD_END }] },
  }));
  const service = new ProfileService(
    makeSupabase({
      display_name: "mara",
      tier: "pro",
      stellar_color: "#5599FF",
      created_at: "2026-02-14T12:00:00.000Z",
      prompt_times: {},
      stripe_subscription_id: "sub_123",
      subscription_status: "active",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.tier, "pro");
  assert.equal(overview.billing_period, "monthly");
  assert.equal(overview.renews_at, new Date(PERIOD_END * 1000).toISOString());
  assert.deepEqual(calls, ["sub_123"]);
  assert.deepEqual(overview.connected_platforms, ["spotify", "youtube"]);
  assert.equal(overview.email, "mara@example.com");
  assert.equal(overview.joined, "with PHENYX since february 2026");
});

test("getOverview on yearly_paid is yearly with no renewal and no Stripe call", async () => {
  const { stripe, calls } = makeStripe(async () => {
    throw new Error("should not be called");
  });
  const service = new ProfileService(
    makeSupabase({
      tier: "pro",
      stripe_subscription_id: null,
      subscription_status: "yearly_paid",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.billing_period, "yearly");
  assert.equal(overview.renews_at, null);
  assert.deepEqual(calls, []);
});

test("getOverview on a gift has no billing period and no renewal", async () => {
  const { stripe, calls } = makeStripe(async () => ({}));
  const service = new ProfileService(
    makeSupabase({
      tier: "gifted",
      stripe_subscription_id: null,
      subscription_status: "gift",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.tier, "pro");
  assert.equal(overview.billing_period, null);
  assert.equal(overview.renews_at, null);
  assert.deepEqual(calls, []);
});

test("getOverview on free never consults Stripe, even with a stale subscription id", async () => {
  const { stripe, calls } = makeStripe(async () => ({}));
  const service = new ProfileService(
    makeSupabase({
      tier: "free",
      stripe_subscription_id: "sub_old",
      subscription_status: "canceled",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.tier, "free");
  assert.equal(overview.billing_period, null);
  assert.equal(overview.renews_at, null);
  assert.deepEqual(calls, []);
});

test("getOverview still returns when Stripe fails: renews_at null, billing_period kept", async () => {
  const { stripe } = makeStripe(async () => {
    throw new Error("stripe down");
  });
  const service = new ProfileService(
    makeSupabase({
      tier: "pro",
      stripe_subscription_id: "sub_123",
      subscription_status: "active",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.billing_period, "monthly");
  assert.equal(overview.renews_at, null);
});

test("getOverview still returns when the Stripe key is missing", async () => {
  const stripe = {
    getClient: () => {
      throw new Error("Missing STRIPE_SECRET_KEY");
    },
  } as any;
  const service = new ProfileService(
    makeSupabase({
      tier: "pro",
      stripe_subscription_id: "sub_123",
      subscription_status: "active",
    }),
    fakePassphrase,
    stripe
  );
  const overview = await service.getOverview("user-1");
  assert.equal(overview.billing_period, "monthly");
  assert.equal(overview.renews_at, null);
});
