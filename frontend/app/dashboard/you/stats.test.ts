import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildYouStats,
  constellationAge,
  constellationStartYear,
  formatJoinedSince,
} from "./stats.ts";

// Run with: node --experimental-strip-types --test app/dashboard/you/stats.test.ts

const NOW = new Date(2026, 8, 7); // 7 september 2026

function pillars(counts: number[]) {
  const names = [
    "origin",
    "emergence",
    "self_creation",
    "convergence",
    "becoming",
    "recognition",
    "transcendence",
  ];
  const out: Record<string, { observation_count: number }> = {};
  names.forEach((name, i) => {
    out[name] = { observation_count: counts[i] ?? 0 };
  });
  return out as any;
}

function data(overrides: Record<string, unknown> = {}) {
  return {
    timeline: { span: ["2014", "2026"], breaks: [{ at: 0.3, label: "a" }, { at: 0.7, label: "b" }] },
    tenure: { years: 0.5, since: "2026-02-14T00:00:00.000Z" },
    pillars: pillars([5, 4, 3, 2, 1, 0, 11]),
    ...overrides,
  } as any;
}

test("constellationStartYear prefers the first 4-digit year in the span, then tenure.since", () => {
  assert.equal(constellationStartYear(data()), 2014);
  assert.equal(constellationStartYear(data({ timeline: { span: ["since 2019", "now"], breaks: [] } })), 2019);
  assert.equal(constellationStartYear(data({ timeline: { span: [], breaks: [] } })), 2026);
  assert.equal(
    constellationStartYear(data({ timeline: { span: [], breaks: [] }, tenure: { years: 0, since: null } })),
    null,
  );
});

test("constellationAge counts months from january of the start year through now", () => {
  const age = constellationAge(data(), NOW);
  assert.deepEqual(age, { label: "12 years, 9 months", from: 2014, years: 12, months: 9 });
});

test("constellationAge uses singular forms and drops a zero months part", () => {
  assert.equal(constellationAge(data({ timeline: { span: ["2025"], breaks: [] } }), new Date(2026, 0, 15))?.label, "1 year, 1 month");
  assert.equal(constellationAge(data({ timeline: { span: ["2025"], breaks: [] } }), new Date(2025, 11, 1))?.label, "1 year");
  assert.equal(constellationAge(data({ timeline: { span: ["2026"], breaks: [] } }), new Date(2026, 0, 1))?.label, "1 month");
  assert.equal(constellationAge(data({ timeline: { span: [], breaks: [] }, tenure: { years: 0, since: null } }), NOW), null);
});

test("buildYouStats lays out age, moments, turning points, accounts", () => {
  const rows = buildYouStats(data(), 7, NOW);
  assert.deepEqual(rows, [
    { key: "age", label: "age", value: "12 years, 9 months", note: "from 2014 to now" },
    { key: "moments", label: "moments", value: "26", note: "across 12 years" },
    { key: "turning points", label: "turning points", value: "2", note: "where several accounts changed at once" },
    { key: "accounts", label: "accounts", value: "7", note: "connected and contributing" },
  ]);
});

test("buildYouStats omits rows with no value", () => {
  const rows = buildYouStats(
    data({ timeline: { span: [], breaks: [] }, tenure: { years: 0, since: null }, pillars: pillars([]) }),
    0,
    NOW,
  );
  assert.deepEqual(rows, []);

  const onlyAccounts = buildYouStats(null, 3, NOW);
  assert.deepEqual(onlyAccounts, [
    { key: "accounts", label: "accounts", value: "3", note: "connected and contributing" },
  ]);
});

test("buildYouStats drops the moments note inside the first year and says 'across 1 year' after it", () => {
  const first = buildYouStats(data({ timeline: { span: ["2026"], breaks: [] } }), 0, NOW);
  assert.equal(first[1].note, null);
  const second = buildYouStats(data({ timeline: { span: ["2025"], breaks: [] } }), 0, NOW);
  assert.equal(second[1].note, "across 1 year");
});

test("formatJoinedSince matches the backend line", () => {
  assert.equal(formatJoinedSince("2026-02-14T10:00:00.000Z", NOW), "with PHENYX since february 2026");
  assert.equal(formatJoinedSince(NOW.toISOString(), NOW), "with PHENYX since this week");
  assert.equal(formatJoinedSince(null, NOW), null);
  assert.equal(formatJoinedSince("nope", NOW), null);
});
