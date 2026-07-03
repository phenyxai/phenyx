/**
 * PHE-24 — pure trait-grounding helpers (no NestJS DI, so unit-testable in
 * isolation the same way sanitize-prose.ts is). Two concerns:
 *   1. guardInsight: the plain-text + 2-3-sentence guard a generated insight must
 *      pass before it is stored.
 *   2. rankTraitMatches: keyword substring matching + relevance ranking for the
 *      `inferTraitInsight` accessor used by the Polaris grounding cascade.
 */

import { sanitizeProse } from "../voice-standard/sanitize-prose";

/** A stored `user_traits` row reduced to the fields matching/ranking needs. */
export interface TraitRow {
  keyword_tags: string[];
  insight: string;
  synthesis_version: number | null;
  created_at: string;
}

/**
 * One matched trait insight returned by `inferTraitInsight`. Only `insight` is
 * ever renderable — `keywordTags` and `score` are internal routing/telemetry
 * metadata and must never be surfaced to a client.
 */
export interface TraitInsightMatch {
  insight: string;
  keywordTags: string[];
  score: number;
}

/** Voice-Standard insights are single resonant lines; cap at 3 sentences. */
const MAX_SENTENCES = 3;

/**
 * Plain-text + length guard for a generated insight. Runs `sanitizeProse` first
 * (strips markdown/HTML/angle brackets), then rejects anything empty or longer
 * than 3 sentences. Returns the clean insight, or null when it must NOT be stored.
 */
export function guardInsight(raw: string): string | null {
  const clean = sanitizeProse(raw ?? "").trim();
  if (!clean) return null;
  if (countSentences(clean) > MAX_SENTENCES) return null;
  return clean;
}

/**
 * Count sentence terminators (., !, ?), collapsing runs like "..." or "?!" into
 * one. Text with terminators but a trailing fragment still counts each terminator;
 * non-empty text with no terminator counts as a single sentence.
 */
export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  if (matches) return matches.length;
  return text.trim() ? 1 : 0;
}

/**
 * Lowercase the question, then return every trait row whose `keyword_tags` has any
 * substring hit against the question, ranked most-relevant first. Relevance is
 * (distinct keyword hits) desc, then synthesis_version desc, then created_at desc
 * so the newest grounding wins ties. Returns [] when nothing hits — the caller
 * then falls back (PHE-22 uses the top pillar's synthesis) rather than forcing an
 * irrelevant insight.
 *
 * `user_traits` carries no pillar linkage, so the ticket's "pillar relevance" is
 * approximated by hit-count + recency: the newest constellation version is the
 * strongest available proxy for the currently-dominant pillar.
 */
export function rankTraitMatches(
  question: string,
  rows: TraitRow[]
): TraitInsightMatch[] {
  const q = (question ?? "").toLowerCase();
  if (!q.trim()) return [];

  const scored: Array<{
    match: TraitInsightMatch;
    version: number;
    createdAt: number;
  }> = [];

  for (const row of rows) {
    if (!row?.insight) continue;
    const tags = Array.isArray(row.keyword_tags) ? row.keyword_tags : [];
    // Distinct keyword hits — a repeated/overlapping tag never inflates the score.
    const hits = new Set<string>();
    for (const tag of tags) {
      const t = (tag ?? "").toLowerCase().trim();
      if (t && q.includes(t)) hits.add(t);
    }
    if (hits.size > 0) {
      scored.push({
        match: { insight: row.insight, keywordTags: tags, score: hits.size },
        version: row.synthesis_version ?? 0,
        createdAt: Date.parse(row.created_at ?? "") || 0,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    if (b.version !== a.version) return b.version - a.version;
    return b.createdAt - a.createdAt;
  });

  return scored.map((s) => s.match);
}
