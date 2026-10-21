import { test } from "node:test";
import assert from "node:assert/strict";
import { insightsStale, milestoneDate, normalizeInsights, polarisUsageLine } from "./insights";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/synthesis/insights.test.ts

const NOW = new Date("2026-10-16T12:00:00.000Z");
const lower = (s: string) => s.toLowerCase();

test("normalizeInsights cleans prose and caps the lists", () => {
  const out = normalizeInsights(
    {
      becoming_clearer: { line: "The work is getting closer.", support: "Two worlds meet." },
      needs_shape: { line: "", support: "ignored without a line" },
      matters: [1, 2, 3, 4, 5].map((n) => ({ title: `Value ${n}`, body: "Shows up often." })),
      ways: [{ title: "You revisit before you decide", body: "You compare periods." }, { title: "", body: "dropped" }],
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
  assert.deepEqual(out.ways, [{ title: "you revisit before you decide", body: "you compare periods." }]);
  assert.equal(out.story, null);
});

test("the story keeps dated milestones on real points, and needs two of them", () => {
  const story = (milestones: unknown[]) =>
    normalizeInsights({ story: { summary: "Film began early.", milestones } }, lower, 1, NOW).story;
  const out = story([
    { date: "2008", title: "Early interest in film.", pillar: "origin" },
    { date: "March 2026", title: "your film reaches your product network", pillar: "recognition" },
    { date: "sometime", title: "dropped", pillar: "becoming" },
    { date: "2020", title: "dropped", pillar: "childhood" },
  ]);
  assert.deepEqual(out, {
    summary: "film began early.",
    milestones: [
      { date: "2008", title: "early interest in film", pillar: "origin" },
      { date: "mar 2026", title: "your film reaches your product network", pillar: "recognition" },
    ],
  });
  assert.equal(story([{ date: "2008", title: "one", pillar: "origin" }]), null);
});

test("milestoneDate reads a year or a month and year", () => {
  assert.equal(milestoneDate("2008"), "2008");
  assert.equal(milestoneDate("Sept. 2025"), "sep 2025");
  assert.equal(milestoneDate("2008-03"), null);
  assert.equal(milestoneDate("smarch 2008"), null);
});

test("polarisUsageLine counts conversations by mode from the first", () => {
  assert.equal(polarisUsageLine([]), "no polaris conversations yet");
  assert.equal(
    polarisUsageLine([
      { mode: "decide", created_at: "2026-10-02T00:00:00Z" },
      { mode: "clarify", created_at: "2026-03-10T00:00:00Z" },
      { mode: null, created_at: "2026-05-01T00:00:00Z" },
    ]),
    "3 polaris conversations since 2026-03 (clarify 2, decide 1); the most recent was decide in 2026-10"
  );
});

test("insightsStale is true when the version has no reading of its own, or one from before ways", () => {
  assert.equal(insightsStale(null, null), false);
  assert.equal(insightsStale(null, 3), true);
  assert.equal(insightsStale({ version: 2, ways: [] }, 3), true);
  assert.equal(insightsStale({ version: 3 }, 3), true);
  assert.equal(insightsStale({ version: 3, ways: [] }, 3), false);
});
