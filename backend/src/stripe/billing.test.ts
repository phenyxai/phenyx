import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "./billing.service";

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
