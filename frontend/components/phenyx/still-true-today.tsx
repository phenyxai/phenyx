"use client";

import { useEffect, useState } from "react";

import { localDayNumber } from "@/components/phenyx/daily-header";

// ============================================================================
// still true today: one constant from the record (PHE-70 / v67)
// ----------------------------------------------------------------------------
// Daily surfaces a single held constant, chosen by local day number so it holds
// all day and changes tomorrow. Profile `what has held` (PHE-75) must not show
// the same constant on the same day: use {@link profileHeldForDay}, which skips
// today's Daily index.
// ============================================================================

export interface HeldConstant {
  title: string;
  body: string;
}

/**
 * The record's held constants. Shared with Profile via {@link profileHeldForDay}
 * so the two surfaces never repeat the same line on the same day.
 */
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

function wrapIndex(dayNumber: number, length: number): number {
  return ((dayNumber % length) + length) % length;
}

/** Daily's one constant for this local day. */
export function stillTrueForDay(dayNumber: number): HeldConstant {
  return HELD_CONSTANTS[wrapIndex(dayNumber, HELD_CONSTANTS.length)];
}

/**
 * Profile `what has held` slice: four constants that skip today's Daily line.
 * PHE-75 should import this rather than indexing HELD_CONSTANTS from day 0.
 */
export function profileHeldForDay(dayNumber: number, count = 4): HeldConstant[] {
  const skip = wrapIndex(dayNumber, HELD_CONSTANTS.length);
  const out: HeldConstant[] = [];
  for (let i = 1; out.length < count && i < HELD_CONSTANTS.length; i++) {
    out.push(HELD_CONSTANTS[(skip + i) % HELD_CONSTANTS.length]);
  }
  return out;
}

export interface StillTrueTodayProps {
  now?: Date;
  accent?: string;
}

export function StillTrueToday({ now, accent = "var(--s, #5599FF)" }: StillTrueTodayProps) {
  const [mountedNow, setMountedNow] = useState<Date | null>(now ?? null);
  useEffect(() => {
    if (!now) setMountedNow(new Date());
  }, [now]);
  const when = now ?? mountedNow;
  if (!when) return null;
  const held = stillTrueForDay(localDayNumber(when));

  return (
    <aside
      style={{
        marginTop: 34,
        paddingTop: 22,
        borderTop: "1px solid rgba(255,253,253,0.06)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,253,253,0.6)",
          margin: "0 0 10px",
        }}
      >
        still true today
      </p>
      <p
        style={{
          fontSize: 14,
          color: accent,
          margin: "0 0 5px",
        }}
      >
        {held.title}
      </p>
      <p
        style={{
          fontSize: 14,
          fontWeight: 300,
          lineHeight: 1.65,
          color: "rgba(255,253,253,0.62)",
          margin: 0,
          maxWidth: "56ch",
        }}
      >
        {held.body}
      </p>
    </aside>
  );
}

export default StillTrueToday;
