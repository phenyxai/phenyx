/**
 * PHE-71 — evidence traces and underneath readings.
 *
 * Pure helpers so gating, certainty, chart derivation, and the Daily-of-day
 * picker stay unit-testable without a live DB. The read gate in {@link ./gating}
 * is the only place chain fields are stripped for free users.
 */

export const SIGNAL_CLOSER: Record<string, string> = {
  frequency:
    "counted, not interpreted. the comparison is what makes it worth looking at.",
  timing: "the hour is measurable. what happens inside it stays yours.",
  duration: "this is how long, not why. the length is the only claim here.",
  sequence: "the order held every time it was checked. the reason for it is yours.",
  recurrence:
    "it came back on its own. the record holds the return, the reason is yours.",
  vocabulary: "these are your words, counted. the change is real, the meaning is open.",
  ratio: "both numbers are yours. the distance between them is the observation.",
  absence: "this is where the record stays empty, which is still something it shows.",
  convergence: "several places, independently. each one holds its own records.",
  divergence: "two descriptions of the same work. both stand as recorded.",
};

export type EvidenceChart =
  | { k: "part"; a: number; b: number; la?: string }
  | { k: "split"; a: number; b: number; la?: string; lb?: string }
  | { k: "clock"; hrs?: number[]; unit?: "hour" | "month"; label?: string }
  | { k: "run"; gap: [number, number]; length?: number; label?: string }
  | { k: "steps"; steps: Array<{ l: string; d: number }> }
  | { k: "series"; pre: number[]; post: number[]; la?: string; lb?: string }
  | { k: "swap"; before: string[]; after: string[] }
  | { k: "ring"; note?: string };

export interface EvidenceEntry {
  /** Dated when, lowercase, e.g. "14 mar 2016, 23:41". */
  t: string;
  /** Source platform. */
  s: string;
  /** What the entry is. */
  w: string;
  /** Role in the preview: earliest / most recent / the one that defines it. */
  l: string;
}

/**
 * Full chain. Locked free rows keep only `sig` + `recs` — never chart/entries/closer.
 */
export interface Evidence {
  sig: string;
  recs: number;
  sources?: string[];
  span?: string;
  certainty?: string;
  chart?: EvidenceChart | null;
  entries?: EvidenceEntry[];
  closer?: string;
}

export interface Underneath {
  id: string;
  headline: string;
  belief: { said: string; n: number; where: string };
  gap: string;
  mechanism: string;
  tell: string;
  basis: string;
  recs: number;
  sources: string[];
  hedge: string;
}

export interface SourceRecordPreview {
  platform: string;
  record_type: string;
  occurred_at: string | null;
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Prototype date form: `14 mar 2016, 23:41`. */
export function formatEntryWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

/**
 * How sure this is, in the same plain terms as the observation — never a score.
 * `n` is the instance count (`evidence_n`); span years and source count corroborate.
 */
export function certaintyCopy(
  n: number,
  span: string | null | undefined,
  sourceCount: number
): string {
  const yrs = String(span || "").match(/\d{4}/g) || [];
  const bits: string[] = [];
  if (n >= 100) bits.push(`measured across ${n.toLocaleString()} instances`);
  else if (n > 1) bits.push(`checked in all ${n} cases on record`);
  else bits.push("a single instance so far");
  const startYear = yrs[0];
  const endYear = yrs[1];
  if (startYear && endYear && +endYear - +startYear >= 3) {
    bits.push(`holding for ${+endYear - +startYear} years`);
  }
  if (sourceCount >= 3) bits.push(`showing up in ${sourceCount} places independently`);
  else if (sourceCount === 2) bits.push("corroborated in a second place");
  return bits.join(", ") + ".";
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const nums = value.map(asFiniteNumber).filter((n): n is number => n != null);
  return nums.length === value.length ? nums : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strs = value.filter((x): x is string => typeof x === "string");
  return strs.length === value.length ? strs : null;
}

function isChart(value: unknown): value is EvidenceChart {
  if (!value || typeof value !== "object") return false;
  const k = (value as { k?: unknown }).k;
  return typeof k === "string" && k.length > 0;
}

/**
 * Charts are drawn from the signal's own figures. Prefer an explicit `viz`
 * object (extractor-supplied); otherwise derive a simple form from signal type
 * + metric_value so the golden frequency fixture still paints.
 */
export function chartFromMetric(
  signalType: string | null | undefined,
  metric: Record<string, unknown> | null | undefined
): EvidenceChart | null {
  if (!metric) return null;
  if (isChart(metric.viz)) return metric.viz;
  if (isChart(metric)) return metric;

  const sig = (signalType || "").toLowerCase();
  const a = asFiniteNumber(metric.a);
  const b = asFiniteNumber(metric.b);
  const la = asString(metric.la);
  const lb = asString(metric.lb);

  if (sig === "timing") {
    const hour = asFiniteNumber(metric.value) ?? asFiniteNumber(metric.hour);
    const hrs = asNumberArray(metric.hrs);
    const unit: "hour" | "month" =
      metric.unit === "month" || metric.unit === "month_utc" ? "month" : "hour";
    if (hrs && hrs.length) {
      return { k: "clock", hrs, unit, label: asString(metric.label) };
    }
    if (hour != null) {
      const label =
        asString(metric.label) ||
        (unit === "month" ? MONTHS[hour] : `${String(hour).padStart(2, "0")}:00`);
      return { k: "clock", hrs: [hour], unit, label };
    }
  }

  if (sig === "ratio" || sig === "frequency" || sig === "divergence" || sig === "absence") {
    if (a != null && b != null) return { k: "split", a, b, la, lb };
    const value = asFiniteNumber(metric.value);
    const of = asFiniteNumber(metric.of) ?? asFiniteNumber(metric.total);
    if (value != null && of != null) {
      return { k: "part", a: value, b: of, la };
    }
  }

  if (sig === "duration") {
    const pre = asNumberArray(metric.pre);
    const post = asNumberArray(metric.post);
    if (pre && post) return { k: "series", pre, post, la, lb };
  }

  if (sig === "sequence" && Array.isArray(metric.steps)) {
    const steps = metric.steps
      .map((step) => {
        if (!step || typeof step !== "object") return null;
        const l = asString((step as { l?: unknown }).l);
        const d = asFiniteNumber((step as { d?: unknown }).d) ?? 0;
        return l ? { l, d } : null;
      })
      .filter((s): s is { l: string; d: number } => s != null);
    if (steps.length) return { k: "steps", steps };
  }

  if (sig === "vocabulary") {
    const before = asStringArray(metric.before);
    const after = asStringArray(metric.after);
    if (before && after) return { k: "swap", before, after };
  }

  if (sig === "recurrence") {
    const note = asString(metric.note) ?? asString(metric.label);
    if (note) return { k: "ring", note };
  }

  if (sig === "absence") {
    const gap = asNumberArray(metric.gap);
    if (gap && gap.length >= 2) {
      return {
        k: "run",
        gap: [gap[0], gap[1]],
        length: asFiniteNumber(metric.length) ?? undefined,
        label: asString(metric.label),
      };
    }
  }

  return null;
}

/**
 * Preview of `what happened, in order`: earliest, most recent, and the one
 * that could have contradicted the pattern. Never more than three — the rest
 * are counted and linked out to export.
 */
export function pickPreviewEntries(records: SourceRecordPreview[]): EvidenceEntry[] {
  if (!records.length) return [];
  const dated = [...records].sort((a, b) => {
    const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return ta - tb;
  });
  const earliest = dated[0];
  const latest = dated[dated.length - 1];
  const same =
    earliest.occurred_at === latest.occurred_at &&
    earliest.platform === latest.platform &&
    earliest.record_type === latest.record_type;

  const out: EvidenceEntry[] = [];
  const seen = new Set<string>();
  const push = (row: SourceRecordPreview | null | undefined, label: string) => {
    if (!row) return;
    const key = `${row.occurred_at ?? ""}|${row.platform}|${row.record_type}|${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      t: formatEntryWhen(row.occurred_at),
      s: row.platform,
      w: row.record_type ? `${row.record_type} on record` : "entry on record",
      l: label,
    });
  };

  push(earliest, "earliest");
  if (!same) push(latest, "most recent");
  if (dated.length >= 3) {
    const defining = dated[Math.floor(dated.length / 2)];
    const definingSame =
      (defining.occurred_at === earliest.occurred_at &&
        defining.platform === earliest.platform &&
        defining.record_type === earliest.record_type) ||
      (defining.occurred_at === latest.occurred_at &&
        defining.platform === latest.platform &&
        defining.record_type === latest.record_type);
    if (!definingSame) push(defining, "the one that defines it");
  }
  return out;
}

export function stubEvidence(sig: string, recs: number): Evidence {
  return { sig, recs };
}

export function buildEvidence(input: {
  sig: string;
  recs: number;
  n: number;
  sources: string[];
  span: string | null;
  metric?: Record<string, unknown> | null;
  entries: EvidenceEntry[];
}): Evidence {
  const sources = input.sources.filter(Boolean);
  return {
    sig: input.sig,
    recs: input.recs,
    sources,
    span: input.span || undefined,
    certainty: certaintyCopy(input.n, input.span, sources.length),
    chart: chartFromMetric(input.sig, input.metric ?? null),
    entries: input.entries,
    closer: SIGNAL_CLOSER[input.sig] || SIGNAL_CLOSER.frequency,
  };
}

/**
 * Strip chain fields when the free daily-trace budget is exhausted.
 * Locked JSON keeps `sig` + `recs` so the client can render the lock row
 * without a CSS flag and without the chain.
 */
export function redactEvidence(evidence: Evidence | null | undefined, unlocked: boolean): Evidence | null {
  if (!evidence) return null;
  if (unlocked) return evidence;
  return stubEvidence(evidence.sig, evidence.recs);
}

export function parseBelief(value: unknown): { said: string; n: number; where: string } {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    said: typeof obj.said === "string" ? obj.said : "",
    n: asFiniteNumber(obj.n) ?? 0,
    where: typeof obj.where === "string" ? obj.where : "",
  };
}

export function buildUnderneath(row: {
  id: string;
  headline: string;
  belief: unknown;
  gap: string;
  mechanism: string;
  tell: string;
  basis: string;
  hedge: string;
  recs?: number;
  sources?: string[] | null;
}): Underneath {
  return {
    id: row.id,
    headline: row.headline,
    belief: parseBelief(row.belief),
    gap: row.gap,
    mechanism: row.mechanism,
    tell: row.tell,
    basis: row.basis,
    recs: row.recs ?? 0,
    sources: (row.sources ?? []).filter(Boolean),
    hedge: row.hedge,
  };
}

/**
 * At most one underneath on Daily per local day. Stable: sorted observation ids,
 * then `dayNumber % length`. Callers pass only readings whose observation is in
 * the served feed.
 */
export function pickUnderneathOfDay(observationIds: string[], dayNumber: number): string | null {
  const unique = [...new Set(observationIds.filter(Boolean))].sort();
  if (!unique.length) return null;
  const idx = ((dayNumber % unique.length) + unique.length) % unique.length;
  return unique[idx];
}

/** UTC day number, matching the prototype's `Math.floor(Date.now()/86400000)`. */
export function utcDayNumber(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}
