"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { loopOffset, trailDate, type Discovery } from "@/lib/discover";

// ============================================================================
// Discover carousel (PHE-103, spec doc 3)
// ----------------------------------------------------------------------------
// Up to seven cards in a deck that loops both ways: arrows, dots, a position
// count, arrow keys and swipe. On wider screens the neighbours sit 56px either
// side, dimmed, with a lit edge facing the main card (clicking one brings it
// forward). Phones show the main card alone and swap it in place. Layout and
// the lit edge live in globals.css (.discover-*); this file owns state.
// ============================================================================

const SWAP_OUT_MS = 180;
const SWIPE_PX = 40;

const onPhone = () => window.matchMedia("(max-width: 760px)").matches;
const always = () => true;

/** In-place swap: the old content fades fully out before the new floats in. */
function useInPlaceSwap<T>(target: T, fade: () => boolean): { shown: T; out: boolean } {
  const [shown, setShown] = useState(target);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (Object.is(target, shown)) return;
    if (!fade() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      setOut(false);
      return;
    }
    setOut(true);
    const timer = window.setTimeout(() => {
      setShown(target);
      setOut(false);
    }, SWAP_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [target, shown, fade]);
  return { shown, out };
}

const LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[rgba(var(--s-rgb),0.85)]";
const ACTION =
  "rounded-full border px-4 py-2 text-[13px] lowercase transition-colors duration-200 motion-reduce:transition-none";

export function DiscoverCarousel({
  discoveries,
  onExplore,
}: {
  discoveries: Discovery[];
  onExplore: (discovery: Discovery) => void;
}) {
  const count = discoveries.length;
  const [index, setIndex] = useState(0);
  const [trailId, setTrailId] = useState<string | null>(null);
  const { shown, out } = useInPlaceSwap(index, onPhone);
  const touchX = useRef<number | null>(null);

  const go = (next: number) => {
    setTrailId(null);
    setIndex(((next % count) + count) % count);
  };

  return (
    <div
      className="discover"
      role="region"
      aria-roledescription="carousel"
      aria-label="discoveries"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === "ArrowRight") go(index + 1);
      }}
    >
      <div
        className="discover-stage"
        onTouchStart={(event) => {
          touchX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {discoveries.map((discovery, i) => {
          const offset = loopOffset(i, shown, count);
          const depth = offset === 0 ? "main" : Math.abs(offset) === 1 ? "back" : "far";
          return (
            <article
              key={discovery.id}
              className="discover-card"
              style={{ "--offset": offset } as CSSProperties}
              data-depth={depth}
              data-side={offset < 0 ? "prev" : offset > 0 ? "next" : undefined}
              data-swapping={depth === "main" && out ? "true" : undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={depth === "main" ? undefined : true}
            >
              <DiscoverCard
                discovery={discovery}
                active={depth === "main"}
                trail={trailId === discovery.id}
                onTrail={() => setTrailId((id) => (id === discovery.id ? null : discovery.id))}
                onExplore={() => onExplore(discovery)}
              />
              {depth === "back" && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="discover-card__go"
                  aria-label={`show discovery ${i + 1} of ${count}`}
                  onClick={() => go(i)}
                />
              )}
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <StepButton label="previous discovery" onClick={() => go(index - 1)} d="M15 6l-6 6 6 6" />
          <div className="flex items-center">
            {discoveries.map((discovery, i) => (
              <button
                key={discovery.id}
                type="button"
                aria-label={`discovery ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className="group p-[5px]"
              >
                <span
                  className={`block h-[7px] w-[7px] rounded-full border transition-colors duration-200 motion-reduce:transition-none ${
                    i === index
                      ? "border-[var(--s)] bg-[var(--s)]"
                      : "border-[#FFFDFD]/30 group-hover:border-[var(--s)]"
                  }`}
                />
              </button>
            ))}
          </div>
          <span aria-live="polite" className="min-w-[3.5ch] text-[12px] font-light tabular-nums text-[#FFFDFD]/45">
            {index + 1} / {count}
          </span>
          <StepButton label="next discovery" onClick={() => go(index + 1)} d="M9 6l6 6-6 6" />
        </div>
      )}
    </div>
  );
}

function StepButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FFFDFD]/12 text-[#FFFDFD]/60 transition-colors duration-200 hover:border-[var(--s)] hover:text-[var(--s)] motion-reduce:transition-none"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

function DiscoverCard({
  discovery: d,
  active,
  trail,
  onTrail,
  onExplore,
}: {
  discovery: Discovery;
  active: boolean;
  trail: boolean;
  onTrail: () => void;
  onExplore: () => void;
}) {
  const { shown: showTrail, out } = useInPlaceSwap(trail, always);
  const faceRef = useRef<HTMLDivElement>(null);
  const toggled = useRef(false);

  // After the person opens or closes the trail, focus follows to the button
  // that undoes it, so keyboard users are never dropped onto the page.
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    faceRef.current?.querySelector<HTMLButtonElement>("[data-return-focus]")?.focus();
  }, [showTrail]);

  const toggle = () => {
    toggled.current = true;
    onTrail();
  };

  return (
    <div
      ref={faceRef}
      inert={!active}
      className="discover-card__face rounded-[18px] border border-[#FFFDFD]/[0.08] bg-[#0E0E0E] p-7 max-[760px]:p-[22px]"
    >
      <div
        className={`transition-[opacity,transform,filter] duration-150 ease-out motion-reduce:transition-none ${
          out ? "translate-y-1 opacity-0 blur-[2px]" : ""
        }`}
      >
        {showTrail ? (
          <>
            <p className={LABEL}>source trail</p>
            <p className="mt-3 text-[15px] font-light leading-[1.4] text-[#FFFDFD]/85">{d.headline}</p>
            <ul className="mt-6 flex flex-col gap-5">
              {d.trail.map((entry, i) => (
                <li key={`${entry.platform}-${entry.date}-${i}`} className="group flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full border border-[rgba(var(--s-rgb),0.7)] transition-colors duration-200 group-hover:bg-[var(--s)] motion-reduce:transition-none"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] text-[#FFFDFD]/45">
                      <span className="text-[var(--s)]">{entry.platform}</span> · {trailDate(entry.date)}
                    </p>
                    <p className="mt-1 text-[14px] font-light leading-[1.5] text-[#FFFDFD]/80">{entry.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              data-return-focus
              onClick={toggle}
              className={`${ACTION} mt-7 border-[#FFFDFD]/15 text-[#FFFDFD]/70 hover:border-[var(--s)] hover:text-[var(--s)]`}
            >
              back to the discovery
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className={`discover-type ${LABEL} text-[var(--s)]`}>{d.type}</span>
              <span className="text-[12px] font-light text-[#FFFDFD]/45">{d.time_context}</span>
            </div>
            <h2 className="mt-4 text-[22px] font-normal leading-[1.3] text-[#FFFDFD] max-[760px]:text-[19px]">
              {d.headline}
            </h2>

            <p className={`${LABEL} mt-6`}>what surfaced</p>
            <p className="mt-2 text-[14.5px] font-light leading-[1.6] text-[#FFFDFD]/80">{d.what_surfaced}</p>

            <p className={`${LABEL} mt-5`}>why it surfaced now</p>
            <p className="mt-2 text-[14.5px] font-light leading-[1.6] text-[#FFFDFD]/80">{d.why_now}</p>

            <ul aria-label="platforms" className="mt-6 flex flex-wrap gap-2">
              {d.sources.map((platform) => (
                <li
                  key={platform}
                  className="rounded-full border border-[rgba(var(--s-rgb),0.35)] bg-[rgba(var(--s-rgb),0.08)] px-2.5 py-0.5 text-[11.5px] text-[var(--s)]"
                >
                  {platform}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onExplore}
                className={`${ACTION} border-[rgba(var(--s-rgb),0.45)] text-[var(--s)] hover:border-[var(--s)] hover:bg-[rgba(var(--s-rgb),0.1)]`}
              >
                ✦ explore with polaris
              </button>
              <button
                type="button"
                data-return-focus
                onClick={toggle}
                className={`${ACTION} border-[#FFFDFD]/15 text-[#FFFDFD]/70 hover:border-[var(--s)] hover:text-[var(--s)]`}
              >
                source trail
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
