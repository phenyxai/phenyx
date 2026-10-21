import assert from "node:assert/strict";
import { test } from "node:test";
import { kindLabel, loopOffset, trailDate, trailYears } from "./discover.ts";

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

test("kindLabel reads each kind the way its card names it", () => {
  assert.equal(kindLabel("try"), "something to try");
  assert.equal(kindLabel("history"), "from your history");
  assert.equal(kindLabel("unknown"), "unknown");
});

test("trailYears spans the trail, shortening a shared century", () => {
  const at = (...dates: string[]) => dates.map((date) => ({ platform: "spotify", date, detail: "" }));
  assert.equal(trailYears(at("2024-09", "2026")), "2024–26");
  assert.equal(trailYears(at("1998", "2021-04")), "1998–2021");
  assert.equal(trailYears(at("2019", "2019-05")), "2019");
  assert.equal(trailYears([]), "");
});
