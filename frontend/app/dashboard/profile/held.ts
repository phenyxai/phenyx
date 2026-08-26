/**
 * PHE-75 — Profile "what has held" must not repeat Daily's "still true today"
 * (PHE-70). This module owns the shared constants and selection rules for both
 * surfaces so their day-based rotations stay aligned.
 */
export interface HeldConstant {
  title: string;
  body: string;
}

const HELD_LIMIT = 4;

export const HELD_CONSTANTS: readonly HeldConstant[] = [
  {
    title: "the four anchors",
    body: "four artists have opened your sessions since before you were eighteen. 1,847 times, all of it private.",
  },
  {
    title: "the tascam 424",
    body: "still loading in every session, twelve years after you sold the machine.",
  },
  {
    title: "3200k",
    body: "your first saved image in 2019 sat at 3150k. tuesday's grade was 3200k.",
  },
  {
    title: "one to four in the morning",
    body: "eight in ten audio sessions start there, and what begins there gets finished.",
  },
  {
    title: "direct contact",
    body: "the three rotations you ranked highest were the three with the most patient contact.",
  },
  {
    title: "the long read",
    body: "you finish what you start reading at a rate that has not moved in eight years.",
  },
  {
    title: "the same hour",
    body: "your reading and your questions have started in the same part of the evening since 2016.",
  },
  {
    title: "the headline",
    body: "unchanged for three years, while the note describing the same job has been rewritten six times.",
  },
  {
    title: "what you follow",
    body: "the thing you followed first in 2015 is the thing you follow closest now.",
  },
  {
    title: "the private draft",
    body: "you write the long version first, every time, and post the short one.",
  },
  {
    title: "the eighteen month return",
    body: "you go back to your own work from 18 to 24 months ago more than to anything recent.",
  },
  {
    title: "the first thing you notice",
    body: "the same detail leads in your saves from 2017 to last month.",
  },
  {
    title: "the abandoned subject",
    body: "the thing you dropped in 2020 is the thing you have spent the most time on since 2024.",
  },
];

export function localDayNumber(now: Date = new Date()): number {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local.getTime() / 86_400_000);
}

function wrapIndex(dayNumber: number, length: number): number {
  return ((dayNumber % length) + length) % length;
}

export function todaysStillTrueIndex(length: number, dayNumber: number = localDayNumber()): number {
  if (length <= 0) return -1;
  return wrapIndex(dayNumber, length);
}

/** Daily's rotating constant after removing every card currently shown on Profile. */
export function pickStillTrueForDay(
  profileHeld: readonly HeldConstant[],
  dayNumber: number = localDayNumber(),
): HeldConstant {
  const profileBodies = new Set(profileHeld.map((held) => held.body));
  const eligible = HELD_CONSTANTS.filter(
    (held) => !profileBodies.has(held.body),
  );
  const pool = eligible.length > 0 ? eligible : HELD_CONSTANTS;
  return pool[wrapIndex(dayNumber, pool.length)];
}

/** Four constants that skip today's Daily still-true line. */
export function profileHeldForDay(dayNumber: number = localDayNumber(), count = HELD_LIMIT): HeldConstant[] {
  const skip = wrapIndex(dayNumber, HELD_CONSTANTS.length);
  const out: HeldConstant[] = [];
  for (let i = 1; out.length < count && i < HELD_CONSTANTS.length; i++) {
    out.push(HELD_CONSTANTS[(skip + i) % HELD_CONSTANTS.length]);
  }
  return out;
}

export function pickHeldConstants(
  items: HeldConstant[],
  dayNumber: number = localDayNumber(),
): HeldConstant[] {
  if (items.length === 0) return profileHeldForDay(dayNumber);
  if (items.length <= HELD_LIMIT) {
    const seen = new Set(items.map((h) => h.body));
    const out = [...items];
    for (const c of profileHeldForDay(dayNumber)) {
      if (out.length >= HELD_LIMIT) break;
      if (!seen.has(c.body)) out.push(c);
    }
    return out;
  }
  const skip = wrapIndex(dayNumber, items.length);
  return items.filter((_, i) => i !== skip).slice(0, HELD_LIMIT);
}
