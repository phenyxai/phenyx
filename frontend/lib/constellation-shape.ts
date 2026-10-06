// PHE-100 — The constellation's fixed shape: the Big Dipper.
//
// The seven points and seven lines in spec doc 2 are exactly the Dipper's
// stick figure: a four-star bowl (origin, emergence, convergence,
// self-creation) and a three-star handle (becoming, recognition,
// transcendence) hanging off convergence. Positions come from the real stars,
// turned 160° so the story climbs from origin at the left to transcendence at
// the top right, so the shape is the one people can find in the sky. It never depends on
// what generation returns: a point with no data is drawn thin, never dropped.
//
// One source for the onboarding formation and the constellation tab. Kept free
// of imports so it loads under plain `node --test`;
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
 * The star each pillar sits on: ICRS J2000 position in degrees and V
 * magnitude, from SIMBAD (checked 2026-10-05; Mizar is Mizar A). Merak and
 * Dubhe are the pointer stars: the line from origin through self-creation
 * leads to Polaris.
 */
export const STARS: Record<Pillar, { star: string; ra: number; dec: number; mag: number }> = {
  origin: { star: "merak", ra: 165.4603, dec: 56.3824, mag: 2.37 },
  emergence: { star: "phecda", ra: 178.4577, dec: 53.6948, mag: 2.44 },
  self_creation: { star: "dubhe", ra: 165.932, dec: 61.751, mag: 1.79 },
  convergence: { star: "megrez", ra: 183.8565, dec: 57.0326, mag: 3.32 },
  becoming: { star: "alioth", ra: 193.5073, dec: 55.9598, mag: 1.77 },
  recognition: { star: "mizar", ra: 200.9814, dec: 54.9254, mag: 2.22 },
  transcendence: { star: "alkaid", ra: 206.8852, dec: 49.3133, mag: 1.86 },
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

/** The pointer stars: a faint guide continues past the second, toward polaris. */
export const POINTER: readonly [Pillar, Pillar] = ["origin", "self_creation"];

/**
 * Clockwise turn, in degrees, from the north-up sky view (east to the left).
 * 90 stands the handle upright; 160 (picked from the rotation preview,
 * 2026-10-05) lays the figure on a rising diagonal: origin at the left,
 * climbing to transcendence at the top right. A turn is how the real sky moves
 * through a night; the figure is never mirrored.
 */
export const ROTATION_DEG = 160;

/**
 * Gnomonic projection about the figure's centre as seen from Earth, turned by
 * ROTATION_DEG. Each axis is normalized to [0,1]; SHAPE_ASPECT keeps the true
 * width/height so drawing never stretches it.
 */
function project(): { layout: Record<Pillar, Vec3>; aspect: number } {
  const rad = Math.PI / 180;
  const unit = (p: Pillar) => {
    const a = STARS[p].ra * rad;
    const d = STARS[p].dec * rad;
    return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  };
  const sum = ALL_PILLARS.map(unit).reduce((s, v) => s.map((c, i) => c + v[i]));
  const a0 = Math.atan2(sum[1], sum[0]);
  const d0 = Math.atan2(sum[2], Math.hypot(sum[0], sum[1]));
  const cos = Math.cos(ROTATION_DEG * rad);
  const sin = Math.sin(ROTATION_DEG * rad);

  const raw = ALL_PILLARS.map((p) => {
    const a = STARS[p].ra * rad;
    const d = STARS[p].dec * rad;
    const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
    const east = (Math.cos(d) * Math.sin(a - a0)) / cosc;
    const north =
      (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cosc;
    // Sky view on screen (y down) is (x, y) = (-east, -north); turn it
    // clockwise by ROTATION_DEG.
    const [x, y] = [-east, -north];
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  });
  const xs = raw.map((r) => r.x);
  const ys = raw.map((r) => r.y);
  const [minX, spanX] = [Math.min(...xs), Math.max(...xs) - Math.min(...xs)];
  const [minY, spanY] = [Math.min(...ys), Math.max(...ys) - Math.min(...ys)];

  const layout = {} as Record<Pillar, Vec3>;
  ALL_PILLARS.forEach((p, i) => {
    layout[p] = { x: (raw[i].x - minX) / spanX, y: (raw[i].y - minY) / spanY, z: i / 10 };
  });
  return { layout, aspect: spanX / spanY };
}

const projected = project();

/** Normalized [0,1] centers per axis. `z` is reserved for a future 3D layer. */
export const NODE_LAYOUT: Record<Pillar, Vec3> = projected.layout;

/** True width / height of the figure at ROTATION_DEG (about 1.1 at 160°). */
export const SHAPE_ASPECT = projected.aspect;

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
