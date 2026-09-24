import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAPTER_MIN_OPACITY,
  chapterOpacity,
  railLayout,
  ringBox,
  stationDelays,
  stepsForward,
  trailBackground,
  wrapIndex,
} from "./landing-motion.ts";

test("the trail is empty until it has swept a visible arc", () => {
  assert.equal(trailBackground(-90, 0), "none");
  assert.equal(trailBackground(-90, 0.5), "none");
});

test("the trail starts where the current quarter began and is brightest at its head", () => {
  // The ring is drawn from 12 o'clock (-90deg in SVG terms, 0deg for a conic
  // gradient), so the first slide's trail starts at `from 0deg`.
  const background = trailBackground(-90, 45);
  assert.match(background, /^conic-gradient\(from 0\.00deg,/);
  assert.match(background, /rgba\(214,231,255,1\) 45\.00deg/);
  // nothing is painted past the head
  assert.match(background, /rgba\(185,213,255,0\) 45\.60deg\)$/);
});

test("the trail never sweeps past a full turn", () => {
  assert.match(trailBackground(0, 500), /rgba\(214,231,255,1\) 360\.00deg/);
});

test("stepping forward always goes clockwise", () => {
  assert.equal(stepsForward(0, 1, 4), 1);
  assert.equal(stepsForward(3, 0, 4), 1);
  assert.equal(stepsForward(1, 0, 4), 3);
  assert.equal(stepsForward(2, 2, 4), 0);
});

test("indexes wrap round in both directions", () => {
  assert.equal(wrapIndex(4, 4), 0);
  assert.equal(wrapIndex(-1, 4), 3);
  assert.equal(wrapIndex(2, 4), 2);
});

test("the trail box is the ring's box as a share of the drawing", () => {
  // viewBox -24 0 448 384, ring centred at 200,190 with radius 122
  const box = ringBox({ x: -24, y: 0, width: 448, height: 384 }, { cx: 200, cy: 190, r: 122 });
  assert.deepEqual(box, { left: 22.768, top: 17.708, width: 54.464, height: 63.542 });
});

test("a chapter fully inside the viewport is fully lit", () => {
  const opacity = chapterOpacity({ top: 200, bottom: 600 }, { top: 0, height: 1000 });
  assert.equal(opacity, 1);
});

test("a chapter entirely outside the focus band sits at the floor", () => {
  const opacity = chapterOpacity({ top: 1400, bottom: 2200 }, { top: 0, height: 1000 });
  assert.equal(opacity, CHAPTER_MIN_OPACITY);
});

test("a chapter half into the focus band is partly lit", () => {
  // band is 220..780 (560px). A 2000px section starting at 640 overlaps 140px.
  const opacity = chapterOpacity({ top: 640, bottom: 2640 }, { top: 0, height: 1000 });
  assert.ok(opacity > CHAPTER_MIN_OPACITY && opacity < 1, `got ${opacity}`);
});

test("stations light in rail order, timed by where each dot sits", () => {
  const delays = stationDelays([0, 250, 1000], { start: 0, length: 1000 }, 11000);
  assert.deepEqual(delays, [0, 2750, 11000]);
});

test("station timing clamps dots that sit outside the rail", () => {
  assert.deepEqual(stationDelays([-40, 1200], { start: 0, length: 1000 }, 1000), [0, 1000]);
});

test("a zero-length rail lights everything at once", () => {
  assert.deepEqual(stationDelays([10, 20], { start: 0, length: 0 }, 1000), [0, 0]);
});

test("stations laid out across get a horizontal rail between the end dots", () => {
  const layout = railLayout([{ x: 100, y: 6 }, { x: 300, y: 6 }, { x: 500, y: 6 }]);
  assert.deepEqual(layout, {
    isVertical: false,
    origin: { x: 100, y: 6 },
    size: { width: 400, height: 1 },
    positions: [100, 300, 500],
    rail: { start: 100, length: 400 },
  });
});

test("stations stacked down a phone get a vertical rail", () => {
  const layout = railLayout([{ x: 6, y: 10 }, { x: 6, y: 210 }, { x: 6, y: 530 }]);
  assert.equal(layout?.isVertical, true);
  assert.deepEqual(layout?.size, { width: 1, height: 520 });
  assert.deepEqual(layout?.positions, [10, 210, 530]);
});

test("no stations, no rail", () => {
  assert.equal(railLayout([]), null);
});
