// PHE-125: the onboarding formation's timing rules (spec doc 6), kept free of
// imports so they run under plain `node --test`. Per-point arrays are in
// ALL_PILLARS order: origin, emergence, self-creation, convergence, becoming,
// recognition, transcendence.

/** When each point's specks start pulling in (ms from the start). */
export const PULL_AT_MS = [700, 1800, 1800, 3000, 4250, 5500, 6700] as const;
/** The earliest each point may appear (ms from the start). */
export const REVEAL_AT_MS = [2400, 3500, 3500, 4750, 6000, 7250, 8450] as const;

export const GATHER_RADIUS_PX = 26;
export const GATHER_SHARE = 0.6;
export const REVEAL_FALLBACK_MS = 1200;
export const LINE_DELAY_MS = 260;
export const LINE_DURATION_MS = 800;
const MAX_FRAME_S = 0.05;

/**
 * A point appears once about 60% of its specks sit within about 26px of it,
 * never before its scheduled time, and at most 1.2s after it if the specks
 * never settle.
 */
export function pointReady(distances: readonly number[], t: number, revealAt: number): boolean {
  if (t < revealAt) return false;
  if (t > revealAt + REVEAL_FALLBACK_MS) return true;
  const near = distances.filter((d) => d < GATHER_RADIUS_PX).length;
  return near >= distances.length * GATHER_SHARE;
}

/** A line starts 0.26s after the later of its two points appeared; null until both have. */
export function lineStartMs(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : Math.max(a, b) + LINE_DELAY_MS;
}

/** Real seconds since the last frame, capped so a stalled frame never flings the specks. */
export function frameSeconds(now: number, last: number | null): number {
  return Math.min(MAX_FRAME_S, Math.max(0.004, (now - (last ?? now - 16)) / 1000));
}

interface Point {
  x: number;
  y: number;
}

export interface ParticleAssignment {
  node: number;
}

/**
 * Seat the particles with the strongest nearest-node claim first, falling back
 * to their next-nearest node when that point reaches the even-share capacity.
 */
export function assignParticlesToNodes(
  seeds: readonly Point[],
  nodes: readonly Point[],
): ParticleAssignment[] {
  if (nodes.length === 0) return [];

  const claims = seeds.map((seed, index) => ({
    index,
    order: nodes
      .map((node, nodeIndex) => ({
        node: nodeIndex,
        distance: Math.hypot(node.x - seed.x, node.y - seed.y),
      }))
      .sort((a, b) => a.distance - b.distance),
  }));
  claims.sort((a, b) => a.order[0].distance - b.order[0].distance);

  const capacity = Math.ceil(seeds.length / nodes.length);
  const counts = Array.from({ length: nodes.length }, () => 0);
  const assignments: ParticleAssignment[] = Array.from(
    { length: seeds.length },
    () => ({ node: 0 }),
  );

  claims.forEach((claim) => {
    const pick = claim.order.find(({ node }) => counts[node] < capacity) ?? claim.order[0];
    counts[pick.node]++;
    assignments[claim.index] = { node: pick.node };
  });

  return assignments;
}
