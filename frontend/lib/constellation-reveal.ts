export const FORMATION_ANIMATION_DURATION_MS = 17_085;

export interface FormationTimeline {
  appearDurationMs: number;
  condenseAtMs: number;
  pullDurationMs: number;
  nodeStaggerMs: number;
  linesAtMs: number;
  linesDurationMs: number;
  revealAtMs: number;
  loadFadeDurationMs: number;
  revealInDurationMs: number;
  labelFadeDurationMs: number;
  hubDelayMs: number;
  condenseJitterMs: number;
  screenFadeDurationMs: number;
  completeAtMs: number;
}

/**
 * Scale every formation beat from the original 20.1 second choreography.
 * Changing FORMATION_ANIMATION_DURATION_MS is the only duration decision the
 * reveal exposes; the relative phase timing stays intact.
 */
export function formationTimeline(totalDuration: number): FormationTimeline {
  const scaleOriginalMs = (originalMs: number) =>
    Math.round((originalMs / 20_100) * totalDuration);
  return {
    appearDurationMs: scaleOriginalMs(2_000),
    condenseAtMs: scaleOriginalMs(4_000),
    pullDurationMs: scaleOriginalMs(1_800),
    nodeStaggerMs: scaleOriginalMs(300),
    linesAtMs: scaleOriginalMs(8_300),
    linesDurationMs: scaleOriginalMs(2_400),
    revealAtMs: scaleOriginalMs(11_700),
    loadFadeDurationMs: scaleOriginalMs(800),
    revealInDurationMs: scaleOriginalMs(2_200),
    labelFadeDurationMs: scaleOriginalMs(350),
    hubDelayMs: scaleOriginalMs(800),
    condenseJitterMs: scaleOriginalMs(600),
    screenFadeDurationMs: scaleOriginalMs(1_800),
    completeAtMs: totalDuration,
  };
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
