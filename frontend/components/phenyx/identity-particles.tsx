"use client";

import { useEffect, useRef } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

export function IdentityParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sessionColor } = useSessionColor();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context = ctx;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const COUNT = 100;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 1.5,
      baseOpacity: 0.15 + Math.random() * 0.3,
      opacity: 0.15 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      pulseOffset: Math.random() * Math.PI * 2,
      pulseSpeed: 0.003 + Math.random() * 0.005,
    }));

    let mouse: { x: number; y: number } | null = null;
    let animId: number;

    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onLeave = () => {
      mouse = null;
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    function hexToRgb(hex: string) {
      const red = parseInt(hex.slice(1, 3), 16);
      const green = parseInt(hex.slice(3, 5), 16);
      const blue = parseInt(hex.slice(5, 7), 16);
      return `${red},${green},${blue}`;
    }

    const rgb = hexToRgb(sessionColor || "#FFFDFD");

    function tick() {
      context.clearRect(0, 0, W, H);

      particles.forEach((particle) => {
        particle.pulseOffset += particle.pulseSpeed;
        const pulse = (Math.sin(particle.pulseOffset) + 1) / 2;

        if (mouse) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150 && distance > 20) {
            const force = ((150 - distance) / 150) * 0.8;
            particle.vx += (dx / distance) * force * 0.1;
            particle.vy += (dy / distance) * force * 0.1;
          }
          const mouseDistance = Math.sqrt(
            (mouse.x - particle.x) ** 2 + (mouse.y - particle.y) ** 2,
          );
          particle.opacity =
            particle.baseOpacity +
            (0.9 - particle.baseOpacity) * Math.max(0, (150 - mouseDistance) / 150);
        } else {
          particle.opacity = particle.baseOpacity + pulse * 0.2;
          particle.vx *= 0.98;
          particle.vy *= 0.98;
        }

        particle.vx = Math.max(-1.5, Math.min(1.5, particle.vx));
        particle.vy = Math.max(-1.5, Math.min(1.5, particle.vy));

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0) particle.x = W;
        if (particle.x > W) particle.x = 0;
        if (particle.y < 0) particle.y = H;
        if (particle.y > H) particle.y = 0;

        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${rgb},${particle.opacity})`;
        context.fill();
      });

      animId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [sessionColor]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
