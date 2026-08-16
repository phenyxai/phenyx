import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "./billing.service";

const billing = new BillingService();

// ---------------------------------------------------------------------------
// capabilitiesFor — the single tier resolver (PHE-69 / v67)
// ---------------------------------------------------------------------------

test("capabilitiesFor(free): all bodies, 2 traces/day, polaris locked", () => {
  const caps = billing.capabilitiesFor("free");
  assert.equal(caps.observationsUnlocked, Infinity);
  assert.equal(caps.evidenceTracesPerDay, 2);
  assert.equal(caps.polarisWeeklyTokens, 0);
  assert.equal(caps.polarisAccess, false);
  assert.equal(caps.crossPlatformCitations, false);
  assert.equal(caps.trackingOverTime, false);
  assert.equal(caps.fullProvenance, false);
  assert.equal(caps.underneath, false);
  assert.equal(caps.dailyFocus, false);
  assert.equal(caps.weeklySynthesis, false);
  assert.equal(caps.yearlyRecap, false);
  assert.equal(caps.clusterEntries, 2);
  assert.equal(caps.tokenTopupEnabled, false);
});

test("capabilitiesFor(pro): 800 tokens, all traces, polaris open", () => {
  const caps = billing.capabilitiesFor("pro");
  assert.equal(caps.observationsUnlocked, Infinity);
  assert.equal(caps.evidenceTracesPerDay, Infinity);
  assert.equal(caps.polarisWeeklyTokens, 800);
  assert.equal(caps.polarisAccess, true);
  assert.equal(caps.crossPlatformCitations, true);
  assert.equal(caps.trackingOverTime, true);
  assert.equal(caps.fullProvenance, true);
  assert.equal(caps.underneath, true);
  assert.equal(caps.dailyFocus, true);
  assert.equal(caps.weeklySynthesis, true);
  assert.equal(caps.yearlyRecap, true);
  assert.equal(caps.clusterEntries, Infinity);
  assert.equal(caps.tokenTopupEnabled, true);
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

test("hasFullAccess is a thin wrapper over polarisAccess", () => {
  assert.equal(billing.hasFullAccess("free"), false);
  assert.equal(billing.hasFullAccess("pro"), true);
  assert.equal(billing.hasFullAccess("gifted"), true);
  assert.equal(billing.hasFullAccess(null), false);
});
