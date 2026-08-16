/**
 * PHE-35 — analytics queue unit tests.
 *
 * Dependency-free: runs on Node's built-in test runner with native TypeScript
 * type-stripping (no vitest/jest install required):
 *
 *   node --experimental-strip-types --test lib/analytics.test.ts
 *
 * `analytics.ts` has no static runtime imports (the Supabase client is loaded
 * lazily inside the flush path), so importing it here never touches the browser
 * or `@supabase/ssr`.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makePolarisMessageProps, makeEvent, daysSince, lastVisitKey, makeObservationFeedbackProps } from "./analytics.ts";

test("polaris_message props carry NO message text (privacy)", () => {
  const secret = "a private user message that must never be persisted anywhere";
  const props = makePolarisMessageProps({ count: 3, pillar_tag: "purpose", message: secret });

  // Exactly the three allowed keys — nothing else.
  assert.deepEqual(Object.keys(props).sort(), ["count", "message_length", "pillar_tag"]);

  // Only the LENGTH is captured.
  assert.equal(props.message_length, secret.length);
  assert.equal(props.count, 3);
  assert.equal(props.pillar_tag, "purpose");

  // No text-bearing key exists.
  const asRecord = props as Record<string, unknown>;
  for (const key of ["message", "text", "body", "content", "transcript"]) {
    assert.ok(!(key in asRecord), `props must not contain a "${key}" field`);
  }

  // The serialized props must not contain the message text anywhere.
  assert.ok(!JSON.stringify(props).includes(secret), "message text leaked into props");
  for (const value of Object.values(props)) {
    if (typeof value === "string") {
      assert.ok(!value.includes(secret), "message text leaked into a string prop");
    }
  }
});

test("polaris_message message_length reflects the true length, not the content", () => {
  const props = makePolarisMessageProps({ count: 1, pillar_tag: null, message: "héllo 👋" });
  assert.equal(props.message_length, "héllo 👋".length);
  assert.equal(props.pillar_tag, null);
});

test("makeEvent builds the standard envelope", () => {
  const ev = makeEvent("user-123", "login", {}, "2026-07-01T00:00:00.000Z");
  assert.equal(ev.user_id, "user-123");
  assert.equal(ev.event_type, "login");
  assert.equal(ev.occurred_at, "2026-07-01T00:00:00.000Z");
  assert.deepEqual(ev.props, {});
});

test("makeEvent defaults occurred_at to an ISO timestamp", () => {
  const ev = makeEvent("u", "tab_visit", { tab: "daily", previous: null });
  assert.equal(typeof ev.occurred_at, "string");
  assert.ok(!Number.isNaN(Date.parse(ev.occurred_at)));
});

test("daysSince computes whole days and handles first visit + clock skew", () => {
  const now = 1_700_000_000_000;
  assert.equal(daysSince(null, now), 0); // first-ever visit
  assert.equal(daysSince(NaN, now), 0); // corrupt stored value
  assert.equal(daysSince(now - 3 * 86_400_000, now), 3);
  assert.equal(daysSince(now - 90 * 60 * 1000, now), 0); // < 1 day
  assert.equal(daysSince(now + 5_000, now), 0); // future ts (skew)
});

test("lastVisitKey is namespaced per user", () => {
  assert.equal(lastVisitKey("abc"), "phenyx:abc:lastVisitTs");
});

test("observation_feedback props carry NO observation body (privacy)", () => {
  const secret = "eight of every ten sessions begin between 1am and 4am";
  const props = makeObservationFeedbackProps({
    pillar: "origin",
    signal_type: "timing",
    verdict: "known",
  });

  assert.deepEqual(Object.keys(props).sort(), ["pillar", "signal_type", "verdict"]);
  assert.equal(props.pillar, "origin");
  assert.equal(props.signal_type, "timing");
  assert.equal(props.verdict, "known");

  const asRecord = props as Record<string, unknown>;
  for (const key of ["message", "text", "body", "content", "transcript"]) {
    assert.ok(!(key in asRecord), `props must not contain a "${key}" field`);
  }
  assert.ok(!JSON.stringify(props).includes(secret), "observation body leaked into props");
});

test("observation_feedback opened-only event still has no body field", () => {
  const props = makeObservationFeedbackProps({
    pillar: "self_creation",
    signal_type: null,
    opened: true,
  });
  assert.equal(props.opened, true);
  assert.equal(props.signal_type, null);
  assert.ok(!("body" in props));
  assert.ok(!("verdict" in props));
});
