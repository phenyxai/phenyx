"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch, type InsightsReading, type ProfileOverview } from "@/lib/api-client";
import { colorName, resolveAccent } from "@/lib/stellar";
import { constellationAge, fetchConstellation, relativeTime, type ConstellationData } from "@/lib/constellation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { PanelHeader } from "@/components/phenyx/panel-header";
import { buildInsightsStats } from "./stats";

type Header = { name: string; color: string | null; platforms: number; insights: InsightsReading | null };

/** Small, lowercase, accent: the section label used across the reading. */
function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-3 text-[12px] tracking-[0.04em] text-[var(--ph-accent)]">{children}</h2>;
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Shown in place of a section until the first reading has been generated. */
function Forming() {
  return <p className="text-[13px] font-light italic text-ph-white/40">forming.</p>;
}

/** One sentence and the short line under it (becoming clearer, needs shape). */
function ReadingLine({ value }: { value: InsightsReading["becoming_clearer"] | undefined }) {
  if (!value) return <Forming />;
  return (
    <>
      <p className="max-w-[60ch] text-[17px] font-light leading-[1.55] text-ph-white/92">{value.line}</p>
      {value.support && (
        <p className="mt-2 max-w-[60ch] text-[13.5px] font-light leading-[1.6] text-ph-white/55">{value.support}</p>
      )}
    </>
  );
}

/**
 * Insights tab (PHE-124, spec doc 5; the you tab before PHE-96). Steps back
 * from single moments: the header (name, color, last updated), three stats
 * computed from real data, what is becoming clearer, what still needs shape,
 * what matters to you, and the three eras of the timeline. The reading comes
 * from `/profile/overview`; until the first one is generated each section
 * says "forming." and keeps its place, so the structure is the same on every
 * plan. Name and email edits live in settings.
 */
export default function InsightsTabPage() {
  const { openId, stellarColor } = useSettingsModals();
  const [header, setHeader] = useState<Header | null>(null);
  const [constellation, setConstellation] = useState<ConstellationData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/overview");
      if (res.ok) {
        const body = (await res.json()) as ProfileOverview;
        setHeader({
          name: body.display_name?.trim() ?? "",
          color: body.stellar_color,
          platforms: body.connected_platforms?.length ?? 0,
          insights: body.insights ?? null,
        });
        return;
      }
    } catch {
      // Fall through to the direct read so the header still shows.
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name, stellar_color")
      .eq("id", user.id)
      .maybeSingle();
    setHeader({
      name: (profile?.display_name as string | null)?.trim() ?? "",
      color: (profile?.stellar_color as string | null) ?? null,
      platforms: 0,
      insights: null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    fetchConstellation().then((result) => {
      if (active) setConstellation(result);
    });
    return () => {
      active = false;
    };
  }, []);

  // A settings modal (edit profile, connections) can change what the header
  // shows; re-read when one closes.
  const prevOpen = useRef(openId);
  useEffect(() => {
    if (prevOpen.current !== null && openId === null) void load();
    prevOpen.current = openId;
  }, [openId, load]);

  const reading = header?.insights ?? null;
  const swatch = resolveAccent(header?.color || stellarColor);
  const updated = reading?.generated_at ?? constellation?.generated_at ?? null;
  const stats = buildInsightsStats(
    header?.platforms ?? 0,
    constellation ? constellationAge(constellation) : null,
    constellation?.tenure.since ?? null,
  );

  return (
    <>
      <IntroBanner tab="insights" copy={INTRO_COPY.insights} className="mt-10 [@media(max-width:760px)]:mx-5 [@media(min-width:761px)]:mx-10" />

      <section className="flex flex-col pt-8 pb-10 [@media(max-width:760px)]:px-5 [@media(min-width:761px)]:px-10">
        <div className="w-full max-w-[820px]">
          <PanelHeader eyebrow="insights" title={header?.name || "your reading"} />

          <p className="-mt-3 mb-10 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-light text-ph-white/60">
            <span
              aria-hidden="true"
              className="h-[14px] w-[14px] shrink-0 rounded-full"
              style={{ background: swatch, boxShadow: `0 0 10px color-mix(in srgb, ${swatch} 40%, transparent)` }}
            />
            <span>{colorName(swatch)}</span>
            {updated && <span className="text-ph-white/45">· updated {relativeTime(updated)}</span>}
          </p>

          {stats.length > 0 && (
            <dl className="mb-14 flex flex-wrap gap-x-14 gap-y-6">
              {stats.map((stat) => (
                <div key={stat.key} className="flex flex-col-reverse gap-1">
                  <dt className="text-[12px] text-ph-white/50">{stat.label}</dt>
                  <dd className="m-0 text-[24px] font-light tracking-[-0.01em] text-ph-white/92">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <Section label="what is becoming clearer">
            <ReadingLine value={reading?.becoming_clearer} />
          </Section>

          <Section label="what still needs shape">
            <ReadingLine value={reading?.needs_shape} />
          </Section>

          <Section label="what matters to you">
            {reading && reading.matters.length > 0 ? (
              <div className="grid gap-x-12 gap-y-7 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-cols-2">
                {reading.matters.map((item) => (
                  <div key={item.title}>
                    <p className="mb-1.5 text-[14.5px] text-ph-white/90">{item.title}</p>
                    <p className="text-[13.5px] font-light leading-[1.6] text-ph-white/60">{item.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Forming />
            )}
          </Section>

          <Section label="your timeline">
            {reading && reading.eras.length > 0 ? (
              <ol className="flex flex-col gap-8">
                {reading.eras.map((era) => (
                  <li key={era.title} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full border border-[rgba(var(--ph-accent-rgb),0.7)]"
                    />
                    <div>
                      <p className="text-[12px] tracking-[0.02em] text-[var(--ph-accent)]">
                        {era.place ? `${era.years} · ${era.place}` : era.years}
                      </p>
                      <p className="mt-1 text-[15px] text-ph-white/90">{era.title}</p>
                      <p className="mt-1.5 max-w-[60ch] text-[13.5px] font-light leading-[1.6] text-ph-white/60">
                        {era.line}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Forming />
            )}
          </Section>
        </div>
      </section>
    </>
  );
}
