import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickHeldConstants,
  profileHeldForDay,
  todaysStillTrueIndex,
  HELD_CONSTANTS,
} from "./held.ts";

const items = [
  { title: "a", body: "1" },
  { title: "b", body: "2" },
  { title: "c", body: "3" },
  { title: "d", body: "4" },
  { title: "e", body: "5" },
];

test("pickHeldConstants pads an empty list from the shared constants, skipping today", () => {
  const day = 0;
  const picked = pickHeldConstants([], day);
  assert.equal(picked.length, 4);
  assert.deepEqual(picked, profileHeldForDay(day));
  assert.notEqual(picked[0]?.title, HELD_CONSTANTS[0].title);
});

test("pickHeldConstants pads fewer than four from the shared constants", () => {
  const picked = pickHeldConstants(items.slice(0, 2), 0);
  assert.equal(picked.length, 4);
  assert.equal(picked[0].title, "a");
  assert.equal(picked[1].title, "b");
});

test("pickHeldConstants skips today still-true when the list is longer than four", () => {
  const day = 0;
  assert.equal(todaysStillTrueIndex(items.length, day), 0);
  const picked = pickHeldConstants(items, day);
  assert.equal(picked.length, 4);
  assert.ok(!picked.some((h) => h.title === "a"));
});
