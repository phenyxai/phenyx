// PHE-93 — Constellation text helpers.
//
// Everything here is a pure function of the normalized constellation shapes:
// the pillar label, the age line under the tab header, the synthesis line that
// heads a point's areas, and the one-line story each point shows in the
// overview. The module carries type-only imports so it loads under plain
// `node --experimental-strip-types --test` (the data layer's `@/` aliases do
// not); `lib/constellation.ts` re-exports it, which is where the app imports
// from.

import type { ClusterObservation, ConstellationData, Pillar, PillarDetail } from "./constellation";

/** Lowercase display label for a pillar (`self_creation` → `self-creation`, as the spec names it). */
export function pillarLabel(pillar: Pillar): string {
  return pillar.replace(/_/g, "-");
}

// Exactly four digits, so a fractional-second run in an ISO timestamp is never
// read as a year.
const EVERY_YEAR = /(?<!\d)\d{4}(?!\d)/g;

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
 * The one line a point shows: its generated story (PHE-122), else the first
 * sentence of its lead observation, else of the lead area's preview, else the
 * point's lens.
 */
export function storyLine(detail: PillarDetail): string {
  const lead = detail.clusters[0];
  return (
    detail.point?.story?.trim() ||
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

// ---------------------------------------------------------------------------
// Points and moments (PHE-122)
// ---------------------------------------------------------------------------

/** The part of a life each point covers (Oct 3 guidelines), shown beside its years. */
export const POINT_ERA: Record<Pillar, string> = {
  origin: "childhood",
  emergence: "teenage years",
  self_creation: "leaving home",
  convergence: "a turning point",
  becoming: "finding your voice",
  recognition: "today",
  transcendence: "what’s next",
};

/** "2013 – 2017 · teenage years · los angeles", leaving out what is unknown. */
export function pointMetaLine(detail: PillarDetail): string {
  return [detail.point?.years, POINT_ERA[detail.pillar], detail.point?.place]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * PHE-129: an opened point's era in the person's own terms, the season of life
 * and its place, "childhood · los angeles". Never years or an age.
 */
export function eraLine(detail: PillarDetail): string {
  return [POINT_ERA[detail.pillar], detail.point?.place]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Every moment under a point, oldest first; undated ones follow, newest surfaced first. */
export function pointMoments(detail: PillarDetail): ClusterObservation[] {
  const all = detail.clusters.flatMap((cluster) => cluster.observations);
  const dated = all.filter((m) => m.occurred_at).sort((a, b) => a.occurred_at!.localeCompare(b.occurred_at!));
  const undated = all.filter((m) => !m.occurred_at).sort((a, b) => b.surfaced_at.localeCompare(a.surfaced_at));
  return [...dated, ...undated];
}

/** What an opened point filters a moment by: its part of life, else its platform (older rows). */
export function momentTopic(moment: ClusterObservation): string {
  return moment.area?.trim() || moment.platform?.trim() || "";
}

/**
 * The threads the person follows: each followed moment's part of life, with
 * the earliest point (story order) it was followed on. A later moment that
 * shares the part of life reads "from your thread". Platforms never make a
 * thread; only a real area does.
 */
export function threadAreas(
  data: ConstellationData,
  order: readonly Pillar[],
  following: (id: string) => boolean,
): Map<string, number> {
  const threads = new Map<string, number>();
  order.forEach((pillar, index) => {
    for (const moment of pointMoments(data.pillars[pillar])) {
      const area = moment.area?.trim();
      if (area && following(moment.id) && !threads.has(area)) threads.set(area, index);
    }
  });
  return threads;
}

/** A moment's one line: its own title, else the first sentence of its body. */
export function momentTitle(moment: ClusterObservation): string {
  return moment.title?.trim() || firstSentence(moment.body).replace(/[.?!]+$/, "");
}

/** The year a moment happened; empty when it is undated. */
export function momentYear(moment: ClusterObservation): string {
  return /^\d{4}/.exec(moment.occurred_at ?? "")?.[0] ?? "";
}
