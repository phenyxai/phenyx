// PHE-103 / PHE-129 — discover tab data shape and the pure helpers its
// carousel needs. Dependency free so it runs under `node --test`.

export interface TrailEntry {
  platform: string;
  /** yyyy, yyyy-mm or yyyy-mm-dd. */
  date: string;
  /** What the source is, in a few words. Empty on cards from before titles. */
  title?: string;
  detail: string;
}

/** The public side of a card, for "behind this discovery". */
export interface PublicStory {
  label: string;
  title: string;
  detail: string;
}

/** One card, as `GET /discover` serves it (PHE-129: it points outward). */
export interface Discovery {
  id: string;
  type: string;
  pillar: string;
  headline: string;
  detail: string;
  reason: string;
  question: string;
  story: PublicStory | null;
  sources: string[];
  trail: TrailEntry[];
  saved: boolean;
}

/** The week's discoveries, as `GET /discover` serves them (PHE-129). */
export interface DiscoveryAllowance {
  /** The monday the week opened. */
  week: string;
  /** When the next week opens, an ISO instant (monday 9am local). */
  resets: string;
  /** The week's discoveries: seven on every plan (PHE-158). */
  limit: number;
  used: number;
  weekly_left: number;
  /** Bought discoveries still available. */
  purchased: number;
  /** How many can be added now. */
  available: number;
}

/** What each kind reads as on its card. */
const KIND_LABELS: Record<string, string> = {
  place: "a place",
  person: "a person",
  try: "something to try",
  history: "from your history",
  detail: "a detail",
  medium: "a medium",
  field: "a field",
};

/** A card's label, e.g. `try` → "something to try". */
export function kindLabel(type: string): string {
  return KIND_LABELS[type] ?? type;
}

/** "2016" + "2024-09" → "2016–24"; one year → "2016"; none → "". */
export function trailYears(trail: readonly TrailEntry[]): string {
  const years = trail.map((entry) => entry.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)).sort();
  if (!years.length) return "";
  const [first, last] = [years[0], years[years.length - 1]];
  return first === last ? first : `${first}–${last.slice(first.slice(0, 2) === last.slice(0, 2) ? 2 : 0)}`;
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

/** "1 discovery", "3 discoveries". */
export function discoveriesLabel(n: number): string {
  return `${n} ${n === 1 ? "discovery" : "discoveries"}`;
}

/** When the next week opens, in the person's own time: "mon oct 26 at 9am". */
export function refreshLabel(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "monday at 9am";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const minutes = parts.minute === "00" ? "" : `:${parts.minute}`;
  return `${parts.weekday} ${parts.month} ${parts.day} at ${parts.hour}${minutes}${parts.dayPeriod}`.toLowerCase();
}

/** A source line in "behind this discovery": "mar 2016 · pinterest · lamp-lit rooms board". */
export function trailLine(entry: TrailEntry): string {
  return [trailDate(entry.date), entry.platform, entry.title].filter(Boolean).join(" · ");
}
