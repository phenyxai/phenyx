// PHE-124 / PHE-129 — the insights reading (spec doc 5, Oct 20 demo, Oct 21
// rebuild doc 10 and prompt 11.8): your story so far (one line and five
// milestones on real moments), what is becoming clearer, what still needs
// shape, what matters to you, and how you find your way. Every line, value
// and pattern names the moments it rests on, so the page links back to them.
//
// Generated once per constellation version by SynthesisService.generateInsights
// and stored on constellation_state.insights with the version it was written
// for, so a stale reading is easy to spot and regenerate. The reading also
// carries a hidden arc (the story shape the moments most resemble), stored for
// tone only and stripped before the reading is served. Pure helpers only here,
// so they run under plain `node --test`.

import { PILLAR_ORDER, type Pillar } from "../observations/gating";

const LIST_LIMIT = 4;
const MILESTONES_MIN = 2;
const MILESTONES_MAX = 5;
/** Milestones this recent read as a month and year ("mar 2026"); older ones as a year. */
const RECENT_MONTHS = 18;

/** The seven story shapes (PHENYX operating system doc). Never shown. */
export const STORY_ARCS = [
  "quest",
  "voyage_and_return",
  "comedy",
  "rags_to_riches",
  "overcoming_the_monster",
  "tragedy",
  "rebirth",
] as const;
export type StoryArc = (typeof STORY_ARCS)[number];

export interface InsightsLine {
  line: string;
  support: string;
  moment_ids: string[];
}

export interface InsightsItem {
  title: string;
  body: string;
  /** At least one: the moments it rests on. */
  moment_ids: string[];
}

/** One stop on "your story so far": a real moment, a few words on what it marks, and when and where it sits. */
export interface InsightsMilestone {
  moment_id: string;
  label: string;
  /** "2008" or "mar 2026", from the moment's own date. */
  date: string;
  /** The point the moment sits on, from the moment itself. */
  pillar: Pillar;
}

export interface InsightsStory {
  line: string;
  /** Date order. */
  milestones: InsightsMilestone[];
}

export interface InsightsReading {
  version: number;
  generated_at: string;
  story: InsightsStory | null;
  becoming_clearer: InsightsLine | null;
  needs_shape: InsightsLine | null;
  matters: InsightsItem[];
  /** "how you find your way": how they decide, work and return to things. */
  patterns: InsightsItem[];
  /** Stored for tone only; never served. */
  arc?: StoryArc | null;
}

/** What the reading may cite: each moment's date (yyyy-mm-dd or yyyy-mm) and point. */
export type MomentIndex = ReadonlyMap<string, { date: string | null; pillar: Pillar }>;

const IDS_SCHEMA = { type: "array", items: { type: "string" } };

const LINE_SCHEMA = {
  type: "object",
  properties: { line: { type: "string" }, support: { type: "string" }, moment_ids: IDS_SCHEMA },
  required: ["line", "support", "moment_ids"],
  additionalProperties: false,
};

const ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { title: { type: "string" }, body: { type: "string" }, moment_ids: IDS_SCHEMA },
    required: ["title", "body", "moment_ids"],
    additionalProperties: false,
  },
};

export const EMIT_INSIGHTS_TOOL = {
  name: "emit_insights",
  description:
    "Emit the insights reading: what is becoming clearer, what still needs shape, what matters to the person, how they find their way, their story so far, and the hidden arc.",
  strict: true as const,
  input_schema: {
    type: "object",
    properties: {
      becoming_clearer: LINE_SCHEMA,
      needs_shape: LINE_SCHEMA,
      matters: ITEMS_SCHEMA,
      patterns: ITEMS_SCHEMA,
      story: {
        type: "object",
        properties: {
          line: { type: "string" },
          milestones: {
            type: "array",
            items: {
              type: "object",
              properties: { moment_id: { type: "string" }, label: { type: "string" } },
              required: ["moment_id", "label"],
              additionalProperties: false,
            },
          },
        },
        required: ["line", "milestones"],
        additionalProperties: false,
      },
      arc: { type: "string", enum: [...STORY_ARCS] },
    },
    required: ["becoming_clearer", "needs_shape", "matters", "patterns", "story", "arc"],
    additionalProperties: false,
  },
};

export const INSIGHTS_INSTRUCTIONS = `you write the insights reading for a person in PHENYX: a step back from single moments to what their whole history adds up to. ground it in the point stories and the dated moments in the message.

return:
- becoming_clearer: line is one sentence on the strongest direction across their history. support is one short sentence on where that shows, for example two parts of their life drawing closer. moment_ids are the moments it rests on.
- needs_shape: line is one sentence on what is still unresolved. support is one short sentence that holds it open without settling it. moment_ids as above.
- matters: three or four values that keep recurring. each has a title of two to five words, a body of one or two sentences pointing to where it shows up, and its moment_ids.
- patterns: three or four patterns in how they decide, work and return to things, for "how you find your way". each has a title of two to five words, a body of one or two sentences, and its moment_ids.
- story: line is one plain sentence on how their life has moved, from what came first to what they are making room for now, for example "film began as an early interest. now you are making room for it alongside product design." never name a story arc or type. milestones are exactly five, in date order, each a moment_id and a label of three to eight words on what that moment marks ("early interest in film").
- arc: which of the seven story shapes their moments most resemble so far: quest, voyage_and_return, comedy, rags_to_riches, overcoming_the_monster, tragedy or rebirth. read it from the moments, never from the person's job or age. it is stored for tone only and must never appear in any line you write, including the story line.

rules:
- every value and pattern names at least one moment id from the message, and only ids from the message.
- write to the person as "you" and reflect what the data suggests ("you keep returning to…", "this suggests…"). never declare who they are.
- every claim traces to the moments and platforms given. never invent a place, a year or an event the data does not support. when a value or milestone is thin, say less, never more.
- plain text only: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language.

answer only by calling emit_insights.`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** The ids that name a moment the reading was given, once each. */
function readIds(value: unknown, moments: MomentIndex): string[] {
  return [...new Set((Array.isArray(value) ? value : []).map(text).filter((id) => moments.has(id)))];
}

function readLine(value: unknown, clean: (s: string) => string, moments: MomentIndex): InsightsLine | null {
  const rec = record(value);
  const line = clean(text(rec.line));
  return line ? { line, support: clean(text(rec.support)), moment_ids: readIds(rec.moment_ids, moments) } : null;
}

/** Values and patterns: each must rest on at least one real moment, or it drops out. */
function readItems(value: unknown, clean: (s: string) => string, moments: MomentIndex): InsightsItem[] {
  return (Array.isArray(value) ? value : [])
    .map((m) => ({
      title: clean(text(record(m).title)),
      body: clean(text(record(m).body)),
      moment_ids: readIds(record(m).moment_ids, moments),
    }))
    .filter((m) => m.title && m.body && m.moment_ids.length > 0)
    .slice(0, LIST_LIMIT);
}

/** A moment's date as a milestone reads it: "mar 2026" within the last 18 months, else "2008". */
export function milestoneDate(date: string, now: Date): string | null {
  const m = date.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : null;
  if (month === null || month < 1 || month > 12) return String(year);
  const ago = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  return ago <= RECENT_MONTHS ? `${MONTHS[month - 1]} ${year}` : String(year);
}

function readStory(value: unknown, clean: (s: string) => string, moments: MomentIndex, now: Date): InsightsStory | null {
  const rec = record(value);
  const line = clean(text(rec.line));
  const seen = new Set<string>();
  const milestones = (Array.isArray(rec.milestones) ? rec.milestones : [])
    .flatMap((m) => {
      const item = record(m);
      const id = text(item.moment_id);
      const moment = moments.get(id);
      const label = clean(text(item.label)).replace(/[.!?]+$/, "");
      if (!moment?.date || !label || seen.has(id)) return [];
      const date = milestoneDate(moment.date, now);
      if (!date) return [];
      seen.add(id);
      return [{ moment_id: id, label, date, pillar: moment.pillar, sort: moment.date }];
    })
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, MILESTONES_MAX)
    .map(({ sort: _sort, ...m }) => m);
  return line && milestones.length >= MILESTONES_MIN ? { line, milestones } : null;
}

/**
 * Turn the model's tool input into the stored reading: every prose string goes
 * through `clean` (the voice sanitizer), ids that name no given moment drop
 * out (and a value or pattern left with none drops out), milestones take their
 * date and point from their moment and sit in date order, and the lists are
 * capped. A story with fewer than two milestones is left out.
 */
export function normalizeInsights(
  raw: unknown,
  clean: (s: string) => string,
  version: number,
  now: Date,
  moments: MomentIndex = new Map(),
): InsightsReading {
  const rec = record(raw);
  const arc = text(rec.arc) as StoryArc;
  return {
    version,
    generated_at: now.toISOString(),
    story: readStory(rec.story, clean, moments, now),
    becoming_clearer: readLine(rec.becoming_clearer, clean, moments),
    needs_shape: readLine(rec.needs_shape, clean, moments),
    matters: readItems(rec.matters, clean, moments),
    patterns: readItems(rec.patterns, clean, moments),
    arc: STORY_ARCS.includes(arc) ? arc : null,
  };
}

/** The reading as it is served: the arc stays behind. */
export function servedInsights(stored: unknown): InsightsReading | null {
  if (!stored || typeof stored !== "object") return null;
  const { arc: _arc, ...reading } = stored as InsightsReading;
  return reading;
}

/** The seven points in story order, so milestones can span them. */
export const POINTS_ORDER_LINE = PILLAR_ORDER.join(" → ");

/**
 * True when a constellation exists but its insights were not written for this
 * version, or were written before PHE-129's patterns and linked moments.
 */
export function insightsStale(stored: unknown, version: unknown): boolean {
  if (typeof version !== "number") return false;
  if (!stored || typeof stored !== "object") return true;
  return (stored as InsightsReading).version !== version || !("patterns" in stored);
}
