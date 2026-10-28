import { computeSignalHash, normalizePillar, normalizeSignalKey } from "./signal-hash";
import type { TierCapabilities } from "../stripe/billing.service";
import { normalizeDateSpan } from "../voice-standard/sanitize-prose";
import {
  redactEvidence,
  type Evidence,
  type Underneath,
} from "./evidence";

/**
 * Free-tier gating + deterministic ordering + read-time redaction for the
 * observation engine (PHE-37). Kept as pure functions (no Nest DI) so the gating
 * invariants are unit-testable without a live DB or Claude call, and so PHE-41
 * (read gate) can refine {@link applyReadGate} in Wave 2 with a clear seam.
 */

/** `pillar_enum` values, in surfacing-priority order (see phe5 migration DDL). */
export const PILLAR_ORDER = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
] as const;

export type Pillar = (typeof PILLAR_ORDER)[number];

const PILLAR_PRIORITY: Record<string, number> = Object.fromEntries(
  PILLAR_ORDER.map((p, i) => [p, i])
);

export function isValidPillar(pillar: string): pillar is Pillar {
  return normalizePillar(pillar) in PILLAR_PRIORITY;
}

/** PHE-156: how many moments each point of the constellation aims to hold. */
export const MOMENTS_PER_POINT = { min: 4, max: 6 } as const;

/** The points holding fewer than {@link MOMENTS_PER_POINT}.min moments, in story order. */
export function pointsToFill(momentPillars: readonly string[]): Pillar[] {
  const counts = new Map<string, number>();
  for (const p of momentPillars) counts.set(normalizePillar(p), (counts.get(normalizePillar(p)) ?? 0) + 1);
  return PILLAR_ORDER.filter((p) => (counts.get(p) ?? 0) < MOMENTS_PER_POINT.min);
}

/** Lower number = higher priority. Unknown pillars sort last. */
export function pillarPriority(pillar: string): number {
  const p = PILLAR_PRIORITY[normalizePillar(pillar)];
  return p === undefined ? PILLAR_ORDER.length : p;
}

/** A single observation as emitted by the `emit_observations` Claude tool. */
export interface ObservationCandidate {
  pillar: string;
  body: string;
  source_platforms: string[];
  meta_label: string | null;
  signal_key: string;
  /** Concrete statements shown behind the observation and used to rank overlap. */
  supporting_points?: string[];
  /** Stable source-record or trait keys copied from the grounding context. */
  source_record_keys?: string[];
  /** Inclusive UTC window for the records behind this observation. */
  window_start?: string | null;
  window_end?: string | null;
  /** PHE-122 moment fields: one short line, then the three readings and the date. */
  title?: string;
  what_happened?: string;
  why_it_matters?: string;
  what_connects?: string;
  occurred_at?: string | null;
  /** PHE-129: one or two words for the part of life the moment sits in; the point's filters. */
  area?: string;
  /** 0..1, used only for deterministic ordering; not persisted (no column). */
  confidence: number;
}

/**
 * Deterministic candidate ordering: pillar priority ASC, then confidence DESC,
 * then normalized signal_key ASC as a stable final tiebreak. Stable across runs
 * for the same inputs, which is what the free-tier gate relies on.
 */
export function orderCandidates(
  candidates: ObservationCandidate[]
): ObservationCandidate[] {
  return [...candidates].sort((a, b) => {
    const pa = pillarPriority(a.pillar);
    const pb = pillarPriority(b.pillar);
    if (pa !== pb) return pa - pb;
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (ca !== cb) return cb - ca;
    return normalizeSignalKey(a.signal_key).localeCompare(
      normalizeSignalKey(b.signal_key)
    );
  });
}

/**
 * Collapse candidate angles that rest on the same source record. A duplicate
 * pair must share a normalized pillar and a source-record key. PHE-156: an
 * overlapping time window alone no longer merges, since a point holds four to
 * six moments from the same era. Stronger candidates are compared first, so a
 * weak bridge cannot transitively erase distinct moments.
 */
export function collapseOverlappingCandidates(
  candidates: ObservationCandidate[],
): ObservationCandidate[] {
  const ranked = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        candidateStrength(right.candidate) - candidateStrength(left.candidate) ||
        left.index - right.index,
    );
  const kept: typeof ranked = [];
  for (const item of ranked) {
    if (kept.some((other) => candidatesOverlap(item.candidate, other.candidate))) {
      continue;
    }
    kept.push(item);
  }
  return kept
    .sort((left, right) => left.index - right.index)
    .map(({ candidate }) => candidate);
}

function candidateStrength(candidate: ObservationCandidate): number {
  const points = candidate.supporting_points?.filter((point) => point.trim()).length ?? 0;
  return points * 2 + Math.max(0, Math.min(1, candidate.confidence ?? 0));
}

function candidatesOverlap(
  left: ObservationCandidate,
  right: ObservationCandidate,
): boolean {
  if (normalizePillar(left.pillar) !== normalizePillar(right.pillar)) return false;

  const leftKeys = new Set(candidateRecordKeys(left));
  return candidateRecordKeys(right).some((key) => leftKeys.has(key));
}

function candidateRecordKeys(candidate: ObservationCandidate): string[] {
  const platforms = new Set(candidate.source_platforms.map(normalizeSignalKey));
  return (candidate.source_record_keys ?? [])
    .map(normalizeSignalKey)
    .filter((key) => key && !platforms.has(key));
}

function candidateWindow(
  candidate: ObservationCandidate,
): { start: number; end: number; startIso: string; endIso: string } | null {
  if (!candidate.window_start || !candidate.window_end) return null;
  const start = Date.parse(candidate.window_start);
  const end = Date.parse(candidate.window_end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  return {
    start: first,
    end: last,
    startIso: new Date(first).toISOString(),
    endIso: new Date(last).toISOString(),
  };
}

/**
 * Generation-time gating flags (denormalized convenience persisted on the row).
 * `orderedCandidates` MUST already be in {@link orderCandidates} order.
 *
 * v67: observation *bodies* are never locked. `locked_for_free` now means
 * "evidence trace is behind the free daily budget" and is re-derived at read
 * time by {@link applyReadGate} from `evidenceTracesPerDay`. Generation still
 * stamps the flag for SQL convenience: free marks every candidate after the
 * first two; pro/gifted stamps all false.
 */
export function computeLockedForFree(
  orderedCandidates: ObservationCandidate[],
  hasFullAccess: boolean
): boolean[] {
  return orderedCandidates.map((_, i) => (hasFullAccess ? false : i >= 2));
}

/** A row to be inserted into `public.observations`. */
export interface ObservationInsert {
  user_id: string;
  pillar: string;
  body: string;
  source_platforms: string[];
  meta_label: string | null;
  is_new: boolean;
  locked_for_free: boolean;
  signal_hash: string;
  points?: string[];
  span_start?: string | null;
  span_end?: string | null;
  title?: string | null;
  what_happened?: string | null;
  why_it_matters?: string | null;
  what_connects?: string | null;
  occurred_at?: string | null;
  area?: string | null;
}

/** "2013-05-02" or "2013-05-02T…" → "2013-05-02"; anything else → null. */
export function momentDate(value: string | null | undefined): string | null {
  const m = value?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m && !Number.isNaN(Date.parse(m[1])) ? m[1] : null;
}

/** " Home " → "home". A topic is a word or two, so anything longer is dropped. */
export function momentArea(value: string | null | undefined): string | null {
  const area = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return area && area.length <= 24 && area.split(" ").length <= 2 ? area : null;
}

/**
 * Turn ordered candidates into insert rows, computing `signal_hash`, setting
 * `is_new=true` (novelty flag) and the generation-time `locked_for_free`. Rows
 * that collapse to the same `signal_hash` within this batch are deduped (first
 * wins) so a single `INSERT ... ON CONFLICT DO NOTHING` can't try to touch the
 * same conflict target twice.
 */
export function buildInsertRows(
  userId: string,
  orderedCandidates: ObservationCandidate[],
  hasFullAccess: boolean
): ObservationInsert[] {
  const seen = new Set<string>();
  const rows: ObservationInsert[] = [];
  for (const c of orderedCandidates) {
    const signal_hash = computeSignalHash(userId, c.pillar, c.signal_key);
    if (seen.has(signal_hash)) continue;
    seen.add(signal_hash);
    const window = candidateWindow(c);
    rows.push({
      user_id: userId,
      pillar: normalizePillar(c.pillar),
      body: c.body,
      source_platforms: c.source_platforms,
      meta_label: c.meta_label && c.meta_label.trim() ? normalizeDateSpan(c.meta_label) : null,
      is_new: true,
      // Stamp after dedup so the free budget applies to unique rows, not
      // collapsed duplicates that never land in `observations`.
      locked_for_free: hasFullAccess ? false : rows.length >= 2,
      signal_hash,
      points: c.supporting_points?.filter((point) => point.trim()),
      span_start: window?.startIso ?? null,
      span_end: window?.endIso ?? null,
      title: c.title?.trim() || null,
      what_happened: c.what_happened?.trim() || null,
      why_it_matters: c.why_it_matters?.trim() || null,
      what_connects: c.what_connects?.trim() || null,
      occurred_at: momentDate(c.occurred_at),
      area: momentArea(c.area),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Read-time gate (PHE-41 refines this in Wave 2).
// ---------------------------------------------------------------------------

/** A stored observation row as read back for serving. */
export interface ObservationRow {
  id: string;
  pillar: string;
  body: string;
  source_platforms: string[];
  meta_label: string | null;
  is_new: boolean;
  locked_for_free: boolean;
  surfaced_at: string;
  /** v66 supporting points (jsonb array of strings). */
  points?: unknown;
  /** Human date span, e.g. "2016 – 2026". */
  evidence_span?: string | null;
  span_start?: string | null;
  span_end?: string | null;
  /** v66 pattern type; used by PHE-72 analytics, never the observation body. */
  signal_type?: string | null;
  evidence_n?: number | null;
  record_count?: number | null;
  sources?: string[] | null;
  /** Full chain assembled by the service; redacted by {@link applyReadGate}. */
  assembled_evidence?: Evidence | null;
  assembled_underneath?: Underneath | null;
  /** True when this row is the one Daily underneath for the local day. */
  underneath_of_day?: boolean;
}

/**
 * The served observation shape (`Observation` in the frontend api-client). Its
 * only consumer, the daily feed card, was removed in PHE-96, so the daily feed
 * and `/observations/:id/feedback` have no frontend consumer. Bodies always
 * ship. `locked` means the *evidence trace* is withheld (citations/provenance
 * omitted), never the sentence itself and, since v244, never the time span.
 */
export interface ServedObservation {
  id: string;
  pillar_tag: string;
  body?: string | null;
  /** First sentence of `body`, for the collapsed Daily card. */
  sentence?: string | null;
  /** Counts behind the claim. */
  points?: string[] | null;
  sources?: string[] | null;
  /** Date span. Served on every tier (v244): how far back the observation reaches. */
  span?: string | null;
  meta_line?: string | null;
  /** Opening question for ✦ explore. */
  explore_prompt?: string | null;
  is_new?: boolean;
  /** True when the evidence trace is redacted (free: every row since v244). */
  locked?: boolean;
  hint?: string | null;
  /** Full chain, or `{ sig, recs }` stub when locked. Null when there is no signal. */
  evidence?: Evidence | null;
  /**
   * True when this observation is today's Daily underneath (Pro body or free lock).
   * The reading payload is never sent to free.
   */
  under?: boolean;
  underneath?: Underneath | null;
  /** v66 pattern type for analytics (PHE-72). */
  signal_type?: string | null;
  /** Persisted `how does this read to you?` state; null when the user has not touched it. */
  feedback?: { verdict: "new" | "known" | "reading" | null; opened: boolean } | null;
}

/** First sentence of an observation body (collapsed Daily card). */
export function firstSentence(body: string): string {
  const cleaned = body.replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return (match ? match[0] : cleaned).trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function formatObservationSpan(
  row: Pick<ObservationRow, "evidence_span" | "span_start" | "span_end">,
): string | null {
  if (row.evidence_span && row.evidence_span.trim()) {
    return normalizeDateSpan(row.evidence_span.trim());
  }
  const start = row.span_start ? new Date(row.span_start) : null;
  const end = row.span_end ? new Date(row.span_end) : null;
  const year = (d: Date) =>
    Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
  const a = start ? year(start) : null;
  const b = end ? year(end) : null;
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return null;
}

function formatSpan(row: ObservationRow): string | null {
  const observationSpan = formatObservationSpan(row);
  if (observationSpan) return observationSpan;
  if (row.meta_label && row.meta_label.trim()) {
    return normalizeDateSpan(row.meta_label.trim());
  }
  return null;
}

/** Redacted placeholder served in place of a locked observation's body. */
export function redactedHint(row: ObservationRow): string {
  const pillar = normalizePillar(row.pillar).replace(/_/g, " ");
  return `a new ${pillar} signal is waiting — unlock to read it`;
}

/**
 * Authoritative serve-time tier gate, driven by {@link TierCapabilities}
 * (PHE-69). `rows` MUST be ordered `surfaced_at DESC` (freshest first).
 *
 * Every tier receives every observation body and its time span (v244: the
 * span stays on free because it tells the person how far back the observation
 * reaches; which accounts it came from does not). Citations + provenance
 * (`sources`, `meta_line`) ship on the first `evidenceTracesPerDay` rows,
 * which is none on free since v244 and all on pro/gifted; the rest keep
 * `body` but set `locked=true`. The proof is what full buys, not the only
 * honest sentences.
 *
 * Evidence: unlocked rows ship the full chain. Locked rows keep `{ sig, recs }`
 * so the client can render the door from payload presence, never chart/entries/
 * closer. Underneath: at most one of the day; pro/gifted get the reading, free
 * gets `under: true` with `underneath: null`.
 */
export function applyReadGate(
  rows: ObservationRow[],
  capabilities: TierCapabilities
): ServedObservation[] {
  return rows.map((row, index) => {
    const bodyUnlocked = index < capabilities.observationsUnlocked;
    const traceUnlocked = index < capabilities.evidenceTracesPerDay;
    const sentence = firstSentence(row.body);
    const points = asStringArray(row.points);
    const evidence = redactEvidence(row.assembled_evidence ?? null, traceUnlocked);
    const under = row.underneath_of_day === true;
    const underneath =
      under && capabilities.underneath ? row.assembled_underneath ?? null : null;
    if (!bodyUnlocked) {
      return {
        id: row.id,
        pillar_tag: row.pillar,
        is_new: row.is_new,
        locked: true,
        hint: redactedHint(row),
        evidence: evidence ? redactEvidence(evidence, false) : null,
        under,
        underneath: null,
        signal_type: row.signal_type ?? null,
      };
    }
    return {
      id: row.id,
      pillar_tag: row.pillar,
      body: row.body,
      sentence,
      points: points.length ? points : undefined,
      sources: traceUnlocked ? row.source_platforms : undefined,
      // The date span ships on every tier. The provenance-label fallback
      // inside `formatSpan` is provenance, so it stays behind the trace.
      span: (traceUnlocked ? formatSpan(row) : formatObservationSpan(row)) ?? undefined,
      meta_line: traceUnlocked ? row.meta_label : undefined,
      explore_prompt: sentence || undefined,
      is_new: row.is_new,
      locked: !traceUnlocked,
      evidence,
      under,
      underneath,
      signal_type: row.signal_type ?? null,
    };
  });
}

export interface TimelineGroup {
  pillar: string;
  observations: ServedObservation[];
}

/**
 * Constellation timeline: apply the same authoritative gate across the whole
 * `surfaced_at DESC` feed (so the free trace budget holds globally), then
 * group by pillar preserving recency order within each group.
 */
export function groupTimelineByPillar(
  rows: ObservationRow[],
  capabilities: TierCapabilities
): TimelineGroup[] {
  const served = applyReadGate(rows, capabilities);
  const byPillar = new Map<string, ServedObservation[]>();
  served.forEach((obs) => {
    const key = obs.pillar_tag;
    const bucket = byPillar.get(key);
    if (bucket) bucket.push(obs);
    else byPillar.set(key, [obs]);
  });
  // Emit groups in pillar-priority order for a stable timeline.
  return [...byPillar.entries()]
    .sort((a, b) => pillarPriority(a[0]) - pillarPriority(b[0]))
    .map(([pillar, observations]) => ({ pillar, observations }));
}
