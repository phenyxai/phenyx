"use client";

// PHE-74 — Constellation tab.
//
// Canvas + panel (overview | pillar | cluster), then below the fold: your
// timeline (from account history, first session) and what moved.

import { useCallback, useEffect, useState } from "react";
import { ConstellationCanvas } from "@/components/phenyx/constellation-canvas";
import { ConstellationPanel } from "@/components/phenyx/constellation-panel";
import { RecordTimelineView } from "@/components/phenyx/record-timeline";
import { WhatMoved } from "@/components/phenyx/what-moved";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import {
  fetchConstellation,
  type ConstellationData,
  type Pillar,
} from "@/lib/constellation";

export default function ConstellationTabPage() {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-screen flex-col">
      <IntroBanner
        tab="constellation"
        copy={INTRO_COPY.constellation}
        className="mx-6 mt-6 shrink-0"
      />
      <div className="flex min-h-[min(72vh,720px)] flex-col min-[1100px]:flex-row">
        <div className="relative min-h-[420px] min-w-0 flex-1">
          {data && (
            <ConstellationCanvas
              data={data}
              selectedPillar={selectedPillar}
              onSelectPillar={openPillar}
              onClosePoint={closePoint}
            />
          )}
        </div>

        <aside className="w-full shrink-0 overflow-visible overscroll-contain border-t border-[#1a1a1a] px-6 py-8 min-[1100px]:max-h-[calc(100vh-130px)] min-[1100px]:w-[clamp(380px,36vw,500px)] min-[1100px]:overflow-y-auto min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:[&>*]:overflow-visible">
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

      {data && (
        <div className="border-t border-[#FFFDFD]/6 px-6 py-14 lg:px-10">
          <RecordTimelineView timeline={data.timeline} />
          <WhatMoved moved={data.moved} yearlyRecap={data.yearly_recap} />
        </div>
      )}
    </div>
  );
}
