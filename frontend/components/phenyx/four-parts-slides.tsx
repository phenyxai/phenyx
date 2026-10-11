"use client";

import { useEffect, useRef, useState } from "react";
import {
  constellationMap,
  constellationStages,
  discoverFinds,
  howItWorksCopy,
  insightPatterns,
  polarisExample,
  type InsightVisual,
} from "@/lib/landing-copy";
import { onActivateKey } from "./landing-dom";

// The worked example inside each slide of the "how it works" orbit. Each time a
// slide comes round again it replays: the CSS keyed on the slide's
// `data-active` restarts its animations, the constellation forms again and
// returns to origin, and the Polaris answer writes itself again. What the reader opened or ticked
// in Polaris stays as they left it, as in the prototype.

export interface SlideExampleProps {
  active: boolean;
  /** The section's text has landed (the entrance gate); stories that run on their own wait for it. */
  ready: boolean;
  /** Pause the orbit's autoplay while someone is reading or clicking. */
  onHold: (ms: number) => void;
}

const SWAP_MS = 340;
// How long a click inside a slide holds the orbit still.
const HOLD_AFTER_STAGE_MS = 10000;
const HOLD_WHILE_READING_MS = 20000;
const TYPE_DELAY_MS = 1000;
const TYPE_TICK_MS = 22;
const TYPE_CHARS_PER_TICK = 2;
// The card floats in first: as a block it starts 0.16s after the section's
// text lands and needs about 0.45s more to show (v1600 waits the same).
const CARD_SETTLE_MS = 610;
// The last line finishes drawing at 1.6s + 6 × 0.15s + 0.6s: keep in step with
// the formation CSS. The point's content and the hint wait for it.
const FORMED_MS = 3100;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Chips({ sources, span, shown }: { sources: readonly string[]; span: string; shown?: boolean }) {
  return (
    <span className="landing-vnext__chips" data-shown={shown}>
      {sources.map((source) => <i key={source}>{source}</i>)}
      <em>{span}</em>
    </span>
  );
}

type Formation = "waiting" | "forming" | "formed";

export function ConstellationSlide({ active, ready, onHold }: SlideExampleProps) {
  const mapRef = useRef<SVGSVGElement>(null);
  const [seen, setSeen] = useState(false);
  const [formation, setFormation] = useState<Formation>("waiting");
  const [isTouch, setIsTouch] = useState(false);
  // `selected` lights the star at once; `shown` swaps the text after the fade.
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const wanted = useRef(0);
  const swapRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
    const map = mapRef.current;
    if (!map || !("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  // The constellation forms each time its slide comes up, once its card has
  // landed and the map is on screen; with reduced motion it is simply there.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setFormation("formed");
      return;
    }
    setFormation("waiting");
    if (!active || !ready || !seen) return;
    const timers = [
      setTimeout(() => setFormation("forming"), CARD_SETTLE_MS),
      setTimeout(() => setFormation("formed"), CARD_SETTLE_MS + FORMED_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, ready, seen]);

  // every visit starts again from origin
  useEffect(() => {
    if (!active) return;
    clearTimeout(swapRef.current);
    wanted.current = 0;
    setSelected(0);
    setShown(0);
    setIsSwapping(false);
  }, [active]);

  useEffect(() => () => clearTimeout(swapRef.current), []);

  // Hover, focus or a tap moves to a point; nothing advances on its own. The
  // old point fades fully out before the new one fades in.
  const select = (index: number) => {
    if (index === wanted.current) return;
    wanted.current = index;
    setSelected(index);
    clearTimeout(swapRef.current);
    if (prefersReducedMotion()) {
      setShown(index);
      return;
    }
    setIsSwapping(true);
    swapRef.current = setTimeout(() => {
      setShown(index);
      setIsSwapping(false);
    }, SWAP_MS);
  };
  const pick = (index: number) => {
    select(index);
    onHold(HOLD_AFTER_STAGE_MS);
  };

  return (
    <div className="landing-vnext__orbit-example landing-vnext__constellation" data-formation={formation}>
      <svg ref={mapRef} className="landing-vnext__stage-map" viewBox="0 0 300 170" aria-label={howItWorksCopy.stageMapLabel}>
        <defs>
          <radialGradient id="landing-star-bloom">
            <stop offset="0" stopColor="#cfe0ff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#b9d5ff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#b9d5ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="landing-vnext__stage-lines">
          {constellationMap.lines.map(([from, to], i) => {
            const [x1, y1] = constellationMap.stars[from];
            const [x2, y2] = constellationMap.stars[to];
            return (
              <line key={`${from}-${to}`} x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} style={{ "--i": i } as React.CSSProperties} />
            );
          })}
        </g>
        {constellationMap.stars.map(([cx, cy], index) => {
          const point = constellationStages[index];
          return (
            <g
              key={point.name}
              className="landing-vnext__stage-star"
              style={{ "--k": index } as React.CSSProperties}
              data-active={index === selected}
              role="button"
              tabIndex={0}
              aria-label={`${point.name}, ${point.era}`}
              aria-pressed={index === selected}
              onPointerEnter={(event) => { if (event.pointerType !== "touch") select(index); }}
              onFocus={() => select(index)}
              onClick={() => pick(index)}
              onKeyDown={onActivateKey(() => pick(index))}
            >
              <circle className="landing-vnext__stage-star-hit" cx={cx} cy={cy} r={12} />
              <circle className="landing-vnext__stage-star-glow" cx={cx} cy={cy} r={11} fill="url(#landing-star-bloom)" />
              <circle className="landing-vnext__stage-star-dot" cx={cx} cy={cy} r={3} />
            </g>
          );
        })}
      </svg>
      <div className="landing-vnext__stage-reveal">
        <p className="landing-vnext__stage-hint">{isTouch ? howItWorksCopy.stageHint.touch : howItWorksCopy.stageHint.hover}</p>
        {/* Every point sits in the same grid cell, so the card keeps the height of the tallest. */}
        <div className="landing-vnext__stage" data-swapping={isSwapping}>
          {constellationStages.map((stage, i) => (
            <div key={stage.name} className="landing-vnext__stage-point" data-shown={i === shown} aria-hidden={i !== shown}>
              <p className="landing-vnext__stage-label">
                <b>{stage.name}</b>{" "}
                <span>{stage.years ? `${stage.era} · ${stage.years}` : stage.era}</span>
              </p>
              <p className="landing-vnext__stage-question">{stage.question}</p>
              <p className="landing-vnext__stage-reading">{stage.reading}</p>
              <ul className="landing-vnext__stage-signals">
                {stage.signals.map((signal) => (
                  <li key={signal.when}>
                    <p className="landing-vnext__signal-meta"><span>{signal.platform}</span><span>{signal.when}</span></p>
                    <p>{signal.what}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightChart({ visual }: { visual: InsightVisual }) {
  if (visual.kind === "bars") {
    return (
      <div className="landing-vnext__bars" aria-hidden="true">
        {[...visual.pattern].map((bit, index) => (
          <i key={index} data-lit={bit === "1"} style={{ "--i": index } as React.CSSProperties} />
        ))}
      </div>
    );
  }
  return (
    <div className="landing-vnext__return" aria-hidden="true">
      <span />
      {visual.points.map((point, index) => (
        <b key={point.label} style={{ "--x": point.at, "--i": index } as React.CSSProperties} />
      ))}
      {visual.points.map((point, index) => (
        <u key={point.label} style={{ "--x": point.at, "--i": index } as React.CSSProperties}>{point.label}</u>
      ))}
    </div>
  );
}

export function InsightsSlide() {
  return (
    <div className="landing-vnext__orbit-example landing-vnext__insights">
      {insightPatterns.map((pattern) => (
        <article key={pattern.claim} className="landing-vnext__pattern">
          <p>{pattern.claim}</p>
          <InsightChart visual={pattern.visual} />
          <p className="landing-vnext__proof">{pattern.proof}</p>
          <Chips sources={pattern.sources} span={pattern.span} />
        </article>
      ))}
    </div>
  );
}

export function DiscoverSlide() {
  return (
    <div className="landing-vnext__orbit-example landing-vnext__finds">
      {discoverFinds.map((find) => (
        <article key={find.name} className="landing-vnext__find">
          <p className="landing-vnext__find-kind">{find.kind}</p>
          <p className="landing-vnext__find-name">{find.name}</p>
          <p className="landing-vnext__find-description">{find.description}</p>
          <p className="landing-vnext__find-why">{find.why}</p>
        </article>
      ))}
    </div>
  );
}

type PolarisView = "evidence" | "plan" | null;

export function PolarisSlide({ active, onHold }: SlideExampleProps) {
  const answer = polarisExample.answer;
  // Rendered whole until the slide is showing, so the server markup and a
  // reader without motion both get the full answer.
  const [typed, setTyped] = useState(answer.length);
  const [view, setView] = useState<PolarisView>(null);
  const [doneSteps, setDoneSteps] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setTyped(answer.length);
      return;
    }
    setTyped(0);
    let count = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        count = Math.min(answer.length, count + TYPE_CHARS_PER_TICK);
        setTyped(count);
        if (count >= answer.length) clearInterval(interval);
      }, TYPE_TICK_MS);
    }, TYPE_DELAY_MS);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [active, answer]);

  const isTyping = typed < answer.length;
  const showView = (next: PolarisView) => {
    setView(next);
    onHold(HOLD_WHILE_READING_MS);
  };
  const closeView = () => showView(null);
  const toggleStep = (index: number) => {
    setDoneSteps((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    onHold(HOLD_WHILE_READING_MS);
  };

  return (
    <div className="landing-vnext__orbit-example landing-vnext__polaris">
      <p className="landing-vnext__polaris-ask">{polarisExample.ask}</p>
      <p className="landing-vnext__polaris-answer" data-typing={isTyping}>
        <span className="sr-only">{answer}</span>
        <span aria-hidden="true">{answer.slice(0, typed)}</span>
      </p>
      <Chips sources={polarisExample.sources} span={polarisExample.span} shown={!isTyping} />
      <p className="landing-vnext__polaris-next" data-shown={!isTyping}>
        <button type="button" aria-pressed={view === "evidence"} onClick={() => showView("evidence")}>
          {polarisExample.evidence.label}
        </button>
        <button type="button" aria-pressed={view === "plan"} onClick={() => showView("plan")}>
          {polarisExample.plan.label}
        </button>
      </p>
      {view ? (
        <div className="landing-vnext__polaris-view" key={view}>
          {view === "evidence" ? (
            <>
              <p className="landing-vnext__polaris-view-title">{polarisExample.evidence.title}</p>
              {polarisExample.evidence.rows.map(([source, detail]) => (
                <div key={source} className="landing-vnext__polaris-evidence">
                  <span>{source}</span>
                  <p>{detail}</p>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="landing-vnext__polaris-view-title">{polarisExample.plan.title}</p>
              {polarisExample.plan.steps.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  className="landing-vnext__polaris-step"
                  aria-pressed={doneSteps.has(index)}
                  onClick={() => toggleStep(index)}
                >
                  <i aria-hidden="true" />
                  <span>{step}</span>
                </button>
              ))}
            </>
          )}
          <button type="button" className="landing-vnext__polaris-back" onClick={closeView}>
            {polarisExample.backLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
