"use client";

import { useEffect, useState, type ReactNode } from "react";

// ============================================================================
// DailyHeader: date + one steadying line (PHE-70 / v67)
// ----------------------------------------------------------------------------
// Renders, in order:
//   1. today's local date as `weekday / month day, year` (lowercase, no comma
//      after the weekday);
//   2. one daily line from the generated set, rotated by local day number
//      (deliberately not a statistic);
//   3. an optional first-visit signpost slot (PHE-33). The v67 Daily surface
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
  return DAILY_LINES[((dayNumber % DAILY_LINES.length) + DAILY_LINES.length) % DAILY_LINES.length];
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
  const line = when ? dailyLineForDay(localDayNumber(when)) : "\u00a0";

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
      {signpost}
    </header>
  );
}

export default DailyHeader;
