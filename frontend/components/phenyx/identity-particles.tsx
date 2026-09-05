"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  r: number;
  baseAlpha: number;
  driftPhaseX: number;
  driftPhaseY: number;
  driftRatio: number;
  driftPhase2: number;
  driftSpeed: number;
  driftAmp: number;
  gatherLag: number;
};

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = width || canvas.offsetWidth || canvas.clientWidth || 300;
  const h = height || canvas.offsetHeight || canvas.clientHeight || 150;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}

function safeR(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0.01;
}

function inHeroDeadZone(x: number, y: number, w: number, h: number) {
  return y < h * 0.12 || x < w * 0.52;
}

/**
 * Exact port of the HTML prototype hero particle cluster
 * (mouse-follow stellar field on the right side of the hero).
 */
export function IdentityParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    const fieldNode = fieldRef.current;
    if (!canvasNode || !fieldNode) return;
    const context = canvasNode.getContext("2d");
    if (!context) return;

    const canvas: HTMLCanvasElement = canvasNode;
    const field: HTMLDivElement = fieldNode;
    const ctx: CanvasRenderingContext2D = context;

    let W = 0;
    let H = 0;
    let mouseX: number | null = null;
    let mouseY: number | null = null;
    let mouseActive = false;
    let animId = 0;
    let cueBox: DOMRect | null = null;
    let fieldT0: number | null = null;
    let onScreen = true;

    const FIELD_MIN_X = 0.225;
    const FIELD_MIN_Y = 0.135;
    const CL_CX = 0.578;
    const CL_CY = 0.56;
    const CL_RX = 0.35;
    const CL_RY = 0.31;
    const MAX_R = 3.4;
    const GLOW_MULT = 4.6;
    const MAX_DRIFT = 30;
    const SAFE_PAD = MAX_R * GLOW_MULT + MAX_DRIFT + 6;
    const PARTICLE_COUNT = 124;
    const FIELD_WAKE_MS = 550;
    const FIELD_WAKE_DUR = 1900;
    const GATHER_RADIUS = 260;
    const GATHER_STRENGTH = 0.05;
    const RETURN_STRENGTH = 0.025;

    const particles: Particle[] = [];
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.target === canvas) onScreen = entry.isIntersecting;
              });
            },
            { rootMargin: "120px" },
          )
        : null;
    if (io) io.observe(canvas);

    function fieldWake(now: number) {
      if (fieldT0 === null) fieldT0 = now;
      const t = (now - fieldT0 - FIELD_WAKE_MS) / FIELD_WAKE_DUR;
      if (t <= 0) return 0.12;
      if (t >= 1) return 1;
      return 0.12 + 0.88 * (1 - Math.pow(1 - t, 3));
    }

    function measureCue() {
      const el = document.querySelector(".landing-vnext__scroll-cue");
      cueBox = el ? el.getBoundingClientRect() : null;
    }

    function resize() {
      if (!field.clientWidth || !field.clientHeight) {
        W = 0;
        H = 0;
        return;
      }
      const metrics = sizeCanvas(canvas, field.clientWidth, field.clientHeight);
      W = metrics.w;
      H = metrics.h;
    }

    function initParticles() {
      particles.length = 0;
      if (!W || !H) return;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.62);
        const x = W * CL_CX + Math.cos(ang) * W * CL_RX * rad;
        const y = H * CL_CY + Math.sin(ang) * H * CL_RY * rad;
        particles.push({
          x,
          y,
          homeX: x,
          homeY: y,
          r: rand(1.6, 3.4) * (1 - 0.3 * rad),
          baseAlpha: rand(0.16, 0.37) * (1 - 0.45 * rad),
          driftPhaseX: rand(0, Math.PI * 2),
          driftPhaseY: rand(0, Math.PI * 2),
          driftRatio: rand(0.58, 1.47),
          driftPhase2: rand(0, Math.PI * 2),
          driftSpeed: rand(0.00009, 0.00024),
          driftAmp: rand(10, 20),
          gatherLag: rand(0.6, 1.4),
        });
      }
    }

    const onMove = (event: MouseEvent) => {
      const rect = field.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
      mouseActive = true;
    };
    const onLeave = () => {
      mouseActive = false;
    };
    const onResize = () => {
      resize();
      measureCue();
      initParticles();
    };

    function draw(t: number) {
      if (!W || !H || document.hidden || !onScreen) {
        animId = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, W, H);
      const wake = fieldWake(performance.now());
      const hero = document.getElementById("s0-top");

      for (const p of particles) {
        const s2 = p.driftSpeed * 0.37;
        const a2 = p.driftAmp * 0.45;
        const driftX =
          Math.sin(t * p.driftSpeed + p.driftPhaseX) * p.driftAmp +
          Math.sin(t * s2 + p.driftPhase2) * a2;
        const driftY =
          Math.cos(t * p.driftSpeed * p.driftRatio + p.driftPhaseY) * p.driftAmp +
          Math.cos(t * s2 * 1.31 + p.driftPhase2) * a2;
        const targetX = p.homeX + driftX;
        const targetY = p.homeY + driftY;

        if (mouseActive && mouseX != null && mouseY != null) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / GATHER_RADIUS);
          const eased = proximity * proximity;
          const pull = eased * GATHER_STRENGTH * p.gatherLag;
          const gatherX = p.x + dx * pull;
          const gatherY = p.y + dy * pull;
          const returnX = p.x + (targetX - p.x) * RETURN_STRENGTH;
          const returnY = p.y + (targetY - p.y) * RETURN_STRENGTH;
          p.x = gatherX * eased + returnX * (1 - eased);
          p.y = gatherY * eased + returnY * (1 - eased);
        } else {
          p.x += (targetX - p.x) * RETURN_STRENGTH;
          p.y += (targetY - p.y) * RETURN_STRENGTH;
        }

        p.x = Math.min(Math.max(p.x, SAFE_PAD), W - SAFE_PAD);
        p.y = Math.min(Math.max(p.y, SAFE_PAD), H - SAFE_PAD);
        const MIN_X = W * FIELD_MIN_X;
        const MIN_Y = H * FIELD_MIN_Y;
        if (p.x < MIN_X) p.x = MIN_X;
        if (p.y < MIN_Y) p.y = MIN_Y;

        if (cueBox) {
          const fr = field.getBoundingClientRect();
          const cx = p.x + fr.left;
          const cy = p.y + fr.top;
          if (
            cx > cueBox.left - 46 &&
            cx < cueBox.right + 46 &&
            cy > cueBox.top - 34 &&
            cy < cueBox.bottom + 34
          ) {
            continue;
          }
        }

        if (hero) {
          const fr = field.getBoundingClientRect();
          const hr = hero.getBoundingClientRect();
          if (
            hr.width &&
            hr.height &&
            inHeroDeadZone(fr.left - hr.left + p.x, fr.top - hr.top + p.y, hr.width, hr.height)
          ) {
            continue;
          }
        }

        const gr = p.r * GLOW_MULT;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, safeR(gr));
        glow.addColorStop(0, `rgba(157,188,239,${p.baseAlpha * 0.55 * wake})`);
        glow.addColorStop(0.4, `rgba(157,188,239,${p.baseAlpha * 0.16 * wake})`);
        glow.addColorStop(1, "rgba(157,188,239,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185,213,255,${Math.min(0.52, p.baseAlpha + 0.14) * wake})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    field.addEventListener("mousemove", onMove);
    field.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);
    resize();
    measureCue();
    initParticles();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      field.removeEventListener("mousemove", onMove);
      field.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={fieldRef} className="landing-vnext__hero-particles" aria-hidden="true">
      <canvas ref={canvasRef} className="landing-vnext__hero-particles-canvas" />
    </div>
  );
}
