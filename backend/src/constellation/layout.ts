/**
 * PHE-74 / PHE-100 — the seven pillars every constellation always has, all
 * lit. Where they sit on the map (the Big Dipper) is decided only by the
 * client, in `frontend/lib/constellation-shape.ts`; the API sends no positions.
 */

export const PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
] as const;

export type Pillar = (typeof PILLARS)[number];

export const CORE_CLUSTER_LABEL = "core signals";

/** PHENYX account age in years. Timeline content must not key off this. */
export const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function tenureYears(
  createdAt: string | null | undefined,
  now = Date.now()
): number {
  if (!createdAt) return 0;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / MS_PER_YEAR);
}
