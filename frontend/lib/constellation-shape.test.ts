import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_PILLARS,
  EDGES,
  NODE_LAYOUT,
  ROTATION_DEG,
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

test("the shape is the real Big Dipper, turned 160° and undistorted", () => {
  assert.deepEqual(
    ALL_PILLARS.map((p) => STARS[p].star),
    ["merak", "phecda", "dubhe", "megrez", "alioth", "mizar", "alkaid"]
  );
  // Rising diagonal: origin at the left edge, transcendence at the top right.
  assert.equal(ROTATION_DEG, 160);
  assert.equal(NODE_LAYOUT.origin.x, 0);
  assert.equal(NODE_LAYOUT.transcendence.x, 1);
  assert.equal(NODE_LAYOUT.transcendence.y, 0);
  assert.ok(NODE_LAYOUT.origin.y > NODE_LAYOUT.transcendence.y, "the story climbs");

  // Fitted into any box, on-screen distances keep the real angular ratios
  // (within the projection's ~3% off-centre error), so the figure is never
  // stretched. Compare the pointer pair with each handle segment.
  const rad = Math.PI / 180;
  const angle = (a: (typeof ALL_PILLARS)[number], b: (typeof ALL_PILLARS)[number]) => {
    const [p, q] = [STARS[a], STARS[b]];
    return Math.acos(
      Math.sin(p.dec * rad) * Math.sin(q.dec * rad) +
        Math.cos(p.dec * rad) * Math.cos(q.dec * rad) * Math.cos((p.ra - q.ra) * rad)
    );
  };
  for (const [w, h] of [[327, 527], [1200, 520], [300, 300]]) {
    const px = Object.fromEntries(fitShape(0, 0, w, h).map((n) => [n.pillar, n]));
    const dist = (a: (typeof ALL_PILLARS)[number], b: (typeof ALL_PILLARS)[number]) =>
      Math.hypot(px[a].x - px[b].x, px[a].y - px[b].y);
    for (const [a, b] of EDGES.slice(4)) {
      const onScreen = dist("origin", "self_creation") / dist(a, b);
      const inSky = angle("origin", "self_creation") / angle(a, b);
      assert.ok(Math.abs(onScreen / inSky - 1) < 0.03, `${a}>${b} distorted in ${w}x${h}`);
    }
  }
  assert.ok(SHAPE_ASPECT > 1 && SHAPE_ASPECT < 1.2);
});
