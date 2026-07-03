/**
 * PHE-43 — events ingest validation unit tests.
 *
 * Dependency-free: runs on Node's built-in test runner with native TypeScript
 * type-stripping (no jest/vitest install), like the frontend queue's tests:
 *
 *   node --experimental-strip-types --test src/events/events.validation.test.ts
 *
 * `events.validation.ts` has NO NestJS decorators and no runtime imports, so it
 * imports cleanly here without booting Nest or a Supabase client.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeEvent,
  ALLOWED_EVENT_TYPES,
} from "./events.validation.ts";

const FIXED_NOW = "2026-07-03T00:00:00.000Z";
const clock = () => FIXED_NOW;
const USER = "11111111-1111-1111-1111-111111111111";

test("server-stamps user_id and ignores any client-supplied user_id", () => {
  const res = sanitizeEvent(
    { event_type: "tab_visit", props: { tab: "daily", previous: null }, user_id: "attacker" },
    USER,
    clock,
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.row.user_id, USER, "user_id must come from the token, not the body");
});

test("polaris_message keeps only count/pillar_tag/length — content is stripped", () => {
  const secret = "a private user message that must never be persisted";
  const res = sanitizeEvent(
    {
      event_type: "polaris_message",
      props: {
        count: 2,
        pillar_tag: "origin",
        message_length: secret.length,
        // Hostile content keys that must never survive:
        message: secret,
        text: secret,
        body: secret,
        content: secret,
      },
    },
    USER,
    clock,
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.deepEqual(Object.keys(res.row.props).sort(), ["count", "message_length", "pillar_tag"]);
  assert.equal((res.row.props as any).message_length, secret.length);
  for (const key of ["message", "text", "body", "content", "transcript"]) {
    assert.ok(!(key in res.row.props), `props must not contain "${key}"`);
  }
  assert.ok(!JSON.stringify(res.row.props).includes(secret), "message text leaked into props");
});

test("polaris_message accepts the ticket's `length` spelling too", () => {
  const res = sanitizeEvent(
    { event_type: "polaris_message", props: { count: 1, pillar_tag: null, length: 42 } },
    USER,
    clock,
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal((res.row.props as any).length, 42);
});

test("unknown event_type is rejected (allowlist), not thrown", () => {
  const res = sanitizeEvent({ event_type: "delete_account", props: {} }, USER, clock);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.match(res.reason, /unknown event_type/);
});

test("all frontend queue event names are on the allowlist", () => {
  for (const name of [
    "tab_visit",
    "tab_duration",
    "days_since_last_visit",
    "polaris_message",
    "login",
    "upgrade_to_pro",
    "downgrade_to_free",
  ]) {
    assert.ok(
      (ALLOWED_EVENT_TYPES as readonly string[]).includes(name),
      `${name} must be allowlisted`,
    );
    const res = sanitizeEvent({ event_type: name, props: {} }, USER, clock);
    assert.equal(res.ok, true, `${name} should validate`);
  }
});

test("bare upgrade/downgrade compatibility aliases are accepted", () => {
  for (const name of ["upgrade", "downgrade"]) {
    const res = sanitizeEvent({ event_type: name, props: {} }, USER, clock);
    assert.equal(res.ok, true, `${name} alias should validate`);
  }
});

test("unknown prop keys are stripped for a known event type", () => {
  const res = sanitizeEvent(
    { event_type: "tab_visit", props: { tab: "daily", previous: "polaris", ip: "1.2.3.4", junk: 1 } },
    USER,
    clock,
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(Object.keys(res.row.props).sort(), ["previous", "tab"]);
});

test("occurred_at: valid client timestamp is preserved", () => {
  const ts = "2026-07-01T12:34:56.000Z";
  const res = sanitizeEvent({ event_type: "login", props: {}, occurred_at: ts }, USER, clock);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.row.occurred_at, ts);
});

test("occurred_at: missing/garbage falls back to server clock", () => {
  const missing = sanitizeEvent({ event_type: "login", props: {} }, USER, clock);
  const garbage = sanitizeEvent(
    { event_type: "login", props: {}, occurred_at: "not-a-date" },
    USER,
    clock,
  );
  assert.equal(missing.ok, true);
  assert.equal(garbage.ok, true);
  if (!missing.ok || !garbage.ok) return;
  assert.equal(missing.row.occurred_at, FIXED_NOW);
  assert.equal(garbage.row.occurred_at, FIXED_NOW);
});

test("event_id: string preserved for idempotency; empty/missing → null", () => {
  const withId = sanitizeEvent(
    { event_type: "login", props: {}, event_id: "abc-123" },
    USER,
    clock,
  );
  const withoutId = sanitizeEvent({ event_type: "login", props: {} }, USER, clock);
  assert.equal(withId.ok, true);
  assert.equal(withoutId.ok, true);
  if (!withId.ok || !withoutId.ok) return;
  assert.equal(withId.row.event_id, "abc-123");
  assert.equal(withoutId.row.event_id, null);
});

test("non-object event and non-object props are rejected", () => {
  assert.equal(sanitizeEvent("nope", USER, clock).ok, false);
  assert.equal(sanitizeEvent(null, USER, clock).ok, false);
  assert.equal(sanitizeEvent(["arr"], USER, clock).ok, false);
  assert.equal(
    sanitizeEvent({ event_type: "login", props: "bad" }, USER, clock).ok,
    false,
  );
});
