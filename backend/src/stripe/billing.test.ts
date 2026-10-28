import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "./billing.service";

const billing = new BillingService();

// ---------------------------------------------------------------------------
// capabilitiesFor — the single tier resolver (PHE-69 / v67, PHE-129)
// ---------------------------------------------------------------------------

test("capabilitiesFor(free): every moment with its sources, no reading, 30 points", () => {
  const caps = billing.capabilitiesFor("free");
  assert.equal(caps.paid, false);
  assert.equal(caps.observationsUnlocked, Infinity);
  assert.equal(caps.evidenceTracesPerDay, Infinity);
  assert.equal(caps.clusterEntries, Infinity);
  assert.equal(caps.momentReading, false);
  assert.equal(caps.polarisMonthlyPoints, 30);
  assert.equal(caps.polarisAccess, true);
  assert.equal(caps.trackingOverTime, false);
  assert.equal(caps.underneath, false);
  assert.equal(caps.yearlyRecap, false);
});

test("capabilitiesFor(pro): the reading, 300 points", () => {
  const caps = billing.capabilitiesFor("pro");
  assert.equal(caps.paid, true);
  assert.equal(caps.evidenceTracesPerDay, Infinity);
  assert.equal(caps.clusterEntries, Infinity);
  assert.equal(caps.momentReading, true);
  assert.equal(caps.polarisMonthlyPoints, 300);
  assert.equal(caps.trackingOverTime, true);
  assert.equal(caps.yearlyRecap, true);
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

test("polarisAccess is not the paid flag: free has polaris with fewer points", () => {
  const free = billing.capabilitiesFor("free");
  const pro = billing.capabilitiesFor("pro");
  assert.equal(free.polarisAccess, pro.polarisAccess);
  assert.ok(free.polarisMonthlyPoints > 0);
  assert.ok(free.polarisMonthlyPoints < pro.polarisMonthlyPoints);
});

test("hasFullAccess is a thin wrapper over `paid`", () => {
  for (const tier of ["free", "pro", "gifted", null, "garbage"]) {
    assert.equal(billing.hasFullAccess(tier), billing.capabilitiesFor(tier).paid);
  }
  assert.equal(billing.hasFullAccess("free"), false);
  assert.equal(billing.hasFullAccess("pro"), true);
  assert.equal(billing.hasFullAccess("gifted"), true);
  assert.equal(billing.hasFullAccess(null), false);
});
