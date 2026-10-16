import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsightsStats } from "./stats.ts";

const NOW = new Date(2026, 9, 16); // 16 october 2026

test("buildInsightsStats reads connected platforms, years in view and here since", () => {
  assert.deepEqual(buildInsightsStats(10, { from: 2008, label: "18 years" }, "2026-03-04T00:00:00.000Z", NOW), [
    { key: "platforms", value: "10", label: "connected platforms" },
    { key: "years", value: "18 years", label: "in view" },
    { key: "since", value: "mar 2026", label: "here since" },
  ]);
});

test("buildInsightsStats leaves out what it cannot compute", () => {
  assert.deepEqual(buildInsightsStats(0, null, null, NOW), []);
  assert.deepEqual(buildInsightsStats(1, { from: 2026, label: "10 months" }, "not a date", NOW), [
    { key: "platforms", value: "1", label: "connected platform" },
    { key: "years", value: "1 year", label: "in view" },
  ]);
});
