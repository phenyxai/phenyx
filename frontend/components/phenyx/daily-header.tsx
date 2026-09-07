"use client";

import { useEffect, useState, type ReactNode } from "react";

import { DAILY_FOCUS_PILLARS } from "./daily-focus";

// ============================================================================
// DailyHeader: date + the mantra of the day (PHE-70 / v67, PHE-92 / v244)
// ----------------------------------------------------------------------------
// Renders, in order:
//   1. today's local date as `weekday / month day, year` (lowercase, no comma
//      after the weekday);
//   2. the label `mantra of the day`;
//   3. one daily line from the generated set, rotated by local day number
//      (deliberately not a statistic);
//   4. the attribution `drawn from <pillar> in your constellation`. There are
//      seven points in the constellation, so the day's line belongs to a point
//      rather than floating free of everything else on the screen. Naming it
//      is the difference between a line chosen for this person and one that
//      looks picked out of a hat;
//   5. an optional first-visit signpost slot (PHE-33). The v67 Daily surface
//      does not pass a signpost; the slot stays so the seam remains clean.
//
// The PHE-26 "✦ ask polaris anything" token chip is gone. Polaris tokens live
// on the Polaris tab (PHE-73).
// ============================================================================

/** Generated daily lines. Rotated by local day number; never a count. */
export const DAILY_LINES: readonly string[] = [
  "the hours nobody sees are still hours you kept.",
  "a thing can be finished and still be yours alone.",
  "you learned the light before you had a word for it.",
  "what returns to you is not an accident.",
  "the work waits better than you think it does.",
  "no one else was going to notice this for you.",
  "the room you keep describing is asking to be built.",
  "you are allowed to like it before anyone else does.",
  "the version you keep is still the work.",
  "taste is a decision you have already made a thousand times.",
  "the quiet part has been carrying the loud part for years.",
  "you can let something go before it is perfect.",
  "the thing you do without deciding to is the signature.",
  "a small audience is still an audience.",
  "you have already done the hard part more than once.",
  "nothing you make has to explain itself first.",
  "the pull toward the same subject is information.",
  "you do not have to be finished to be ready.",
  "what you protect tells you what it is worth.",
  "the long way around was still the way.",
  "you are further in than it feels from inside it.",
];

/** Local calendar day as days-since-epoch, stable for the whole local day. */
export function localDayNumber(now: Date = new Date()): number {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local.getTime() / 86_400_000);
}

/** `wednesday / august 12, 2026`: weekday / month day, year, lowercase. */
export function formatDailyDate(now: Date = new Date()): string {
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const month = now.toLocaleDateString("en-US", { month: "long" }).toLowerCase();
  return `${weekday} / ${month} ${now.getDate()}, ${now.getFullYear()}`;
}

export function dailyLineForDay(dayNumber: number): string {
  return DAILY_LINES[dailyLineIndex(dayNumber)];
}

function dailyLineIndex(dayNumber: number): number {
  return ((dayNumber % DAILY_LINES.length) + DAILY_LINES.length) % DAILY_LINES.length;
}

/**
 * The constellation point the day's line is drawn from: the line index maps
 * onto the seven pillars, lowercase with its hyphen (`self-creation`).
 */
export function mantraPillarForDay(dayNumber: number): string {
  return DAILY_FOCUS_PILLARS[dailyLineIndex(dayNumber) % DAILY_FOCUS_PILLARS.length];
}

export interface DailyHeaderProps {
  /** Optional override for tests; defaults to local now. */
  now?: Date;
  /**
   * First-visit signpost node (PHE-33). Rendered as-is when provided.
   * v67 Daily leaves this empty.
   */
  signpost?: ReactNode;
}

export function DailyHeader({ now, signpost }: DailyHeaderProps) {
  const [mountedNow, setMountedNow] = useState<Date | null>(now ?? null);
  useEffect(() => {
    if (!now) setMountedNow(new Date());
  }, [now]);

  const when = now ?? mountedNow;
  const dateLine = when ? formatDailyDate(when) : "\u00a0";
  const dayNumber = when ? localDayNumber(when) : null;
  const line = dayNumber === null ? "\u00a0" : dailyLineForDay(dayNumber);
  const pillar = dayNumber === null ? "" : mantraPillarForDay(dayNumber);

  return (
    <header>
      <p
        style={{
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: "0.04em",
          lineHeight: 1,
          color: "rgba(255,253,253,0.5)",
          margin: 0,
          marginBottom: 6,
        }}
      >
        {dateLine}
      </p>
      <p
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(var(--s-rgb, 85, 153, 255), 0.72)",
          margin: "18px 0 8px",
        }}
      >
        mantra of the day
      </p>
      <p
        style={{
          fontSize: "clamp(18px, 2vw, 23px)",
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: "0.01em",
          color: "rgba(255,253,253,0.92)",
          margin: "16px 0 28px",
          maxWidth: 620,
        }}
      >
        {line}
      </p>
      <p
        style={{
          fontSize: 12.5,
          letterSpacing: "0.01em",
          color: "rgba(255,253,253,0.44)",
          margin: "9px 0 30px",
        }}
      >
        {pillar ? `drawn from ${pillar} in your constellation` : "\u00a0"}
      </p>
      {signpost}
    </header>
  );
}

export default DailyHeader;
