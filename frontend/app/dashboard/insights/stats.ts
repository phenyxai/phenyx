// PHE-124 / PHE-129 — the three stats under the insights header (spec doc 5,
// rebuild doc 10): connected platforms, years in view and here since, all
// computed from real data. A stat with nothing behind it is left out rather
// than shown as zero.
//
// Type-only import so this module stays runnable under `node --test`.

import type { ConstellationData } from "@/lib/constellation";

export interface InsightsStat {
  key: "platforms" | "years" | "since";
  value: string;
  label: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

/**
 * What the moments themselves show (rebuild doc 10): the platforms they draw
 * on, so "connected platforms" counts connections plus these and the two
 * always match, and the year of the earliest dated moment, for "years in view".
 */
export function momentFacts(data: ConstellationData | null): { platforms: string[]; firstYear: number | null } {
  const platforms = new Set<string>();
  let first: string | null = null;
  for (const detail of Object.values(data?.pillars ?? {})) {
    for (const moment of detail.clusters.flatMap((c) => c.observations)) {
      for (const p of [moment.platform, ...(moment.sources ?? [])]) if (p) platforms.add(p.trim().toLowerCase());
      if (moment.occurred_at && (!first || moment.occurred_at < first)) first = moment.occurred_at;
    }
  }
  const year = first ? Number(first.slice(0, 4)) : NaN;
  return { platforms: [...platforms], firstYear: Number.isFinite(year) ? year : null };
}

export function buildInsightsStats(
  platforms: number,
  firstYear: number | null,
  since: string | null,
  now: Date = new Date(),
): InsightsStat[] {
  const rows: InsightsStat[] = [];
  if (platforms > 0) {
    rows.push({
      key: "platforms",
      value: String(platforms),
      label: platforms === 1 ? "connected platform" : "connected platforms",
    });
  }
  if (firstYear !== null) {
    const years = Math.max(1, now.getFullYear() - firstYear);
    rows.push({ key: "years", value: `${years} ${years === 1 ? "year" : "years"}`, label: "in view" });
  }
  const joined = since ? new Date(since) : null;
  if (joined && !Number.isNaN(joined.getTime())) {
    rows.push({ key: "since", value: `${MONTHS[joined.getMonth()]} ${joined.getFullYear()}`, label: "here since" });
  }
  return rows;
}
