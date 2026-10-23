// PHE-124 / PHE-129 — the three stats under the insights header (spec doc 5,
// rebuild doc 10): connected platforms, years in view and here since, all
// computed from real data. A count with nothing behind it is left out rather
// than shown as zero; years in view always keeps its place (PHE-152) and reads
// "forming" until a dated source arrives (older imports carry no dates).
//
// Type-only import so this module stays runnable under `node --test`.

import type { ConstellationData } from "@/lib/constellation";

export interface InsightsStat {
  key: "platforms" | "years" | "since";
  value: string;
  label: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

/** The first four-digit year in a string ("2013 – 2017", "2008-05-01"), or null. */
function yearIn(text: string | null | undefined): number | null {
  const match = text ? /\b(1[89]\d\d|2\d\d\d)\b/.exec(text) : null;
  return match ? Number(match[1]) : null;
}

/**
 * What the constellation itself shows (rebuild doc 10): every platform it
 * draws on (each moment's platform and sources, each area's and point's
 * source platforms, the new signal's sources), so "connected platforms"
 * counts connections plus these and the two always match. For "years in
 * view", the earliest year anything is dated: a moment, a point's years, or
 * the record timeline drawn from the connected accounts (PHE-149).
 */
export function momentFacts(data: ConstellationData | null): { platforms: string[]; firstYear: number | null } {
  const platforms = new Set<string>();
  const add = (p: string | null | undefined) => {
    const name = p?.trim().toLowerCase();
    if (name) platforms.add(name);
  };
  const years: number[] = [];
  const addYear = (y: number | null) => {
    if (y !== null) years.push(y);
  };
  for (const detail of Object.values(data?.pillars ?? {})) {
    (detail.source_platforms ?? []).forEach(add);
    addYear(yearIn(detail.point?.years));
    for (const cluster of detail.clusters) {
      (cluster.source_platforms ?? []).forEach(add);
      for (const moment of cluster.observations) {
        [moment.platform, ...(moment.sources ?? [])].forEach(add);
        addYear(yearIn(moment.occurred_at));
      }
    }
  }
  (data?.signal?.sources ?? []).forEach((s) => add(s.platform));
  (data?.timeline?.span ?? []).forEach((y) => addYear(yearIn(y)));
  return { platforms: [...platforms], firstYear: years.length ? Math.min(...years) : null };
}

/**
 * PHE-148: the person's name as their Google profile carries it, for an
 * account whose profile row has no name (it was created before sign-in
 * stored one). Mirrors the backend's `displayNameFromMetadata`.
 */
export function nameFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "";
  const read = (key: string) => {
    const value = metadata[key];
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  };
  return (
    read("full_name") ||
    read("name") ||
    [read("given_name"), read("family_name")].filter(Boolean).join(" ")
  ).slice(0, 80);
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
  const years = firstYear === null ? null : Math.max(1, now.getFullYear() - firstYear);
  rows.push({ key: "years", value: years === null ? "forming" : `${years} ${years === 1 ? "year" : "years"}`, label: "in view" });
  const joined = since ? new Date(since) : null;
  if (joined && !Number.isNaN(joined.getTime())) {
    rows.push({ key: "since", value: `${MONTHS[joined.getMonth()]} ${joined.getFullYear()}`, label: "here since" });
  }
  return rows;
}
