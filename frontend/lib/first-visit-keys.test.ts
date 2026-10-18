/**
 * PHE-96 — intro banner keys. Insights was the you tab, so a banner already
 * seen under `intro:you` counts as seen for insights.
 *
 *   node --test lib/first-visit-keys.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import { introBannerKeys, isBannerSeen } from "./first-visit-keys.ts";

test("each tab reads its own key first", () => {
  assert.deepEqual(introBannerKeys("u1", "constellation"), ["phenyx:u1:intro:constellation"]);
  assert.deepEqual(introBannerKeys("u1", "polaris"), ["phenyx:u1:intro:polaris"]);
});

test("insights also honours the old you key", () => {
  assert.deepEqual(introBannerKeys("u1", "insights"), [
    "phenyx:u1:intro:insights",
    "phenyx:u1:intro:you",
  ]);
});

test("a banner dismissed under intro:you stays dismissed on insights", () => {
  const stored = new Set(["phenyx:u1:intro:you"]);
  assert.equal(isBannerSeen(introBannerKeys("u1", "insights"), (k) => stored.has(k)), true);
});

test("an unseen banner is not seen, and another user's flag does not count", () => {
  const stored = new Set(["phenyx:u2:intro:you", "phenyx:u2:intro:insights"]);
  assert.equal(isBannerSeen(introBannerKeys("u1", "insights"), (k) => stored.has(k)), false);
});
