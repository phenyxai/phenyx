"use client";

import { useEffect, useRef } from "react";

const PARTICLE_RGB = "157,188,239";
const STELLAR_RGB = "185,213,255";
const HERO_PARTICLE_COUNT = 124;
const FIELD_MIN_X = 0.225;
const FIELD_MIN_Y = 0.135;
const CLUSTER_CENTER_X = 0.578;
const CLUSTER_CENTER_Y = 0.56;
const CLUSTER_RADIUS_X = 0.35;
const CLUSTER_RADIUS_Y = 0.31;
const MAX_RADIUS = 3.4;
const GLOW_MULTIPLIER = 4.6;
const MAX_DRIFT = 30;
const SAFE_PADDING = MAX_RADIUS * GLOW_MULTIPLIER + MAX_DRIFT + 6;
const FIELD_WAKE_DELAY = 550;
const FIELD_WAKE_DURATION = 1900;
const GATHER_RADIUS = 260;
const GATHER_STRENGTH = 0.05;
const RETURN_STRENGTH = 0.025;

interface HeroParticle {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  radius: number;
  baseAlpha: number;
  driftPhaseX: number;
  driftPhaseY: number;
  driftRatio: number;
  driftPhase2: number;
  driftSpeed: number;
  driftAmplitude: number;
  gatherLag: number;
}

interface AmbientStar {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function isInHeroDeadZone(x: number, y: number, width: number, height: number) {
  return y < height * 0.12 || x < width * 0.52;
}

export function IdentityParticles({ prefersReducedMotion = false }: { prefersReducedMotion?: boolean }) {
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = backgroundRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < 80; index += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        if (x < canvas.width * 0.62 || y < canvas.height * 0.42) continue;
        const radius = Math.random() * 0.6 + 0.1;
        const alpha = 0.03 + Math.random() * 0.12;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${STELLAR_RGB},${alpha})`;
        context.fill();
      }
    };

    draw();
    const delayedDraw = window.setTimeout(draw, 400);
    window.addEventListener("resize", draw);
    window.addEventListener("load", draw);
    return () => {
      window.clearTimeout(delayedDraw);
      window.removeEventListener("resize", draw);
      window.removeEventListener("load", draw);
    };
  }, []);

  useEffect(() => {
    const canvas = starsRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let stars: AmbientStar[] = [];
    let frame = 0;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      stars = Array.from({ length: Math.floor((width * height) / 2200) }, () => ({
        x: width * 0.2 + Math.random() * width * 0.8,
        y: Math.pow(Math.random(), 1.5) * height * 0.92,
        radius: 0.5 + Math.random() * 1.4,
        baseAlpha: 0.22 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0009,
      }));
    };

    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);
      const rect = canvas.getBoundingClientRect();
      for (const star of stars) {
        if (isInHeroDeadZone(star.x, star.y, width, height)) continue;
        const screenX = rect.left + (star.x / width) * rect.width;
        const screenY = rect.top + (star.y / height) * rect.height;
        if (screenX < window.innerWidth * 0.52 && screenY < window.innerHeight * 0.6) continue;
        if (screenY < 66) continue;

        const alpha = prefersReducedMotion
          ? star.baseAlpha * 0.78
          : star.baseAlpha * (0.55 + 0.45 * Math.sin(time * star.speed + star.phase));
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,253,253,${alpha})`;
        context.fill();
      }
    };

    const animate = (time: number) => {
      paint(time);
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    if (prefersReducedMotion) paint(0);
    else frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const field = fieldRef.current?.parentElement;
    const canvas = clusterRef.current;
    const context = canvas?.getContext("2d");
    if (!field || !canvas || !context) return;

    let width = 0;
    let height = 0;
    let mouseX: number | null = null;
    let mouseY: number | null = null;
    let mouseActive = false;
    let particles: HeroParticle[] = [];
    let cueBox: DOMRect | null = null;
    let fieldStartedAt: number | null = null;
    let frame = 0;

    const measureCue = () => {
      cueBox = document.querySelector(".landing-v66__scroll-cue")?.getBoundingClientRect() ?? null;
    };

    const resize = () => {
      width = field.clientWidth;
      height = field.clientHeight;
      canvas.width = width;
      canvas.height = height;
      measureCue();
      particles = Array.from({ length: HERO_PARTICLE_COUNT }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radialDistance = Math.pow(Math.random(), 0.62);
        const x = width * CLUSTER_CENTER_X + Math.cos(angle) * width * CLUSTER_RADIUS_X * radialDistance;
        const y = height * CLUSTER_CENTER_Y + Math.sin(angle) * height * CLUSTER_RADIUS_Y * radialDistance;
        return {
          x,
          y,
          homeX: x,
          homeY: y,
          radius: randomBetween(1.6, 3.4) * (1 - 0.3 * radialDistance),
          baseAlpha: randomBetween(0.16, 0.37) * (1 - 0.45 * radialDistance),
          driftPhaseX: randomBetween(0, Math.PI * 2),
          driftPhaseY: randomBetween(0, Math.PI * 2),
          driftRatio: randomBetween(0.58, 1.47),
          driftPhase2: randomBetween(0, Math.PI * 2),
          driftSpeed: randomBetween(0.00009, 0.00024),
          driftAmplitude: randomBetween(10, 20),
          gatherLag: randomBetween(0.6, 1.4),
        };
      });
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = field.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
      mouseActive = true;
    };
    const onMouseLeave = () => {
      mouseActive = false;
    };

    const fieldWake = (time: number) => {
      if (prefersReducedMotion) return 1;
      if (fieldStartedAt === null) fieldStartedAt = time;
      const progress = (time - fieldStartedAt - FIELD_WAKE_DELAY) / FIELD_WAKE_DURATION;
      if (progress <= 0) return 0.12;
      if (progress >= 1) return 1;
      return 0.12 + 0.88 * (1 - Math.pow(1 - progress, 3));
    };

    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);
      const wake = fieldWake(time);
      const fieldRect = field.getBoundingClientRect();
      const heroRect = field.closest(".landing-v66__hero")?.getBoundingClientRect();

      for (const particle of particles) {
        const slowerSpeed = particle.driftSpeed * 0.37;
        const slowerAmplitude = particle.driftAmplitude * 0.45;
        const driftX = Math.sin(time * particle.driftSpeed + particle.driftPhaseX) * particle.driftAmplitude
          + Math.sin(time * slowerSpeed + particle.driftPhase2) * slowerAmplitude;
        const driftY = Math.cos(time * particle.driftSpeed * particle.driftRatio + particle.driftPhaseY) * particle.driftAmplitude
          + Math.cos(time * slowerSpeed * 1.31 + particle.driftPhase2) * slowerAmplitude;
        const targetX = particle.homeX + (prefersReducedMotion ? 0 : driftX);
        const targetY = particle.homeY + (prefersReducedMotion ? 0 : driftY);

        if (!prefersReducedMotion && mouseActive && mouseX !== null && mouseY !== null) {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.hypot(dx, dy);
          const proximity = Math.max(0, 1 - distance / GATHER_RADIUS);
          const eased = proximity * proximity;
          const pull = eased * GATHER_STRENGTH * particle.gatherLag;
          const gatherX = particle.x + dx * pull;
          const gatherY = particle.y + dy * pull;
          const returnX = particle.x + (targetX - particle.x) * RETURN_STRENGTH;
          const returnY = particle.y + (targetY - particle.y) * RETURN_STRENGTH;
          particle.x = gatherX * eased + returnX * (1 - eased);
          particle.y = gatherY * eased + returnY * (1 - eased);
        } else {
          particle.x += (targetX - particle.x) * RETURN_STRENGTH;
          particle.y += (targetY - particle.y) * RETURN_STRENGTH;
        }

        particle.x = Math.min(Math.max(particle.x, SAFE_PADDING), width - SAFE_PADDING);
        particle.y = Math.min(Math.max(particle.y, SAFE_PADDING), height - SAFE_PADDING);
        particle.x = Math.max(particle.x, width * FIELD_MIN_X);
        particle.y = Math.max(particle.y, height * FIELD_MIN_Y);

        const screenX = particle.x + fieldRect.left;
        const screenY = particle.y + fieldRect.top;
        if (
          cueBox
          && screenX > cueBox.left - 46
          && screenX < cueBox.right + 46
          && screenY > cueBox.top - 34
          && screenY < cueBox.bottom + 34
        ) continue;

        if (
          heroRect
          && isInHeroDeadZone(
            fieldRect.left - heroRect.left + particle.x,
            fieldRect.top - heroRect.top + particle.y,
            heroRect.width,
            heroRect.height,
          )
        ) continue;

        const glowRadius = particle.radius * GLOW_MULTIPLIER;
        const glow = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          glowRadius,
        );
        glow.addColorStop(0, `rgba(${PARTICLE_RGB},${particle.baseAlpha * 0.55 * wake})`);
        glow.addColorStop(0.4, `rgba(${PARTICLE_RGB},${particle.baseAlpha * 0.16 * wake})`);
        glow.addColorStop(1, `rgba(${PARTICLE_RGB},0)`);
        context.beginPath();
        context.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
        context.fillStyle = glow;
        context.fill();

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${STELLAR_RGB},${Math.min(0.52, particle.baseAlpha + 0.14) * wake})`;
        context.fill();
      }
    };

    const animate = (time: number) => {
      paint(time);
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    if (prefersReducedMotion) paint(performance.now());
    else {
      field.addEventListener("mousemove", onMouseMove);
      field.addEventListener("mouseleave", onMouseLeave);
      frame = window.requestAnimationFrame(animate);
    }
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      field.removeEventListener("mousemove", onMouseMove);
      field.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReducedMotion]);

  return (
    <>
      <canvas ref={backgroundRef} className="landing-v66__background-particles" aria-hidden="true" />
      <canvas ref={starsRef} className="landing-v66__hero-stars" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />
      <div ref={fieldRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} aria-hidden="true">
        <canvas ref={clusterRef} className="landing-v66__hero-particle-cluster" />
      </div>
    </>
  );
}
