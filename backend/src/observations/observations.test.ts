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
  collapseOverlappingCandidates,
  computeLockedForFree,
  buildInsertRows,
  applyReadGate,
  groupTimelineByPillar,
  isValidPillar,
  firstSentence,
} from "./gating";
import {
  parseFeedbackBody,
  attachFeedback,
  applyFeedbackRanking,
} from "./feedback";
import { BillingService } from "../stripe/billing.service";
import { ObservationsService } from "./observations.service";
import {
  buildEvidence,
  certaintyCopy,
  chartFromMetric,
  pickPreviewEntries,
  pickUnderneathOfDay,
  redactEvidence,
  stubEvidence,
} from "./evidence";

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

test("collapseOverlappingCandidates keeps the better-supported same-pillar window", () => {
  const stronger = cand({
    pillar: "origin",
    signal_key: "export-to-release",
    confidence: 0.72,
    supporting_points: ["exported 4 jan", "released 18 feb", "45 day gap"],
    source_record_keys: ["project:export:2026-01-04", "project:release:2026-02-18"],
    window_start: "2026-01-04T00:00:00Z",
    window_end: "2026-02-18T00:00:00Z",
  });
  const weakerAngle = cand({
    pillar: "origin",
    signal_key: "release-lag",
    confidence: 0.91,
    supporting_points: ["released 18 feb"],
    source_record_keys: ["project:review:2026-02-12"],
    window_start: "2026-02-01T00:00:00Z",
    window_end: "2026-02-18T00:00:00Z",
  });
  const sharedRecordDifferentWindow = cand({
    pillar: "origin",
    signal_key: "release-record-retold",
    supporting_points: ["released 18 feb"],
    source_record_keys: ["project:release:2026-02-18"],
    window_start: "2027-01-01T00:00:00Z",
    window_end: "2027-01-02T00:00:00Z",
  });
  const otherPillar = cand({
    pillar: "emergence",
    signal_key: "same-window-other-pillar",
    supporting_points: ["released 18 feb"],
    source_record_keys: ["project:release:2026-02-18"],
    window_start: "2026-02-01T00:00:00Z",
    window_end: "2026-02-18T00:00:00Z",
  });
  const separateWindow = cand({
    pillar: "origin",
    signal_key: "later-window",
    supporting_points: ["exported 4 jul"],
    source_record_keys: ["project:export:2026-07-04"],
    window_start: "2026-07-04T00:00:00Z",
    window_end: "2026-07-04T00:00:00Z",
  });

  const collapsed = collapseOverlappingCandidates([
    weakerAngle,
    sharedRecordDifferentWindow,
    otherPillar,
    separateWindow,
    stronger,
  ]);

  assert.deepEqual(
    collapsed.map((candidate) => candidate.signal_key).sort(),
    ["export-to-release", "later-window", "same-window-other-pillar"],
  );
});

test("collapseOverlappingCandidates does not transitively merge distinct windows", () => {
  const collapsed = collapseOverlappingCandidates([
    cand({
      signal_key: "january",
      supporting_points: ["a", "b", "c"],
      window_start: "2026-01-01T00:00:00Z",
      window_end: "2026-01-10T00:00:00Z",
    }),
    cand({
      signal_key: "broad-weak-bridge",
      supporting_points: ["b"],
      window_start: "2026-01-05T00:00:00Z",
      window_end: "2026-02-05T00:00:00Z",
    }),
    cand({
      signal_key: "february",
      supporting_points: ["d", "e"],
      window_start: "2026-02-01T00:00:00Z",
      window_end: "2026-02-10T00:00:00Z",
    }),
  ]);

  assert.deepEqual(
    collapsed.map((candidate) => candidate.signal_key),
    ["january", "february"],
  );
});

test("collapseOverlappingCandidates does not treat a platform as a source-record key", () => {
  const collapsed = collapseOverlappingCandidates([
    cand({
      signal_key: "early-listening",
      source_platforms: ["spotify"],
      source_record_keys: ["spotify"],
    }),
    cand({
      signal_key: "late-listening",
      source_platforms: ["spotify"],
      source_record_keys: ["spotify"],
    }),
  ]);

  assert.deepEqual(
    collapsed.map((candidate) => candidate.signal_key),
    ["early-listening", "late-listening"],
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

test("firstSentence takes the leading clause and strips markup", () => {
  assert.equal(
    firstSentence("eight of every ten sessions begin between 1am and 4am. visual work does not."),
    "eight of every ten sessions begin between 1am and 4am."
  );
  assert.equal(firstSentence("boards of canada returned after <b>six</b> years."), "boards of canada returned after six years.");
});

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
  assert.equal(served[2].sentence, "the body");
  assert.equal(served[2].explore_prompt, "the body");
  assert.equal(served[2].sources, undefined);
  assert.equal(served[2].span, undefined);
  assert.equal(served[2].meta_line, undefined);
});

test("applyReadGate ships points and span on unlocked traces", () => {
  const served = applyReadGate(
    [
      row({
        points: ["twelve sessions", "none of them public"],
        evidence_span: "2016 - 2026",
      }),
    ],
    PRO
  );
  assert.deepEqual(served[0].points, ["twelve sessions", "none of them public"]);
  assert.equal(served[0].span, "2016 – 2026");
  assert.equal(served[0].sentence, "the body");
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
// PHE-71 — evidence traces + underneath gating
// ---------------------------------------------------------------------------

const maraEvidence = buildEvidence({
  sig: "frequency",
  recs: 1847,
  n: 1847,
  sources: ["spotify", "chatgpt"],
  span: "2016 – 2026",
  metric: { k: "split", a: 1847, b: 12, la: "these four", lb: "the four you post about" },
  entries: [
    { t: "14 mar 2016, 23:41", s: "spotify", w: "session opened on heaven or las vegas, first on record", l: "earliest" },
    { t: "29 jul 2026, 02:08", s: "spotify", w: "session opened on geogaddi, 1,847th", l: "most recent" },
    { t: "06 apr 2024, 19:12", s: "spotify", w: "public playlist 'for the drive' created, none of the four included", l: "the one that defines it" },
  ],
});

const maraUnder = {
  id: "u-night",
  headline: "the 1am to 4am pattern is not chronotype. it tracks the absence of obligation.",
  belief: { said: "i'm just nocturnal", n: 23, where: "chat history, 2021 to now" },
  gap: "the hour is given as preference. it moved when obligation moved.",
  mechanism: "what the record separates is not day from night but making from being assessed.",
  tell: "creative start time moves when obligation moves.",
  basis: "five years of session starts",
  recs: 612,
  sources: ["chatgpt", "spotify", "youtube"],
  hedge: "the hour is measurable. the reason is still yours.",
};

test("certaintyCopy matches the mara frequency fixture", () => {
  assert.equal(
    certaintyCopy(1847, "2016 – 2026", 2),
    "measured across 1,847 instances, holding for 10 years, corroborated in a second place."
  );
});

test("chartFromMetric prefers an explicit viz and derives timing clocks", () => {
  assert.deepEqual(
    chartFromMetric("frequency", { viz: { k: "split", a: 1847, b: 12, la: "these four", lb: "the four you post about" } }),
    { k: "split", a: 1847, b: 12, la: "these four", lb: "the four you post about" }
  );
  assert.deepEqual(
    chartFromMetric("timing", { measure: "median_hour", value: 23, unit: "hour_utc" }),
    { k: "clock", hrs: [23], unit: "hour", label: "23:00" }
  );
});

test("pickPreviewEntries returns earliest, most recent, and a defining third", () => {
  const entries = pickPreviewEntries([
    { platform: "spotify", record_type: "play", occurred_at: "2016-03-14T23:41:00Z" },
    { platform: "spotify", record_type: "play", occurred_at: "2024-04-06T19:12:00Z" },
    { platform: "spotify", record_type: "play", occurred_at: "2026-07-29T02:08:00Z" },
  ]);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].l, "earliest");
  assert.equal(entries[1].l, "most recent");
  assert.equal(entries[2].l, "the one that defines it");
  assert.equal(entries[0].t, "14 mar 2016, 23:41");
});

test("redactEvidence drops chart/entries/closer on a locked trace", () => {
  const locked = redactEvidence(maraEvidence, false);
  assert.deepEqual(locked, stubEvidence("frequency", 1847));
  assert.equal(locked?.entries, undefined);
  assert.equal(locked?.chart, undefined);
  assert.equal(locked?.closer, undefined);
  assert.equal(redactEvidence(maraEvidence, true), maraEvidence);
});

test("applyReadGate free: first two traces keep the chain, later rows keep only sig+recs", () => {
  const served = applyReadGate(
    [
      row({
        id: "one",
        signal_type: "frequency",
        record_count: 1847,
        assembled_evidence: maraEvidence,
      }),
      row({
        id: "two",
        signal_type: "timing",
        record_count: 4,
        assembled_evidence: buildEvidence({
          sig: "timing",
          recs: 4,
          n: 4,
          sources: ["spotify"],
          span: "this week",
          entries: [],
        }),
      }),
      row({
        id: "three",
        signal_type: "frequency",
        record_count: 12,
        assembled_evidence: maraEvidence,
      }),
    ],
    FREE
  );
  assert.ok(served[0].evidence?.entries);
  assert.ok(served[0].evidence?.chart);
  assert.ok(served[0].evidence?.closer);
  assert.equal(served[1].evidence?.entries?.length, 0);
  assert.equal(served[2].locked, true);
  assert.deepEqual(served[2].evidence, { sig: "frequency", recs: 1847 });
  assert.equal(served[2].evidence?.entries, undefined);
  assert.equal(served[2].evidence?.chart, undefined);
  assert.equal(served[2].evidence?.closer, undefined);
});

test("applyReadGate free: underneath flag without reading payload", () => {
  const served = applyReadGate(
    [
      row({
        id: "one",
        assembled_underneath: maraUnder,
        underneath_of_day: true,
      }),
      row({ id: "two", assembled_underneath: maraUnder, underneath_of_day: false }),
    ],
    FREE
  );
  assert.equal(served[0].under, true);
  assert.equal(served[0].underneath, null);
  assert.equal(served[1].under, false);
  assert.equal(served[1].underneath, null);
});

test("applyReadGate pro: underneath body ships on the of-the-day row only", () => {
  const served = applyReadGate(
    [
      row({
        id: "one",
        assembled_evidence: maraEvidence,
        assembled_underneath: maraUnder,
        underneath_of_day: true,
      }),
      row({
        id: "two",
        assembled_evidence: maraEvidence,
        assembled_underneath: maraUnder,
        underneath_of_day: false,
      }),
    ],
    PRO
  );
  assert.equal(served[0].under, true);
  assert.equal(served[0].underneath?.headline, maraUnder.headline);
  assert.equal(served[1].under, false);
  assert.equal(served[1].underneath, null);
  assert.ok(served.every((o) => Array.isArray(o.evidence?.entries)));
});

test("pickUnderneathOfDay is stable for a given date and set", () => {
  const ids = ["c", "a", "b"];
  const first = pickUnderneathOfDay(ids, 10);
  const again = pickUnderneathOfDay(["b", "c", "a"], 10);
  assert.equal(first, again);
  assert.equal(pickUnderneathOfDay([], 10), null);
  assert.ok(ids.includes(pickUnderneathOfDay(ids, 0)!));
});

// ---------------------------------------------------------------------------
// PHE-72 — feedback parse / attach / writer ranking
// ---------------------------------------------------------------------------

test("parseFeedbackBody accepts verdicts, null, and opened", () => {
  assert.deepEqual(parseFeedbackBody({ verdict: "new" }), {
    ok: true,
    value: { verdict: "new" },
  });
  assert.deepEqual(parseFeedbackBody({ verdict: null }), {
    ok: true,
    value: { verdict: null },
  });
  assert.deepEqual(parseFeedbackBody({ opened: true }), {
    ok: true,
    value: { opened: true },
  });
  assert.equal(parseFeedbackBody({}).ok, false);
  assert.equal(parseFeedbackBody({ verdict: "data" }).ok, false);
  assert.equal(parseFeedbackBody({ opened: "yes" }).ok, false);
});

test("attachFeedback maps rows onto served observations; missing → null", () => {
  const served = applyReadGate([row({ id: "a" }), row({ id: "b" })], PRO);
  const attached = attachFeedback(served, [
    { observation_id: "a", verdict: "known", opened: true },
  ]);
  assert.deepEqual(attached[0].feedback, { verdict: "known", opened: true });
  assert.equal(attached[1].feedback, null);
});

test("applyFeedbackRanking skips reading hashes and deprioritizes known pillars", () => {
  const userId = "user-1";
  const readingKey = "skip-me";
  const readingHash = computeSignalHash(userId, "origin", readingKey);
  const ranked = applyFeedbackRanking(
    userId,
    [
      cand({ pillar: "origin", signal_key: readingKey, confidence: 0.99 }),
      cand({ pillar: "origin", signal_key: "keep-origin", confidence: 0.5 }),
      cand({ pillar: "emergence", signal_key: "keep-em", confidence: 0.4 }),
    ],
    [
      { signal_hash: readingHash, pillar: "origin", verdict: "reading" },
      { signal_hash: "other", pillar: "origin", verdict: "known" },
    ]
  );
  assert.deepEqual(
    ranked.map((c) => c.signal_key),
    ["keep-em", "keep-origin"]
  );
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
