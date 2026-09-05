"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { polarisCopy } from "@/lib/landing-copy";

const AUTO_MS = 6000;
const FADE_MS = 340;

export function AskPolarisWidget() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
  }, [index, stop]);

  useEffect(() => {
    stop();
    if (!isPaused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timerRef.current = setTimeout(() => select((index + 1) % polarisCopy.examples.length), AUTO_MS);
    }
    return stop;
  }, [index, isPaused, restartKey, select, stop]);

  useEffect(() => () => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
  }, []);

  const entry = polarisCopy.examples[index];
  const emphasisAt = entry.answer.indexOf(entry.emphasis);

  return (
    <div
      className="landing-vnext__polaris-card"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsPaused(false);
      }}
    >
      <div data-fading={isFading}>
        <p className="landing-vnext__polaris-pillar">{entry.pillar}</p>
        <p className="landing-vnext__polaris-question">{entry.question}</p>
        <p className="landing-vnext__polaris-answer">
          {entry.answer.slice(0, emphasisAt)}<strong>{entry.emphasis}</strong>{entry.answer.slice(emphasisAt + entry.emphasis.length)}
        </p>
        <div className="landing-vnext__polaris-meta">
          {entry.sources.map((source) => <span key={source}><i />{source}</span>)}
          <span className="landing-vnext__polaris-span">{entry.span}</span>
        </div>
      </div>
      <div className="landing-vnext__polaris-dots" aria-label="Polaris examples">
        {polarisCopy.examples.map((example, dotIndex) => (
          <button key={example.pillar} type="button" aria-label={`show ${example.pillar} example`} aria-current={dotIndex === index ? "true" : undefined} onClick={() => select(dotIndex)} />
        ))}
      </div>
    </div>
  );
}
