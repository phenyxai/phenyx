"use client";

import { useEffect, useRef, useState } from "react";
import { promiseCopy, SECTION_IDS, type PromiseVisual } from "@/lib/landing-copy";
import { railLayout, stationDelays } from "@/lib/landing-motion";

// "our vision" (v630 onward in the Sept 23 export): five stations along a rail,
// from connecting an account to leaving with everything. The first time the
// rail comes into view a light runs along it once and each station lights as
// the runner reaches it; the closing line appears when the run is over.

const RUN_MS = 11000;

// "still" is the reduced-motion end state: every station lit, no run along the rail.
type Phase = "idle" | "play" | "done" | "still";

function StationVisual({ visual }: { visual: PromiseVisual }) {
  switch (visual.kind) {
    case "choose":
      return (
        <div className="landing-vnext__station-toggles">
          {visual.toggles.map((toggle) => (
            <span key={toggle.name} data-state={toggle.state}><i />{toggle.name}</span>
          ))}
        </div>
      );
    case "protect":
      return (
        <svg className="landing-vnext__station-shield" viewBox="0 0 120 72">
          <circle data-ring="3" cx="60" cy="36" r="30" />
          <circle data-ring="2" cx="60" cy="36" r="20" />
          <circle data-ring="1" cx="60" cy="36" r="10" />
          <circle data-ring="core" cx="60" cy="36" r="3.5" />
        </svg>
      );
    case "show":
      return (
        <div className="landing-vnext__station-why">
          <p>{visual.observation}</p>
          <svg viewBox="0 0 160 22" preserveAspectRatio="none">
            <path d="M80 0 C80 12 36 8 36 22" />
            <path d="M80 0 C80 12 124 8 124 22" />
          </svg>
          <div>{visual.sources.map((source) => <span key={source}>{source}</span>)}</div>
        </div>
      );
    case "decide":
      return (
        <div className="landing-vnext__station-decide">
          <p>{visual.observation}</p>
          <div>
            <span data-yes="true">{visual.yes}</span>
            <span>{visual.no}</span>
          </div>
        </div>
      );
    case "leave":
      return (
        <div className="landing-vnext__station-leave">
          {visual.accounts.map((account) => <span key={account}>{account}</span>)}
        </div>
      );
  }
}

export function PromiseSection() {
  const storyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<readonly boolean[]>(() => promiseCopy.stations.map(() => false));

  useEffect(() => {
    const story = storyRef.current;
    const rail = railRef.current;
    if (!story || !rail) return;

    // Measure the dots and pin the rail between the first and the last.
    const placeRail = () => {
      const box = story.getBoundingClientRect();
      const layout = railLayout(
        Array.from(story.querySelectorAll<HTMLElement>(".landing-vnext__station-node")).map((node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
        }),
      );
      if (!layout) return null;
      story.dataset.direction = layout.isVertical ? "down" : "across";
      rail.style.left = `${layout.origin.x}px`;
      rail.style.top = `${layout.origin.y}px`;
      rail.style.width = `${layout.size.width}px`;
      rail.style.height = `${layout.size.height}px`;
      return layout;
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setLit(promiseCopy.stations.map(() => true));
        setPhase("still");
        return;
      }
      const layout = placeRail();
      if (!layout) return;
      setPhase("play");
      stationDelays(layout.positions, layout.rail, RUN_MS).forEach((delay, index) => {
        timers.push(setTimeout(() => setLit((current) => current.map((on, i) => on || i === index)), delay));
      });
      timers.push(setTimeout(() => setPhase("done"), RUN_MS + 400));
    };

    const resize = new ResizeObserver(() => placeRail());
    resize.observe(story);

    let reveal: IntersectionObserver | null = null;
    if (!("IntersectionObserver" in window)) run();
    else {
      reveal = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        reveal?.disconnect();
        run();
      }, { threshold: 0.35 });
      reveal.observe(story);
    }

    return () => {
      timers.forEach(clearTimeout);
      resize.disconnect();
      reveal?.disconnect();
    };
  }, []);

  return (
    <section id={SECTION_IDS.promise} className="landing-vnext__section landing-vnext__promise">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{promiseCopy.eyebrow}</p>
        <h2 data-reveal="1">{promiseCopy.headline}</h2>
        <p className="landing-vnext__section-lead" data-reveal="2">{promiseCopy.lede}</p>

        <div
          ref={storyRef}
          className="landing-vnext__promise-story"
          data-phase={phase}
          style={{ "--run": `${RUN_MS}ms` } as React.CSSProperties}
        >
          <span ref={railRef} className="landing-vnext__promise-rail" aria-hidden="true">
            <i />
            <b />
          </span>
          <ol className="landing-vnext__stations">
            {promiseCopy.stations.map((station, index) => (
              <li key={station.title} className="landing-vnext__station" data-lit={lit[index]}>
                <span className="landing-vnext__station-node" aria-hidden="true" />
                <div className="landing-vnext__station-visual" aria-hidden="true">
                  <StationVisual visual={station.visual} />
                </div>
                <h3>{station.title}</h3>
                <p>{station.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="landing-vnext__thesis landing-vnext__promise-close" data-reveal="3" data-shown={phase === "done" || phase === "still"}>
          {promiseCopy.close}
        </p>
      </div>
    </section>
  );
}
