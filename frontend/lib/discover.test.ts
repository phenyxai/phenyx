import assert from "node:assert/strict";
import { test } from "node:test";
import { loopOffset, trailDate } from "./discover.ts";

test("loopOffset puts the neighbours either side and wraps both ways", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6].map((i) => loopOffset(i, 0, 7)),
    [0, 1, 2, 3, -3, -2, -1],
  );
  // From the last card, the first is next and the one before is behind.
  assert.equal(loopOffset(0, 6, 7), 1);
  assert.equal(loopOffset(5, 6, 7), -1);
  assert.deepEqual([0, 1].map((i) => loopOffset(i, 0, 2)), [0, 1]);
});

test("trailDate reads year, month and day precision", () => {
  assert.equal(trailDate("2016"), "2016");
  assert.equal(trailDate("2016-03"), "mar 2016");
  assert.equal(trailDate("2016-03-05"), "5 mar 2016");
});
