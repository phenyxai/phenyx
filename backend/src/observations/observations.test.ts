import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSignalHash,
  normalizeSignalKey,
} from "./signal-hash";
import {
  ObservationCandidate,
  ObservationRow,
  orderCandidates,
  computeLockedForFree,
  buildInsertRows,
  applyReadGate,
  groupTimelineByPillar,
  isValidPillar,
} from "./gating";
import { BillingService } from "../stripe/billing.service";
import { ObservationsService } from "./observations.service";

// The read gate now consumes TierCapabilities (PHE-41). Resolve them from the
// real BillingService so the gate tests and the resolver can't silently drift.
const billing = new BillingService();
const FREE = billing.capabilitiesFor("free");
const PRO = billing.capabilitiesFor("pro");

// ---------------------------------------------------------------------------
// signal_hash — dedup / novelty key
// ---------------------------------------------------------------------------

test("computeSignalHash is deterministic for identical inputs", () => {
  const a = computeSignalHash("user-1", "origin", "linkedin+spotify:consistency-6mo");
  const b = computeSignalHash("user-1", "origin", "linkedin+spotify:consistency-6mo");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("computeSignalHash is invariant to case/whitespace of pillar and signal_key", () => {
  const canonical = computeSignalHash("user-1", "origin", "linkedin+spotify:consistency-6mo");
  const noisy = computeSignalHash("user-1", "  ORIGIN ", "  LinkedIn+Spotify:consistency-6mo   ");
  assert.equal(canonical, noisy);
});

test("signal_hash keys on the pattern, not the prose — paraphrase collapses to same hash", () => {
  // Two different bodies but the SAME underlying signal_key → same hash → dedup.
  const key = "youtube+reddit:late-night-learning";
  const first = computeSignalHash("user-1", "emergence", key);
  const paraphrase = computeSignalHash("user-1", "emergence", key);
  assert.equal(first, paraphrase);
});

test("computeSignalHash differs across user, pillar, and signal_key", () => {
  const base = computeSignalHash("user-1", "origin", "k");
  assert.notEqual(base, computeSignalHash("user-2", "origin", "k"));
  assert.notEqual(base, computeSignalHash("user-1", "emergence", "k"));
  assert.notEqual(base, computeSignalHash("user-1", "origin", "k2"));
});

test("normalizeSignalKey collapses whitespace and lowercases", () => {
  assert.equal(normalizeSignalKey("  A   B\tC "), "a b c");
});

test("isValidPillar accepts pillar_enum values and rejects others", () => {
  assert.ok(isValidPillar("origin"));
  assert.ok(isValidPillar("SELF_CREATION"));
  assert.ok(!isValidPillar("nonsense"));
  assert.ok(!isValidPillar("SELF-CREATION")); // hyphen is not the enum form
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function cand(overrides: Partial<ObservationCandidate>): ObservationCandidate {
  return {
    pillar: "origin",
    body: "b",
    source_platforms: [],
    meta_label: null,
    signal_key: "k",
    confidence: 0.5,
    ...overrides,
  };
}

test("orderCandidates sorts by pillar priority, then confidence desc", () => {
  const ordered = orderCandidates([
    cand({ pillar: "convergence", signal_key: "c", confidence: 0.9 }),
    cand({ pillar: "origin", signal_key: "o-low", confidence: 0.2 }),
    cand({ pillar: "origin", signal_key: "o-high", confidence: 0.8 }),
  ]);
  assert.deepEqual(
    ordered.map((c) => c.signal_key),
    ["o-high", "o-low", "c"]
  );
});

// ---------------------------------------------------------------------------
// Generation-time gating
// ---------------------------------------------------------------------------

test("computeLockedForFree: free tier unlocks the first two traces", () => {
  const ordered = [cand({ signal_key: "a" }), cand({ signal_key: "b" }), cand({ signal_key: "c" })];
  const flags = computeLockedForFree(ordered, false);
  assert.deepEqual(flags, [false, false, true]);
  assert.equal(flags.filter((f) => f === false).length, 2);
});

test("computeLockedForFree: pro/gifted unlocks all", () => {
  const ordered = [cand({}), cand({ signal_key: "b" })];
  assert.deepEqual(computeLockedForFree(ordered, true), [false, false]);
});

test("buildInsertRows sets is_new, gating flags, hashes, and dedups within batch", () => {
  const rows = buildInsertRows(
    "user-1",
    orderCandidates([
      cand({ pillar: "origin", signal_key: "dup", confidence: 0.9 }),
      cand({ pillar: "origin", signal_key: "DUP", confidence: 0.1 }), // same hash after normalize
      cand({ pillar: "emergence", signal_key: "e", confidence: 0.5 }),
    ]),
    false
  );
  // "dup" and "DUP" collapse to one row; the higher-confidence one wins ordering.
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.is_new === true));
  // First two unlocked for free (v67 evidence budget).
  assert.equal(rows.filter((r) => r.locked_for_free === false).length, 2);
  assert.equal(rows[0].locked_for_free, false);
  assert.ok(rows.every((r) => /^[0-9a-f]{64}$/.test(r.signal_hash)));
});

// ---------------------------------------------------------------------------
// Read gate
// ---------------------------------------------------------------------------

function row(overrides: Partial<ObservationRow>): ObservationRow {
  return {
    id: "id",
    pillar: "origin",
    body: "the body",
    source_platforms: ["linkedin", "spotify"],
    meta_label: "cross-platform pattern / 6 months",
    is_new: true,
    locked_for_free: false,
    surfaced_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

test("applyReadGate free tier: all bodies, traces only on first two of the day", () => {
  const served = applyReadGate(
    [row({ id: "fresh" }), row({ id: "older" }), row({ id: "oldest" })],
    FREE
  );
  assert.equal(served.length, 3);
  assert.ok(served.every((o) => o.body === "the body"));
  // First two of the local day carry citations + provenance.
  assert.equal(served[0].locked, false);
  assert.deepEqual(served[0].sources, ["linkedin", "spotify"]);
  assert.equal(served[0].meta_line, "cross-platform pattern / 6 months");
  assert.equal(served[1].locked, false);
  assert.deepEqual(served[1].sources, ["linkedin", "spotify"]);
  // Third+ keep the sentence; traces are withheld.
  assert.equal(served[2].locked, true);
  assert.equal(served[2].body, "the body");
  assert.equal(served[2].sources, undefined);
  assert.equal(served[2].meta_line, undefined);
});

test("applyReadGate pro/gifted: all unlocked with source_platforms + provenance present", () => {
  const served = applyReadGate([row({ id: "a" }), row({ id: "b" })], PRO);
  assert.ok(served.every((o) => o.locked === false));
  assert.ok(served.every((o) => Array.isArray(o.sources) && o.sources!.length === 2));
  assert.ok(served.every((o) => o.meta_line === "cross-platform pattern / 6 months"));
});

test("groupTimelineByPillar groups by pillar and keeps every body for free", () => {
  const groups = groupTimelineByPillar(
    [
      row({ id: "1", pillar: "origin" }),
      row({ id: "2", pillar: "emergence" }),
      row({ id: "3", pillar: "origin" }),
    ],
    FREE
  );
  // Groups emitted in pillar-priority order: origin before emergence.
  assert.deepEqual(groups.map((g) => g.pillar), ["origin", "emergence"]);
  const served = groups.flatMap((g) => g.observations);
  assert.equal(served.length, 3);
  assert.ok(served.every((o) => o.body === "the body"));
  assert.equal(served.filter((o) => o.locked === true).length, 1);
});

// ---------------------------------------------------------------------------
// PHE-42 — weekly cron skips frozen accounts (selectActiveUserIds filter).
// ---------------------------------------------------------------------------

/**
 * Fake Supabase whose reads are table-scoped: connected onairos users vs. the
 * frozen ids among them. Each query terminates by awaiting a thenable chain
 * (select → eq → in → then), matching selectActiveUserIds' call shape.
 */
function makeSupabase(connectedUserIds: string[], frozenIds: string[]) {
  return {
    getClient() {
      return {
        from(table: string) {
          const data =
            table === "onairos_connections"
              ? connectedUserIds.map((user_id) => ({ user_id }))
              : frozenIds.map((id) => ({ id }));
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            then: (onF: any, onR: any) =>
              Promise.resolve({ data, error: null }).then(onF, onR),
          };
          return chain;
        },
      };
    },
  };
}

function makeObservationsService(connectedUserIds: string[], frozenIds: string[]) {
  return new ObservationsService(
    { get: () => undefined } as any,
    makeSupabase(connectedUserIds, frozenIds) as any,
    {} as any,
    {} as any
  );
}

test("selectActiveUserIds excludes frozen users from the active set", async () => {
  const service = makeObservationsService(["a", "b", "c"], ["b"]);
  const ids = await (service as any).selectActiveUserIds();
  assert.deepEqual([...ids].sort(), ["a", "c"], "frozen user 'b' is filtered out");
});

test("selectActiveUserIds returns all when none are frozen", async () => {
  const service = makeObservationsService(["a", "b"], []);
  const ids = await (service as any).selectActiveUserIds();
  assert.deepEqual([...ids].sort(), ["a", "b"]);
});

test("selectActiveUserIds returns empty (no frozen lookup) when no active users", async () => {
  const service = makeObservationsService([], ["z"]);
  const ids = await (service as any).selectActiveUserIds();
  assert.deepEqual(ids, []);
});
