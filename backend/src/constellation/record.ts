/**
 * PHE-74 — below-fold record DTOs.
 *
 * `your timeline` is drawn from connected-account history (source_records span).
 * Named eras are engine output only — this module never invents them.
 * `what moved` is parsed from stored then→now pairs when the engine wrote them;
 * otherwise the list is empty and the client shows an explicit empty state.
 */

export interface TimelineEra {
  start: number;
  width: number;
  name: string;
}

export interface TimelineBreak {
  at: number;
  label: string;
}

export interface TimelineCardEvidence {
  when: string;
  source: string;
  text: string;
}

export interface TimelineCard {
  tag: string;
  line: string;
  evidence: TimelineCardEvidence[];
}

export interface RecordTimeline {
  span: string[];
  note: string | null;
  eras: TimelineEra[];
  breaks: TimelineBreak[];
  return_line: string | null;
  card: TimelineCard | null;
  /** True when named eras are absent. Client must not invent them. */
  empty: boolean;
}

export interface MovedPair {
  label: string;
  then: string;
  now: string;
}

export interface YearlyRecapEntry {
  when: string;
  text: string;
}

const TIMELINE_NOTE =
  "you did not have to use PHENYX for this to be here. this is drawn from what your accounts already held.";

function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseEras(value: unknown): TimelineEra[] {
  if (!Array.isArray(value)) return [];
  const out: TimelineEra[] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 3) {
      const start = Number(item[0]);
      const width = Number(item[1]);
      const name = typeof item[2] === "string" ? item[2].trim() : "";
      if (Number.isFinite(start) && Number.isFinite(width) && name) {
        out.push({ start, width, name });
      }
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const start = Number(rec.start);
    const width = Number(rec.width);
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (Number.isFinite(start) && Number.isFinite(width) && name) {
      out.push({ start, width, name });
    }
  }
  return out;
}

function parseBreaks(value: unknown): TimelineBreak[] {
  if (!Array.isArray(value)) return [];
  const out: TimelineBreak[] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      const at = Number(item[0]);
      const label = typeof item[1] === "string" ? item[1].trim() : "";
      if (Number.isFinite(at) && label) out.push({ at, label });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const at = Number(rec.at);
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (Number.isFinite(at) && label) out.push({ at, label });
  }
  return out;
}

function parseCard(value: unknown): TimelineCard | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const tag = typeof rec.tag === "string" ? rec.tag.trim() : "";
  const line = typeof rec.line === "string" ? rec.line.trim() : "";
  if (!tag || !line) return null;
  const evidence: TimelineCardEvidence[] = [];
  if (Array.isArray(rec.evidence) || Array.isArray(rec.ev)) {
    for (const item of (rec.evidence ?? rec.ev) as unknown[]) {
      if (Array.isArray(item) && item.length >= 3) {
        const when = typeof item[0] === "string" ? item[0] : "";
        const source = typeof item[1] === "string" ? item[1] : "";
        const text = typeof item[2] === "string" ? item[2] : "";
        if (when && source && text) evidence.push({ when, source, text });
        continue;
      }
      const ev = asRecord(item);
      if (!ev) continue;
      const when = typeof ev.when === "string" ? ev.when : "";
      const source = typeof ev.source === "string" ? ev.source : "";
      const text = typeof ev.text === "string" ? ev.text : "";
      if (when && source && text) evidence.push({ when, source, text });
    }
  }
  return { tag, line, evidence };
}

function parseMoved(value: unknown): MovedPair[] {
  if (!Array.isArray(value)) return [];
  const out: MovedPair[] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 3) {
      const label = typeof item[0] === "string" ? item[0].trim() : "";
      const then = typeof item[1] === "string" ? item[1].trim() : "";
      const now = typeof item[2] === "string" ? item[2].trim() : "";
      if (label && then && now) out.push({ label, then, now });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const then = typeof rec.then === "string" ? rec.then.trim() : "";
    const now = typeof rec.now === "string" ? rec.now.trim() : "";
    if (label && then && now) out.push({ label, then, now });
  }
  return out;
}

function parseYearly(value: unknown): YearlyRecapEntry[] {
  if (!Array.isArray(value)) return [];
  const out: YearlyRecapEntry[] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2) {
      const when = typeof item[0] === "string" ? item[0].trim() : "";
      const text =
        typeof item[item.length - 1] === "string"
          ? String(item[item.length - 1]).trim()
          : "";
      if (when && text) out.push({ when, text });
      continue;
    }
    const rec = asRecord(item);
    if (!rec) continue;
    const when = typeof rec.when === "string" ? rec.when.trim() : "";
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (when && text) out.push({ when, text });
  }
  return out;
}

/**
 * Reduced timeline from the earliest/latest retained account timestamps.
 * Named eras / turning points only appear when `engineRecord` already has them.
 */
export function buildRecordTimeline(
  earliest: string | null,
  latest: string | null,
  engineRecord: unknown
): RecordTimeline {
  const rec = asRecord(engineRecord);
  const nested = rec ? asRecord(rec.timeline) ?? rec : null;
  const eras = parseEras(nested?.eras);
  const breaks = parseBreaks(nested?.breaks);
  const card = parseCard(nested?.card);
  const returnLine =
    typeof nested?.return_line === "string"
      ? nested.return_line.trim()
      : typeof nested?.ret === "string"
        ? nested.ret.trim()
        : "";

  const engineSpan = Array.isArray(nested?.span)
    ? nested.span.filter((y): y is string => typeof y === "string" && /^\d{4}$/.test(y))
    : [];

  const a = yearOf(earliest);
  const b = yearOf(latest);
  const span =
    engineSpan.length >= 2
      ? engineSpan
      : a && b
        ? a === b
          ? [String(a)]
          : [String(a), String(b)]
        : [];

  const empty = eras.length === 0;
  const note =
    typeof nested?.note === "string" && nested.note.trim()
      ? nested.note.trim()
      : span.length
        ? TIMELINE_NOTE
        : null;

  return {
    span,
    note,
    eras,
    breaks,
    return_line: returnLine || null,
    card,
    empty,
  };
}

export function buildMoved(engineRecord: unknown): MovedPair[] {
  const rec = asRecord(engineRecord);
  if (!rec) return [];
  return parseMoved(rec.moved ?? asRecord(rec.record)?.moved);
}

export function buildYearlyRecap(
  eligible: boolean,
  engineRecord: unknown
): YearlyRecapEntry[] | null {
  if (!eligible) return null;
  const rec = asRecord(engineRecord);
  if (!rec) return [];
  return parseYearly(rec.yearly ?? rec.development ?? rec.yearly_recap);
}
