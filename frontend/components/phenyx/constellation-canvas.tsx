"use client";

// PHE-28 — Constellation canvas.
//
// A <canvas> renderer for the seven-node constellation, forked from the SVG
// landing component (`constellation.tsx`, which the landing mission section still
// uses) because this surface needs a requestAnimationFrame pulse loop, DPR-aware
// backing-store scaling, and pixel hit-testing that the static SVG map does not.
//
// - Four active pillars fill/glow in the user's stellar color; a pillar carrying
//   a new observation pulses and shows a new-signal dot.
// - Unformed pillars (becoming|recognition|transcendence until they carry
//   observations) render dim: no pulse, no new-signal dot. They are still
//   keyboard-reachable overlay buttons.
// - The RAF loop pauses when the document is hidden (visibilitychange) and is
//   skipped entirely under prefers-reduced-motion, which draws a single static
//   frame instead.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ALL_PILLARS,
  EDGES,
  NODE_LAYOUT,
  isLockedPillar,
  pillarLabel,
  type ConstellationData,
  type Pillar,
} from "@/lib/constellation";

const PADDING = 46; // keeps edge nodes + labels off the canvas border
const BASE_RADIUS = 5.5;
const LOCKED_RADIUS = 4;
const HIT_SLOP = 14;

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

  // Map the deterministic normalized layout into CSS-pixel centers for the
  // current canvas size. `z` is intentionally not consulted here — the draw is
  // 2D; z only round-trips through the node model.
  const computeNodePixels = useCallback((w: number, h: number) => {
    const innerW = Math.max(0, w - PADDING * 2);
    const innerH = Math.max(0, h - PADDING * 2);
    const next = ALL_PILLARS.map((pillar) => {
      const pos = NODE_LAYOUT[pillar];
      return {
        pillar,
        x: PADDING + pos.x * innerW,
        y: PADDING + pos.y * innerH,
        r: isLockedPillar(pillar) ? LOCKED_RADIUS : BASE_RADIUS,
      };
    });
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
    const stellar = current.stellar_color;

    // Faint, non-interactive edges.
    ctx.lineWidth = 1;
    for (const [a, b] of EDGES) {
      const na = pixelByPillar.get(a);
      const nb = pixelByPillar.get(b);
      if (!na || !nb) continue;
      const lit =
        current.pillars[a].active && current.pillars[b].active ? 0.16 : 0.07;
      ctx.strokeStyle = `rgba(255,253,253,${lit})`;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();
    }

    // Slow pulse phase in [0,1]; static (0.5) when animation is suppressed.
    const phase = animated ? (Math.sin(time / 900) + 1) / 2 : 0.5;

    for (const node of nodes) {
      const detail = current.pillars[node.pillar];
      const isSelected = selectedRef.current === node.pillar;

      if (!detail.active) {
        // Unformed pillar: dim ring, no fill, no glow, no pulse.
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,253,253,0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,253,253,0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Active pillar: stellar glow. Pulse amplitude only when carrying a new
        // observation, otherwise a steady halo.
        const pulse = detail.has_new ? 0.45 + phase * 0.55 : 0.6;
        const glowRadius = node.r + 8 + (detail.has_new ? phase * 5 : 3);

        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          glowRadius,
        );
        gradient.addColorStop(0, withAlpha(stellar, 0.55 * pulse));
        gradient.addColorStop(1, withAlpha(stellar, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core.
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = stellar;
        ctx.fill();

        // Selection ring.
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(stellar, 0.7);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // New-signal dot, top-right of the core.
        if (detail.has_new) {
          const dx = node.x + node.r + 2;
          const dy = node.y - node.r - 2;
          ctx.beginPath();
          ctx.arc(dx, dy, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFDFD";
          ctx.fill();
        }
      }

      // Label.
      ctx.font = "300 11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = detail.active
        ? "rgba(255,253,253,0.6)"
        : "rgba(255,253,253,0.28)";
      const labelY = node.y + node.r + 12;
      ctx.fillText(pillarLabel(node.pillar), node.x, labelY);
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
    <div className="relative h-full w-full">
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
          const areaCount = detail.clusters.length;
          const n = detail.observation_count;
          const label = areaCount
            ? `${pillarLabel(node.pillar)}, ${n} observation${n === 1 ? "" : "s"} in ${areaCount} area${areaCount === 1 ? "" : "s"}`
            : `${pillarLabel(node.pillar)}, no observations yet`;
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
              className="pointer-events-auto absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0 focus-visible:bg-[#FFFDFD]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--s,#88AAEE)] motion-reduce:transition-none"
              style={{ left: node.x, top: node.y }}
            />
          );
        })}
      </div>
      <p id={labelId} className="sr-only">
        your constellation
      </p>
      <p id={helpId} className="sr-only">
        seven points. use the arrow keys to move between them, enter to open one, escape to close it.
      </p>
      <p id={liveId} className="sr-only" role="status" aria-live="polite">
        {selectedPillar
          ? `${pillarLabel(selectedPillar)} opened. details are in the panel beside the constellation.`
          : ""}
      </p>
    </div>
  );
}

/** Blend a hex color with an alpha channel, tolerant of malformed input. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(85,153,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
