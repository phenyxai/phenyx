import { test } from "node:test";
import assert from "node:assert/strict";
import { STELLAR, stellarColorFor } from "./stellar.util";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/common/stellar.util.test.ts
//
// Palette parity with the frontend and the SQL function is asserted in
// frontend/lib/stellar.test.ts; this file pins the assignment itself.

test("the palette has 24 distinct colors and no brand blue", () => {
  assert.equal(STELLAR.length, 24);
  assert.equal(new Set(STELLAR).size, 24);
  for (const brand of ["#B9D5FF", "#D7E7FF", "#89A8E3"]) {
    assert.ok(!(STELLAR as readonly string[]).includes(brand));
  }
});

// Expected values computed independently: sha256(id + createdAt), first 7 hex
// digits as an int, mod 24.
test("stellarColorFor maps known (id, created_at) pairs to known palette entries", () => {
  const cases: [string, string, number][] = [
    ["00000000-0000-0000-0000-000000000001", "2026-06-04T16:00:00.000Z", 16],
    ["3f2b9c1e-7a4d-4e8b-9f1a-2c6d5e8b7a90", "2026-07-01T09:30:15.123Z", 21],
    ["a1b2c3d4-e5f6-4789-8abc-def012345678", "2026-10-09T00:00:00.000Z", 6],
  ];
  for (const [id, createdAt, index] of cases) {
    assert.equal(stellarColorFor(id, createdAt), STELLAR[index]);
  }
});

test("stellarColorFor is deterministic and always lands on the palette", () => {
  const id = "3f2b9c1e-7a4d-4e8b-9f1a-2c6d5e8b7a90";
  const at = "2026-07-01T09:30:15.123Z";
  assert.equal(stellarColorFor(id, at), stellarColorFor(id, at));
  for (let i = 0; i < 200; i++) {
    const color = stellarColorFor(`user-${i}`, at);
    assert.ok((STELLAR as readonly string[]).includes(color));
  }
});
