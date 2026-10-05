// PHE-100 — The constellation's fixed shape: seven points, seven lines.
//
// One source for the onboarding formation and the constellation tab, so the
// picture that forms is the picture the person lands on. The shape never
// depends on what generation returns: a point with no data is drawn thin,
// never dropped. Kept free of imports so it loads under plain `node --test`;
// `backend/src/constellation/layout.ts` mirrors NODE_LAYOUT for the API.

export const ALL_PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
] as const;

export type Pillar = (typeof ALL_PILLARS)[number];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Normalized [0,1] centers within the drawing box. Origin anchors the bottom,
 * emergence and self-creation form a diamond into convergence, and a spine
 * rises through becoming and recognition to transcendence. `z` is reserved for
 * a future 3D layer and never read by the 2D draw.
 */
export const NODE_LAYOUT: Record<Pillar, Vec3> = {
  origin: { x: 0.5, y: 0.9, z: 0.0 },
  emergence: { x: 0.33, y: 0.72, z: 0.1 },
  self_creation: { x: 0.67, y: 0.72, z: 0.2 },
  convergence: { x: 0.5, y: 0.56, z: 0.3 },
  becoming: { x: 0.5, y: 0.41, z: 0.4 },
  recognition: { x: 0.5, y: 0.26, z: 0.5 },
  transcendence: { x: 0.5, y: 0.11, z: 0.6 },
};

/** The seven lines, in formation draw order (spec doc 2). */
export const EDGES: readonly [Pillar, Pillar][] = [
  ["origin", "emergence"],
  ["origin", "self_creation"],
  ["emergence", "convergence"],
  ["self_creation", "convergence"],
  ["convergence", "becoming"],
  ["becoming", "recognition"],
  ["recognition", "transcendence"],
];
