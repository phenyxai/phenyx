import { test } from "node:test";
import assert from "node:assert/strict";
import { insightsStale, milestoneDate, normalizeInsights, servedInsights, type MomentIndex } from "./insights";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/synthesis/insights.test.ts

const NOW = new Date("2026-10-16T12:00:00.000Z");
const lower = (s: string) => s.toLowerCase();
const MOMENTS: MomentIndex = new Map([
  ["m-2008", { date: "2008-05-01", pillar: "origin" }],
  ["m-2019", { date: "2019-03-01", pillar: "self_creation" }],
  ["m-2026", { date: "2026-03-12", pillar: "recognition" }],
  ["m-undated", { date: null, pillar: "becoming" }],
]);

test("normalizeInsights cleans prose, keeps only given moment ids, and caps the lists", () => {
  const out = normalizeInsights(
    {
      becoming_clearer: { line: "The work is getting closer.", support: "Two worlds meet.", moment_ids: ["m-2019", "nope", "m-2019"] },
      needs_shape: { line: "", support: "ignored without a line", moment_ids: [] },
      matters: [1, 2, 3, 4, 5].map((n) => ({ title: `Value ${n}`, body: "Shows up often.", moment_ids: ["m-2008"] })),
      patterns: [
        { title: "You revisit before you decide", body: "You compare periods.", moment_ids: ["m-2026"] },
        { title: "Rests on nothing", body: "dropped", moment_ids: ["invented"] },
      ],
      arc: "rebirth",
    },
    lower,
    7,
    NOW,
    MOMENTS,
  );
  assert.equal(out.version, 7);
  assert.equal(out.generated_at, NOW.toISOString());
  assert.deepEqual(out.becoming_clearer, { line: "the work is getting closer.", support: "two worlds meet.", moment_ids: ["m-2019"] });
  assert.equal(out.needs_shape, null);
  assert.equal(out.matters.length, 4);
  assert.deepEqual(out.patterns, [{ title: "you revisit before you decide", body: "you compare periods.", moment_ids: ["m-2026"] }]);
  assert.equal(out.arc, "rebirth");
  assert.equal(out.story, null);
});

test("milestones sit on real dated moments, take their date and point from them, in date order", () => {
  const story = (milestones: unknown[]) =>
    normalizeInsights({ story: { line: "Film began early.", milestones } }, lower, 1, NOW, MOMENTS).story;
  assert.deepEqual(
    story([
      { moment_id: "m-2026", label: "your film reaches your product network." },
      { moment_id: "m-2008", label: "Early interest in film" },
      { moment_id: "invented", label: "dropped, not given" },
      { moment_id: "m-2008", label: "dropped, already used" },
    ]),
    {
      line: "film began early.",
      milestones: [
        { moment_id: "m-2008", label: "early interest in film", date: "2008", pillar: "origin" },
        { moment_id: "m-2026", label: "your film reaches your product network", date: "mar 2026", pillar: "recognition" },
      ],
    },
  );
  assert.equal(story([{ moment_id: "m-2008", label: "one" }]), null);
});

test("when any milestone's moment is undated, milestones sit in point order and undated ones carry no date", () => {
  const out = normalizeInsights(
    {
      story: {
        line: "Film began early.",
        milestones: [
          { moment_id: "m-2026", label: "recognition" },
          { moment_id: "m-undated", label: "becoming" },
          { moment_id: "m-2008", label: "origin" },
        ],
      },
    },
    lower,
    1,
    NOW,
    MOMENTS,
  ).story;
  assert.deepEqual(out?.milestones, [
    { moment_id: "m-2008", label: "origin", date: "2008", pillar: "origin" },
    { moment_id: "m-undated", label: "becoming", date: null, pillar: "becoming" },
    { moment_id: "m-2026", label: "recognition", date: "mar 2026", pillar: "recognition" },
  ]);
});

test("milestoneDate reads a month and year when recent, else the year", () => {
  assert.equal(milestoneDate("2026-03-12", NOW), "mar 2026");
  assert.equal(milestoneDate("2025-05", NOW), "may 2025");
  assert.equal(milestoneDate("2024-10-01", NOW), "2024");
  assert.equal(milestoneDate("2008", NOW), "2008");
  assert.equal(milestoneDate("someday", NOW), null);
});

test("an unknown arc is dropped and the served reading never carries one", () => {
  assert.equal(normalizeInsights({ arc: "hero's journey" }, lower, 1, NOW).arc, null);
  const served = servedInsights({ version: 1, patterns: [], arc: "quest" });
  assert.equal(served && "arc" in served, false);
  assert.equal(servedInsights(null), null);
});

test("insightsStale is true when the version has no reading of its own, or one from before patterns", () => {
  assert.equal(insightsStale(null, null), false);
  assert.equal(insightsStale(null, 3), true);
  assert.equal(insightsStale({ version: 2, patterns: [] }, 3), true);
  assert.equal(insightsStale({ version: 3, ways: [] }, 3), true);
  assert.equal(insightsStale({ version: 3, patterns: [] }, 3), false);
});
