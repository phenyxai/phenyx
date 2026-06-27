"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient twinkling starfield confined to the right band of the hero, so it
 * never renders on top of the hero title/tagline on the left. Stars stay
 * white (ambient, not session-tinted). Ported from the reference `starCanvas`.
 * Sits BEHIND <IdentityParticles/> in the hero (z-0). Hidden on mobile.
 */
export function HeroStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let stars: {
      x: number;
      y: number;
      r: number;
      baseAlpha: number;
      phase: number;
      speed: number;
    }[] = [];
    let animId = 0;

    function resize() {
      W = canvas!.width = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      stars = [];
      const n = Math.floor((W * H) / 7000);
      for (let i = 0; i < n; i++) {
        // keep ambient stars clear of the text column on the left (~0-58%)
        const x = W * 0.58 + Math.random() * W * 0.42;
        stars.push({
          x,
          y: Math.random() * H,
          r: 0.4 + Math.random() * 1.3,
          baseAlpha: 0.15 + Math.random() * 0.55,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0004 + Math.random() * 0.0009,
        });
      }
    }

    function paint(t: number) {
      ctx!.clearRect(0, 0, W, H);
      stars.forEach((s) => {
        const a = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,253,253,${a})`;
        ctx!.fill();
      });
    }

    function draw(t: number) {
      paint(t);
      animId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();

    if (reduceMotion) {
      paint(0);
    } else {
      animId = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="max-lg:hidden absolute inset-0 z-0"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
