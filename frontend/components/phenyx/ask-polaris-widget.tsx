"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { constellationCopy } from "@/lib/landing-copy";

const AUTO_MS = 6000;
const FADE_MS = 340;

export function AskPolarisWidget() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const select = useCallback((nextIndex: number) => {
    stop();
    if (nextIndex === index) {
      setRestartKey((key) => key + 1);
      return;
    }
    if (fadeRef.current) clearTimeout(fadeRef.current);
    if (reducedMotion) {
      setIndex(nextIndex);
      setIsFading(false);
      return;
    }
    setIsFading(true);
    fadeRef.current = setTimeout(() => {
      setIndex(nextIndex);
      setIsFading(false);
      fadeRef.current = null;
    }, FADE_MS);
  }, [index, reducedMotion, stop]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    stop();
    if (!reducedMotion && !isPaused) {
      timerRef.current = setTimeout(
        () => select((index + 1) % constellationCopy.polarisExamples.length),
        AUTO_MS,
      );
    }
    return stop;
  }, [index, isPaused, reducedMotion, restartKey, select, stop]);

  useEffect(() => () => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
  }, []);

  const entry = constellationCopy.polarisExamples[index];
  const emphasisAt = entry.answer.indexOf(entry.emphasis);
  const answerStart = emphasisAt >= 0 ? entry.answer.slice(0, emphasisAt) : entry.answer;
  const answerEnd = emphasisAt >= 0 ? entry.answer.slice(emphasisAt + entry.emphasis.length) : "";

  return (
    <div
      className="landing-v66__polaris-card"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsPaused(false);
      }}
    >
      <div className={`landing-v66__polaris-qa${isFading ? " fading" : ""}`}>
        <p className="landing-v66__polaris-pillar">{entry.pillar}</p>
        <p className="landing-v66__polaris-question">{entry.question}</p>
        <p className="landing-v66__polaris-answer">{answerStart}<strong>{entry.emphasis}</strong>{answerEnd}</p>
        <div className="landing-v66__polaris-meta">
          {entry.sources.map((source) => (
            <span className="landing-v66__polaris-source" key={source}><i aria-hidden="true" />{source}</span>
          ))}
          <span className="landing-v66__polaris-span">{entry.span}</span>
        </div>
      </div>
      <div className="landing-v66__polaris-dots" aria-label="Polaris examples">
        {constellationCopy.polarisExamples.map((example, dotIndex) => (
          <button
            key={example.pillar}
            type="button"
            aria-label={`show ${example.pillar} example`}
            aria-current={dotIndex === index ? "true" : undefined}
            onClick={() => select(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
