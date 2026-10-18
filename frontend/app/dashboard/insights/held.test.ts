import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHeldConstants, HELD_CONSTANTS } from "./held.ts";

const items = [
  { title: "a", body: "1" },
  { title: "b", body: "2" },
  { title: "c", body: "3" },
  { title: "d", body: "4" },
  { title: "e", body: "5" },
];

test("pickHeldConstants falls back to the first four shared constants", () => {
  assert.deepEqual(pickHeldConstants([]), HELD_CONSTANTS.slice(0, 4));
});

test("pickHeldConstants pads fewer than four from the shared constants", () => {
  const picked = pickHeldConstants(items.slice(0, 2));
  assert.equal(picked.length, 4);
  assert.deepEqual(
    picked.map((h) => h.title),
    ["a", "b", HELD_CONSTANTS[0].title, HELD_CONSTANTS[1].title],
  );
});

test("pickHeldConstants does not repeat a constant the list already holds", () => {
  const picked = pickHeldConstants([HELD_CONSTANTS[0]]);
  assert.equal(picked.length, 4);
  assert.equal(new Set(picked.map((h) => h.body)).size, 4);
});

test("pickHeldConstants keeps the first four when the list is longer, dropping none before that", () => {
  // PHE-96: no daily surface is left to dedupe against, so nothing is skipped.
  assert.deepEqual(pickHeldConstants(items), items.slice(0, 4));
});
