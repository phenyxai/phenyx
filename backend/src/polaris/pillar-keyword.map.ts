import type { Pillar } from "../types/database";

/**
 * PHE-22 — verbatim pillar → keyword map, ported from the prototype's
 * `inferTraitInsight` / pillar-matching logic. This is the SINGLE SOURCE OF TRUTH
 * for keyword-based pillar routing and is shared with PHE-29 (topic tagging), so the
 * keyword lists below must stay byte-for-byte as specified in the ticket.
 *
 * Matching rule: lowercase the question, then substring-match each keyword. The
 * FIRST pillar (in this array's order) with any keyword hit wins. No hit → the
 * caller falls back to the user's top-scoring active pillar from constellation_state.
 *
 * The pillar keys are the `pillar_enum` values (e.g. `self_creation`, not the
 * "self-creation" display label) so the same map feeds constellation_state column
 * lookups (`${pillar}_synthesis`), `polaris_messages.pillar_tag`, and PHE-29 tags
 * without a second translation layer.
 */
export interface PillarKeywords {
  pillar: Pillar;
  keywords: string[];
}

export const PILLAR_KEYWORD_MAP: readonly PillarKeywords[] = [
  { pillar: "origin", keywords: ["beginning", "start", "roots", "foundation"] },
  { pillar: "emergence", keywords: ["emerg", "noticed", "realized", "others saw"] },
  { pillar: "self_creation", keywords: ["made", "create", "built", "my own", "craft"] },
  {
    pillar: "convergence",
    keywords: ["meet", "overlap", "intersection", "different worlds"],
  },
  {
    pillar: "becoming",
    keywords: ["becoming", "who i am when no one", "evolving"],
  },
  {
    pillar: "recognition",
    keywords: ["how i'm seen", "understood", "others describe", "perceive"],
  },
  {
    pillar: "transcendence",
    keywords: ["beyond", "purpose", "legacy", "meaning", "where i'm going"],
  },
] as const;

/**
 * Route a question to the most relevant pillar via the verbatim keyword map above.
 * Returns null when no keyword matches — the caller then falls back to the user's
 * top-scoring active pillar (or a default) from constellation_state.
 */
export function inferPillarFromKeywords(question: string): Pillar | null {
  const q = question.toLowerCase();
  for (const { pillar, keywords } of PILLAR_KEYWORD_MAP) {
    if (keywords.some((k) => q.includes(k))) {
      return pillar;
    }
  }
  return null;
}
