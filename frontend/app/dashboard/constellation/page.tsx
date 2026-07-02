"use client";

// PHE-28 — Constellation tab.
//
// Two-column surface: the interactive canvas (left) and a fixed 320px detail
// panel (right). The canvas renders the seven-node constellation; selecting a
// node drives the panel between its default, active-detail, and locked-static
// states. Content is read via `fetchConstellation()` (PHE-31 endpoint, with a
// graceful Supabase fallback), so a missing or sparse constellation still
// renders every node.

import { useEffect, useState } from "react";
import { ConstellationCanvas } from "@/components/phenyx/constellation-canvas";
import { ConstellationPanel } from "@/components/phenyx/constellation-panel";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import {
  fetchConstellation,
  type ConstellationData,
  type Pillar,
} from "@/lib/constellation";

export default function ConstellationTabPage() {
  const [data, setData] = useState<ConstellationData | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);

  useEffect(() => {
    let active = true;
    fetchConstellation().then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* PHE-33 first-visit intro banner, above the two-column region. */}
      <IntroBanner
        tab="constellation"
        copy={INTRO_COPY.constellation}
        className="mx-6 mt-6 shrink-0"
      />
      <div className="flex min-h-0 flex-1">
        {/* Canvas column. The parent is the sizing box the canvas measures. */}
        <div className="relative min-w-0 flex-1">
          {data && (
            <ConstellationCanvas
              data={data}
              selectedPillar={selectedPillar}
              onSelectPillar={setSelectedPillar}
            />
          )}
        </div>

        {/* Detail panel — fixed 320px, scrolls independently. */}
        <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[#1a1a1a] px-6 py-8">
          {data ? (
            <ConstellationPanel
              data={data}
              selectedPillar={selectedPillar}
              onSelectPillar={setSelectedPillar}
              onBack={() => setSelectedPillar(null)}
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
