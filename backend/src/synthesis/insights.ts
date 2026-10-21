// PHE-124 / PHE-129 — the insights reading (spec doc 5, Oct 20 demo): your
// story so far (one line and a few dated milestones), what is becoming
// clearer, what still needs shape, what matters to you, and how you find your
// way.
//
// Generated once per constellation version by SynthesisService.generateInsights
// and stored on constellation_state.insights with the version it was written
// for, so a stale reading is easy to spot and regenerate. Pure helpers only
// here, so they run under plain `node --test`.

import { PILLAR_ORDER, type Pillar } from "../observations/gating";

const LIST_LIMIT = 4;
const MILESTONES_MIN = 2;
const MILESTONES_MAX = 5;

export interface InsightsLine {
  line: string;
  support: string;
}

/** One stop on "your story so far": when, a few words, and the point it opens. */
export interface InsightsMilestone {
  /** "2008" or "mar 2026". */
  date: string;
  title: string;
  pillar: Pillar;
}

export interface InsightsStory {
  summary: string;
  /** Oldest first. */
  milestones: InsightsMilestone[];
}

export interface InsightsReading {
  version: number;
  generated_at: string;
  story: InsightsStory | null;
  becoming_clearer: InsightsLine | null;
  needs_shape: InsightsLine | null;
  matters: { title: string; body: string }[];
  /** How the person tends to decide and move, from their moments and their polaris use. */
  ways: { title: string; body: string }[];
}

const LINE_SCHEMA = {
  type: "object",
  properties: { line: { type: "string" }, support: { type: "string" } },
  required: ["line", "support"],
  additionalProperties: false,
};

const ITEMS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { title: { type: "string" }, body: { type: "string" } },
    required: ["title", "body"],
    additionalProperties: false,
  },
};

export const EMIT_INSIGHTS_TOOL = {
  name: "emit_insights",
  description:
    "Emit the insights reading: the story so far, what is becoming clearer, what still needs shape, what matters to the person, and how they find their way.",
  strict: true as const,
  input_schema: {
    type: "object",
    properties: {
      story: {
        type: "object",
        properties: {
          summary: { type: "string" },
          milestones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                title: { type: "string" },
                pillar: { type: "string", enum: [...PILLAR_ORDER] },
              },
              required: ["date", "title", "pillar"],
              additionalProperties: false,
            },
          },
        },
        required: ["summary", "milestones"],
        additionalProperties: false,
      },
      becoming_clearer: LINE_SCHEMA,
      needs_shape: LINE_SCHEMA,
      matters: ITEMS_SCHEMA,
      ways: ITEMS_SCHEMA,
    },
    required: ["story", "becoming_clearer", "needs_shape", "matters", "ways"],
    additionalProperties: false,
  },
};

export const INSIGHTS_INSTRUCTIONS = `you write the insights reading for a person in PHENYX: a step back from single moments to what their whole history adds up to. ground it in their constellation, the dated moments and their polaris use in the message.

return:
- story: summary is one sentence on the arc so far, from where it began to where it is now, for example "film began as an early interest. now you are making room for it alongside product design." milestones are three to five turning points, oldest first, each with date (a year like "2008", or a month and year like "mar 2026" for the recent ones), title (three to seven words, no full stop, such as "move to the bay for product design") and pillar (the constellation point the moment sits on).
- becoming_clearer: line is one sentence on the strongest direction across their history. support is one short sentence on where that shows, for example two parts of their life drawing closer.
- needs_shape: line is one sentence on what is still unresolved. support is one short sentence that holds it open without settling it.
- matters: three or four values that keep recurring. each has a title of two to five words and a body of one or two sentences that points to where it shows up.
- ways: up to four ways they tend to find their way: how they decide, when they return to something, what helps them choose. each has a title of three to seven words, such as "you revisit before you decide", and a body of one or two sentences grounded in their moments and in how their polaris questions have changed. leave it empty when the data shows too little.

rules:
- write to the person as "you" and reflect what the data suggests ("you keep returning to…", "this suggests…"). never declare who they are.
- every claim traces to the moments, platforms and polaris use given. never invent a place, a year or an event the data does not support; when the history is thin, say less, never more.
- plain text only: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language.

you must return the reading by calling the emit_insights tool.`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readLine(value: unknown, clean: (s: string) => string): InsightsLine | null {
  const rec = record(value);
  const line = clean(text(rec.line));
  return line ? { line, support: clean(text(rec.support)) } : null;
}

function readItems(value: unknown, clean: (s: string) => string): { title: string; body: string }[] {
  return (Array.isArray(value) ? value : [])
    .map((m) => ({ title: clean(text(record(m).title)), body: clean(text(record(m).body)) }))
    .filter((m) => m.title && m.body)
    .slice(0, LIST_LIMIT);
}

/** "2008" stays, "March 2026" / "mar 2026" → "mar 2026"; anything else is dropped. */
export function milestoneDate(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^\d{4}$/.test(v)) return v;
  const m = v.match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/);
  return m && MONTHS.includes(m[1]) ? `${m[1]} ${m[2]}` : null;
}

function readStory(value: unknown, clean: (s: string) => string): InsightsStory | null {
  const rec = record(value);
  const summary = clean(text(rec.summary));
  const milestones = (Array.isArray(rec.milestones) ? rec.milestones : [])
    .flatMap((m) => {
      const item = record(m);
      const date = milestoneDate(text(item.date));
      const title = clean(text(item.title)).replace(/[.!?]+$/, "");
      const pillar = text(item.pillar) as Pillar;
      return date && title && PILLAR_ORDER.includes(pillar) ? [{ date, title, pillar }] : [];
    })
    .slice(0, MILESTONES_MAX);
  return summary && milestones.length >= MILESTONES_MIN ? { summary, milestones } : null;
}

/**
 * Turn the model's tool input into the stored reading: every prose string goes
 * through `clean` (the voice sanitizer), empty entries drop out, milestone
 * dates read as a year or a month and year, and the lists are capped. A story
 * with fewer than two milestones is left out.
 */
export function normalizeInsights(
  raw: unknown,
  clean: (s: string) => string,
  version: number,
  now: Date
): InsightsReading {
  const rec = record(raw);
  return {
    version,
    generated_at: now.toISOString(),
    story: readStory(rec.story, clean),
    becoming_clearer: readLine(rec.becoming_clearer, clean),
    needs_shape: readLine(rec.needs_shape, clean),
    matters: readItems(rec.matters, clean),
    ways: readItems(rec.ways, clean),
  };
}

/**
 * How the person has used polaris, for "how you find your way": how many
 * conversations, since when, the modes they chose, and the most recent.
 */
export function polarisUsageLine(rows: { mode: string | null; created_at: string }[]): string {
  if (rows.length === 0) return "no polaris conversations yet";
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const counts = new Map<string, number>();
  for (const row of sorted) counts.set(row.mode ?? "clarify", (counts.get(row.mode ?? "clarify") ?? 0) + 1);
  const modes = [...counts].map(([mode, n]) => `${mode} ${n}`).join(", ");
  const last = sorted[sorted.length - 1];
  return `${rows.length} polaris conversations since ${sorted[0].created_at.slice(0, 7)} (${modes}); the most recent was ${last.mode ?? "clarify"} in ${last.created_at.slice(0, 7)}`;
}

/**
 * True when a constellation exists but its insights were not written for this
 * version, or were written before PHE-129's story and ways.
 */
export function insightsStale(stored: unknown, version: unknown): boolean {
  if (typeof version !== "number") return false;
  if (!stored || typeof stored !== "object") return true;
  return (stored as InsightsReading).version !== version || !("ways" in stored);
}
