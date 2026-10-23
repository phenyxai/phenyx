"use client";

// PHE-28 — Constellation canvas.
//
// A <canvas> renderer for the seven-node constellation, forked from the SVG
// landing component (`constellation.tsx`, which the landing mission section still
// uses) because this surface needs a requestAnimationFrame pulse loop, DPR-aware
// backing-store scaling, and pixel hit-testing that the static SVG map does not.
//
// - PHE-100: the seven points are joined by the seven lines in
//   `constellation-shape`: the Big Dipper, from real star positions, scaled
//   uniformly (never stretched). A faint dotted pointer continues past
//   self-creation (Dubhe) along the line from origin (Merak), toward polaris. A
//   thin point (no synthesis and no observations yet) is drawn quietly, never
//   dropped. A point carrying a new observation pulses.
// - Oct 21 demo glow: every point is a small cream core inside an accent halo
//   of one fixed size, the lines are the accent at low strength, and a faint
//   accent wash sits behind the whole sky. The opened point becomes a tighter,
//   brighter star, its own lines brighten, and the rest step back.
// - Points carry no names on the map; the name heads the panel once a point is
//   opened. Screen readers get the name from each overlay button.
// - The RAF loop pauses when the document is hidden (visibilitychange) and is
//   skipped entirely under prefers-reduced-motion, which draws a single static
//   frame instead.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { pillarLabel, type ConstellationData, type Pillar } from "@/lib/constellation";
import { hexToRgb, resolveAccent } from "@/lib/stellar";
import {
  ALL_PILLARS,
  EDGES,
  POINTER,
  STAR_RADIUS,
  fitShape,
} from "@/lib/constellation-shape";

const PADDING = 28; // keeps edge nodes and their glow off the canvas border
const HIT_SLOP = 14;

// The demo's star, in CSS pixels (its `--constellation-*` values).
const CORE_RADIUS = 2.384;
/** The core is the accent mixed into warm white at this share. */
const CORE_TINT = 0.24;
const CORE_BASE: [number, number, number] = [255, 246, 231]; // #fff6e7
const HALO_RADIUS = 17.44;
/** Halo alpha at its center (core color), 18% out and 58% out (accent); clear at the edge. */
const HALO_CENTER = 0.84;
const HALO_INNER = 0.72;
const HALO_OUTER = 0.17;
/** The opened point: a #fff5e9 core to 2.5px, accent .78 at 3px, .23 at 8px, clear by 13px. */
const OPEN_RADIUS = 13;
const OPEN_CORE = "255, 245, 233";
const LINE_ALPHA = 0.32;
const LINE_NEAR_ALPHA = 0.46;
/** With a point open, the other points and lines step back to these opacities. */
const DIM_POINT = 0.55;
const DIM_LINE = 0.45;

interface NodePixel {
  pillar: Pillar;
  x: number;
  y: number;
  r: number;
}

export interface ConstellationCanvasProps {
  data: ConstellationData;
  selectedPillar: Pillar | null;
  onSelectPillar: (pillar: Pillar) => void;
  /** Escape closes the open point (back to overview). */
  onClosePoint?: () => void;
}

export function ConstellationCanvas({
  data,
  selectedPillar,
  onSelectPillar,
  onClosePoint,
}: ConstellationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodePixelsRef = useRef<NodePixel[]>([]);
  const [overlayNodes, setOverlayNodes] = useState<NodePixel[]>([]);
  const [kbIndex, setKbIndex] = useState(0);
  const liveId = useId();
  const labelId = useId();
  const helpId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const cssSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Latest render inputs, mirrored to refs so the RAF loop reads current values
  // without being torn down and rebuilt on every prop change.
  const dataRef = useRef(data);
  const selectedRef = useRef(selectedPillar);
  dataRef.current = data;
  selectedRef.current = selectedPillar;

  // Fit the real shape uniformly into the canvas (never stretched) and take
  // CSS-pixel centers. `z` is not consulted; the draw is 2D.
  const computeNodePixels = useCallback((w: number, h: number) => {
    const next = fitShape(
      PADDING,
      PADDING,
      Math.max(0, w - PADDING * 2),
      Math.max(0, h - PADDING * 2),
    ).map((node) => ({ ...node, r: STAR_RADIUS[node.pillar] }));
    nodePixelsRef.current = next;
    setOverlayNodes(next);
  }, []);

  const drawFrame = useCallback((time: number, animated: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = cssSizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const current = dataRef.current;
    const nodes = nodePixelsRef.current;
    const pixelByPillar = new Map(nodes.map((n) => [n.pillar, n]));
    // PHE-98: the same resolved accent as --ph-accent (a stale or off-palette
    // value paints neutral), as a real hex for the canvas.
    const stellar = resolveAccent(current.stellar_color);

    const rgb = hexToRgb(stellar);
    const open = selectedRef.current;
    const core = mixCore(stellar);

    // The lines: the accent at low strength. With a point open, its own lines
    // brighten and the rest step back.
    ctx.lineWidth = 1;
    for (const [a, b] of EDGES) {
      const na = pixelByPillar.get(a);
      const nb = pixelByPillar.get(b);
      if (!na || !nb) continue;
      const near = open !== null && (a === open || b === open);
      const alpha = near ? LINE_NEAR_ALPHA : open ? LINE_ALPHA * DIM_LINE : LINE_ALPHA;
      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();
    }

    // The pointer: a dotted guide past self-creation, up to one pointer-gap
    // long, fading out toward polaris. It stops where it would leave the
    // canvas so the fade always finishes on screen. Not a line of the shape
    // and not clickable.
    const from = pixelByPillar.get(POINTER[0]);
    const to = pixelByPillar.get(POINTER[1]);
    if (from && to) {
      const gx = to.x - from.x;
      const gy = to.y - from.y;
      const gap = Math.hypot(gx, gy) || 1;
      // Fraction of the gap that fits before the canvas edge (4px inset).
      const fit = (pos: number, d: number, size: number) =>
        d > 0 ? (size - 4 - pos) / d : d < 0 ? (4 - pos) / d : Infinity;
      const t = Math.max(0, Math.min(1, fit(to.x, gx, w), fit(to.y, gy, h)));
      const dx = gx * t;
      const dy = gy * t;
      // Too little room past the star (e.g. a very short canvas): skip it.
      if (Math.hypot(dx, dy) > to.r + 14) {
        const sx = to.x + (gx / gap) * (to.r + 6);
        const sy = to.y + (gy / gap) * (to.r + 6);
        const fade = ctx.createLinearGradient(sx, sy, to.x + dx, to.y + dy);
        fade.addColorStop(0, `rgba(${rgb}, ${open ? LINE_ALPHA * DIM_LINE : LINE_ALPHA})`);
        fade.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.strokeStyle = fade;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(to.x + dx, to.y + dy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Slow pulse phase in [0,1]; static (0.5) when animation is suppressed.
    const phase = animated ? (Math.sin(time / 900) + 1) / 2 : 0.5;

    for (const node of nodes) {
      const detail = current.pillars[node.pillar];
      const thin = detail.observation_count === 0 && !detail.synthesis;
      // A thin point is drawn at half strength; with a point open, the others step back.
      ctx.globalAlpha = (thin ? 0.55 : 1) * (open && open !== node.pillar ? DIM_POINT : 1);

      if (open === node.pillar) {
        const star = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, OPEN_RADIUS);
        star.addColorStop(0, `rgb(${OPEN_CORE})`);
        star.addColorStop(2.5 / OPEN_RADIUS, `rgb(${OPEN_CORE})`);
        star.addColorStop(3 / OPEN_RADIUS, `rgba(${rgb}, 0.78)`);
        star.addColorStop(8 / OPEN_RADIUS, `rgba(${rgb}, 0.23)`);
        star.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = star;
        ctx.beginPath();
        ctx.arc(node.x, node.y, OPEN_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // The halo; a point carrying a new observation breathes.
        const breath = detail.has_new ? 0.7 + phase * 0.3 : 1;
        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, HALO_RADIUS);
        halo.addColorStop(0, `rgba(${core}, ${HALO_CENTER * breath})`);
        halo.addColorStop(0.18, `rgba(${rgb}, ${HALO_INNER * breath})`);
        halo.addColorStop(0.58, `rgba(${rgb}, ${HALO_OUTER * breath})`);
        halo.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(node.x, node.y, HALO_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgb(${core})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, CORE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // PHE-102: "new signal" tag beside the unseen signal's point, flipped
      // to the left when it would run off the right edge.
      if (current.signal?.pillar === node.pillar) {
        const label = "new signal";
        ctx.font = `500 10px ${getComputedStyle(canvas).fontFamily}`;
        ctx.textBaseline = "middle";
        const width = ctx.measureText(label).width;
        const gap = CORE_RADIUS + 10;
        const right = node.x + gap + width <= w - 4;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillStyle = stellar;
        ctx.fillText(label, right ? node.x + gap : node.x - gap, node.y);
      }
    }
  }, []);

  // Size the backing store to cssSize * dpr and rescale the context so drawing
  // stays crisp on hi-DPI displays and after viewport changes.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    cssSizeRef.current = { w, h };
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    computeNodePixels(w, h);
    // Repaint immediately so a resize is reflected even while the RAF loop is
    // paused (hidden tab / reduced motion).
    drawFrame(performance.now(), false);
  }, [computeNodePixels, drawFrame]);

  useEffect(() => {
    resize();

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const loop = () => {
      drawFrame(performance.now(), true);
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reducedMotion) {
        drawFrame(performance.now(), false);
        return;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Pause the loop when the document is hidden to avoid wasted frames; resume
    // cleanly (and repaint) when it becomes visible again.
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const ro = new ResizeObserver(() => resize());
    if (canvasRef.current?.parentElement) {
      ro.observe(canvasRef.current.parentElement);
    }
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [drawFrame, resize]);

  // Redraw once when static inputs (data / selection) change while the loop is
  // paused, so reduced-motion + hidden-tab states still reflect fresh props.
  useEffect(() => {
    drawFrame(performance.now(), false);
  }, [data, selectedPillar, drawFrame]);

  const handlePointer = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;

      let hit: NodePixel | null = null;
      let best = Infinity;
      for (const node of nodePixelsRef.current) {
        const dist = Math.hypot(px - node.x, py - node.y);
        if (dist <= node.r + HIT_SLOP && dist < best) {
          best = dist;
          hit = node;
        }
      }
      if (hit) {
        const idx = ALL_PILLARS.indexOf(hit.pillar);
        if (idx >= 0) setKbIndex(idx);
        onSelectPillar(hit.pillar);
      }
    },
    [onSelectPillar],
  );

  const focusButton = useCallback((index: number) => {
    const i = (index + ALL_PILLARS.length) % ALL_PILLARS.length;
    setKbIndex(i);
    buttonRefs.current[i]?.focus();
  }, []);

  const onKbKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const k = event.key;
      if (k === "ArrowRight" || k === "ArrowDown") {
        event.preventDefault();
        focusButton(kbIndex + 1);
      } else if (k === "ArrowLeft" || k === "ArrowUp") {
        event.preventDefault();
        focusButton(kbIndex - 1);
      } else if (k === "Home") {
        event.preventDefault();
        focusButton(0);
      } else if (k === "End") {
        event.preventDefault();
        focusButton(ALL_PILLARS.length - 1);
      } else if (k === "Escape") {
        if (selectedPillar) {
          event.preventDefault();
          onClosePoint?.();
        }
      }
    },
    [focusButton, kbIndex, onClosePoint, selectedPillar],
  );

  return (
    <div className="relative h-full w-full" style={{ background: skyWash(resolveAccent(data.stellar_color)) }}>
      <canvas
        ref={canvasRef}
        onClick={handlePointer}
        className="h-full w-full cursor-pointer"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={helpId}
        onKeyDown={onKbKeyDown}
      >
        {overlayNodes.map((node, i) => {
          const detail = data.pillars[node.pillar];
          const n = detail.observation_count;
          const label = n
            ? `${pillarLabel(node.pillar)}, ${n} moment${n === 1 ? "" : "s"}`
            : `${pillarLabel(node.pillar)}, no moments yet`;
          return (
            <button
              key={node.pillar}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              type="button"
              tabIndex={i === kbIndex ? 0 : -1}
              aria-label={label}
              aria-expanded={selectedPillar === node.pillar}
              onClick={() => {
                setKbIndex(i);
                onSelectPillar(node.pillar);
              }}
              className="pointer-events-auto absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0 focus-visible:bg-ph-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ph-accent)] motion-reduce:transition-none"
              style={{ left: node.x, top: node.y }}
            />
          );
        })}
      </div>
      <p id={labelId} className="sr-only">
        your constellation
      </p>
      <p id={helpId} className="sr-only">
        seven points in your constellation. use the arrow keys to move between them, enter to open one, and escape to close it.
      </p>
      <p id={liveId} className="sr-only" role="status" aria-live="polite">
        {selectedPillar
          ? `${pillarLabel(selectedPillar)} opened. details are in the panel.`
          : ""}
      </p>
    </div>
  );
}

/** The star's cream core: the accent mixed into #fff6e7 at CORE_TINT, as "r, g, b". */
function mixCore(hex: string): string {
  return hexToRgb(hex)
    .split(",")
    .map((c, i) => Math.round(Number(c) * CORE_TINT + CORE_BASE[i] * (1 - CORE_TINT)))
    .join(", ");
}

/** The faint accent wash behind the sky, as in the demo's field. */
function skyWash(hex: string): string {
  const rgb = hexToRgb(hex);
  return `radial-gradient(ellipse 49% 46% at 50% 52%, rgba(${rgb}, 0.07) 0%, rgba(${rgb}, 0.048) 30%, rgba(${rgb}, 0.019) 60%, rgba(${rgb}, 0.004) 82%, rgba(${rgb}, 0) 100%) no-repeat`;
}
