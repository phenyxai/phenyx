"use client";

import { useEffect, useState } from "react";
import { constellationCopy } from "@/lib/landing-copy";

const points = [
  { name: "origin", x: 12, y: 88 },
  { name: "emergence", x: 37, y: 87 },
  { name: "self-creation", x: 18, y: 47 },
  { name: "convergence", x: 38, y: 52 },
  { name: "becoming", x: 61, y: 48 },
  { name: "recognition", x: 80, y: 39 },
  { name: "transcendence", x: 88, y: 12 },
] as const;

const lines = [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [3, 5]] as const;

export function LandingConstellation() {
  const [active, setActive] = useState(-1);
  const [hovered, setHovered] = useState(-1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let index = 0;
    const timeout = window.setTimeout(() => {
      setActive(0);
      index = 0;
    }, 2800);
    const interval = window.setInterval(() => {
      index = (index + 1) % points.length;
      setActive(index);
    }, 2900);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const highlighted = hovered >= 0 ? hovered : active;

  return (
    <figure className="landing-vnext__constellation" aria-label={constellationCopy.visualizationLabel}>
      <svg viewBox="0 0 100 100" role="img">
        <defs>
          <filter id="landing-node-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {lines.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={points[from].x} y1={points[from].y}
            x2={points[to].x} y2={points[to].y}
            data-lit={highlighted === from || highlighted === to}
          />
        ))}
        {points.map((point, index) => (
          <g
            key={point.name}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(-1)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(-1)}
            tabIndex={0}
            aria-label={point.name}
          >
            <circle className="landing-vnext__node-hit" cx={point.x} cy={point.y} r="5" />
            <circle className="landing-vnext__node" cx={point.x} cy={point.y} r={highlighted === index ? 1.5 : 0.8} data-lit={highlighted === index} />
          </g>
        ))}
      </svg>
      <figcaption data-visible={hovered >= 0}>{hovered >= 0 ? points[hovered].name : ""}</figcaption>
    </figure>
  );
}
