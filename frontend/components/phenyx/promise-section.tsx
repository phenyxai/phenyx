"use client";

import { useEffect, useRef, useState } from "react";
import { promiseCopy, SECTION_IDS, type PromiseVisual } from "@/lib/landing-copy";
import { railLayout, stationDelays, type RailLayout } from "@/lib/landing-motion";
import { EntranceWords, useEntrance } from "./use-entrance";

// "your space" (v630, reworked in the Oct 4 export): five stations along a
// rail, from choosing platforms to changing your mind. Once the heading and
// lede have landed (the entrance gate) and the rail is on screen, a light runs
// along it once and each station's visual, title and line float in as the
// light reaches it.

const RUN_MS = 3200;

// "still" is the reduced-motion end state: every station lit, no run along the rail.
type Phase = "idle" | "play" | "still";

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
  const sectionRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const layoutRef = useRef<RailLayout | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const landed = useEntrance(sectionRef);
  const [isOnScreen, setIsOnScreen] = useState(false);
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
      layoutRef.current = layout;
      if (!layout) return;
      story.dataset.direction = layout.isVertical ? "down" : "across";
      rail.style.left = `${layout.origin.x}px`;
      rail.style.top = `${layout.origin.y}px`;
      rail.style.width = `${layout.size.width}px`;
      rail.style.height = `${layout.size.height}px`;
    };
    placeRail();
    const resize = new ResizeObserver(placeRail);
    resize.observe(story);

    let seen: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      seen = new IntersectionObserver(([entry]) => setIsOnScreen(entry.isIntersecting), { rootMargin: "0px 0px -12% 0px" });
      seen.observe(story);
    } else setIsOnScreen(true);

    const timers = timersRef.current;
    return () => {
      resize.disconnect();
      seen?.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  // The light runs once, after the heading and lede have landed and only while
  // the rail is on screen.
  useEffect(() => {
    if (phase !== "idle" || !landed || !isOnScreen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLit(promiseCopy.stations.map(() => true));
      setPhase("still");
      return;
    }
    const layout = layoutRef.current;
    if (!layout) return;
    setPhase("play");
    stationDelays(layout.positions, layout.rail, RUN_MS).forEach((delay, index) => {
      timersRef.current.push(setTimeout(() => setLit((current) => current.map((on, i) => on || i === index)), delay));
    });
  }, [phase, landed, isOnScreen]);

  return (
    <section ref={sectionRef} id={SECTION_IDS.promise} className="landing-vnext__section landing-vnext__promise">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-entrance="eyebrow">{promiseCopy.eyebrow}</p>
        <h2 data-entrance="headline"><EntranceWords text={promiseCopy.headline} /></h2>
        <p className="landing-vnext__section-lead" data-entrance="lede">{promiseCopy.lede}</p>

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
      </div>
    </section>
  );
}
