import { test } from "node:test";
import assert from "node:assert/strict";
import { purchaseLine } from "./purchases";

test("points sell in steps of 100 up to 2,000 at $4.99 per 100", () => {
  assert.deepEqual(purchaseLine("points", 300), { name: "100 polaris points", unitAmount: 499, quantity: 3, amount: 300 });
  assert.equal(purchaseLine("points", 2000)?.quantity, 20);
  assert.equal(purchaseLine("points", 250), null);
  assert.equal(purchaseLine("points", 2100), null);
  assert.equal(purchaseLine("points", 0), null);
});

test("discoveries sell as packs of 1, 3 or 10", () => {
  assert.equal(purchaseLine("discoveries", 1)?.unitAmount, 99);
  assert.equal(purchaseLine("discoveries", 3)?.unitAmount, 199);
  assert.deepEqual(purchaseLine("discoveries", 10), { name: "10 discoveries", unitAmount: 499, quantity: 1, amount: 10 });
  assert.equal(purchaseLine("discoveries", 2), null);
  assert.equal(purchaseLine("gift", 1), null);
});
