"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import type { Discovery } from "@/lib/discover";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { DiscoverCarousel } from "@/components/phenyx/discover-carousel";
import { PanelHeader } from "@/components/phenyx/panel-header";

// ============================================================================
// Discover tab (PHE-103, spec doc 3)
// ----------------------------------------------------------------------------
// Seven discoveries from `GET /discover`, one card at a time. The first visit
// waits while the set is generated, which can take a minute. The read fails
// soft: any error renders the empty state. Explore with polaris opens a chat
// seeded with the card, the same `?q=&pillar=` deep link daily used; polaris
// enforces its own weekly allowance.
// ============================================================================

const delay = (seconds: number) => ({ "--float-delay": `${seconds}s` }) as CSSProperties;

export default function DiscoverTabPage() {
  const router = useRouter();
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/discover");
        if (!res.ok) throw new Error(`discover ${res.status}`);
        const data = (await res.json()) as { discoveries?: Discovery[] };
        if (active) setDiscoveries(data.discoveries ?? []);
      } catch {
        if (active) setDiscoveries([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const explore = (discovery: Discovery) => {
    const params = new URLSearchParams({
      q: `${discovery.headline}. ${discovery.what_surfaced}`,
      pillar: discovery.pillar,
    });
    router.push(`/dashboard/polaris?${params.toString()}`);
  };

  return (
    <section className="flex min-h-screen flex-col px-6 pb-20 pt-6 lg:px-10">
      <IntroBanner tab="discover" copy={INTRO_COPY.discover} className="mb-2 shrink-0" />

      <header className="float-in pt-8">
        <PanelHeader
          eyebrow="discover"
          title="what could be next?"
          sub="single connections across your platforms, one at a time."
        />
      </header>

      {discoveries === null ? (
        <p className="float-in text-[13px] font-light text-ph-white/35" style={delay(0.12)}>
          looking across your platforms for what surfaced. the first set can take a minute.
        </p>
      ) : discoveries.length === 0 ? (
        <p className="float-in max-w-[52ch] text-[15px] font-light leading-[1.55] text-ph-white/40" style={delay(0.12)}>
          nothing has surfaced yet. connect more platforms and come back soon.
        </p>
      ) : (
        <div className="float-in" style={delay(0.12)}>
          <DiscoverCarousel discoveries={discoveries} onExplore={explore} />
        </div>
      )}
    </section>
  );
}
