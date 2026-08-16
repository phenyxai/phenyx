/**
 * PHE-74 — seven-point layout, kept in lockstep with
 * `frontend/lib/constellation.ts` NODE_LAYOUT so GET /constellation `points`
 * land on the same canvas the client already draws.
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

export const ACTIVE_PILLARS: ReadonlySet<string> = new Set([
  "origin",
  "emergence",
  "self_creation",
  "convergence",
]);

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const NODE_LAYOUT: Record<Pillar, Vec3> = {
  origin: { x: 0.5, y: 0.85, z: 0.0 },
  emergence: { x: 0.22, y: 0.68, z: 0.1 },
  self_creation: { x: 0.16, y: 0.42, z: 0.2 },
  convergence: { x: 0.5, y: 0.48, z: 0.3 },
  becoming: { x: 0.82, y: 0.5, z: 0.4 },
  recognition: { x: 0.74, y: 0.24, z: 0.5 },
  transcendence: { x: 0.5, y: 0.12, z: 0.6 },
};

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
