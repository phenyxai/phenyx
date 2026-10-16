import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignParticlesToNodes,
  frameSeconds,
  lineStartMs,
  pointReady,
} from "./constellation-reveal.ts";

test("a point waits for its time, then for 60% of its specks within 26px", () => {
  const settled = [5, 10, 20, 25, 40];
  const scattered = [5, 30, 60, 90, 120];
  assert.equal(pointReady(settled, 999, 1000), false);
  assert.equal(pointReady(settled, 1000, 1000), true);
  assert.equal(pointReady(scattered, 1000, 1000), false);
  assert.equal(pointReady(scattered, 2201, 1000), true);
});

test("a line starts 0.26s after the later of its two points", () => {
  assert.equal(lineStartMs(null, 1000), null);
  assert.equal(lineStartMs(1000, 1500), 1760);
});

test("frame time is real elapsed time, capped", () => {
  assert.equal(frameSeconds(1020, 1000), 0.02);
  assert.equal(frameSeconds(5000, 1000), 0.05);
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
