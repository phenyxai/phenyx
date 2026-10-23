"use client";

// PHE-74 / PHE-93 — Constellation tab.
//
// The sky and the reading panel, with no page header (PHE-129: the panel's
// "explore what shaped you." is the tab's one line). PHE-100:
// below 1024px the sky takes the top ~65% of the viewport (never full height)
// with the panel under it; from 1024px the Big Dipper sits in a sticky
// column beside a 440px panel, so a point and its reading are seen together.
// Opening a point never scrolls the page: the panel swaps in place (fade out,
// then float in), and the map stays where it is. The weekly timeline and
// "what moved" left this tab in v244; their components stay in the repo,
// unmounted.

import { useCallback, useEffect, useRef, useState } from "react";
import { ConstellationCanvas } from "@/components/phenyx/constellation-canvas";
import { ConstellationPanel } from "@/components/phenyx/constellation-panel";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { ALL_PILLARS, fetchConstellation, pointMoments, type ConstellationData, type Pillar } from "@/lib/constellation";

/** Fade-out time for an in-place panel swap, before the new view floats in. */
const SWAP_OUT_MS = 180;

export default function ConstellationTabPage() {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchConstellation().then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
  }, []);

  // PHE-129: insights' milestones link here with ?moment=<id> (or ?point=<pillar>).
  // Read once on the client and drop it from the address, so a reload starts at
  // the overview; the moment opens its point with that moment expanded.
  const [linked, setLinked] = useState<{ point: string | null; moment: string | null } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("point") && !params.get("moment")) return;
    setLinked({ point: params.get("point"), moment: params.get("moment") });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  useEffect(() => {
    if (!linked || !data) return;
    const owner = linked.moment
      ? ALL_PILLARS.find((p) => pointMoments(data.pillars[p]).some((m) => m.id === linked.moment))
      : (ALL_PILLARS as readonly string[]).includes(linked.point ?? "")
        ? (linked.point as Pillar)
        : undefined;
    if (owner) setSelectedPillar(owner);
  }, [linked, data]);

  const openPillar = useCallback((pillar: Pillar) => setSelectedPillar(pillar), []);
  const closePoint = useCallback(() => setSelectedPillar(null), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (selectedPillar) {
        event.preventDefault();
        closePoint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePoint, selectedPillar]);

  // In-place swap: the panel fades fully out, swaps to the new view, then
  // floats back in. The map never moves. Only when the reader had scrolled
  // into the panel (its top above the viewport, e.g. a row deep in the
  // overview list) does its top come back into view, and only while it is
  // hidden, so nothing visible jumps.
  const [shown, setShown] = useState<Pillar | null>(null);
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    if (shown === selectedPillar) return;
    const next = selectedPillar;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(next);
      return;
    }
    setSwapping(true);
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (panel && panel.getBoundingClientRect().top < 0) {
        panel.scrollIntoView({ block: "start" });
      }
      setShown(next);
      setSwapping(false);
    }, SWAP_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [selectedPillar, shown]);

  return (
    <div className="flex min-h-screen flex-col">
      <IntroBanner
        tab="constellation"
        copy={INTRO_COPY.constellation}
        className="mx-6 mt-4 shrink-0 lg:mx-10"
      />

      {/* The 1024px split lives in globals.css (.constellation-split), not in
          lg: classes, so the onairos SDK's stylesheet cannot override it. */}
      <div className="constellation-split flex flex-col items-center gap-[22px] px-6 pt-4 pb-10 lg:px-10">
        {/* Phones (with the dashboard's top bar and 72px bottom nav): the map
            leaves room under it for the opened point's name and the start of
            its story, about 65% of the space between the two bars. */}
        <div className="constellation-sky relative h-[clamp(320px,65svh,760px)] w-full [@media(max-width:640px)]:h-[clamp(300px,calc(100svh-370px),620px)]">
          {data && (
            <ConstellationCanvas
              data={data}
              selectedPillar={selectedPillar}
              onSelectPillar={openPillar}
              onClosePoint={closePoint}
            />
          )}
        </div>

        <aside
          ref={panelRef}
          data-view={shown ? "point" : "overview"}
          className={`w-full min-w-0 max-w-[640px] transition-[opacity,transform,filter] duration-200 ease-out motion-reduce:transition-none ${
            swapping ? "translate-y-1 opacity-0 blur-[2px]" : "translate-y-0 opacity-100 blur-0"
          }`}
        >
          {data ? (
            <ConstellationPanel
              data={data}
              selectedPillar={shown}
              onSelectPillar={openPillar}
              openMomentId={linked?.moment ?? null}
            />
          ) : (
            <p className="text-[13px] font-light lowercase text-ph-white/30">
              aligning your constellation…
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
