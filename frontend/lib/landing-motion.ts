// Motion arithmetic for the landing, kept free of the DOM so it can be tested
// under `node --test`. Ported from the Sept 23 landing export (internal pass
// v740): the orbit carousel's light trail (v610/v640), the chapters that come
// into focus as they reach the middle of the screen (v610), and the "our
// vision" rail that lights each station as the runner reaches it (v630).

/** Opacity a chapter rests at when it is nowhere near the focus band. */
export const CHAPTER_MIN_OPACITY = 0.26;

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

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * How lit a chapter is, from how much of it sits inside the middle band of the
 * scroller (22% to 78% of its height). A chapter that fits on screen whole is
 * treated as nearly centred, so short sections do not stay dim.
 */
export function chapterOpacity(
  section: { top: number; bottom: number },
  viewport: { top: number; height: number },
): number {
  const bandTop = viewport.top + viewport.height * 0.22;
  const bandBottom = viewport.top + viewport.height * 0.78;
  const band = bandBottom - bandTop;
  const height = section.bottom - section.top;
  const overlap = Math.max(0, Math.min(section.bottom, bandBottom) - Math.max(section.top, bandTop));
  let focus = height > 0 ? overlap / Math.min(height, band) : 0;
  const onScreen = section.top >= viewport.top - 2 && section.bottom <= viewport.top + viewport.height + 2;
  if (onScreen) focus = Math.max(focus, 0.92);
  focus = Math.min(1, focus * 1.25);
  const opacity = CHAPTER_MIN_OPACITY + (1 - CHAPTER_MIN_OPACITY) * easeInOut(focus);
  return Math.round(opacity * 1000) / 1000;
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
