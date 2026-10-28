import { sanitizeProse } from "../voice-standard/sanitize-prose";
import { isValidPillar } from "../observations/gating";
import { normalizePillar } from "../observations/signal-hash";

/**
 * PHE-103 / PHE-129 — the card rules for discover, as pure functions so they
 * run under `node --test` without Nest, Supabase or Claude.
 *
 * PHE-129 (Oct 20 demo, Oct 21 rebuild doc section 9): a discovery points
 * outward. It names a real place, person, thing to try, detail, medium or
 * field (or something from the person's own history worth returning to), says
 * what it is, and gives one personal reason grounded in a dated source on a
 * connected platform. PHE-158: a fresh set of seven arrives every week, on
 * every plan, opening monday at 9am in the person's own time ({@link discoveryWeek}).
 *
 * Order in the service: {@link validateDiscovery} each candidate (limits,
 * trims, dated trail), {@link dedupeDiscoveries} the survivors (PHE-83 carry
 * over), then {@link selectSet} the seven that are kept, at least five kinds among them.
 */

/**
 * Each discovery has exactly one kind; the card shows it as "a place", "a
 * person", "something to try", "from your history", "a detail", "a medium"
 * or "a field".
 */
export const DISCOVERY_TYPES = ["place", "person", "try", "history", "detail", "medium", "field"] as const;

export type DiscoveryType = (typeof DISCOVERY_TYPES)[number];

/** The headline holds two lines on the card: the prompt asks for about 55 characters, past this it is regenerated. */
export const HEADLINE_MAX = 60;
/** The question polaris opens with, when the person asks about the card. */
export const QUESTION_MAX = 120;
export const SET_SIZE = 7;

export interface TrailEntry {
  platform: string;
  /** yyyy, yyyy-mm or yyyy-mm-dd, copied from the grounding. */
  date: string;
  /** What the source is, in a few words, e.g. "lamp-lit rooms board". */
  title: string;
  /** One line on what is there. */
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
      title: sanitizeProse(entry.title ?? "").replace(/[.!?]+$/, ""),
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
 * shared platform, date and source title in their trails) or point at the
 * same thing (the same public name). Several outward picks may share a point,
 * a platform and a date, since a place and a person can grow from the same
 * years, and a platform's only date is often the day it was connected (PHE-158).
 */
export function discoveriesOverlap(a: Discovery, b: Discovery): boolean {
  const source = (entry: TrailEntry) => `${entry.platform}@${entry.date}@${entry.title.toLowerCase()}`;
  const cited = new Set(a.trail.map(source));
  if (b.trail.some((entry) => cited.has(source(entry)))) return true;
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

/**
 * Rebuild doc 9: a set of seven uses at least five kinds. The strongest card
 * of each kind goes first, then the strongest of the rest, so a set holds as
 * many kinds as the candidates allow.
 */
export function selectSet(cards: readonly Discovery[]): Discovery[] {
  const ranked = [...cards].sort((a, b) => discoveryStrength(b) - discoveryStrength(a));
  const firsts = DISCOVERY_TYPES.map((type) => ranked.find((card) => card.type === type)).filter(
    (card): card is Discovery => card !== undefined,
  );
  const rest = ranked.filter((card) => !firsts.includes(card));
  return [...firsts, ...rest].slice(0, SET_SIZE);
}

/** A time zone the runtime knows, else UTC. */
export function safeTimeZone(timeZone: unknown): string {
  if (typeof timeZone !== "string" || !timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The wall clock in `timeZone` at `instant`, as if it were UTC (ms). */
function wallClock(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

/** The instant the wall clock in `timeZone` reads `wall` (ms, as UTC). */
function fromWallClock(wall: number, timeZone: string): number {
  let instant = wall - (wallClock(wall, timeZone) - wall);
  instant -= wallClock(instant, timeZone) - wall;
  return instant;
}

const WEEK_OPENS_HOUR = 9;
const DAY_MS = 86_400_000;

/**
 * The discovery week: it opens every monday at 9am in the person's time zone.
 * `week` is that monday's date (the discovery_usage key), `opened` and
 * `resets` the instants it opened and opens next.
 */
// ponytail: the week follows the time zone the browser sends; store it on the profile if people start gaming it.
export function discoveryWeek(now: Date, timeZone: string): { week: string; opened: string; resets: string } {
  const wall = wallClock(now.getTime(), timeZone);
  const day = new Date(wall);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  let monday = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - sinceMonday, WEEK_OPENS_HOUR);
  if (wall < monday) monday -= 7 * DAY_MS;
  return {
    week: new Date(monday).toISOString().slice(0, 10),
    opened: new Date(fromWallClock(monday, timeZone)).toISOString(),
    resets: new Date(fromWallClock(monday + 7 * DAY_MS, timeZone)).toISOString(),
  };
}
