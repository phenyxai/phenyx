import { computeSignalHash, normalizePillar, normalizeSignalKey } from "./signal-hash";
import type { TierCapabilities } from "../stripe/billing.service";

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
    rows.push({
      user_id: userId,
      pillar: normalizePillar(c.pillar),
      body: c.body,
      source_platforms: c.source_platforms,
      meta_label: c.meta_label && c.meta_label.trim() ? c.meta_label : null,
      is_new: true,
      // Stamp after dedup so the free budget applies to unique rows, not
      // collapsed duplicates that never land in `observations`.
      locked_for_free: hasFullAccess ? false : rows.length >= 2,
      signal_hash,
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
  /** Human date span, e.g. "2016 - 2026". */
  evidence_span?: string | null;
  span_start?: string | null;
  span_end?: string | null;
}

/**
 * The shape the frontend consumes (`frontend/components/phenyx/observation-card.tsx`
 * → `Observation`). v67: bodies always ship. `locked` means the *evidence trace*
 * is withheld (citations/provenance omitted) — never the sentence itself.
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
  /** Date span shown next to source tags. */
  span?: string | null;
  meta_line?: string | null;
  /** Opening question for ✦ explore. */
  explore_prompt?: string | null;
  is_new?: boolean;
  /** True when the evidence trace is redacted (free, after the daily budget). */
  locked?: boolean;
  hint?: string | null;
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

function formatSpan(row: ObservationRow): string | null {
  if (row.evidence_span && row.evidence_span.trim()) return row.evidence_span.trim();
  const start = row.span_start ? new Date(row.span_start) : null;
  const end = row.span_end ? new Date(row.span_end) : null;
  const year = (d: Date) =>
    Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
  const a = start ? year(start) : null;
  const b = end ? year(end) : null;
  if (a && b) return a === b ? a : `${a} - ${b}`;
  if (row.meta_label && row.meta_label.trim()) return row.meta_label.trim();
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
 * v67: every tier receives every observation body. Free receives citations +
 * provenance on the first `evidenceTracesPerDay` rows of the local day; later
 * rows keep `body` but set `locked=true` and omit sources/meta (the proof is
 * what Pro buys, not the only honest sentences). Pro/gifted: all traces.
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
    if (!bodyUnlocked) {
      return {
        id: row.id,
        pillar_tag: row.pillar,
        is_new: row.is_new,
        locked: true,
        hint: redactedHint(row),
      };
    }
    return {
      id: row.id,
      pillar_tag: row.pillar,
      body: row.body,
      sentence,
      points: points.length ? points : undefined,
      sources: traceUnlocked ? row.source_platforms : undefined,
      span: traceUnlocked ? formatSpan(row) : undefined,
      meta_line: traceUnlocked ? row.meta_label : undefined,
      explore_prompt: sentence || undefined,
      is_new: row.is_new,
      locked: !traceUnlocked,
    };
  });
}

export interface TimelineGroup {
  pillar: string;
  observations: ServedObservation[];
}

/**
 * Constellation timeline: apply the same authoritative gate across the whole
 * `surfaced_at DESC` feed (so "exactly one unlocked for free" holds globally),
 * then group by pillar preserving recency order within each group.
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
