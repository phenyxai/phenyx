// PHE-100 — The constellation's fixed shape: the Big Dipper.
//
// The seven points and seven lines in spec doc 2 are exactly the Dipper's
// stick figure: a four-star bowl (origin, emergence, convergence,
// self-creation) and a three-star handle (becoming, recognition,
// transcendence) hanging off convergence. The figure is drawn by hand (Oct 31
// reference): a squared bowl at the left, the handle running out level and
// lifting at its tip, so the story climbs from origin at the bottom left to
// transcendence at the top right. It never depends on what generation
// returns: a point with no data is drawn thin, never dropped.
//
// One source for the onboarding formation and the constellation tab. Kept free
// of imports so it loads under plain `node --test`;
// The API sends no positions; the client alone decides where points sit.

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

/** The star each pillar sits on and its V magnitude (SIMBAD, 2026-10-05). */
export const STARS: Record<Pillar, { star: string; mag: number }> = {
  origin: { star: "merak", mag: 2.37 },
  emergence: { star: "phecda", mag: 2.44 },
  self_creation: { star: "dubhe", mag: 1.79 },
  convergence: { star: "megrez", mag: 3.32 },
  becoming: { star: "alioth", mag: 1.77 },
  recognition: { star: "mizar", mag: 2.22 },
  transcendence: { star: "alkaid", mag: 1.86 },
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

/** Each point's center in the Oct 31 reference drawing, in its pixels (y down). */
export const FIGURE: Record<Pillar, [number, number]> = {
  origin: [97, 370],
  emergence: [143, 203],
  self_creation: [289, 366],
  convergence: [296, 223],
  becoming: [473, 207],
  recognition: [619, 171],
  transcendence: [680, 61],
};

/** PHE-163: the figure tilts this many degrees up (counterclockwise) around its own center. */
export const TILT_DEG = 7;

const TILTED: Record<Pillar, [number, number]> = (() => {
  const cx = ALL_PILLARS.reduce((sum, p) => sum + FIGURE[p][0], 0) / ALL_PILLARS.length;
  const cy = ALL_PILLARS.reduce((sum, p) => sum + FIGURE[p][1], 0) / ALL_PILLARS.length;
  const [cos, sin] = [Math.cos((TILT_DEG * Math.PI) / 180), Math.sin((TILT_DEG * Math.PI) / 180)];
  // y points down, so lifting the right side subtracts from y.
  return Object.fromEntries(
    ALL_PILLARS.map((p) => {
      const [dx, dy] = [FIGURE[p][0] - cx, FIGURE[p][1] - cy];
      return [p, [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos]];
    })
  ) as Record<Pillar, [number, number]>;
})();

const xs = ALL_PILLARS.map((p) => TILTED[p][0]);
const ys = ALL_PILLARS.map((p) => TILTED[p][1]);
const [minX, spanX] = [Math.min(...xs), Math.max(...xs) - Math.min(...xs)];
const [minY, spanY] = [Math.min(...ys), Math.max(...ys) - Math.min(...ys)];

/** Normalized [0,1] centers per axis, after the tilt. `z` is reserved for a future 3D layer. */
export const NODE_LAYOUT = Object.fromEntries(
  ALL_PILLARS.map((p, i) => [
    p,
    { x: (TILTED[p][0] - minX) / spanX, y: (TILTED[p][1] - minY) / spanY, z: i / 10 },
  ])
) as Record<Pillar, Vec3>;

/** True width / height of the tilted figure (about 1.43). */
export const SHAPE_ASPECT = spanX / spanY;

/** Core radius in px from real brightness: brighter stars draw larger. */
export const STAR_RADIUS: Record<Pillar, number> = Object.fromEntries(
  ALL_PILLARS.map((p) => [p, Math.max(2.5, 6.5 - 1.1 * STARS[p].mag)])
) as Record<Pillar, number>;

/**
 * Pixel centers for the figure scaled uniformly into a box and centered in it,
 * in ALL_PILLARS order. Never stretched, whatever the box's proportions.
 */
export function fitShape(
  left: number,
  top: number,
  width: number,
  height: number
): { pillar: Pillar; x: number; y: number }[] {
  const h = Math.max(0, Math.min(height, width / SHAPE_ASPECT));
  const w = h * SHAPE_ASPECT;
  const x0 = left + (width - w) / 2;
  const y0 = top + (height - h) / 2;
  return ALL_PILLARS.map((pillar) => ({
    pillar,
    x: x0 + NODE_LAYOUT[pillar].x * w,
    y: y0 + NODE_LAYOUT[pillar].y * h,
  }));
}
