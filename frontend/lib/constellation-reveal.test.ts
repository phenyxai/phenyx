import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignParticlesToNodes,
  formationTimeline,
} from "./constellation-reveal.ts";

test("formationTimeline scales the complete reveal from one total duration", () => {
  const faster = formationTimeline(17_085);
  const slower = formationTimeline(23_115);

  assert.equal(faster.completeAtMs, 17_085);
  assert.equal(slower.completeAtMs, 23_115);
  assert.equal(faster.condenseAtMs, 3_400);
  assert.equal(slower.condenseAtMs, 4_600);
  assert.ok(faster.revealAtMs < slower.revealAtMs);
});

test("assignParticlesToNodes keeps 200 nearest claims within an even node capacity", () => {
  const seeds = Array.from({ length: 200 }, (_, index) => ({
    x: index / 1_000,
    y: index / 1_000,
  }));
  const nodes = Array.from({ length: 7 }, (_, index) => ({
    x: index * 100,
    y: index * 100,
  }));

  const assignments = assignParticlesToNodes(seeds, nodes);
  const counts = Array.from({ length: 7 }, () => 0);
  assignments.forEach(({ node }) => counts[node]++);

  assert.equal(assignments.length, 200);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 200);
  assert.ok(Math.max(...counts) <= Math.ceil(200 / 7));
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 3);
  assert.deepEqual(assignments.slice(0, 29).map(({ node }) => node), Array(29).fill(0));
  assert.equal(assignments[29].node, 1);
  assert.notEqual(counts[0], 200);
});
