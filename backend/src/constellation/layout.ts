/**
 * PHE-74 — seven-point layout, kept in lockstep with
 * `frontend/lib/constellation-shape.ts` NODE_LAYOUT so GET /constellation
 * `points` land on the same canvas the client already draws. PHE-100: all
 * seven points are always served and always lit; there is no locked set.
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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// The Big Dipper from real star positions, turned 160° from the north-up sky
// view (origin at the left, transcendence at the top right). Each axis is
// normalized on its own; the figure's true width/height is 1.10, so clients
// scale it uniformly rather than stretching it to the canvas.
export const NODE_LAYOUT: Record<Pillar, Vec3> = {
  origin: { x: 0.0, y: 0.781, z: 0.0 },
  emergence: { x: 0.237, y: 0.456, z: 0.1 },
  self_creation: { x: 0.165, y: 1.0, z: 0.2 },
  convergence: { x: 0.434, y: 0.55, z: 0.3 },
  becoming: { x: 0.658, y: 0.412, z: 0.4 },
  recognition: { x: 0.847, y: 0.318, z: 0.5 },
  transcendence: { x: 1.0, y: 0.0, z: 0.6 },
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
