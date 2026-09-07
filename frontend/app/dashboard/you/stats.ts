// PHE-95 / v244 — the "your constellation" stats on the you tab.
//
// Pure helpers over the constellation payload (`fetchConstellation`) and the
// connected-platform count from `/profile/overview`. Type-only import so this
// module stays runnable under `node --experimental-strip-types --test`.
//
// The age itself comes from `constellationAge` in lib/constellation (shared with
// the constellation tab); the page computes it and passes it in.

import type { ConstellationAge, ConstellationData } from "@/lib/constellation";

export interface YouStat {
  key: "age" | "moments" | "turning points" | "accounts";
  label: string;
  value: string;
  note: string | null;
}

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
 * Rows for the "your constellation" block, in prototype order: age, moments,
 * turning points, accounts. A row with no value is omitted.
 */
export function buildYouStats(
  data: ConstellationData | null,
  accounts: number,
  age: ConstellationAge | null,
  now: Date = new Date(),
): YouStat[] {
  const rows: YouStat[] = [];

  if (data) {
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
