import { sanitizeProse } from "../voice-standard/sanitize-prose";
import { PILLAR_ORDER, isValidPillar } from "../observations/gating";
import { normalizePillar } from "../observations/signal-hash";

/**
 * PHE-103 / PHE-129 — the card rules for discover, as pure functions so they
 * run under `node --test` without Nest, Supabase or Claude.
 *
 * PHE-129 (Oct 20 demo): a discovery points outward. It names a real place,
 * person, thing to try, detail or medium (or something from the person's own
 * history worth returning to), says what it is, and gives one personal reason
 * grounded in a dated source on a connected platform.
 *
 * Order in the service: {@link validateDiscovery} each candidate (limits,
 * trims, dated trail), {@link dedupeDiscoveries} the survivors (PHE-83 carry
 * over), then {@link selectSet} the seven that are shown.
 */

/**
 * Each discovery has exactly one kind; the card shows it as "a place", "a
 * person", "something to try", "from your history", "a detail" or "a medium".
 */
export const DISCOVERY_TYPES = ["place", "person", "try", "history", "detail", "medium"] as const;

export type DiscoveryType = (typeof DISCOVERY_TYPES)[number];

/** The prompt asks for about 55 characters; past this the card is regenerated. */
export const HEADLINE_MAX = 72;
/** The question polaris opens with, when the person asks about the card. */
export const QUESTION_MAX = 120;
export const SET_SIZE = 7;

export interface TrailEntry {
  platform: string;
  /** yyyy, yyyy-mm or yyyy-mm-dd, copied from the grounding. */
  date: string;
  detail: string;
}

/** The public side of a discovery, for "behind this discovery": who or what, and one line on it. */
export interface PublicStory {
  /** The name it goes by, e.g. "brian eno" or "jazz kissa". */
  label: string;
  /** A few words, e.g. "music for a place". */
  title: string;
  detail: string;
}

/** One card as Claude emits it through `emit_discoveries`. */
export interface DiscoveryCandidate {
  type: string;
  pillar: string;
  headline: string;
  detail: string;
  reason: string;
  question: string;
  story: PublicStory;
  trail: TrailEntry[];
  confidence: number;
}

/** A card that meets every limit: what is stored and shown. */
export interface Discovery {
  type: DiscoveryType;
  pillar: string;
  /** One idea, one sentence. */
  headline: string;
  /** What it is, in one or two sentences. */
  detail: string;
  /** The one personal reason, from the person's own dated sources. */
  reason: string;
  /** What "ask polaris" opens with. */
  question: string;
  /** Null for the person's own history, or when there is no public side. */
  story: PublicStory | null;
  /** The platforms behind the reason: the trail's, so every one has a dated source. */
  sources: string[];
  /** Earliest first. */
  trail: TrailEntry[];
  confidence: number;
}

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** Text up to the first sentence end. A decimal like "2.5" is not an end. */
export function firstSentence(text: string): string {
  return firstSentences(text, 1);
}

/** Text up to the `n`th sentence end. */
export function firstSentences(text: string, n: number): string {
  const match = text.match(new RegExp(`^(?:.*?[.!?](?=\\s|$)){1,${n}}`, "s"));
  return (match ? match[0] : text).trim();
}

/** Ends the line with `mark` unless it already ends a sentence. */
function closed(text: string, mark: "." | "?"): string {
  return /[.!?]$/.test(text) ? text : `${text}${mark}`;
}

/**
 * Check one candidate against the card limits. The detail is trimmed to two
 * sentences and the reason to one; anything that can't be trimmed honestly (a
 * long headline, a headline with two ideas, no question, no dated source on a
 * connected platform) returns null so the service can regenerate it. A public
 * story missing any part is dropped, and the person's own history never has one.
 */
export function validateDiscovery(
  candidate: DiscoveryCandidate,
  connectedPlatforms: ReadonlySet<string>,
): Discovery | null {
  if (!(DISCOVERY_TYPES as readonly string[]).includes(candidate.type)) return null;
  if (!isValidPillar(candidate.pillar)) return null;

  const line = sanitizeProse(candidate.headline).replace(/[.!]+$/, "");
  if (!line || line.length > HEADLINE_MAX || /[.!?]\s/.test(line)) return null;
  const headline = closed(line, ".");

  const detail = firstSentences(sanitizeProse(candidate.detail, "discovery"), 2);
  const reason = firstSentence(sanitizeProse(candidate.reason, "discovery"));
  const asked = sanitizeProse(candidate.question, "discovery");
  if (!detail || !reason || !asked || asked.length > QUESTION_MAX) return null;
  const question = closed(asked.replace(/[.!]+$/, ""), "?");

  const story = {
    label: sanitizeProse(candidate.story?.label ?? ""),
    title: sanitizeProse(candidate.story?.title ?? "").replace(/[.!?]+$/, ""),
    detail: firstSentence(sanitizeProse(candidate.story?.detail ?? "", "discovery")),
  };

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
    headline,
    detail,
    reason,
    question,
    story: candidate.type !== "history" && story.label && story.title && story.detail ? story : null,
    sources: [...new Set(trail.map((entry) => entry.platform))],
    trail,
    confidence: candidate.confidence,
  };
}

/** More dated sources first, then confidence. */
export function discoveryStrength(card: Discovery): number {
  return card.trail.length * 2 + Math.max(0, Math.min(1, card.confidence || 0));
}

/**
 * Two cards say the same thing when they rest on the same dated source (a
 * shared platform and date in their trails) or point at the same thing (the
 * same public name). Several outward picks may share a point and a stretch of
 * time, since a place and a person can grow from the same years.
 */
export function discoveriesOverlap(a: Discovery, b: Discovery): boolean {
  const cited = new Set(a.trail.map((entry) => `${entry.platform}@${entry.date}`));
  if (b.trail.some((entry) => cited.has(`${entry.platform}@${entry.date}`))) return true;
  return !!a.story && !!b.story && a.story.label.toLowerCase() === b.story.label.toLowerCase();
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
