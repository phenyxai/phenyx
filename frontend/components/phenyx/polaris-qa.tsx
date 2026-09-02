"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

/**
 * "Dig deeper with polaris" rotating Q&A card. Ported from the reference
 * `usecaseQA`: auto-advances through four examples every 6000ms with a 450ms
 * crossfade; the dots are clickable and reset the cycle. The answer contains a
 * trusted inline <b> emphasis rendered via dangerouslySetInnerHTML. Left
 * border, pillar text, and active dot use the session color.
 */

interface Entry {
  pillar: string;
  q: string;
  a: string;
  src1: string;
  src2: string;
  span: string;
}

const ENTRIES: Entry[] = [
  {
    pillar: "convergence",
    q: '"am i moving as fast as i think i am?"',
    a: "you tend to describe the work as fast, but what you save and return to has slowed steadily across three years, on both accounts.",
    src1: "spotify",
    src2: "pinterest",
    span: "3 years / 2 sources",
  },
];

const AUTO_MS = 6000;
const FADE_MS = 450;

export function PolarisQA() {
  const { sessionColor } = useSessionColor();
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const idxRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotionRef = useRef(false);

  const goTo = (i: number) => {
    const next = (i + ENTRIES.length) % ENTRIES.length;
    if (reduceMotionRef.current) {
      // no crossfade under reduced motion — switch instantly
      idxRef.current = next;
      setIdx(next);
      setFading(false);
      return;
    }
    setFading(true);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      idxRef.current = next;
      setIdx(next);
      setFading(false);
    }, FADE_MS);
  };

  const startCycle = () => {
    if (reduceMotionRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      goTo(idxRef.current + 1);
    }, AUTO_MS);
  };

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    startCycle();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDot = (i: number) => {
    goTo(i);
    startCycle();
  };

  const e = ENTRIES[idx];

  return (
    <div
      style={{
        border: "1px solid #2e2e2e",
        borderRadius: "16px",
        background: "#121212",
        padding: "36px 40px",
        position: "relative",
        overflow: "hidden",
        marginTop: "24px",
      }}
    >
      <div
        style={{
          borderLeft: `2px solid ${sessionColor}`,
          paddingLeft: "20px",
          transition: "opacity .45s ease",
          opacity: fading ? 0 : 1,
        }}
      >
        <p
          className="uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "0.14em",
            color: sessionColor,
            marginBottom: "14px",
            fontWeight: 600,
          }}
        >
          {e.pillar}
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "#999",
            fontStyle: "italic",
            marginBottom: "12px",
          }}
        >
          {e.q}
        </p>
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.75,
            color: "#FFFDFD",
            fontWeight: 300,
          }}
          dangerouslySetInnerHTML={{ __html: e.a }}
        />
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: "#333",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "10px", color: "#888", letterSpacing: "0.04em" }}>
            {e.src1}
          </span>
          <span
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: "#333",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "10px", color: "#888", letterSpacing: "0.04em" }}>
            {e.src2}
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "#888",
              letterSpacing: "0.04em",
              marginLeft: "auto",
            }}
          >
            {e.span}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "7px", marginTop: "26px", paddingLeft: "22px" }}>
        {ENTRIES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`show example ${i + 1}`}
            onClick={() => handleDot(i)}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: i === idx ? sessionColor : "#2a2a2a",
              transform: i === idx ? "scale(1.25)" : "scale(1)",
              transition: "background .3s, transform .3s",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
