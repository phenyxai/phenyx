import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsightsStats, momentFacts } from "./stats.ts";

const NOW = new Date(2026, 9, 16); // 16 october 2026

test("buildInsightsStats reads connected platforms, years in view and here since", () => {
  assert.deepEqual(buildInsightsStats(10, 2008, "2026-03-04T00:00:00.000Z", NOW), [
    { key: "platforms", value: "10", label: "connected platforms" },
    { key: "years", value: "18 years", label: "in view" },
    { key: "since", value: "mar 2026", label: "here since" },
  ]);
});

test("buildInsightsStats leaves out what it cannot compute", () => {
  assert.deepEqual(buildInsightsStats(0, null, null, NOW), []);
  assert.deepEqual(buildInsightsStats(1, 2026, "not a date", NOW), [
    { key: "platforms", value: "1", label: "connected platform" },
    { key: "years", value: "1 year", label: "in view" },
  ]);
});

test("momentFacts reads the moments' platforms and earliest dated year", () => {
  const moment = (platform: string | null, occurred_at: string | null, sources: string[] = []) => ({ platform, occurred_at, sources });
  const data = {
    pillars: {
      origin: { clusters: [{ observations: [moment("YouTube", "2008-05-01"), moment(null, null, ["pinterest"])] }] },
      becoming: { clusters: [{ observations: [moment("spotify", "2019-02-01", ["youtube"])] }] },
    },
  } as unknown as Parameters<typeof momentFacts>[0];
  assert.deepEqual(momentFacts(data), { platforms: ["youtube", "pinterest", "spotify"], firstYear: 2008 });
  assert.deepEqual(momentFacts(null), { platforms: [], firstYear: null });
});
