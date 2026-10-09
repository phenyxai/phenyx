import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { STELLAR, stellarColorFor } from "./stellar.util";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/common/stellar.util.test.ts

test("PHE-98: brand blue is never assigned as a person's accent", () => {
  assert.ok(!STELLAR.some((hex) => hex.toUpperCase() === "#5599FF"));
  for (let i = 0; i < 500; i++) {
    const color = stellarColorFor(randomUUID(), new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString());
    assert.ok((STELLAR as readonly string[]).includes(color));
  }
});
