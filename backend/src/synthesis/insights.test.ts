import { test } from "node:test";
import assert from "node:assert/strict";
import { ERA_TITLES, insightsStale, normalizeInsights } from "./insights";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/synthesis/insights.test.ts

const NOW = new Date("2026-10-16T12:00:00.000Z");
const lower = (s: string) => s.toLowerCase();

test("normalizeInsights cleans prose, titles the eras in order and caps the lists", () => {
  const out = normalizeInsights(
    {
      becoming_clearer: { line: "The work is getting closer.", support: "Two worlds meet." },
      needs_shape: { line: "", support: "ignored without a line" },
      matters: [1, 2, 3, 4, 5].map((n) => ({ title: `Value ${n}`, body: "Shows up often." })),
      eras: [
        { years: "2006-2017", place: "Los Angeles", line: "Film openings." },
        { years: "2018–2023", place: "", line: "A product career." },
        { years: "2024-now", place: "", line: "Sharing the work." },
        { years: "2030", place: "", line: "a fourth era is dropped" },
      ],
    },
    lower,
    7,
    NOW
  );
  assert.equal(out.version, 7);
  assert.equal(out.generated_at, NOW.toISOString());
  assert.deepEqual(out.becoming_clearer, { line: "the work is getting closer.", support: "two worlds meet." });
  assert.equal(out.needs_shape, null);
  assert.equal(out.matters.length, 4);
  assert.deepEqual(
    out.eras.map((e) => [e.title, e.years, e.place]),
    [
      [ERA_TITLES[0], "2006 – 2017", "los angeles"],
      [ERA_TITLES[1], "2018 – 2023", null],
      [ERA_TITLES[2], "2024 – now", null],
    ]
  );
});

test("an era without a line drops out but the others keep their own titles", () => {
  const out = normalizeInsights(
    { eras: [{ years: "2006 – 2017", place: "", line: "" }, { years: "2018 – 2023", place: "", line: "x." }] },
    lower,
    1,
    NOW
  );
  assert.deepEqual(out.eras.map((e) => e.title), [ERA_TITLES[1]]);
});

test("insightsStale is true only when a constellation version has no reading of its own", () => {
  assert.equal(insightsStale(null, null), false);
  assert.equal(insightsStale(null, 3), true);
  assert.equal(insightsStale({ version: 2 }, 3), true);
  assert.equal(insightsStale({ version: 3 }, 3), false);
});
