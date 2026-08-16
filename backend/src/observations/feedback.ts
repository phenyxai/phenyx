import { computeSignalHash, normalizePillar } from "./signal-hash";
import { orderCandidates, type ObservationCandidate, type ServedObservation } from "./gating";

/**
 * PHE-72 — observation feedback (`does this land?`).
 *
 * Verdicts are internal storage keys, never user-facing copy:
 *   new     ← yes
 *   known   ← yes, already knew
 *   reading ← not quite
 */

export const FEEDBACK_VERDICTS = ["new", "known", "reading"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export interface ObservationFeedbackState {
  verdict: FeedbackVerdict | null;
  opened: boolean;
}

export interface FeedbackSignal {
  signal_hash: string;
  pillar: string;
  verdict: FeedbackVerdict | null;
  /** Writer-only; never sent to the client feedback payload. */
  body?: string;
}

export interface ParsedFeedbackBody {
  verdict?: FeedbackVerdict | null;
  opened?: boolean;
}

const VERDICT_SET: ReadonlySet<string> = new Set(FEEDBACK_VERDICTS);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type ParseFeedbackResult =
  | { ok: true; value: ParsedFeedbackBody }
  | { ok: false; error: string };

/** Validate the POST /observations/:id/feedback body. */
export function parseFeedbackBody(body: unknown): ParseFeedbackResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "body must be an object" };
  }

  const hasVerdict = Object.prototype.hasOwnProperty.call(body, "verdict");
  const hasOpened = Object.prototype.hasOwnProperty.call(body, "opened");
  if (!hasVerdict && !hasOpened) {
    return { ok: false, error: "verdict or opened is required" };
  }

  const value: ParsedFeedbackBody = {};

  if (hasVerdict) {
    const verdict = body.verdict;
    if (verdict !== null && (typeof verdict !== "string" || !VERDICT_SET.has(verdict))) {
      return { ok: false, error: "verdict must be new, known, reading, or null" };
    }
    value.verdict = verdict as FeedbackVerdict | null;
  }

  if (hasOpened) {
    if (typeof body.opened !== "boolean") {
      return { ok: false, error: "opened must be a boolean" };
    }
    value.opened = body.opened;
  }

  return { ok: true, value };
}

export interface FeedbackRow {
  observation_id: string;
  verdict: string | null;
  opened: boolean;
}

function asVerdict(value: string | null): FeedbackVerdict | null {
  if (value && VERDICT_SET.has(value)) return value as FeedbackVerdict;
  return null;
}

/** Attach persisted feedback onto the daily-feed payload. Missing row → null. */
export function attachFeedback(
  observations: ServedObservation[],
  rows: FeedbackRow[]
): ServedObservation[] {
  const byId = new Map<string, ObservationFeedbackState>();
  for (const row of rows) {
    byId.set(row.observation_id, {
      verdict: asVerdict(row.verdict),
      opened: row.opened === true,
    });
  }
  return observations.map((o) => ({
    ...o,
    feedback: byId.get(o.id) ?? null,
  }));
}

/**
 * Writer ranking (PHE-72):
 *   - `reading` hashes are overreach — do not regenerate the same claim
 *   - `known` pillars are a surfacing problem — deprioritize them
 *   - `new` is the value rate and does not filter
 */
export function applyFeedbackRanking(
  userId: string,
  candidates: ObservationCandidate[],
  feedback: FeedbackSignal[]
): ObservationCandidate[] {
  const readingHashes = new Set(
    feedback.filter((f) => f.verdict === "reading").map((f) => f.signal_hash)
  );
  const knownPillars = new Set(
    feedback
      .filter((f) => f.verdict === "known")
      .map((f) => normalizePillar(f.pillar))
  );

  const kept = readingHashes.size
    ? candidates.filter((c) => {
        const hash = computeSignalHash(userId, c.pillar, c.signal_key);
        return !readingHashes.has(hash);
      })
    : candidates;

  const ordered = orderCandidates(kept);
  if (knownPillars.size === 0) return ordered;

  const fresh: ObservationCandidate[] = [];
  const known: ObservationCandidate[] = [];
  for (const c of ordered) {
    if (knownPillars.has(normalizePillar(c.pillar))) known.push(c);
    else fresh.push(c);
  }
  return [...fresh, ...known];
}
