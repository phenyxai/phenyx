"use client";

// PHE-74 / PHE-93 — Constellation tab.
//
// Header (eyebrow + age line), then the sky and the reading panel. PHE-100: at
// every width the sky takes the top ~65% of the viewport (never full height)
// and the panel reads below it, brought into view when a point opens. The sky
// is capped as wide as it is tall so the seven-point shape keeps its
// proportions on wide screens. The weekly timeline and "what moved" left this
// tab in v244; their components stay in the repo, unmounted.

import { useCallback, useEffect, useRef, useState } from "react";
import { ConstellationCanvas } from "@/components/phenyx/constellation-canvas";
import { ConstellationPanel } from "@/components/phenyx/constellation-panel";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import {
  constellationAge,
  fetchConstellation,
  type ConstellationData,
  type Pillar,
} from "@/lib/constellation";

export default function ConstellationTabPage() {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
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

  const openPillar = useCallback((pillar: Pillar) => {
    setSelectedPillar(pillar);
    setSelectedClusterId(null);
  }, []);

  const back = useCallback(() => {
    if (selectedClusterId) {
      setSelectedClusterId(null);
      return;
    }
    setSelectedPillar(null);
  }, [selectedClusterId]);

  const closePoint = useCallback(() => {
    setSelectedClusterId(null);
    setSelectedPillar(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (selectedClusterId || selectedPillar) {
        event.preventDefault();
        closePoint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePoint, selectedClusterId, selectedPillar]);

  // The panel sits under the sky, so opening a point brings the reading into
  // view rather than leaving it below the fold.
  useEffect(() => {
    if (!selectedPillar) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [selectedPillar]);

  const age = data ? constellationAge(data) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <IntroBanner
        tab="constellation"
        copy={INTRO_COPY.constellation}
        className="mx-6 mt-6 shrink-0 lg:mx-10"
      />

      <header className="px-6 pb-5 pt-8 lg:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#FFFDFD]/52">
          your constellation
        </p>
        {age && (
          <p className="mt-2 text-[13px] font-light lowercase text-[#FFFDFD]/45">
            {age.label} of your life, from {age.from} to now.
          </p>
        )}
      </header>

      <div className="flex flex-col items-center gap-[22px] px-6 pb-10 lg:px-10">
        <div className="relative h-[clamp(320px,65svh,760px)] w-full max-w-[65svh]">
          {data && (
            <ConstellationCanvas
              data={data}
              selectedPillar={selectedPillar}
              onSelectPillar={openPillar}
              onClosePoint={closePoint}
            />
          )}
        </div>

        <aside ref={panelRef} className="w-full min-w-0 max-w-[640px]">
          {data ? (
            <ConstellationPanel
              data={data}
              selectedPillar={selectedPillar}
              selectedClusterId={selectedClusterId}
              onSelectPillar={openPillar}
              onSelectCluster={setSelectedClusterId}
              onBack={back}
            />
          ) : (
            <p className="text-[13px] font-light lowercase text-[#FFFDFD]/30">
              aligning your constellation…
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
