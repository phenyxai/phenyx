import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHeldConstants, todaysStillTrueIndex } from "./held.ts";

const items = [
  { title: "a", body: "1" },
  { title: "b", body: "2" },
  { title: "c", body: "3" },
  { title: "d", body: "4" },
  { title: "e", body: "5" },
];

test("pickHeldConstants returns all items when there are four or fewer", () => {
  assert.deepEqual(pickHeldConstants(items.slice(0, 4)), items.slice(0, 4));
  assert.deepEqual(pickHeldConstants(items.slice(0, 2)), items.slice(0, 2));
  assert.deepEqual(pickHeldConstants([]), []);
});

test("pickHeldConstants skips today's still-true when there are more than four", () => {
  const now = 0;
  assert.equal(todaysStillTrueIndex(items.length, now), 0);
  const picked = pickHeldConstants(items, now);
  assert.equal(picked.length, 4);
  assert.equal(picked[0].title, "b");
  assert.ok(!picked.some((h) => h.title === "a"));
});
