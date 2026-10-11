import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewSignalRow, markNewFromSignal, shouldCreateSignal, type InsertedMoment } from "./new-signal";

const moments: InsertedMoment[] = [
  {
    id: "o1",
    pillar: "Becoming",
    body: "you keep returning to late-night playlists.",
    source_platforms: ["spotify", "youtube"],
    span_start: "2024-01-01T00:00:00Z",
    span_end: "2025-06-01T00:00:00Z",
  },
  { id: "o2", pillar: "origin", body: "an early save.", source_platforms: [] },
];

test("a signal needs a refresh that inserted something new", () => {
  assert.equal(shouldCreateSignal(false, 3), false); // first generation
  assert.equal(shouldCreateSignal(true, 0), false); // nothing new found
  assert.equal(shouldCreateSignal(true, 1), true);
});

test("claude's point, summary and ideas land; points are in story order", () => {
  const row = buildNewSignalRow("u1", moments, {
    point: "becoming",
    points: ["recognition", "nonsense"],
    summary: "this suggests a new rhythm.",
    ideas: [" try one ", "", "two", "three", "four"],
  });
  assert.equal(row.pillar, "becoming");
  assert.deepEqual(row.points, ["origin", "becoming", "recognition"]);
  assert.equal(row.summary, "this suggests a new rhythm.");
  assert.deepEqual(row.ideas, ["try one", "two", "three"]);
  assert.deepEqual(row.observation_ids, ["o1", "o2"]);
  assert.deepEqual(row.sources, [
    { observation_id: "o1", platform: "spotify", span: "2024 – 2025" },
    { observation_id: "o1", platform: "youtube", span: "2024 – 2025" },
  ]);
});

test("without claude the signal still traces to its moments", () => {
  const row = buildNewSignalRow("u1", moments, null);
  assert.equal(row.pillar, "becoming");
  assert.equal(row.summary, moments[0].body);
  assert.deepEqual(row.ideas, []);
});

test("only the unseen signal's moments read as new", () => {
  const rows = [
    { id: "o1", is_new: true },
    { id: "o2", is_new: true },
  ];
  assert.deepEqual(
    markNewFromSignal(rows, new Set(["o2"])).map((r) => r.is_new),
    [false, true]
  );
  assert.deepEqual(
    markNewFromSignal(rows, new Set()).map((r) => r.is_new),
    [false, false]
  );
});
