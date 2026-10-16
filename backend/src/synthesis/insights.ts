// PHE-124 — the insights reading (spec doc 5): what is becoming clearer, what
// still needs shape, what matters to you, and the three eras of the timeline.
//
// Generated once per constellation version by SynthesisService.generateInsights
// and stored on constellation_state.insights with the version it was written
// for, so a stale reading is easy to spot and regenerate. Pure helpers only
// here, so they run under plain `node --test`.

import { normalizeDateSpan } from "../voice-standard/sanitize-prose";

/** The timeline's three eras, always in this order (spec doc 5). */
export const ERA_TITLES = [
  "childhood and teenage years",
  "leaving home to a turning point",
  "finding your voice",
] as const;

const MATTERS_LIMIT = 4;

export interface InsightsLine {
  line: string;
  support: string;
}

export interface InsightsEra {
  title: (typeof ERA_TITLES)[number];
  years: string;
  /** Spelled-out place, or null when the data does not show one. */
  place: string | null;
  line: string;
}

export interface InsightsReading {
  version: number;
  generated_at: string;
  becoming_clearer: InsightsLine | null;
  needs_shape: InsightsLine | null;
  matters: { title: string; body: string }[];
  eras: InsightsEra[];
}

const LINE_SCHEMA = {
  type: "object",
  properties: { line: { type: "string" }, support: { type: "string" } },
  required: ["line", "support"],
  additionalProperties: false,
};

export const EMIT_INSIGHTS_TOOL = {
  name: "emit_insights",
  description:
    "Emit the insights reading: what is becoming clearer, what still needs shape, what matters to the person, and the three eras of their timeline.",
  strict: true as const,
  input_schema: {
    type: "object",
    properties: {
      becoming_clearer: LINE_SCHEMA,
      needs_shape: LINE_SCHEMA,
      matters: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, body: { type: "string" } },
          required: ["title", "body"],
          additionalProperties: false,
        },
      },
      eras: {
        type: "array",
        items: {
          type: "object",
          properties: {
            years: { type: "string" },
            place: { type: "string" },
            line: { type: "string" },
          },
          required: ["years", "place", "line"],
          additionalProperties: false,
        },
      },
    },
    required: ["becoming_clearer", "needs_shape", "matters", "eras"],
    additionalProperties: false,
  },
};

export const INSIGHTS_INSTRUCTIONS = `you write the insights reading for a person in PHENYX: a step back from single moments to what their whole history adds up to. ground it in their constellation and in the dated moments in the message.

return:
- becoming_clearer: line is one sentence on the strongest direction across their history. support is one short sentence on where that shows, for example two parts of their life drawing closer.
- needs_shape: line is one sentence on what is still unresolved. support is one short sentence that holds it open without settling it.
- matters: three or four values that keep recurring. each has a title of two to five words and a body of one or two sentences that points to where it shows up.
- eras: exactly three, in this order: ${ERA_TITLES.join(", ")}. each has years (a span of full years like "2006 – 2017", and the last may end in "now"), place (a place spelled out in full, like "los angeles", or an empty string when the data does not show one), and line (one sentence on what that era held).

rules:
- write to the person as "you" and reflect what the data suggests ("you keep returning to…", "this suggests…"). never declare who they are.
- every claim traces to the moments and platforms given. never invent a place, a year or an event the data does not support; when an era is thin, say less, never more.
- plain text only: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language.

you must return the reading by calling the emit_insights tool.`;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLine(value: unknown, clean: (s: string) => string): InsightsLine | null {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const line = clean(text(rec.line));
  return line ? { line, support: clean(text(rec.support)) } : null;
}

/** "2006-2017" → "2006 – 2017", "2024-now" → "2024 – now". */
function normalizeYears(years: string): string {
  return normalizeDateSpan(years.toLowerCase()).replace(/(\d{4})\s*[-–—]\s*now\b/, "$1 – now");
}

/**
 * Turn the model's tool input into the stored reading: every prose string goes
 * through `clean` (the voice sanitizer), empty entries drop out, eras take
 * their fixed titles in order, and the lists are capped.
 */
export function normalizeInsights(
  raw: unknown,
  clean: (s: string) => string,
  version: number,
  now: Date
): InsightsReading {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const matters = (Array.isArray(rec.matters) ? rec.matters : [])
    .map((m) => {
      const item = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
      return { title: clean(text(item.title)), body: clean(text(item.body)) };
    })
    .filter((m) => m.title && m.body)
    .slice(0, MATTERS_LIMIT);

  const eras: InsightsEra[] = [];
  (Array.isArray(rec.eras) ? rec.eras : []).slice(0, ERA_TITLES.length).forEach((e, i) => {
    const item = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
    const line = clean(text(item.line));
    const years = normalizeYears(text(item.years));
    if (!line || !years) return;
    eras.push({ title: ERA_TITLES[i], years, place: clean(text(item.place)) || null, line });
  });

  return {
    version,
    generated_at: now.toISOString(),
    becoming_clearer: readLine(rec.becoming_clearer, clean),
    needs_shape: readLine(rec.needs_shape, clean),
    matters,
    eras,
  };
}

/** True when a constellation exists but its insights were not written for this version. */
export function insightsStale(stored: unknown, version: unknown): boolean {
  if (typeof version !== "number") return false;
  return !stored || typeof stored !== "object" || (stored as InsightsReading).version !== version;
}
