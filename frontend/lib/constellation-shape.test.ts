import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_PILLARS, EDGES, NODE_LAYOUT } from "./constellation-shape.ts";

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
