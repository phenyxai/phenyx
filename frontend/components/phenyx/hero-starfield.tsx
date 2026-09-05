"use client";

import { useEffect, useRef } from "react";

export function HeroStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const element = canvas;
    const context = ctx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let stars: {
      x: number;
      y: number;
      radius: number;
      baseAlpha: number;
      phase: number;
      speed: number;
    }[] = [];
    let animId = 0;

    function resize() {
      width = element.offsetWidth;
      height = element.offsetHeight;
      element.width = width;
      element.height = height;
      stars = Array.from({ length: Math.floor((width * height) / 7000) }, () => ({
        x: width * 0.58 + Math.random() * width * 0.42,
        y: Math.random() * height,
        radius: 0.4 + Math.random() * 1.3,
        baseAlpha: 0.15 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0009,
      }));
    }

    function paint(time: number) {
      context.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        const alpha = reduceMotion
          ? star.baseAlpha
          : star.baseAlpha * (0.55 + 0.45 * Math.sin(time * star.speed + star.phase));
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,253,253,${alpha})`;
        context.fill();
      });
    }

    function draw(time: number) {
      paint(time);
      animId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();

    if (reduceMotion) paint(0);
    else animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="landing-vnext__hero-starfield"
    />
  );
}
