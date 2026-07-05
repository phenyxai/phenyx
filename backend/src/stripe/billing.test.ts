import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "./billing.service";
import { isoWeekStart, evaluateBudget } from "./polaris-budget";

const billing = new BillingService();

// ---------------------------------------------------------------------------
// capabilitiesFor — the single tier resolver (PHE-41)
// ---------------------------------------------------------------------------

test("capabilitiesFor(free): 1 observation, 80 tokens, no citations/tracking/provenance", () => {
  const caps = billing.capabilitiesFor("free");
  assert.equal(caps.observationsUnlocked, 1);
  assert.equal(caps.polarisWeeklyTokens, 80);
  assert.equal(caps.crossPlatformCitations, false);
  assert.equal(caps.trackingOverTime, false);
  assert.equal(caps.fullProvenance, false);
});

test("capabilitiesFor(pro): unlimited observations, 8000 tokens, all gates open", () => {
  const caps = billing.capabilitiesFor("pro");
  assert.equal(caps.observationsUnlocked, Infinity);
  assert.equal(caps.polarisWeeklyTokens, 8000);
  assert.equal(caps.crossPlatformCitations, true);
  assert.equal(caps.trackingOverTime, true);
  assert.equal(caps.fullProvenance, true);
});

test("capabilitiesFor(gifted) resolves identical to pro", () => {
  assert.deepEqual(billing.capabilitiesFor("gifted"), billing.capabilitiesFor("pro"));
});

test("capabilitiesFor treats null/unknown tier as free (fail-closed)", () => {
  const free = billing.capabilitiesFor("free");
  assert.deepEqual(billing.capabilitiesFor(null), free);
  assert.deepEqual(billing.capabilitiesFor(undefined), free);
  assert.deepEqual(billing.capabilitiesFor("garbage"), free);
});

test("hasFullAccess is a thin wrapper over capabilitiesFor", () => {
  assert.equal(billing.hasFullAccess("free"), false);
  assert.equal(billing.hasFullAccess("pro"), true);
  assert.equal(billing.hasFullAccess("gifted"), true);
  assert.equal(billing.hasFullAccess(null), false);
});

// ---------------------------------------------------------------------------
// isoWeekStart — weekly bucket key (Monday, UTC)
// ---------------------------------------------------------------------------

test("isoWeekStart returns the Monday of the week, UTC", () => {
  // 2026-07-05 is a Sunday → its ISO week started Monday 2026-06-29.
  assert.equal(isoWeekStart(new Date("2026-07-05T12:00:00Z")), "2026-06-29");
  // 2026-06-29 is that Monday → maps to itself.
  assert.equal(isoWeekStart(new Date("2026-06-29T00:00:00Z")), "2026-06-29");
  // 2026-07-01 (Wed) is in the same week.
  assert.equal(isoWeekStart(new Date("2026-07-01T23:59:59Z")), "2026-06-29");
});

test("isoWeekStart buckets by UTC, not local offset — Monday 00:30 UTC stays that Monday", () => {
  assert.equal(isoWeekStart(new Date("2026-06-29T00:30:00Z")), "2026-06-29");
});

test("isoWeekStart rolls Sunday 23:59 back to that week's Monday, not the next", () => {
  // 2026-07-05 Sunday 23:59 UTC still belongs to the week of 2026-06-29.
  assert.equal(isoWeekStart(new Date("2026-07-05T23:59:59Z")), "2026-06-29");
});

// ---------------------------------------------------------------------------
// evaluateBudget — boundary block, no increment
// ---------------------------------------------------------------------------

test("evaluateBudget allows a turn that exactly reaches the limit", () => {
  const d = evaluateBudget(79, 1, 80);
  assert.equal(d.allowed, true);
  assert.equal(d.remaining, 1);
});

test("evaluateBudget blocks at exactly the limit (80 used, any positive estimate)", () => {
  const d = evaluateBudget(80, 1, 80);
  assert.equal(d.allowed, false);
  assert.equal(d.used, 80);
  assert.equal(d.limit, 80);
  assert.equal(d.remaining, 0);
});

test("evaluateBudget blocks a turn that would overshoot the limit", () => {
  assert.equal(evaluateBudget(70, 20, 80).allowed, false);
});

test("evaluateBudget clamps negative/NaN usage and estimate to zero", () => {
  const d = evaluateBudget(-5, Number.NaN, 80);
  assert.equal(d.used, 0);
  assert.equal(d.estimated, 0);
  assert.equal(d.allowed, true);
  assert.equal(d.remaining, 80);
});

test("evaluateBudget respects the pro budget (8000)", () => {
  const limit = billing.capabilitiesFor("pro").polarisWeeklyTokens;
  assert.equal(evaluateBudget(7999, 1, limit).allowed, true);
  assert.equal(evaluateBudget(8000, 1, limit).allowed, false);
});
