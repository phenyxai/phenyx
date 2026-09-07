// PHE-93 — Constellation text helpers.
//
// Everything here is a pure function of the normalized constellation shapes:
// the pillar label, the age line under the tab header, the synthesis line that
// heads a point's areas, and the one-line story each point shows in the
// overview. The module carries type-only imports so it loads under plain
// `node --experimental-strip-types --test` (the data layer's `@/` aliases do
// not); `lib/constellation.ts` re-exports it, which is where the app imports
// from.

import type { ConstellationData, Pillar, PillarDetail } from "./constellation";

/** Lowercase display label for a pillar (`self_creation` → `self creation`). */
export function pillarLabel(pillar: Pillar): string {
  return pillar.replace(/_/g, " ");
}

// Exactly four digits, so a fractional-second run in an ISO timestamp is never
// read as a year.
const FIRST_YEAR = /(?<!\d)\d{4}(?!\d)/;
const EVERY_YEAR = /(?<!\d)\d{4}(?!\d)/g;

function firstYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = FIRST_YEAR.exec(text);
  return match ? Number(match[0]) : null;
}

// ---------------------------------------------------------------------------
// Age line
// ---------------------------------------------------------------------------

export interface ConstellationAge {
  /** The calendar year the constellation starts in. */
  from: number;
  /** "12 years, 9 months": months omitted when zero, singular at one. */
  label: string;
}

/**
 * How much of a life the constellation covers. The start year is the first
 * four-digit year in `timeline.span`, else the year of `tenure.since`; months
 * are counted from january of that year to `now`. Null when neither source
 * carries a year, so the caller renders nothing.
 */
export function constellationAge(
  data: ConstellationData,
  now: Date = new Date(),
): ConstellationAge | null {
  let from: number | null = null;
  for (const entry of data.timeline.span) {
    from = firstYear(entry);
    if (from != null) break;
  }
  if (from == null) from = firstYear(data.tenure.since);
  if (from == null) return null;

  const months = Math.max(1, (now.getFullYear() - from) * 12 + now.getMonth() + 1);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return { from, label: parts.join(", ") };
}

// ---------------------------------------------------------------------------
// Synthesis line
// ---------------------------------------------------------------------------

const CORE_SIGNALS = "core signals";

export interface SynthesisLine {
  text: string;
  /** Free reading: the areas are named, what they amount to is held back. */
  locked: boolean;
}

function joinNames(names: string[]): string {
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What a point's areas amount to when read together. Composed from the areas
 * themselves so it can never drift from what sits underneath it. Needs at
 * least two named areas ("core signals" is the unnamed sentinel); the year
 * span comes from every four-digit year in the observations' `span`, falling
 * back to `surfaced_at`, and the count is every observation under the point.
 * On free the line only says that a full reading exists.
 */
export function synthesisLine(detail: PillarDetail, isPro: boolean): SynthesisLine | null {
  const named = detail.clusters
    .map((cluster) => cluster.label.trim())
    .filter((label) => label && label !== CORE_SIGNALS);
  if (named.length < 2) return null;

  if (!isPro) {
    return {
      text: `these ${named.length} areas are read together with full ✦`,
      locked: true,
    };
  }

  const years: number[] = [];
  let count = 0;
  for (const cluster of detail.clusters) {
    count += cluster.observation_count || cluster.observations.length;
    for (const observation of cluster.observations) {
      const source = String(observation.span || observation.surfaced_at || "");
      for (const year of source.match(EVERY_YEAR) ?? []) years.push(Number(year));
    }
  }

  let text = `${joinNames(named)} all sit under ${pillarLabel(detail.pillar)}`;
  const span = years.length ? Math.max(...years) - Math.min(...years) : 0;
  text += span > 0
    ? `, and they hold together across ${span} ${span === 1 ? "year" : "years"} of your life`
    : ", and they hold together";
  text += `, on ${count} ${count === 1 ? "thing" : "things"} you did rather than anything you said about yourself.`;
  return { text, locked: false };
}

// ---------------------------------------------------------------------------
// Story rows
// ---------------------------------------------------------------------------

/** What each point is for, shown while it has nothing of its own to say. */
export const PILLAR_LENS: Record<Pillar, string> = {
  origin: "what has been with you the longest",
  emergence: "what began to appear",
  self_creation: "what you chose to make your own",
  convergence: "what has started to connect",
  becoming: "what is taking shape now",
  recognition: "what others have started to see",
  transcendence: "the question you have not answered yet",
};

/** Tags stripped, whitespace collapsed, cut after the first `.`, `?` or `!`. */
export function firstSentence(text: string | null | undefined): string {
  if (!text) return "";
  const plain = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const match = /^[^.?!]*[.?!]/.exec(plain);
  return (match ? match[0] : plain).trim();
}

/**
 * The one line a point shows in the overview: the first sentence of its lead
 * observation, else of the lead area's preview, else the point's lens.
 */
export function storyLine(detail: PillarDetail): string {
  const lead = detail.clusters[0];
  return (
    firstSentence(lead?.observations[0]?.body) ||
    firstSentence(lead?.preview) ||
    PILLAR_LENS[detail.pillar]
  );
}

/** Observations under a point that are still marked new. */
export function newObservationCount(detail: PillarDetail): number {
  let count = 0;
  for (const cluster of detail.clusters) {
    for (const observation of cluster.observations) if (observation.is_new) count += 1;
  }
  return count;
}
