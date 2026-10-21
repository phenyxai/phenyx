"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch, type InsightsReading, type ProfileOverview } from "@/lib/api-client";
import { colorName, resolveAccent } from "@/lib/stellar";
import { constellationAge, fetchConstellation, relativeTime, type ConstellationData } from "@/lib/constellation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { buildInsightsStats } from "./stats";

type Header = { name: string; color: string | null; platforms: number; insights: InsightsReading | null };

/** Small, lowercase, accent: the label on each reading. */
function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-3.5 text-[12px] font-semibold text-[var(--ph-accent)]">{children}</h2>;
}

/** Shown in place of a section until the first reading has been generated. */
function Forming() {
  return <p className="text-[13px] font-light italic text-ph-white/40">forming.</p>;
}

/** One sentence and the short line under it (becoming clearer, needs shape). */
function ReadingLine({ label, value }: { label: string; value: InsightsReading["becoming_clearer"] | undefined }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      {value ? (
        <>
          <p className="max-w-[60ch] text-[14px] leading-[1.68] text-ph-white/68">{value.line}</p>
          {value.support && <p className="mt-3 max-w-[60ch] text-[13px] font-medium leading-[1.55] text-ph-white/85">{value.support}</p>}
        </>
      ) : (
        <Forming />
      )}
    </section>
  );
}

/** A reading that opens in place: native <details>, with a + that turns while open. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-ph-white/[0.08]">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] text-ph-white/87 transition-colors duration-200 hover:text-[var(--ph-accent)] [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="transition-transform duration-200 group-open:rotate-45">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}

function Items({ items }: { items: { title: string; body: string }[] | undefined }) {
  if (!items?.length) return <Forming />;
  return (
    <div className="grid gap-x-12 gap-y-6 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-cols-2">
      {items.map((item) => (
        <div key={item.title}>
          <p className="mb-1.5 text-[14.5px] text-ph-white/90">{item.title}</p>
          <p className="text-[13.5px] font-light leading-[1.6] text-ph-white/65">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * "your story so far": one line, then the milestones on a line whose dots
 * brighten toward now. Each milestone opens its point on the constellation.
 * Phones stack them.
 */
function Story({ story }: { story: InsightsReading["story"] | undefined }) {
  return (
    <section className="rounded-[20px] border border-ph-white/11 bg-ph-white/[0.016] p-6">
      <p className="text-[12px] font-medium text-[var(--ph-accent)]">your story so far</p>
      {story ? (
        <>
          <p className="mt-2.5 text-[16px] leading-[1.6] text-ph-white/90">{story.summary}</p>
          <ol className="relative mt-6 grid gap-x-6 gap-y-5 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-flow-col [@media(min-width:641px)]:auto-cols-fr">
            {story.milestones.map((m, i) => (
              <li key={`${m.date}-${m.title}`} className="relative">
                {i < story.milestones.length - 1 && (
                  <span aria-hidden="true" className="absolute top-[4px] left-[9px] h-px w-[calc(100%+24px)] bg-[rgba(var(--ph-accent-rgb),0.45)] [@media(max-width:640px)]:hidden" />
                )}
                <Link
                  href={`/dashboard/constellation?point=${m.pillar}`}
                  aria-label={`explore milestone: ${m.date}, ${m.title}`}
                  className="group relative [@media(min-width:641px)]:block [@media(max-width:640px)]:grid [@media(max-width:640px)]:grid-cols-[9px_1fr] [@media(max-width:640px)]:gap-x-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="block h-[9px] w-[9px] rounded-full bg-[var(--ph-accent)] shadow-[0_0_0_3px_var(--ph-black)] [@media(max-width:640px)]:row-span-2 [@media(max-width:640px)]:mt-[4px]"
                    style={{ opacity: 0.55 + (0.45 * (i + 1)) / story.milestones.length }}
                  />
                  <time className="block text-[12px] font-light text-ph-white/78 [@media(min-width:641px)]:mt-4">{m.date}</time>
                  <b className="block text-[15px] [@media(min-width:641px)]:mt-2 [@media(max-width:640px)]:mt-1 font-medium leading-[1.45] text-ph-white/90 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
                    {m.title}
                  </b>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="mt-2.5">
          <Forming />
        </div>
      )}
    </section>
  );
}

/**
 * Insights tab (PHE-124, PHE-129, spec doc 5; the you tab before PHE-96).
 * Steps back from single moments: the header (name, color, last updated, and
 * three stats from real data, where "connected platforms ›" opens your
 * connections), your story so far, what is becoming clearer beside what still
 * needs shape, then what matters to you and how you find your way, each opening
 * in place. The reading comes from `/profile/overview`; until the first one is
 * generated each section says "forming." and keeps its place, so the structure
 * is the same on every plan. Name and email edits live in settings.
 */
export default function InsightsTabPage() {
  const { openId, openModal, stellarColor } = useSettingsModals();
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
      <IntroBanner tab="insights" copy={INTRO_COPY.insights} className="mt-10 [@media(max-width:640px)]:mx-5 [@media(min-width:641px)]:mx-10" />

      <section className="flex flex-col pt-8 pb-10 [@media(max-width:640px)]:px-5 [@media(min-width:641px)]:px-10">
        <div className="w-full max-w-[1040px]">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
            <div className="min-w-0">
              <h1 className="text-[17px] font-medium text-ph-white/92">{header?.name || "your reading"}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ph-white/78">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: swatch, boxShadow: `0 0 8px color-mix(in srgb, ${swatch} 50%, transparent)` }}
                />
                <span>{colorName(swatch)}</span>
                {updated && <span className="text-ph-white/45">· updated {relativeTime(updated)}</span>}
              </p>
            </div>
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                {stats.map((stat) => {
                  const body = (
                    <>
                      <span className="text-[13.5px] text-ph-white/94">{stat.value}</span>
                      <span className="mt-1 flex items-center gap-1 text-[11.5px] text-ph-white/82">
                        {stat.label}
                        {stat.key === "platforms" && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9.5 6l6 6-6 6" />
                          </svg>
                        )}
                      </span>
                    </>
                  );
                  return stat.key === "platforms" ? (
                    <button
                      key={stat.key}
                      type="button"
                      onClick={() => openModal("my-connections")}
                      aria-label={`${stat.value} ${stat.label}, see your connected platforms`}
                      className="flex flex-col text-left transition-colors duration-200 hover:text-[var(--ph-accent)]"
                    >
                      {body}
                    </button>
                  ) : (
                    <p key={stat.key} className="flex flex-col">
                      {body}
                    </p>
                  );
                })}
              </div>
            )}
          </header>

          <Story story={reading?.story} />

          <div className="mt-11 mb-10 grid gap-x-[88px] gap-y-10 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-cols-2">
            <ReadingLine label="what is becoming clearer" value={reading?.becoming_clearer} />
            <ReadingLine label="what still needs shape" value={reading?.needs_shape} />
          </div>

          <Disclosure title="what matters to you">
            <Items items={reading?.matters} />
          </Disclosure>
          <Disclosure title="how you find your way">
            <Items items={reading?.ways} />
          </Disclosure>
        </div>
      </section>
    </>
  );
}
