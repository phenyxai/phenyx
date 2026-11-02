"use client";

import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { kindLabel, loopOffset, type Discovery } from "@/lib/discover";

// ============================================================================
// Discover carousel (PHE-103, PHE-129, spec doc 3)
// ----------------------------------------------------------------------------
// Up to seven cards in a deck that loops both ways: arrows, dots (the current
// one a short accent bar), arrow keys and swipe. On wider screens the
// neighbours sit 70px either side, dimmed but legible, with a lit edge facing
// the main card (clicking one brings it forward). Phones show the main card
// alone and swap it in place. Each card: its kind, the ★ save, the headline, what it is, the personal
// reason in the accent, then "ask polaris" at the right (PHE-163). The text
// sits together as one block (PHE-160) and none of it is cut off: a headline
// too long for two display lines on the 428px card drops to the title size.
// A long deck counts instead of drawing a dot per card. Layout, spacing, sizes
// from 641px and the lit edge live in globals.css (.discover-*); this file
// owns state.
// ============================================================================

const SWAP_OUT_MS = 180;
/** Past this many cards the dots give way to "3 of 24". */
const DOTS_MAX = 12;
const SWIPE_PX = 40;
// ponytail: a character count stands in for measuring the wrap. Up to 50 fit
// two display lines on the 428px card, from 55 none do; measure if fonts change.
const HEADLINE_DISPLAY_MAX = 50;

const onPhone = () => window.matchMedia("(max-width: 640px)").matches;

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

/** One solid five-point star: outlined at rest, filled in the accent once saved. */
export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "var(--ph-accent)" : "currentColor"}
      stroke="none"
      aria-hidden="true"
      className={filled ? "" : "opacity-60"}
    >
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
    </svg>
  );
}

/** A card's action pill ("ask polaris"), also used in the saved view. */
export function CardLink(props: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="ph-optical h-10 rounded-full border border-ph-white/20 bg-ph-white/[0.035] px-[18px] text-body font-medium text-ph-white transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)]"
      {...props}
    />
  );
}

export function DiscoverCarousel({
  discoveries,
  onSave,
  onAsk,
}: {
  discoveries: Discovery[];
  onSave: (discovery: Discovery) => void;
  onAsk: (discovery: Discovery) => void;
}) {
  const count = discoveries.length;
  const [index, setIndex] = useState(0);
  const { shown, out } = useInPlaceSwap(index, onPhone);
  const touchX = useRef<number | null>(null);

  const go = (next: number) => setIndex(((next % count) + count) % count);

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
                onSave={() => onSave(discovery)}
                onAsk={() => onAsk(discovery)}
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
        <div className="mt-8 flex items-center justify-center gap-[18px]">
          <StepButton label="previous discovery" onClick={() => go(index - 1)} d="M19 12H5M11 6l-6 6 6 6" />
          {count > DOTS_MAX ? (
            <p aria-live="polite" className="min-w-[64px] text-center text-meta tabular-nums text-ph-secondary">
              {index + 1} of {count}
            </p>
          ) : (
          <div className="flex items-center" aria-live="polite">
            {discoveries.map((discovery, i) => (
              <button
                key={discovery.id}
                type="button"
                aria-label={`discovery ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className="group px-[3px] py-2"
              >
                <span
                  className={`block h-[6px] rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
                    i === index ? "w-[18px] bg-[var(--ph-accent)]" : "w-[6px] bg-ph-white/18 group-hover:bg-[var(--ph-accent)]"
                  }`}
                />
              </button>
            ))}
          </div>
          )}
          <StepButton label="next discovery" onClick={() => go(index + 1)} d="M5 12h14M13 6l6 6-6 6" />
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
      className="flex h-9 w-9 items-center justify-center rounded-full border border-ph-white/10 text-ph-secondary transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)] motion-reduce:transition-none"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

function DiscoverCard({
  discovery: d,
  active,
  onSave,
  onAsk,
}: {
  discovery: Discovery;
  active: boolean;
  onSave: () => void;
  onAsk: () => void;
}) {
  return (
    <div
      inert={!active}
      className="discover-card__face flex h-full flex-col rounded-[20px] border bg-ph-white/[0.016]"
    >
      <div className="discover-card__head flex items-center justify-between gap-4">
        <span className="discover-type text-[16px] leading-6 font-semibold text-[var(--ph-accent)]">{kindLabel(d.type)}</span>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={d.saved}
          aria-label={`${d.saved ? "remove from saved" : "save discovery"}: ${d.headline}`}
          className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ph-secondary transition-colors duration-200 hover:text-[var(--ph-accent)]"
        >
          <StarIcon filled={d.saved} />
        </button>
      </div>
      <h2 className={`discover-card__headline text-pretty text-ph-white ${d.headline.length > HEADLINE_DISPLAY_MAX ? "text-title" : "text-display"}`}>{d.headline}</h2>
      <p className="discover-card__detail text-reading text-ph-white">{d.detail}</p>
      <p className="discover-card__reason text-reading italic text-[var(--ph-accent)]">{d.reason}</p>
      <div className="discover-card__foot mt-auto flex justify-end">
        <CardLink onClick={onAsk}>ask polaris</CardLink>
      </div>
    </div>
  );
}
