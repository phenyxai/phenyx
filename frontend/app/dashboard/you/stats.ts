// PHE-95 / v244 — the "your constellation" stats on the you tab.
//
// Pure helpers over the constellation payload (`fetchConstellation`) and the
// connected-platform count from `/profile/overview`. Type-only import so this
// module stays runnable under `node --experimental-strip-types --test`.
//
// A sibling ticket adds an equivalent `constellationAge` to lib/constellation.ts;
// the two are deduped at merge.

import type { ConstellationData } from "@/lib/constellation";

export interface ConstellationAge {
  /** "12 years, 9 months" — singular forms, months omitted when zero. */
  label: string;
  /** First year the record covers. */
  from: number;
  years: number;
  months: number;
}

export interface YouStat {
  key: "age" | "moments" | "turning points" | "accounts";
  label: string;
  value: string;
  note: string | null;
}

const YEAR_RE = /\b(?:19|20)\d{2}\b/;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The year the record starts: the first 4-digit year in `timeline.span`, else
 * the year of `tenure.since`. Null when neither is known.
 */
export function constellationStartYear(
  data: Pick<ConstellationData, "timeline" | "tenure">,
): number | null {
  for (const entry of data.timeline?.span ?? []) {
    const match = YEAR_RE.exec(entry);
    if (match) return Number(match[0]);
  }
  if (data.tenure?.since) {
    const since = new Date(data.tenure.since);
    if (!Number.isNaN(since.getTime())) return since.getFullYear();
  }
  return null;
}

/**
 * Age of the constellation, counted in whole months from january of the start
 * year through the current month (inclusive, never below one). Mirrors the
 * prototype's `constellationAge()`.
 */
export function constellationAge(
  data: Pick<ConstellationData, "timeline" | "tenure">,
  now: Date = new Date(),
): ConstellationAge | null {
  const from = constellationStartYear(data);
  if (from == null) return null;
  const total = Math.max(
    1,
    (now.getFullYear() - from) * 12 + now.getMonth() + 1,
  );
  const years = Math.floor(total / 12);
  const months = total % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(plural(years, "year", "years"));
  if (months > 0) parts.push(plural(months, "month", "months"));
  return { label: parts.join(", "), from, years, months };
}

/**
 * Rows for the "your constellation" block, in prototype order: age, moments,
 * turning points, accounts. A row with no value is omitted.
 */
export function buildYouStats(
  data: ConstellationData | null,
  accounts: number,
  now: Date = new Date(),
): YouStat[] {
  const rows: YouStat[] = [];

  if (data) {
    const age = constellationAge(data, now);
    if (age) {
      rows.push({
        key: "age",
        label: "age",
        value: age.label,
        note: `from ${age.from} to now`,
      });
    }

    const moments = Object.values(data.pillars ?? {}).reduce(
      (n, pillar) => n + (pillar?.observation_count ?? 0),
      0,
    );
    if (moments > 0) {
      const span = age ? now.getFullYear() - age.from : 0;
      rows.push({
        key: "moments",
        label: "moments",
        value: String(moments),
        note: span >= 1 ? `across ${plural(span, "year", "years")}` : null,
      });
    }

    const turns = data.timeline?.breaks?.length ?? 0;
    if (turns > 0) {
      rows.push({
        key: "turning points",
        label: "turning points",
        value: String(turns),
        note: "where several accounts changed at once",
      });
    }
  }

  if (accounts > 0) {
    rows.push({
      key: "accounts",
      label: "accounts",
      value: String(accounts),
      note: "connected and contributing",
    });
  }

  return rows;
}

/**
 * Client-side twin of the backend's `formatJoined`, for the supabase-direct
 * fallback: "with PHENYX since <month year>".
 */
export function formatJoinedSince(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (now.getTime() - d.getTime() < weekMs) return "with PHENYX since this week";
  return `with PHENYX since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
