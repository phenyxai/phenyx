// Motion arithmetic for the landing, kept free of the DOM so it can be tested
// under `node --test`. Ported from the landing exports: the orbit carousel's
// light trail (v610/v640), the rail that lights each station as the runner
// reaches it (v630), and the entrance every section plays (v1800, Oct 4).

const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

export interface EntrancePlan {
  /** When the headline's first word starts; each next word follows 75ms later. */
  headline: number;
  ledes: number[];
  /** When the section's text has landed: the gate for stories that run on their own. */
  landed: number;
  blocks: number[];
}

/**
 * When each part of a section floats in, in seconds from the moment its
 * headline comes into view: the eyebrow at once, the headline word by word
 * 120ms after it, the ledes 0.2s after the words and 0.18s apart, then the
 * blocks (cards and visuals) 0.16s apart once the text has landed.
 */
export function entrancePlan(parts: { hasEyebrow: boolean; words: number; ledes: number; blocks: number }): EntrancePlan {
  const headline = parts.hasEyebrow ? 0.12 : 0;
  const firstLede = headline + parts.words * 0.075 + 0.2;
  const landed = firstLede + (parts.ledes ? (parts.ledes - 1) * 0.18 + 0.4 : 0.3);
  return {
    headline,
    ledes: Array.from({ length: parts.ledes }, (_, i) => round(firstLede + i * 0.18)),
    landed: round(landed),
    blocks: Array.from({ length: parts.blocks }, (_, i) => round(landed + i * 0.16)),
  };
}

/**
 * The orbit trail as one conic gradient: transparent where the trail began,
 * brightest at its head, nothing beyond it. One gradient rather than segments,
 * so there is no banding. `startAngle` is in SVG terms (-90 is 12 o'clock).
 */
export function trailBackground(startAngle: number, sweep: number): string {
  const deg = Math.max(0, Math.min(360, sweep));
  if (deg < 0.6) return "none";
  const from = (((startAngle + 90) % 360) + 360) % 360;
  return (
    `conic-gradient(from ${from.toFixed(2)}deg,` +
    `rgba(185,213,255,0) 0deg,` +
    `rgba(185,213,255,.28) ${(deg * 0.55).toFixed(2)}deg,` +
    `rgba(214,231,255,1) ${deg.toFixed(2)}deg,` +
    `rgba(185,213,255,0) ${(deg + 0.6).toFixed(2)}deg)`
  );
}

/** `index` brought into 0..count-1, so stepping past either end comes round. */
export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/** How many positions the orbit turns to reach `to`. It only ever turns clockwise. */
export function stepsForward(from: number, to: number, count: number): number {
  return wrapIndex(to - from, count);
}

/**
 * Where a circle sits inside its SVG drawing, as percentages of the drawing,
 * so an HTML layer (the orbit trail) can be laid exactly over the ring at any
 * rendered size.
 */
export function ringBox(
  viewBox: { x: number; y: number; width: number; height: number },
  ring: { cx: number; cy: number; r: number },
): { left: number; top: number; width: number; height: number } {
  const percent = (value: number, of: number) => Math.round((value / of) * 100000) / 1000;
  return {
    left: percent(ring.cx - ring.r - viewBox.x, viewBox.width),
    top: percent(ring.cy - ring.r - viewBox.y, viewBox.height),
    width: percent(ring.r * 2, viewBox.width),
    height: percent(ring.r * 2, viewBox.height),
  };
}

/**
 * When each station lights, in ms. The stations are not evenly spaced (least
 * of all when they stack on a phone), so each one is timed from where its dot
 * actually sits along the rail rather than from its index.
 */
export function stationDelays(
  positions: readonly number[],
  rail: { start: number; length: number },
  duration: number,
): number[] {
  return positions.map((position) => {
    if (rail.length <= 0) return 0;
    const fraction = Math.max(0, Math.min(1, (position - rail.start) / rail.length));
    return Math.round(fraction * duration);
  });
}

export interface RailLayout {
  isVertical: boolean;
  /** Where the rail starts: the centre of the first dot. */
  origin: { x: number; y: number };
  size: { width: number; height: number };
  /** Each dot's position along the rail's axis, for `stationDelays`. */
  positions: number[];
  rail: { start: number; length: number };
}

/**
 * The rail pinned between the first and last station dots, so the light ends
 * on one. The stations run across on a wide screen and stack down a phone;
 * the dots say which.
 */
export function railLayout(centres: readonly { x: number; y: number }[]): RailLayout | null {
  const first = centres[0];
  const last = centres[centres.length - 1];
  if (!first || !last) return null;
  const isVertical = last.y - first.y > last.x - first.x;
  const length = isVertical ? last.y - first.y : last.x - first.x;
  return {
    isVertical,
    origin: { x: first.x, y: first.y },
    size: isVertical ? { width: 1, height: length } : { width: length, height: 1 },
    positions: centres.map((centre) => (isVertical ? centre.y : centre.x)),
    rail: { start: isVertical ? first.y : first.x, length },
  };
}
