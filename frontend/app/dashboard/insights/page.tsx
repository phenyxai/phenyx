"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch, type InsightsReading, type ProfileOverview } from "@/lib/api-client";
import { fetchConstellation, pillarLabel, relativeTime, type ConstellationData, type Pillar } from "@/lib/constellation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { buildInsightsStats, momentFacts, nameFromMetadata } from "./stats";

type Header = { name: string; platforms: string[]; insights: InsightsReading | null };

/** Where a reading points: its first moment, opened in the constellation. */
function momentHref(ids: string[] | undefined): string | null {
  return ids?.[0] ? `/dashboard/constellation?moment=${encodeURIComponent(ids[0])}` : null;
}

/** Small, lowercase, accent: the label on each reading. */
function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-3.5 text-meta font-semibold text-[var(--ph-accent)]">{children}</h2>;
}

/** Shown in place of a section until the first reading has been generated. */
function Forming() {
  return <p className="text-body italic text-ph-tertiary">forming.</p>;
}

/** One sentence and the short line under it (becoming clearer, needs shape). */
function ReadingLine({ label, value }: { label: string; value: InsightsReading["becoming_clearer"] | undefined }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      {value ? (
        <>
          <p className="max-w-[60ch] text-reading text-ph-secondary">{value.line}</p>
          {value.support && <p className="mt-4 max-w-[60ch] text-reading font-medium text-ph-white">{value.support}</p>}
        </>
      ) : (
        <Forming />
      )}
    </section>
  );
}

/** A reading that opens in place: native <details>, its heading in the accent, with a + that turns while open. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-ph-white/[0.08]">
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-heading text-[var(--ph-accent)] transition-colors duration-200 hover:text-[var(--ph-accent)] [&::-webkit-details-marker]:hidden">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="transition-transform duration-200 group-open:rotate-45">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}

/** Values and patterns: each title opens the moment it rests on. */
function Items({ items }: { items: { title: string; body: string; moment_ids?: string[] }[] | undefined }) {
  if (!items?.length) return <Forming />;
  return (
    <div className="grid gap-x-12 gap-y-9 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-cols-2">
      {items.map((item) => (
        <div key={item.title}>
          {momentHref(item.moment_ids) ? (
            <Link
              href={momentHref(item.moment_ids)!}
              className="mb-2 block text-item text-ph-white transition-colors duration-200 hover:text-[var(--ph-accent)]"
            >
              {item.title}
            </Link>
          ) : (
            <p className="mb-2 text-item text-ph-white">{item.title}</p>
          )}
          <p className="text-reading text-ph-secondary">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * "your story so far": one line, then five milestones on a line whose dots
 * brighten toward now. Each milestone opens its moment on the constellation.
 * An undated moment shows its point in place of the date. Phones stack them.
 */
function Story({ story }: { story: InsightsReading["story"] | undefined }) {
  return (
    <section className="rounded-[20px] border border-ph-white/11 bg-ph-white/[0.016] p-6">
      <p className="text-meta font-semibold text-[var(--ph-accent)]">your story so far</p>
      {story ? (
        <>
          <p className="mt-2.5 text-title text-ph-white">{story.line}</p>
          <ol className="relative mt-6 grid gap-x-6 gap-y-5 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-flow-col [@media(min-width:641px)]:auto-cols-fr">
            {story.milestones.map((m, i) => {
              const when = m.date ?? pillarLabel(m.pillar as Pillar);
              return (
                <li key={m.moment_id} className="relative">
                  {i < story.milestones.length - 1 && (
                    <span aria-hidden="true" className="absolute top-[4px] left-[9px] h-px w-[calc(100%+24px)] bg-[rgba(var(--ph-accent-rgb),0.45)] [@media(max-width:640px)]:hidden" />
                  )}
                  <Link
                    href={`/dashboard/constellation?moment=${encodeURIComponent(m.moment_id)}`}
                    aria-label={`open this moment: ${when}, ${m.label}`}
                    className="group relative [@media(min-width:641px)]:block [@media(max-width:640px)]:grid [@media(max-width:640px)]:grid-cols-[9px_1fr] [@media(max-width:640px)]:gap-x-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className="block h-[9px] w-[9px] rounded-full bg-[var(--ph-accent)] shadow-[0_0_0_3px_var(--ph-black)] [@media(max-width:640px)]:row-span-2 [@media(max-width:640px)]:mt-[4px]"
                      style={{ opacity: 0.55 + (0.45 * (i + 1)) / story.milestones.length }}
                    />
                    <span className="block text-meta text-ph-tertiary [@media(min-width:641px)]:mt-4">{when}</span>
                    <b className="block text-item [@media(min-width:641px)]:mt-2 [@media(max-width:640px)]:mt-1 text-ph-white transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
                      {m.label}
                    </b>
                  </Link>
                </li>
              );
            })}
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
  const { openId, openModal } = useSettingsModals();
  const [header, setHeader] = useState<Header | null>(null);
  const [constellation, setConstellation] = useState<ConstellationData | null>(null);

  // PHE-148: an account whose profile row has no name still has the name its
  // Google profile carries; the header shows that, never a placeholder.
  const [profileName, setProfileName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setProfileName(nameFromMetadata(data.user?.user_metadata)));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/overview");
      if (res.ok) {
        const body = (await res.json()) as ProfileOverview;
        setHeader({
          name: body.display_name?.trim() ?? "",
          platforms: body.connected_platforms ?? [],
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
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    setHeader({
      name: (profile?.display_name as string | null)?.trim() ?? "",
      platforms: [],
      insights: null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadConstellation = useCallback(() => fetchConstellation().then(setConstellation), []);
  useEffect(() => {
    void loadConstellation();
  }, [loadConstellation]);

  // A settings modal (edit profile, connections) can change what the header
  // shows, platforms included (PHE-149); re-read both when one closes.
  const prevOpen = useRef(openId);
  useEffect(() => {
    if (prevOpen.current !== null && openId === null) {
      void load();
      void loadConstellation();
    }
    prevOpen.current = openId;
  }, [openId, load, loadConstellation]);

  const reading = header?.insights ?? null;
  const name = header?.name || profileName;
  const updated = reading?.generated_at ?? constellation?.generated_at ?? null;
  // Connected platforms count the connections plus every platform the constellation draws on.
  const facts = momentFacts(constellation);
  const platforms = new Set([...(header?.platforms ?? []).map((p) => p.trim().toLowerCase()), ...facts.platforms]);
  const stats = buildInsightsStats(platforms.size, facts.firstYear, constellation?.tenure.since ?? null);

  return (
    <>
      <section className="flex flex-col pb-10 [@media(max-width:640px)]:px-5 [@media(max-width:640px)]:pt-6 [@media(min-width:641px)]:pt-16">
        <IntroBanner tab="insights" copy={INTRO_COPY.insights} className="[@media(max-width:640px)]:mb-8 [@media(min-width:641px)]:mb-6" />
        <div className="w-full">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
            <div className="min-w-0">
              {name && <h1 className="text-display lowercase text-ph-white">{name}</h1>}
              {updated && <p className="mt-1 text-meta text-ph-tertiary">updated {relativeTime(updated)}</p>}
            </div>
            {/* As in the demo: one row 40px apart, each stat at least 86px wide;
                phones keep the three on one row as equal columns. */}
            {stats.length > 0 && (
              <div className="[@media(min-width:641px)]:flex [@media(min-width:641px)]:flex-wrap [@media(min-width:641px)]:gap-x-10 [@media(min-width:641px)]:gap-y-4 [@media(max-width:640px)]:grid [@media(max-width:640px)]:w-full [@media(max-width:640px)]:grid-cols-3 [@media(max-width:640px)]:gap-3">
                {stats.map((stat) => {
                  const body = (
                    <>
                      <span className="text-reading text-ph-white">{stat.value}</span>
                      {/* Inline, so the arrow follows the last word when the label wraps on phones. */}
                      <span className="text-meta text-ph-secondary">
                        {stat.label}
                        {stat.key === "platforms" && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-[3px] inline-block align-[-1px]">
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
                      className="flex [@media(max-width:640px)]:min-w-0 [@media(min-width:641px)]:min-w-[86px] flex-col text-left transition-colors duration-200 hover:text-[var(--ph-accent)]"
                    >
                      {body}
                    </button>
                  ) : (
                    <p key={stat.key} className="flex [@media(max-width:640px)]:min-w-0 [@media(min-width:641px)]:min-w-[86px] flex-col">
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
            <Items items={reading?.patterns} />
          </Disclosure>
        </div>
      </section>
    </>
  );
}
