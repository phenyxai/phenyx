"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { constellationCopy } from "@/lib/landing-copy";

// ============================================================================
// AskPolarisWidget — landing "your constellation" rotating Q&A (PHE-25)
// ----------------------------------------------------------------------------
// Shows four HAND-CURATED example Q&As (one per pillar) to demonstrate what
// Polaris does before signup. These are marketing examples — NOT live Claude
// calls. There is NO backend, NO answer engine, NO `apiFetch`, and NO network
// request on render or dot-nav. The content below is a set of trusted, verbatim
// constants ported from the prototype (`phenyx full.html:3775-3827`).
//
// Bolding scope: this landing widget is the ONE surface permitted to render
// HTML bolding — the bolded final sentence is the punchline. That is why the
// ANSWER BODY (and only the answer body) is rendered via
// `dangerouslySetInnerHTML` from these trusted constants. Do NOT generalize
// this anywhere else (dashboard Polaris stays plain-text). The question is
// rendered as a plain React text node — it contains no markup.
// ============================================================================

interface QAEntry {
  pillar: string;
  /** Curated question, quotes included. Rendered as plain text (no markup). */
  q: string;
  /** Curated answer; the final sentence is wrapped in <b> (the punchline). */
  a: string;
  src1: string;
  src2: string;
  span: string;
}

// Verbatim curated content — trusted constants (see header note on bolding).
const ENTRIES: readonly QAEntry[] = [
  {
    pillar: "origin",
    q: '"why have the same three songs been on repeat for years whenever i\'m overwhelmed?"',
    a: "those songs were never comfort. they're a reset button. <b>you reach for them right before your best decisions, not your worst ones.</b>",
    src1: "spotify",
    src2: "youtube",
    span: "consistent pattern / 3+ years",
  },
  {
    pillar: "emergence",
    q: '"why did people start treating me differently before i felt like anything had changed?"',
    a: "they weren't reacting to something new. they were finally catching up to something that had been building for a while. <b>you were the last one to notice what everyone else could already see.</b>",
    src1: "instagram",
    src2: "github",
    span: "visible shift / building for months",
  },
  {
    pillar: "recognition",
    q: '"why do people open up to me so fast, even online?"',
    a: "you ask one real question before anyone expects it. most people wait for permission to be that direct. <b>you've just never needed it.</b>",
    src1: "reddit",
    src2: "linkedin",
    span: "40+ threads / recurring",
  },
  {
    pillar: "transcendence",
    q: '"why do i feel done with something i haven\'t even technically finished?"',
    a: "you're not done with the project. you're done with who you were when you started it. <b>that's a different ending than the one you've been bracing for.</b>",
    src1: "github",
    src2: "youtube",
    span: "shift detected / recent",
  },
];

const AUTO_MS = 6000;
const FADE_MS = 450;

export function AskPolarisWidget() {
  const { sessionColor } = useSessionColor();

  // `idx` drives what renders; `idxRef` is the timer-safe source of truth so the
  // auto-advance interval and dot handlers never read a stale closure value.
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const [faded, setFaded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resolved once on mount; when set, swaps happen instantly (fade skipped).
  const reducedMotionRef = useRef(false);

  // Fade out, swap content at FADE_MS, fade back in — mirrors the prototype.
  // Under reduced motion the swap is instant (no fade, no pending timeout).
  const goTo = useCallback((i: number) => {
    const next = ((i % ENTRIES.length) + ENTRIES.length) % ENTRIES.length;
    idxRef.current = next;

    if (reducedMotionRef.current) {
      setIdx(next);
      return;
    }

    setFaded(true);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIdx(next);
      setFaded(false);
    }, FADE_MS);
  }, []);

  // (Re)start the 6s auto-advance. Always clears the old interval first so a
  // manual jump can never leave two intervals firing.
  const startCycle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      goTo(idxRef.current + 1);
    }, AUTO_MS);
  }, [goTo]);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    startCycle();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [startCycle]);

  const entry = ENTRIES[idx];

  return (
    <div>
      {/* Lead — preserves the copy the mount point was seeded with. */}
      <p
        className="lowercase"
        style={{
          fontSize: "13px",
          letterSpacing: "0.08em",
          color: "rgba(255,253,253,0.55)",
          paddingTop: "24px",
        }}
      >
        {constellationCopy.polarisLead}
      </p>

      <div
        style={{
          marginTop: "20px",
          border: "1px solid rgba(255,253,253,0.08)",
          borderRadius: "16px",
          background: "#0D0D0C",
          padding: "32px 32px 26px",
        }}
      >
        <div
          style={{
            borderLeft: `2px solid ${sessionColor}`,
            paddingLeft: "20px",
            opacity: faded ? 0 : 1,
            transition: "opacity 0.45s ease",
          }}
        >
          {/* Pillar */}
          <p
            className="uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: "0.14em",
              fontWeight: 600,
              color: sessionColor,
              marginBottom: "14px",
            }}
          >
            {entry.pillar}
          </p>

          {/* Question — plain text (no markup); quotes are part of the copy. */}
          <p
            className="lowercase"
            style={{
              fontSize: "14px",
              fontStyle: "italic",
              color: "rgba(255,253,253,0.5)",
              marginBottom: "12px",
              lineHeight: 1.6,
            }}
          >
            {entry.q}
          </p>

          {/*
            Answer — the ONLY surface permitted to render HTML bolding. Content
            is a verbatim trusted constant from ENTRIES; the bolded final
            sentence is the punchline. Do not generalize this pattern.
          */}
          <p
            className="lowercase"
            style={{
              fontSize: "14px",
              fontWeight: 300,
              lineHeight: 1.75,
              color: "#FFFDFD",
            }}
            dangerouslySetInnerHTML={{ __html: entry.a }}
          />

          {/* Meta row — pillar-appropriate sources + span. */}
          <div
            className="lowercase"
            style={{
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span aria-hidden="true" style={metaDotStyle} />
            <span style={metaTextStyle}>{entry.src1}</span>
            <span aria-hidden="true" style={metaDotStyle} />
            <span style={metaTextStyle}>{entry.src2}</span>
            <span style={{ ...metaTextStyle, marginLeft: "auto" }}>
              {entry.span}
            </span>
          </div>
        </div>

        {/* Dot navigation — click jumps to that pillar and restarts the cycle. */}
        <div
          style={{
            display: "flex",
            gap: "7px",
            marginTop: "26px",
            paddingLeft: "22px",
          }}
        >
          {ENTRIES.map((e, i) => {
            const active = i === idx;
            return (
              <button
                key={e.pillar}
                type="button"
                aria-label={`show example ${i + 1}`}
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  goTo(i);
                  startCycle();
                }}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: active ? sessionColor : "rgba(255,253,253,0.18)",
                  transform: active ? "scale(1.25)" : "scale(1)",
                  transition: "background 0.3s ease, transform 0.3s ease",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const metaDotStyle = {
  width: "4px",
  height: "4px",
  borderRadius: "50%",
  background: "rgba(255,253,253,0.25)",
  flexShrink: 0,
} as const;

const metaTextStyle = {
  fontSize: "10px",
  letterSpacing: "0.04em",
  color: "rgba(255,253,253,0.5)",
} as const;

export default AskPolarisWidget;
