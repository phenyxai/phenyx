// PHE-103 — discover tab data shape and the two pure helpers its carousel
// needs. Dependency free so it runs under `node --test`.

export interface TrailEntry {
  platform: string;
  /** yyyy, yyyy-mm or yyyy-mm-dd. */
  date: string;
  detail: string;
}

/** One card, as `GET /discover` serves it. */
export interface Discovery {
  id: string;
  type: string;
  pillar: string;
  time_context: string;
  headline: string;
  what_surfaced: string;
  why_now: string;
  sources: string[];
  trail: TrailEntry[];
}

/**
 * Where card `i` sits relative to the main card in a looping deck of `count`:
 * 0 is the main card, -1 and 1 its neighbours, and the rest wrap the short way.
 */
export function loopOffset(i: number, index: number, count: number): number {
  const ahead = (((i - index) % count) + count) % count;
  return ahead > count / 2 ? ahead - count : ahead;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2016" → "2016", "2016-03" → "mar 2016", "2016-03-05" → "5 mar 2016". */
export function trailDate(date: string): string {
  const [year, month, day] = date.split("-");
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  if (!name) return year;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}
