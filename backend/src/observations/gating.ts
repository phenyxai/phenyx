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
 * `orderedCandidates` MUST already be in {@link orderCandidates} order. Free
 * tier: exactly the single highest-priority candidate is unlocked
 * (`locked_for_free=false`), the rest locked. Pro/gifted: all unlocked.
 *
 * The authoritative serve-time gate is {@link applyReadGate}; this flag is a
 * convenience for SQL verification and a fast path, re-derived on read.
 */
export function computeLockedForFree(
  orderedCandidates: ObservationCandidate[],
  hasFullAccess: boolean
): boolean[] {
  return orderedCandidates.map((_, i) => (hasFullAccess ? false : i !== 0));
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
  const lockedFlags = computeLockedForFree(orderedCandidates, hasFullAccess);
  const seen = new Set<string>();
  const rows: ObservationInsert[] = [];
  orderedCandidates.forEach((c, i) => {
    const signal_hash = computeSignalHash(userId, c.pillar, c.signal_key);
    if (seen.has(signal_hash)) return;
    seen.add(signal_hash);
    rows.push({
      user_id: userId,
      pillar: normalizePillar(c.pillar),
      body: c.body,
      source_platforms: c.source_platforms,
      meta_label: c.meta_label && c.meta_label.trim() ? c.meta_label : null,
      is_new: true,
      locked_for_free: lockedFlags[i],
      signal_hash,
    });
  });
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
}

/**
 * The shape the frontend consumes (`frontend/components/phenyx/observation-card.tsx`
 * → `Observation`). Locked cards omit `body`/`sources` entirely — the client
 * never receives redacted content — and carry a `hint` instead.
 */
export interface ServedObservation {
  id: string;
  pillar_tag: string;
  body?: string | null;
  sources?: string[] | null;
  meta_line?: string | null;
  is_new?: boolean;
  locked?: boolean;
  hint?: string | null;
}

/** Redacted placeholder served in place of a locked observation's body. */
export function redactedHint(row: ObservationRow): string {
  const pillar = normalizePillar(row.pillar).replace(/_/g, " ");
  return `a new ${pillar} signal is waiting — unlock to read it`;
}

/**
 * Authoritative serve-time tier gate, driven by {@link TierCapabilities}
 * (PHE-41). `rows` MUST be ordered `surfaced_at DESC` (freshest first) — that
 * ordering is what makes the free unlock land at index 0, matching the
 * belt-and-suspenders client gate in `frontend/app/dashboard/daily/page.tsx`
 * (`locked = !isPro && index > 0`).
 *
 * Free (`observationsUnlocked: 1`): exactly the freshest observation is served
 * with its `body`, but with `source_platforms` and provenance (`meta_label`)
 * STRIPPED — those are stored, never sent, so an upgrade reveals them with no
 * re-generation. Every other row is served locked with `body`/`sources` omitted
 * and a `hint` in their place.
 * Pro/gifted (`observationsUnlocked: Infinity`): all unlocked, citations +
 * provenance present.
 */
export function applyReadGate(
  rows: ObservationRow[],
  capabilities: TierCapabilities
): ServedObservation[] {
  return rows.map((row, index) => {
    const unlocked = index < capabilities.observationsUnlocked;
    if (unlocked) {
      return {
        id: row.id,
        pillar_tag: row.pillar,
        body: row.body,
        // Stripped for free even on the single unlocked card (still stored).
        sources: capabilities.crossPlatformCitations ? row.source_platforms : undefined,
        meta_line: capabilities.fullProvenance ? row.meta_label : undefined,
        is_new: row.is_new,
        locked: false,
      };
    }
    return {
      id: row.id,
      pillar_tag: row.pillar,
      is_new: row.is_new,
      locked: true,
      hint: redactedHint(row),
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
