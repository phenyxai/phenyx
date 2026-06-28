"use client";

import { useEffect, useRef } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

/**
 * The seven-point identity constellation. Ported from the reference
 * `makeLandingConstellation` + its auto-cycle controller. Nodes/lines assemble
 * themselves the first time the canvas scrolls into view (IntersectionObserver,
 * threshold .35, once only), then auto-cycle through each pillar every 3400ms,
 * with hover takeover. Colors are recolored to the session color. Honors
 * prefers-reduced-motion (renders fully formed, no entrance, no cycle).
 */

const POS = [
  { rx: 0.12, ry: 0.88 },
  { rx: 0.37, ry: 0.87 },
  { rx: 0.18, ry: 0.47 },
  { rx: 0.38, ry: 0.52 },
  { rx: 0.61, ry: 0.48 },
  { rx: 0.8, ry: 0.39 },
  { rx: 0.88, ry: 0.12 },
];
const LINES = [
  { i: 0, j: 1 },
  { i: 0, j: 2 },
  { i: 1, j: 3 },
  { i: 2, j: 3 },
  { i: 3, j: 4 },
  { i: 4, j: 5 },
  { i: 5, j: 6 },
];
const PILLAR_NAMES = [
  "origin",
  "emergence",
  "self-creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface MissionConstellationProps {
  labels?: boolean;
  fontSize?: number;
  heightRatio?: number;
  maxHeight?: number;
  maxHeightMobile?: number;
}

export function MissionConstellation({
  labels = true,
  fontSize = 13,
  heightRatio = 0.5,
  maxHeight = 380,
  maxHeightMobile = 320,
}: MissionConstellationProps) {
  const { sessionColor } = useSessionColor();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rgb = hexToRgb(sessionColor || "#B9D5FF");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let W = 0;
    let H = 0;
    let activeIndex = 0;
    const activeLevels = POS.map((_, i) => (i === activeIndex ? 1 : 0));
    const labelLevels = POS.map((_, i) => (i === activeIndex ? 1 : 0));
    let lastFrameT: number | null = null;

    // Width-dependent values recomputed in resize() (rotation/resize-safe).
    // pt() and findHoveredNode() both read these mutable closure vars so the
    // drawn geometry and hit-testing always stay in sync.
    let fontSizeNow = fontSize;
    let padTop = fontSizeNow + 8;
    let padBottom = fontSizeNow + 14;
    let padX = 12;

    const HEIGHT_RATIO = heightRatio;
    const maxH = maxHeight;
    const maxHMobile = maxHeightMobile;
    // Effective mobile cap is raised so the node band (ry 0.12→0.88) isn't
    // crushed into ~100–140px on short viewports.
    const MOBILE_HEIGHT_RATIO = 0.72;
    const MOBILE_MAX_HEIGHT = 360;
    const MOBILE_FONT_SIZE = 11;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas!.offsetWidth;
      const isMobile = window.innerWidth <= 780;
      const ratio = isMobile ? MOBILE_HEIGHT_RATIO : HEIGHT_RATIO;
      const effectiveMax = isMobile
        ? Math.max(maxHMobile, MOBILE_MAX_HEIGHT)
        : maxH;
      const computedH = Math.min(W * ratio, effectiveMax);
      H = computedH;
      // Smaller label font on the narrowest viewports.
      fontSizeNow = window.innerWidth <= 420 ? MOBILE_FONT_SIZE : fontSize;
      // Paddings reserve room for label extents so insetting keeps labels
      // (drawn above/below nodes) inside the canvas.
      padTop = fontSizeNow + 8;
      padBottom = fontSizeNow + 14;
      padX = 12;
      canvas!.style.height = computedH + "px";
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Map node coords into an inner, label-padded sub-rect (CSS-space px)
    // instead of edge-to-edge, so nodes + labels never reach the canvas edges.
    function pt(p: { rx: number; ry: number }) {
      return {
        x: padX + p.rx * (W - 2 * padX),
        y: padTop + p.ry * (H - padTop - padBottom),
      };
    }

    // ── entrance animation ────────────────────────────────────────────
    const revealEnabled = !reduceMotion;
    let revealStarted = false;
    let revealStartTime: number | null = null;
    const REVEAL_NODE_STAGGER = 140;
    const REVEAL_NODE_DURATION = 650;
    const REVEAL_PAUSE_AFTER_NODES = 300;
    const REVEAL_LINE_STAGGER = 220;
    const REVEAL_LINE_DURATION = 600;

    const allNodesDoneTime =
      (POS.length - 1) * REVEAL_NODE_STAGGER +
      REVEAL_NODE_DURATION +
      REVEAL_PAUSE_AFTER_NODES;
    const allLinesDoneTime =
      allNodesDoneTime +
      (LINES.length - 1) * REVEAL_LINE_STAGGER +
      REVEAL_LINE_DURATION;
    const WHOLE_GLOW_DELAY = 200;
    const WHOLE_GLOW_DURATION = 1100;
    const namesEnabledTime =
      allLinesDoneTime + WHOLE_GLOW_DELAY + WHOLE_GLOW_DURATION;

    function nodeRevealProgress(i: number, now: number) {
      if (!revealEnabled) return 1;
      if (!revealStarted) return 0;
      const start = revealStartTime! + i * REVEAL_NODE_STAGGER;
      const p = (now - start) / REVEAL_NODE_DURATION;
      return Math.max(0, Math.min(1, p));
    }
    function lineRevealProgress(lineIndex: number, now: number) {
      if (!revealEnabled) return 1;
      if (!revealStarted) return 0;
      const start =
        revealStartTime! + allNodesDoneTime + lineIndex * REVEAL_LINE_STAGGER;
      const p = (now - start) / REVEAL_LINE_DURATION;
      return Math.max(0, Math.min(1, p));
    }
    function wholeGlowLevel(now: number) {
      if (!revealEnabled || !revealStarted) return 0;
      const start = revealStartTime! + allLinesDoneTime + WHOLE_GLOW_DELAY;
      const p = (now - start) / WHOLE_GLOW_DURATION;
      if (p < 0 || p > 1) return 0;
      return Math.sin(p * Math.PI);
    }
    function namesEnabled(now: number) {
      if (!revealEnabled) return true;
      if (!revealStarted) return false;
      return now >= revealStartTime! + namesEnabledTime;
    }
    function ease(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    let observer: IntersectionObserver | null = null;
    if (revealEnabled && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !revealStarted) {
              revealStarted = true;
              revealStartTime = performance.now();
              observer!.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(canvas);
    } else {
      revealStarted = true;
      revealStartTime = -99999;
    }

    let animId = 0;
    let cancelled = false;
    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H);
      const now = performance.now();
      const dt = lastFrameT == null ? 16 : Math.min(48, t - lastFrameT);
      lastFrameT = t;
      const EASE_TAU = 760;
      const LABEL_EASE_TAU = 320;
      const easeFactor = 1 - Math.exp(-dt / EASE_TAU);
      const labelEaseFactor = 1 - Math.exp(-dt / LABEL_EASE_TAU);
      POS.forEach((_, i) => {
        const target = i === activeIndex ? 1 : 0;
        activeLevels[i] += (target - activeLevels[i]) * easeFactor;
        labelLevels[i] += (target - labelLevels[i]) * labelEaseFactor;
      });
      const wGlow = wholeGlowLevel(now);
      LINES.forEach((l, lineIndex) => {
        const lineProg = ease(lineRevealProgress(lineIndex, now));
        if (lineProg <= 0) return;
        const a = pt(POS[l.i]);
        const b = pt(POS[l.j]);
        const endX = a.x + (b.x - a.x) * lineProg;
        const endY = a.y + (b.y - a.y) * lineProg;
        const lineLvl = Math.max(
          activeLevels[l.i] || 0,
          activeLevels[l.j] || 0,
          wGlow
        );
        const basePulse = 0.09 + 0.04 * Math.sin(t * 0.0006 + l.i);
        const pulse = basePulse + 0.34 * lineLvl;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(endX, endY);
        ctx!.strokeStyle = `rgba(${rgb},${pulse * lineProg})`;
        ctx!.lineWidth = 0.7 + 0.6 * lineLvl;
        ctx!.stroke();
      });
      POS.forEach((p, i) => {
        const nodeProg = ease(nodeRevealProgress(i, now));
        if (nodeProg <= 0) return;
        const pos = pt(p);
        const lvl = Math.max(activeLevels[i], wGlow);
        const pulse = Math.sin(t * 0.0009 + i * 1.3);
        const baseR = i === 3 ? 6 : 4;
        const restR = baseR * (0.92 + pulse * 0.08);
        const activeR = baseR * 1.55 * (0.95 + pulse * 0.1);
        const r = (restR + (activeR - restR) * lvl) * nodeProg;
        const glowMult = 1 + 0.1 * lvl;
        const restGlow = 0.14 + pulse * 0.03;
        const activeGlow = 0.32 + pulse * 0.05;
        const glowAlpha = (restGlow + (activeGlow - restGlow) * lvl) * nodeProg;
        const glow = ctx!.createRadialGradient(
          pos.x,
          pos.y,
          0,
          pos.x,
          pos.y,
          r * 5 * glowMult
        );
        glow.addColorStop(0, `rgba(${rgb},${glowAlpha})`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, r * 5 * glowMult, 0, Math.PI * 2);
        ctx!.fillStyle = glow;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${rgb},${(0.9 + 0.1 * lvl) * nodeProg})`;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, r * 0.32, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,253,253,${0.95 * nodeProg})`;
        ctx!.fill();
      });
      if (labels && namesEnabled(now)) {
        labelLevels.forEach((lvl, i) => {
          if (lvl <= 0.03 || nodeRevealProgress(i, now) < 1) return;
          const pos = pt(POS[i]);
          const name = PILLAR_NAMES[i];
          ctx!.font = `600 ${fontSizeNow}px Plus Jakarta Sans, sans-serif`;
          ctx!.fillStyle = `rgba(${rgb},${0.95 * Math.min(1, lvl)})`;
          ctx!.textAlign = "center";
          // Safety-net clamping on top of the inset mapping.
          const halfTextWidth = ctx!.measureText(name).width / 2;
          // Clamp X so centered text never overruns left/right edges.
          const labelX = Math.max(
            halfTextWidth + 2,
            Math.min(W - halfTextWidth - 2, pos.x)
          );
          const belowY = pos.y + (fontSizeNow + 10);
          const aboveY = pos.y - (fontSizeNow + 4);
          let labelY = POS[i].ry > 0.7 ? belowY : aboveY;
          // Flip a top-label that would clip above; flip a bottom-label that
          // would clip below.
          if (labelY - fontSizeNow < 2) {
            labelY = belowY;
          } else if (labelY + 4 > H) {
            labelY = aboveY;
          }
          // Final clamp keeps the baseline inside the canvas.
          labelY = Math.max(fontSizeNow, Math.min(H - 4, labelY));
          ctx!.fillText(name, labelX, labelY);
        });
      }
      animId = requestAnimationFrame(draw);
    }

    // ── auto-cycle + hover takeover controller ────────────────────────
    let cycleIdx = 0;
    let hovering = false;
    let cycleInterval: ReturnType<typeof setInterval> | null = null;
    if (!reduceMotion) {
      cycleInterval = setInterval(() => {
        if (hovering) return;
        cycleIdx = (cycleIdx + 1) % POS.length;
        activeIndex = cycleIdx;
      }, 3400);
    }

    function findHoveredNode(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas!.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas!.height / rect.height);
      const dpr = window.devicePixelRatio || 1;
      let closestIdx = -1;
      let closestDist = 28 * dpr;
      POS.forEach((p, i) => {
        // Use the SAME inset mapping as pt() (CSS-space) scaled to device px,
        // so hit-testing lines up with the drawn nodes.
        const cs = pt(p);
        const px = cs.x * dpr;
        const py = cs.y * dpr;
        const d = Math.sqrt((mx - px) * (mx - px) + (my - py) * (my - py));
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      });
      return closestIdx;
    }
    function onMove(e: MouseEvent) {
      const idx = findHoveredNode(e);
      if (idx >= 0) {
        hovering = true;
        activeIndex = idx;
      } else if (hovering) {
        hovering = false;
      }
    }
    function onLeave() {
      hovering = false;
    }
    if (!reduceMotion) {
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseleave", onLeave);
    }

    window.addEventListener("resize", resize);
    resize();
    const reTimeout = setTimeout(resize, 250);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (cancelled) return;
          resize();
        })
        .catch(() => {});
    }
    animId = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      clearTimeout(reTimeout);
      if (cycleInterval) clearInterval(cycleInterval);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [sessionColor, labels, fontSize, heightRatio, maxHeight, maxHeightMobile]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", display: "block" }}
    />
  );
}
