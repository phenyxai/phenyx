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
// `data-active` restarts its animations, the stage viewer returns to origin,
// and the Polaris answer writes itself again. What the reader opened or ticked
// in Polaris stays as they left it, as in the prototype.

export interface SlideExampleProps {
  active: boolean;
  /** Pause the orbit's autoplay while someone is reading or clicking. */
  onHold: (ms: number) => void;
}

const SWAP_MS = 300;
// How long a click inside a slide holds the orbit still.
const HOLD_AFTER_STAGE_MS = 10000;
const HOLD_WHILE_READING_MS = 20000;
const TYPE_DELAY_MS = 1000;
const TYPE_TICK_MS = 22;
const TYPE_CHARS_PER_TICK = 2;

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

export function ConstellationSlide({ active, onHold }: SlideExampleProps) {
  // `selected` lights the star at once; `shown` swaps the text after the fade.
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const swapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // every visit starts again from origin
  useEffect(() => {
    if (!active) return;
    if (swapRef.current) clearTimeout(swapRef.current);
    setSelected(0);
    setShown(0);
    setIsSwapping(false);
  }, [active]);

  useEffect(() => () => {
    if (swapRef.current) clearTimeout(swapRef.current);
  }, []);

  const pick = (index: number) => {
    onHold(HOLD_AFTER_STAGE_MS);
    setSelected(index);
    if (swapRef.current) clearTimeout(swapRef.current);
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

  const stage = constellationStages[shown];
  const lastIndex = constellationStages.length - 1;

  return (
    <div className="landing-vnext__orbit-example landing-vnext__constellation">
      <p className="landing-vnext__stage-name">
        <b>{stage.name}</b>
        <span>{stage.year}</span>
      </p>
      <svg className="landing-vnext__stage-map" viewBox="0 0 300 170" aria-label={howItWorksCopy.stageMapLabel}>
        <g className="landing-vnext__stage-lines">
          {constellationMap.lines.map(([from, to]) => {
            const [x1, y1] = constellationMap.stars[from];
            const [x2, y2] = constellationMap.stars[to];
            return <line key={`${from}-${to}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        {constellationMap.stars.map(([cx, cy], index) => {
          const point = constellationStages[index];
          return (
            <g
              key={point.name}
              className="landing-vnext__stage-star"
              data-active={index === selected}
              data-ahead={index === lastIndex}
              role="button"
              tabIndex={0}
              aria-label={`${point.name}, ${point.year}`}
              aria-pressed={index === selected}
              onClick={() => pick(index)}
              onKeyDown={onActivateKey(() => pick(index))}
            >
              <circle className="landing-vnext__stage-star-hit" cx={cx} cy={cy} r={12} />
              <circle className="landing-vnext__stage-star-dot" cx={cx} cy={cy} r={3} />
            </g>
          );
        })}
      </svg>
      <div className="landing-vnext__stage" data-swapping={isSwapping}>
        <p className="landing-vnext__stage-question">{stage.question}</p>
        <div className="landing-vnext__stage-rows">
          {stage.rows.map(([source, moment]) => (
            <div key={source}>
              <span>{source}</span>
              <p>{moment}</p>
            </div>
          ))}
        </div>
        <p className="landing-vnext__stage-hint">{howItWorksCopy.stageHint}</p>
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
