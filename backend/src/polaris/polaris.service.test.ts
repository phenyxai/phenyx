import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSuggestedQuestions } from "./polaris.service";

test("computeSuggestedQuestions returns four pillar-tagged questions when empty", () => {
  const qs = computeSuggestedQuestions(null);
  assert.equal(qs.length, 4);
  for (const q of qs) {
    assert.equal(typeof q.text, "string");
    assert.ok(q.text.length > 0);
    assert.equal(typeof q.pillar_tag, "string");
  }
  assert.deepEqual(
    qs.map((q) => q.pillar_tag),
    ["origin", "emergence", "self_creation", "convergence"]
  );
});

test("computeSuggestedQuestions takes the four highest-scoring pillars", () => {
  const qs = computeSuggestedQuestions({
    origin_score: 10,
    emergence_score: 90,
    self_creation_score: 40,
    convergence_score: 70,
    becoming_score: 80,
    recognition_score: 20,
    transcendence_score: 5,
  });
  assert.equal(qs.length, 4);
  assert.deepEqual(
    qs.map((q) => q.pillar_tag),
    ["emergence", "becoming", "convergence", "self_creation"]
  );
});
