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
  pointsToFill,
  PILLAR_ORDER,
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
// PHE-129: free now ships every trace too; the locked path is exercised with no traces left.
const NO_TRACES = { ...FREE, evidenceTracesPerDay: 0 };

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

test("pointsToFill lists every point under four moments, in story order", () => {
  const four = (p: string) => [p, p, p, p];
  assert.deepEqual(pointsToFill([]), [...PILLAR_ORDER]);
  assert.deepEqual(
    pointsToFill([...four("origin"), ...four("emergence"), "Self_Creation", ...four("convergence"), ...four("becoming"), ...four("recognition"), ...four("transcendence"), "transcendence"]),
    ["self_creation"],
  );
});

test("collapseOverlappingCandidates keeps the better-supported of two same-pillar moments on one record", () => {
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

  // PHE-156: the weaker angle shares only a window with the stronger, so it stays.
  assert.deepEqual(
    collapsed.map((candidate) => candidate.signal_key).sort(),
    ["export-to-release", "later-window", "release-lag", "same-window-other-pillar"],
  );
});

test("collapseOverlappingCandidates keeps moments on one point over the same months", () => {
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
    ["january", "broad-weak-bridge", "february"],
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

test("applyReadGate with no traces left: every body and span, no trace on any row", () => {
  const served = applyReadGate(
    [
      row({ id: "fresh", evidence_span: "2016 - 2026" }),
      row({ id: "older", span_start: "2019-03-01T00:00:00Z", span_end: "2024-08-01T00:00:00Z" }),
      row({ id: "oldest" }),
    ],
    NO_TRACES
  );
  assert.equal(served.length, 3);
  // Every row keeps the sentence: the day is the same on free and full.
  assert.ok(served.every((o) => o.body === "the body"));
  assert.ok(served.every((o) => o.sentence === "the body"));
  assert.ok(served.every((o) => o.explore_prompt === "the body"));
  // Every row is a door: citations + provenance are withheld on all of them.
  assert.ok(served.every((o) => o.locked === true));
  assert.ok(served.every((o) => o.sources === undefined));
  assert.ok(served.every((o) => o.meta_line === undefined));
  // The time span stays: it says how far back the observation reaches.
  assert.equal(served[0].span, "2016 – 2026");
  assert.equal(served[1].span, "2019 – 2024");
  // No date span on the row: the provenance-label fallback is trace-only.
  assert.equal(served[2].span, undefined);
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
  // With no date span on the row, an unlocked trace falls back to the label.
  assert.ok(served.every((o) => o.span === "cross-platform pattern / 6 months"));
});

test("groupTimelineByPillar groups by pillar and keeps every body and trace for free", () => {
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
  // PHE-129: free sees what happened and its sources, on the timeline as on the feed.
  assert.equal(served.filter((o) => o.locked === true).length, 0);
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

test("applyReadGate with no traces left: every row keeps only sig+recs, never the chain", () => {
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
    NO_TRACES
  );
  assert.ok(served.every((o) => o.locked === true));
  // The door keeps its kind label and count so the client can name it.
  assert.deepEqual(served[0].evidence, { sig: "frequency", recs: 1847 });
  assert.deepEqual(served[1].evidence, { sig: "timing", recs: 4 });
  assert.deepEqual(served[2].evidence, { sig: "frequency", recs: 1847 });
  assert.ok(served.every((o) => o.evidence?.entries === undefined));
  assert.ok(served.every((o) => o.evidence?.chart === undefined));
  assert.ok(served.every((o) => o.evidence?.closer === undefined));
});

test("applyReadGate pro: every row ships the chain", () => {
  const served = applyReadGate(
    [
      row({ id: "one", signal_type: "frequency", assembled_evidence: maraEvidence }),
      row({ id: "two", signal_type: "frequency", assembled_evidence: maraEvidence }),
      row({ id: "three", signal_type: "frequency", assembled_evidence: maraEvidence }),
    ],
    PRO
  );
  assert.ok(served.every((o) => o.locked === false));
  assert.ok(served.every((o) => Array.isArray(o.evidence?.entries)));
  assert.ok(served.every((o) => o.evidence?.closer));
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
  // PHE-122: "follow this thread" on its own is a valid body.
  assert.deepEqual(parseFeedbackBody({ following: true }), { ok: true, value: { following: true } });
  assert.equal(parseFeedbackBody({ following: "yes" }).ok, false);
});

test("attachFeedback maps rows onto served observations; missing → null", () => {
  const served = applyReadGate([row({ id: "a" }), row({ id: "b" })], PRO);
  const attached = attachFeedback(served, [
    { observation_id: "a", verdict: "known", opened: true },
  ]);
  assert.deepEqual(attached[0].feedback, { verdict: "known", opened: true, following: false });
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

// ---------------------------------------------------------------------------
// PHE-92 (v244) — the served free envelope, end to end through
// attachEvidenceHierarchy + applyReadGate: a zero trace budget still leaves
// every row with `{ sig, recs }` and its span, so the door has a name.
// ---------------------------------------------------------------------------

/**
 * Fake Supabase keyed by table. Every read chain is a thenable that resolves
 * to the table's rows; `maybeSingle` resolves to the first row.
 */
function makeFeedSupabase(tables: Record<string, Record<string, unknown>[]>) {
  return {
    getClient() {
      return {
        from(table: string) {
          const data = tables[table] ?? [];
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            is: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }),
            then: (onF: any, onR: any) =>
              Promise.resolve({ data, error: null }).then(onF, onR),
          };
          return chain;
        },
      };
    },
  };
}

function makeFeedService(tier: string) {
  return new ObservationsService(
    { get: () => undefined } as any,
    makeFeedSupabase({
      user_profiles: [{ tier }],
      constellation_state: [{ mantra: "the line of the day" }],
      observations: [
        {
          id: "one",
          pillar: "origin",
          body: "the body. and the rest.",
          source_platforms: ["spotify", "chatgpt"],
          meta_label: "cross-platform pattern / 6 months",
          is_new: true,
          locked_for_free: true,
          surfaced_at: "2026-09-01T00:00:00Z",
          signal_type: "frequency",
          record_count: 1847,
          evidence_span: "2016 - 2026",
        },
        {
          id: "two",
          pillar: "emergence",
          body: "another body.",
          source_platforms: ["youtube"],
          meta_label: null,
          is_new: false,
          locked_for_free: true,
          surfaced_at: "2026-08-01T00:00:00Z",
          signal_type: null,
          record_count: 0,
        },
      ],
      observation_feedback: [],
      // PHE-102: "one" is the unseen signal's moment, so it alone reads as new.
      new_signals: [{ observation_ids: ["one"] }],
      underneath_readings: [],
      observation_signals: [],
    }) as any,
    {} as any,
    new BillingService()
  );
}

test("getDailyFeed free (PHE-129): every row served with its sources, like full", async () => {
  const feed = await makeFeedService("free").getDailyFeed("u1");
  assert.equal(feed.mantra, "the line of the day");
  assert.equal(feed.observations.length, 2);
  const [one] = feed.observations;
  assert.equal(one.locked, false);
  assert.equal(one.sentence, "the body.");
  assert.deepEqual(one.sources, ["spotify", "chatgpt"]);
  assert.equal(one.span, "2016 – 2026");
  assert.ok(Array.isArray(one.evidence?.entries));
});

test("getDailyFeed pro: the chain and the sources ship on every row", async () => {
  const feed = await makeFeedService("pro").getDailyFeed("u1");
  const [one] = feed.observations;
  assert.equal(one.locked, false);
  assert.deepEqual(one.sources, ["spotify", "chatgpt"]);
  assert.equal(one.meta_line, "cross-platform pattern / 6 months");
  assert.equal(one.span, "2016 – 2026");
  assert.equal(one.evidence?.sig, "frequency");
  assert.ok(Array.isArray(one.evidence?.entries));
  assert.ok(one.evidence?.closer);
});

test("buildInsertRows carries the PHE-122 moment fields and keeps only a real date", () => {
  const [withMoment, withoutDate] = buildInsertRows(
    "user-1",
    [
      cand({
        signal_key: "moment-a",
        title: " a board of warm rooms ",
        what_happened: "you start a pinterest board.",
        why_it_matters: "the light you saved returns.",
        what_connects: "",
        occurred_at: "2013-05-02T10:00:00Z",
        area: " Home ",
      }),
      cand({ signal_key: "moment-b", occurred_at: "sometime in 2013", area: "the rooms you kept saving" }),
    ],
    true
  );
  assert.equal(withMoment.title, "a board of warm rooms");
  assert.equal(withMoment.what_happened, "you start a pinterest board.");
  assert.equal(withMoment.what_connects, null);
  assert.equal(withMoment.occurred_at, "2013-05-02");
  assert.equal(withoutDate.title, null);
  assert.equal(withoutDate.occurred_at, null);
  assert.equal(withMoment.area, "home");
  assert.equal(withoutDate.area, null);
});

test("PHE-156 cost: fills run on Sonnet, the first alone, the rest reading its cached grounding", async () => {
  const bodies: any[] = [];
  const events: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
    const n = bodies.push(JSON.parse(init.body));
    events.push(`start ${n}`);
    await new Promise((r) => setTimeout(r, 5));
    events.push(`end ${n}`);
    return { ok: true, status: 200, json: async () => ({ content: [], usage: {} }) };
  }) as any;
  const service = new ObservationsService(
    { get: () => "test-key" } as any,
    { getClient: () => ({}) } as any,
    {
      buildSystemBlocks: async (text: string) => [
        { type: "text", text: "standard", cache_control: { type: "ephemeral" } },
        { type: "text", text },
      ],
    } as any,
    { hasFullAccess: () => true } as any
  );
  let moments: { pillar: string }[] = [];
  (service as any).getUserTier = async () => "free";
  (service as any).loadGenerationContext = async () => ({
    userId: "u",
    state: null,
    traits: [],
    connections: [{ platform: "spotify", redacted_snapshot: null }],
    recent: [],
    moments,
    feedbackSignals: [],
    hasSignal: true,
  });

  try {
    // A new person: seven thin points, seven fill calls.
    await service.generate("u");
    assert.equal(bodies.length, 7);
    assert.deepEqual(events.slice(0, 2), ["start 1", "end 1"]);
    for (const [i, body] of bodies.entries()) {
      assert.equal(body.model, "claude-sonnet-5-5");
      assert.equal(body.output_config.effort, "medium");
      assert.ok(body.system.at(-1).cache_control);
      const [grounding, ask] = body.messages[0].content;
      assert.ok(grounding.cache_control);
      assert.equal(grounding.text, bodies[0].messages[0].content[0].text);
      assert.match(ask.text, new RegExp(`WRITE FOR ONE POINT ONLY: ${PILLAR_ORDER[i]}`));
    }

    // Every point full: one novel-patterns call on Opus, nothing to share.
    bodies.length = 0;
    moments = PILLAR_ORDER.flatMap((pillar) => Array.from({ length: 4 }, () => ({ pillar })));
    await service.generate("u");
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].model, "claude-opus-5-5");
    assert.equal(bodies[0].messages[0].content[0].cache_control, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
