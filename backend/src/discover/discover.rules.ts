import { sanitizeProse } from "../voice-standard/sanitize-prose";
import { PILLAR_ORDER, isValidPillar } from "../observations/gating";
import { normalizePillar } from "../observations/signal-hash";

/**
 * PHE-103 — the card rules for discover, as pure functions so they run under
 * `node --test` without Nest, Supabase or Claude.
 *
 * Order in the service: {@link validateDiscovery} each candidate (limits,
 * trims, dated trail), {@link dedupeDiscoveries} the survivors (PHE-83 carry
 * over), then {@link selectSet} the seven that are shown.
 */

/** Spec doc 3: each discovery has exactly one of these, shown as its label. */
export const DISCOVERY_TYPES = [
  "resurfaced",
  "connection",
  "pattern",
  "rhythm",
  "unfinished thread",
  "memory",
  "taste",
  "possibility",
  "health",
  "language",
  "network",
] as const;

export type DiscoveryType = (typeof DISCOVERY_TYPES)[number];

/** The prompt asks for about 50 characters; past this the card is regenerated. */
export const HEADLINE_MAX = 60;
export const TIME_CONTEXT_MAX = 40;
export const SET_SIZE = 7;

export interface TrailEntry {
  platform: string;
  /** yyyy, yyyy-mm or yyyy-mm-dd, copied from the grounding. */
  date: string;
  detail: string;
}

/** One card as Claude emits it through `emit_discoveries`. */
export interface DiscoveryCandidate {
  type: string;
  pillar: string;
  time_context: string;
  headline: string;
  what_surfaced: string;
  why_now: string;
  trail: TrailEntry[];
  confidence: number;
}

/** A card that meets every limit: what is stored and shown. */
export interface Discovery {
  type: DiscoveryType;
  pillar: string;
  time_context: string;
  headline: string;
  what_surfaced: string;
  why_now: string;
  /** The platform pills: the trail's platforms, so every pill has a dated source. */
  sources: string[];
  /** Earliest first. */
  trail: TrailEntry[];
  confidence: number;
}

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** Text up to the first sentence end. A decimal like "2.5" is not an end. */
export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/s);
  return (match ? match[0] : text).trim();
}

/**
 * Check one candidate against the card limits. The two sentence fields are
 * trimmed to their first sentence; anything that can't be trimmed honestly
 * (a long headline, a headline with two ideas, no dated source on a connected
 * platform) returns null so the service can regenerate it.
 */
export function validateDiscovery(
  candidate: DiscoveryCandidate,
  connectedPlatforms: ReadonlySet<string>,
): Discovery | null {
  if (!(DISCOVERY_TYPES as readonly string[]).includes(candidate.type)) return null;
  if (!isValidPillar(candidate.pillar)) return null;

  const headline = sanitizeProse(candidate.headline).replace(/[.!?]+$/, "");
  if (!headline || headline.length > HEADLINE_MAX || /[.!?]\s/.test(headline)) return null;

  const time_context = sanitizeProse(candidate.time_context).replace(/\.+$/, "");
  if (!time_context || time_context.length > TIME_CONTEXT_MAX) return null;

  const what_surfaced = firstSentence(sanitizeProse(candidate.what_surfaced, "discovery"));
  const why_now = firstSentence(sanitizeProse(candidate.why_now, "discovery"));
  if (!what_surfaced || !why_now) return null;

  const trail = candidate.trail
    .map((entry) => ({
      platform: entry.platform.trim().toLowerCase(),
      date: entry.date.trim(),
      detail: sanitizeProse(entry.detail),
    }))
    .filter(
      (entry) =>
        connectedPlatforms.has(entry.platform) &&
        DATE.test(entry.date) &&
        !Number.isNaN(Date.parse(entry.date)) &&
        entry.detail.length > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (trail.length === 0) return null;

  return {
    type: candidate.type as DiscoveryType,
    pillar: normalizePillar(candidate.pillar),
    time_context,
    headline,
    what_surfaced,
    why_now,
    sources: [...new Set(trail.map((entry) => entry.platform))],
    trail,
    confidence: candidate.confidence,
  };
}

/** More dated sources first, then confidence. */
export function discoveryStrength(card: Discovery): number {
  return card.trail.length * 2 + Math.max(0, Math.min(1, card.confidence || 0));
}

/** First and last trail dates as comparable yyyy-mm-dd strings; a bare year runs to its end. */
function trailWindow(card: Discovery): [start: string, end: string] {
  const first = card.trail[0].date;
  const last = card.trail[card.trail.length - 1].date;
  return [`${first}-00-00`.slice(0, 10), `${last}-99-99`.slice(0, 10)];
}

/**
 * Two cards say the same thing when they rest on the same dated source (a
 * shared platform and date in their trails), or sit on the same constellation
 * point over overlapping time.
 */
export function discoveriesOverlap(a: Discovery, b: Discovery): boolean {
  const cited = new Set(a.trail.map((entry) => `${entry.platform}@${entry.date}`));
  if (b.trail.some((entry) => cited.has(`${entry.platform}@${entry.date}`))) return true;
  if (a.pillar !== b.pillar) return false;
  const [aStart, aEnd] = trailWindow(a);
  const [bStart, bEnd] = trailWindow(b);
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * The merge rule (PHE-83, carried into PHE-103): of two overlapping cards the
 * weaker one is dropped. Stronger cards claim their ground first, so a weak
 * card that overlaps two others can't knock both out.
 */
export function dedupeDiscoveries(cards: readonly Discovery[]): Discovery[] {
  const kept: Discovery[] = [];
  const ranked = [...cards].sort((a, b) => discoveryStrength(b) - discoveryStrength(a));
  for (const card of ranked) {
    if (!kept.some((other) => discoveriesOverlap(card, other))) kept.push(card);
  }
  return kept;
}

/** Spec doc 3: one per constellation point first, in point order, then the strongest of the rest. */
export function selectSet(cards: readonly Discovery[]): Discovery[] {
  const ranked = [...cards].sort((a, b) => discoveryStrength(b) - discoveryStrength(a));
  const firsts = PILLAR_ORDER.map((pillar) => ranked.find((card) => card.pillar === pillar)).filter(
    (card): card is Discovery => card !== undefined,
  );
  const rest = ranked.filter((card) => !firsts.includes(card));
  return [...firsts, ...rest].slice(0, SET_SIZE);
}
