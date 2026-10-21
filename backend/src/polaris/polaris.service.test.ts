import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStarters, parseMode, planSteps } from "./polaris.service";

test("computeStarters gives one starter per mode from the default pillars when empty", () => {
  const starters = computeStarters(null);
  assert.deepEqual(
    starters.map((s) => [s.mode, s.pillar_tag]),
    [
      ["clarify", "origin"],
      ["understand", "emergence"],
      ["decide", "self_creation"],
    ]
  );
  for (const s of starters) assert.ok(s.text.length > 0);
});

test("computeStarters draws each mode from a different top-scoring pillar", () => {
  const starters = computeStarters({
    origin_score: 10,
    emergence_score: 90,
    self_creation_score: 40,
    convergence_score: 70,
    becoming_score: 80,
    recognition_score: 20,
    transcendence_score: 5,
  });
  assert.deepEqual(
    starters.map((s) => s.pillar_tag),
    ["emergence", "becoming", "convergence"]
  );
});

test("parseMode keeps a known mode and falls back to clarify", () => {
  assert.equal(parseMode("decide"), "decide");
  assert.equal(parseMode("understand"), "understand");
  assert.equal(parseMode("anything"), "clarify");
  assert.equal(parseMode(undefined), "clarify");
});

test("planSteps keeps whole step indexes in range, once each, in order", () => {
  assert.deepEqual(planSteps([3, 1, 1, -1, 2.5, 40, "2", 0]), [0, 1, 3]);
  assert.deepEqual(planSteps("1,2"), []);
  assert.deepEqual(planSteps(undefined), []);
});
