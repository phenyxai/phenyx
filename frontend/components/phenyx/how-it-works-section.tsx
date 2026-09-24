"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { howItWorksCopy, SECTION_IDS } from "@/lib/landing-copy";
import { ringBox, stepsForward, trailBackground, wrapIndex } from "@/lib/landing-motion";
import {
  ConstellationSlide,
  DiscoverSlide,
  InsightsSlide,
  PolarisSlide,
  type SlideExampleProps,
} from "./four-parts-slides";
import { onActivateKey } from "./landing-dom";

// The four parts of PHENYX on an orbit (v610 onward in the Sept 23 export).
// Each part sits at a quarter of the ring; while the orbit is on screen a light
// trail sweeps from the current part to the next, and when it arrives the next
// part's slide comes up. The trail is the progress bar, so there is no other.
// Hovering, keyboard focus, clicking a part, or working inside a slide holds
// the orbit still.

const DWELL_MS = 7000;
const HOLD_AFTER_PICK_MS = 5000;
const SWIPE_PX = 40;
const VIEWBOX = { x: -24, y: 0, width: 448, height: 384 };
const RING = { cx: 200, cy: 190, r: 122, innerR: 86 };
// The trail layer sits over the ring, padded so the mask's band lands on the stroke.
const TRAIL_BOX = ringBox(VIEWBOX, RING);
const TRAIL_PAD_PX = 6;
// Label placement per quarter, clockwise from 12 o'clock.
const LABELS = [
  { x: 200, y: 28, anchor: "middle" },
  { x: 356, y: 194, anchor: "start" },
  { x: 200, y: 360, anchor: "middle" },
  { x: 44, y: 194, anchor: "end" },
] as const;
const EXAMPLES: readonly React.ComponentType<SlideExampleProps>[] = [
  ConstellationSlide,
  InsightsSlide,
  DiscoverSlide,
  PolarisSlide,
];

export function HowItWorksSection() {
  const slides = howItWorksCopy.slides;
  const count = slides.length;
  const quarter = 360 / count;
  const [index, setIndex] = useState(0);
  const orbitRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLSpanElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const motion = useRef({
    index: 0,
    /** Angle (SVG degrees, -90 is 12 o'clock) the current trail sweeps from. */
    trailStart: -90,
    /** How far through the current slide's dwell, 0 to 1. */
    progress: 0,
    isVisible: false,
    isHovered: false,
    isKeyboardFocused: false,
    isHeld: false,
    wasTouched: false,
    release: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  const hold = useCallback((ms: number) => {
    const m = motion.current;
    m.isHeld = true;
    m.wasTouched = true;
    clearTimeout(m.release);
    m.release = setTimeout(() => { m.isHeld = false; }, ms);
  }, []);

  const show = useCallback((next: number) => {
    motion.current.index = next;
    setIndex(next);
  }, []);

  const goTo = useCallback((target: number, fromUser: boolean) => {
    const m = motion.current;
    const next = wrapIndex(target, count);
    if (fromUser) hold(HOLD_AFTER_PICK_MS);
    m.progress = 0;
    if (next === m.index) return;
    m.trailStart += quarter * stepsForward(m.index, next, count);
    show(next);
  }, [count, hold, quarter, show]);

  // One animation frame loop drives the trail and the autoplay.
  useEffect(() => {
    const m = motion.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = 0;
    let painted = "";
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = last ? Math.min(64, now - last) : 16;
      last = now;
      const isPlaying = m.isVisible && !m.isHovered && !m.isKeyboardFocused && !m.isHeld && !reduced && !document.hidden;
      if (isPlaying) {
        m.progress += elapsed / DWELL_MS;
        if (m.progress >= 1) {
          m.trailStart += quarter;
          m.progress = 0;
          show(wrapIndex(m.index + 1, count));
        }
      }
      const background = trailBackground(m.trailStart, quarter * m.progress);
      if (background !== painted && trailRef.current) {
        trailRef.current.style.background = background;
        painted = background;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(m.release);
    };
  }, [count, quarter, show]);

  // Autoplay only while the orbit is on screen. Arriving at it for the first
  // time (before anyone has touched it) starts again from constellation.
  useEffect(() => {
    const orbit = orbitRef.current;
    const m = motion.current;
    if (!orbit) return;
    if (!("IntersectionObserver" in window)) {
      m.isVisible = true;
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const wasVisible = m.isVisible;
        m.isVisible = entry.isIntersecting && entry.intersectionRatio > 0.15;
        if (m.isVisible && !wasVisible && !m.wasTouched) goTo(0, false);
      }
    }, { threshold: [0, 0.15, 0.4, 0.7] });
    observer.observe(orbit);
    return () => observer.disconnect();
  }, [goTo]);

  // The slides share one grid cell; the panel takes the height of whichever is
  // showing, so a short slide does not leave the tallest one's gap behind it.
  useEffect(() => {
    const box = slidesRef.current;
    const slide = box?.children[index] as HTMLElement | undefined;
    if (!box || !slide) return;
    const fit = () => {
      if (slide.scrollHeight) box.style.height = `${slide.scrollHeight + 4}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(slide);
    return () => observer.disconnect();
  }, [index]);

  return (
    <section id={SECTION_IDS.how} className="landing-vnext__section">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{howItWorksCopy.eyebrow}</p>
        <h2 data-reveal>{howItWorksCopy.headline}</h2>
        <p className="landing-vnext__section-lead" data-reveal>{howItWorksCopy.subline}</p>

        <div
          ref={orbitRef}
          className="landing-vnext__orbit"
          role="region"
          aria-roledescription="carousel"
          aria-label={howItWorksCopy.orbitLabel}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            goTo(motion.current.index + (event.key === "ArrowRight" ? 1 : -1), true);
          }}
          onFocus={(event) => {
            // a mouse click focuses a point too; only keyboard focus holds the orbit
            if (event.target.matches(":focus-visible")) motion.current.isKeyboardFocused = true;
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              motion.current.isKeyboardFocused = false;
            }
          }}
          onMouseEnter={() => { motion.current.isHovered = true; }}
          onMouseLeave={() => {
            const m = motion.current;
            m.isHovered = false;
            m.isHeld = false;
            clearTimeout(m.release);
          }}
          onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
          onTouchEnd={(event) => {
            if (touchX.current === null) return;
            const dx = event.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > SWIPE_PX) goTo(motion.current.index + (dx < 0 ? 1 : -1), true);
          }}
        >
          <div className="landing-vnext__orbit-visual">
            <span
              ref={trailRef}
              className="landing-vnext__orbit-trail"
              aria-hidden="true"
              style={{
                left: `calc(${TRAIL_BOX.left}% - ${TRAIL_PAD_PX}px)`,
                top: `calc(${TRAIL_BOX.top}% - ${TRAIL_PAD_PX}px)`,
                width: `calc(${TRAIL_BOX.width}% + ${TRAIL_PAD_PX * 2}px)`,
                height: `calc(${TRAIL_BOX.height}% + ${TRAIL_PAD_PX * 2}px)`,
              }}
            />
            <svg
              viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
              className="landing-vnext__orbit-svg"
            >
              <circle className="landing-vnext__orbit-ring" cx={RING.cx} cy={RING.cy} r={RING.r} />
              <circle className="landing-vnext__orbit-ring-inner" cx={RING.cx} cy={RING.cy} r={RING.innerR} />
              {slides.map((slide, i) => {
                const angle = ((-90 + quarter * i) * Math.PI) / 180;
                const x = RING.cx + RING.r * Math.cos(angle);
                const y = RING.cy + RING.r * Math.sin(angle);
                const label = LABELS[i];
                const pick = () => goTo(i, true);
                return (
                  <g
                    key={slide.kicker}
                    className="landing-vnext__orbit-node"
                    data-active={i === index}
                    role="button"
                    tabIndex={0}
                    aria-label={`${howItWorksCopy.orbitNodeLabel} ${slide.kicker}`}
                    aria-pressed={i === index}
                    onClick={pick}
                    onKeyDown={onActivateKey(pick)}
                  >
                    <circle className="landing-vnext__orbit-node-halo" cx={x} cy={y} r={15} />
                    <circle className="landing-vnext__orbit-node-dot" cx={x} cy={y} r={4} />
                    <text x={label.x} y={label.y} textAnchor={label.anchor}>{slide.kicker}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="landing-vnext__orbit-panel">
            <div ref={slidesRef} className="landing-vnext__orbit-slides">
              {slides.map((slide, i) => {
                const Example = EXAMPLES[i];
                return (
                  <article
                    key={slide.kicker}
                    className="landing-vnext__orbit-slide"
                    data-active={i === index}
                    aria-hidden={i !== index}
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${count}: ${slide.kicker}`}
                  >
                    <p className="landing-vnext__orbit-kicker">{slide.kicker}</p>
                    <h3 className="landing-vnext__orbit-title">{slide.title}</h3>
                    <p className="landing-vnext__orbit-line">{slide.line}</p>
                    <Example active={i === index} onHold={hold} />
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
