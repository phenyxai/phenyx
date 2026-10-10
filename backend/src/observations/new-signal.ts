import { formatObservationSpan, isValidPillar, PILLAR_ORDER } from "./gating";
import { normalizePillar } from "./signal-hash";

/**
 * PHE-102 — new signal. A refresh that inserts observations the user didn't
 * have before is a new pattern; it becomes one `new_signals` row attached to
 * one point. The first generation never makes one: with nothing surfaced
 * before, nothing can be new relative to it.
 */

/** An observation this refresh actually inserted (signal_hash was new). */
export interface InsertedMoment {
  id: string;
  pillar: string;
  body: string;
  source_platforms: string[] | null;
  evidence_span?: string | null;
  span_start?: string | null;
  span_end?: string | null;
}

/** What `emit_new_signal` returns (all optional: Claude may fail). */
export interface EmittedSignal {
  point?: string;
  points?: string[];
  summary?: string;
  ideas?: string[];
}

export interface NewSignalInsert {
  user_id: string;
  pillar: string;
  points: string[];
  summary: string;
  ideas: string[];
  observation_ids: string[];
  sources: Array<{ observation_id: string; platform: string; span: string | null }>;
}

export function shouldCreateSignal(hadPriorObservations: boolean, inserted: number): boolean {
  return hadPriorObservations && inserted > 0;
}

/**
 * Build the row. The point and points involved fall back to the moments' own
 * pillars and the summary to the first moment's body, so a failed Claude call
 * still yields a signal that traces to its sources; ideas are only Claude's.
 */
export function buildNewSignalRow(
  userId: string,
  moments: InsertedMoment[],
  emitted: EmittedSignal | null
): NewSignalInsert {
  const momentPillars = moments.map((m) => normalizePillar(m.pillar));
  const pillar =
    emitted?.point && isValidPillar(emitted.point)
      ? normalizePillar(emitted.point)
      : momentPillars[0];
  const named = (emitted?.points ?? []).filter(isValidPillar).map(normalizePillar);
  const involved = new Set([pillar, ...momentPillars, ...named]);
  return {
    user_id: userId,
    pillar,
    // Story order, the same order the map and panel use.
    points: PILLAR_ORDER.filter((p) => involved.has(p)),
    summary: emitted?.summary?.trim() || moments[0].body,
    ideas: (emitted?.ideas ?? []).map((i) => i.trim()).filter(Boolean).slice(0, 3),
    observation_ids: moments.map((m) => m.id),
    sources: moments.flatMap((m) =>
      (m.source_platforms ?? []).map((platform) => ({
        observation_id: m.id,
        platform,
        span: formatObservationSpan({
          evidence_span: m.evidence_span ?? null,
          span_start: m.span_start ?? null,
          span_end: m.span_end ?? null,
        }),
      }))
    ),
  };
}
