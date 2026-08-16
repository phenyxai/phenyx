"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { constellationCopy } from "@/lib/landing-copy";

const AUTO_MS = 6000;

export function AskPolarisWidget() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

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
      timerRef.current = setInterval(
        () => setIndex((current) => (current + 1) % constellationCopy.polarisExamples.length),
        AUTO_MS,
      );
    }
    return stop;
  }, [isPaused, reducedMotion, stop]);

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
      <div className="landing-v66__polaris-qa">
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
            onClick={() => setIndex(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
