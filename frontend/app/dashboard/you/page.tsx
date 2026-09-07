"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTier } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch, type ProfileOverview } from "@/lib/api-client";
import { colorName } from "@/lib/stellar";
import { fetchConstellation, type ConstellationData } from "@/lib/constellation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { IntroBanner } from "@/components/phenyx/intro-banner";
import { PanelHeader } from "@/components/phenyx/panel-header";
import { pickHeldConstants } from "./held";
import { buildYouStats, formatJoinedSince } from "./stats";

/** Section labels are lowercase in source; the uppercase treatment is styling. */
function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-5 text-[11px] font-semibold tracking-[0.15em] text-[#FFFDFD]/52 uppercase">
      {children}
    </h2>
  );
}

/**
 * You tab (PHE-91 / PHE-95, v244; formerly Profile). One screen under the
 * shared panel header: identity, connected platforms, your color, the
 * "your constellation" stats block, and what has stayed with you. The grouped
 * settings rows and "get in touch" live on /dashboard/settings, reached from
 * the sidebar gear. Gifted is never shown; freeze/pause does not exist.
 */
export default function YouTabPage() {
  const { isPro } = useTier();
  const { openModal, openId, stellarColor } = useSettingsModals();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [constellation, setConstellation] = useState<ConstellationData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/overview");
      if (res.ok) {
        const body = (await res.json()) as ProfileOverview;
        setOverview({
          ...body,
          held: pickHeldConstants(body.held ?? []),
        });
        return;
      }
    } catch {
      // fall through
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setOverview(null);
      return;
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name, stellar_color, created_at")
      .eq("id", user.id)
      .maybeSingle();
    setOverview({
      display_name: profile?.display_name ?? null,
      email: user.email ?? null,
      joined: formatJoinedSince(profile?.created_at as string | null),
      stellar_color: profile?.stellar_color ?? null,
      connected_platforms: [],
      held: pickHeldConstants([]),
      snapshot: [],
      foresight: null,
      tier: isPro ? "pro" : "free",
      renews_at: null,
      billing_period: null,
    });
  }, [isPro]);

  useEffect(() => {
    void load();
  }, [load]);

  // The stats block reads the same payload the constellation tab renders.
  useEffect(() => {
    let active = true;
    fetchConstellation().then((result) => {
      if (active) setConstellation(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const prevOpen = useRef(openId);
  useEffect(() => {
    if (prevOpen.current !== null && openId === null) void load();
    prevOpen.current = openId;
  }, [openId, load]);

  const displayName = overview?.display_name?.trim() ?? "";
  const email = overview?.email?.trim() ?? "";
  const joined = overview?.joined?.trim() ?? "";
  const platforms = overview?.connected_platforms ?? [];
  const held = overview?.held ?? [];
  const swatch = overview?.stellar_color || stellarColor;
  const stellarName = colorName(swatch);
  const badge = isPro ? "full" : "free";
  const stats = buildYouStats(constellation, platforms.length);

  return (
    <>
      <IntroBanner
        tab="you"
        copy="this is what we know about you so far, and where you can manage your account."
        className="mx-10 mt-10"
      />

      <section className="flex flex-col px-10 pt-8 pb-10">
        <div className="w-full max-w-[820px]">
          <PanelHeader eyebrow="you" title="everything gathered here so far" />

          <div className="mb-[38px] flex flex-wrap items-start gap-x-14 gap-y-8 border-b border-[rgba(255,253,253,0.045)] pb-8">
            <div className="flex min-w-[200px] flex-col gap-1">
              <div className="flex items-center gap-2.5">
                {displayName && (
                  <p className="text-[15px] font-medium tracking-[-0.01em] text-[#FFFDFD]">
                    {displayName}
                  </p>
                )}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-[7px] py-0.5 text-[9px] tracking-[0.14em] uppercase ${
                    isPro
                      ? "border-[rgba(var(--s-rgb),0.4)] text-[var(--s)]"
                      : "border-[#FFFDFD]/18 text-[#FFFDFD]/50"
                  }`}
                >
                  {badge}
                </span>
                <button
                  type="button"
                  title="edit name and email"
                  aria-label="edit name and email"
                  onClick={() => openModal("edit-profile")}
                  className="flex min-h-[26px] min-w-[26px] items-center justify-center p-1.5 text-[#FFFDFD]/60 transition-colors hover:text-[var(--s)]"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
              {email && (
                <p className="text-[13px] tracking-[0.02em] text-[#FFFDFD]/62">
                  {email}
                </p>
              )}
              {joined && (
                <p className="mt-1 text-[11px] tracking-[0.02em] text-[#FFFDFD]/50">
                  {joined}
                </p>
              )}
            </div>

            <div className="min-w-[240px] flex-1">
              <SectionLabel>connected platforms</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {platforms.length === 0 ? (
                  <p className="text-[11px] text-[#888]">no platforms connected.</p>
                ) : (
                  platforms.map((platform) => (
                    <span
                      key={platform}
                      className="rounded-lg border border-[rgba(185,213,255,0.16)] px-[9px] py-0.5 text-[11px] tracking-[0.03em] lowercase text-[#888]"
                    >
                      {platform}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="min-w-[220px]">
              <SectionLabel>your color</SectionLabel>
              <div className="flex items-center gap-3">
                <div
                  className="h-[18px] w-[18px] shrink-0 rounded-full"
                  style={{
                    background: swatch,
                    boxShadow: `0 0 10px color-mix(in srgb, ${swatch} 40%, transparent)`,
                  }}
                  aria-hidden="true"
                />
                <p className="text-[13.5px] font-light leading-relaxed text-[#FFFDFD]/72">
                  {stellarName}
                </p>
              </div>
            </div>
          </div>

          {stats.length > 0 && (
            <div className="mb-[52px]">
              <SectionLabel>your constellation</SectionLabel>
              <dl className="flex flex-col gap-3">
                {stats.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[minmax(0,140px)_auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 border-b border-[rgba(255,253,253,0.06)] py-2.5 last:border-b-0 max-sm:grid-cols-[1fr_auto]"
                  >
                    <dt className="text-[12px] tracking-[0.12em] text-[rgba(255,253,253,0.5)] uppercase">
                      {row.label}
                    </dt>
                    <dd className="m-0 text-[17px] font-normal text-[rgba(255,253,253,0.92)]">
                      {row.value}
                    </dd>
                    {row.note && (
                      <dd className="m-0 text-[13px] text-[rgba(255,253,253,0.55)] max-sm:col-span-full">
                        {row.note}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mb-[52px]">
            <SectionLabel>what has stayed with you</SectionLabel>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {held.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[rgba(255,253,253,0.045)] bg-[#FFFDFD]/[0.008] px-[22px] py-5"
                >
                  <p className="mb-1.5 text-[13px] tracking-[0.01em] text-[var(--s)]">
                    {item.title}
                  </p>
                  <p className="text-[13px] leading-relaxed text-[#FFFDFD]/78">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
