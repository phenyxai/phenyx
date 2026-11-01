import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_PILLARS,
  EDGES,
  FIGURE,
  NODE_LAYOUT,
  SHAPE_ASPECT,
  STARS,
  fitShape,
} from "./constellation-shape.ts";

test("the constellation is always seven points and the seven spec lines", () => {
  assert.equal(ALL_PILLARS.length, 7);
  assert.deepEqual(Object.keys(NODE_LAYOUT).sort(), [...ALL_PILLARS].sort());
  assert.deepEqual(
    EDGES.map(([a, b]) => `${a}>${b}`),
    [
      "origin>emergence",
      "origin>self_creation",
      "emergence>convergence",
      "self_creation>convergence",
      "convergence>becoming",
      "becoming>recognition",
      "recognition>transcendence",
    ]
  );
  // Every point sits on at least one line and inside the drawing box.
  for (const pillar of ALL_PILLARS) {
    assert.ok(EDGES.some((edge) => edge.includes(pillar)), `${pillar} has no line`);
    const { x, y } = NODE_LAYOUT[pillar];
    assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${pillar} is off the map`);
  }
});

test("the shape is the reference Big Dipper, undistorted", () => {
  assert.deepEqual(
    ALL_PILLARS.map((p) => STARS[p].star),
    ["merak", "phecda", "dubhe", "megrez", "alioth", "mizar", "alkaid"]
  );
  // Rising diagonal: origin at the bottom left, transcendence at the top right.
  assert.equal(NODE_LAYOUT.origin.x, 0);
  assert.equal(NODE_LAYOUT.origin.y, 1);
  assert.equal(NODE_LAYOUT.transcendence.x, 1);
  assert.equal(NODE_LAYOUT.transcendence.y, 0);

  // Fitted into any box, on-screen distances keep the drawing's ratios, so
  // the figure is never stretched. Compare the left side of the bowl with
  // every line.
  const ref = (a: (typeof ALL_PILLARS)[number], b: (typeof ALL_PILLARS)[number]) =>
    Math.hypot(FIGURE[a][0] - FIGURE[b][0], FIGURE[a][1] - FIGURE[b][1]);
  for (const [w, h] of [[327, 527], [1200, 520], [300, 300]]) {
    const px = Object.fromEntries(fitShape(0, 0, w, h).map((n) => [n.pillar, n]));
    const dist = (a: (typeof ALL_PILLARS)[number], b: (typeof ALL_PILLARS)[number]) =>
      Math.hypot(px[a].x - px[b].x, px[a].y - px[b].y);
    for (const [a, b] of EDGES) {
      const onScreen = dist("origin", "emergence") / dist(a, b);
      const inDrawing = ref("origin", "emergence") / ref(a, b);
      assert.ok(Math.abs(onScreen / inDrawing - 1) < 1e-9, `${a}>${b} distorted in ${w}x${h}`);
    }
  }
  assert.ok(SHAPE_ASPECT > 1.8 && SHAPE_ASPECT < 2);
});
