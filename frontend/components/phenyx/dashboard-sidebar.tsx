"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { useTier, applyTierUI } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackTabVisit, trackTabDuration } from "@/lib/analytics";

/**
 * Nav items in fixed product order. Rendered in array order — never sorted.
 * (Daily, Polaris, Constellation, You.) Settings is not a tab: it is reached
 * from the gear in the account row and lives at /dashboard/settings.
 */
const TABS = [
  { id: "daily", label: "daily" },
  { id: "polaris", label: "polaris" },
  { id: "constellation", label: "constellation" },
  { id: "you", label: "you" },
] as const;

/** The brand orb carries the user's stellar color (`--s`), personalising the mark. */
const ORB_STYLE = {
  background:
    "radial-gradient(circle at 42% 42%, var(--s) 0%, var(--s) 42%, color-mix(in srgb, var(--s) 55%, transparent) 60%, transparent 100%)",
  boxShadow: "0 0 10px color-mix(in srgb, var(--s) 40%, transparent)",
} as const;

/** First word of a display name; "you" when there is none to show. */
function firstName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first || "you";
}

async function fetchFirstName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return firstName(data?.display_name);
}

/**
 * Persistent left sidebar for the dashboard shell (v244). Lives in the dashboard
 * layout so it does NOT remount on tab change — Constellation canvas/RAF state
 * survives navigating away and back. The active tab derives from the route
 * segment (no client-only tab state that can desync from the URL).
 *
 * Top to bottom: brand block (stellar orb + PHENYX + plan pill), the four tab
 * links, and the account row (first name + settings gear). Hidden at or below
 * 760px, where MobileBottomNav takes over.
 *
 * The plan pill's label is applied through the single applyTierUI() authority
 * on load and on any tier change; the pill is always rendered and only mutated,
 * so its DOM identity stays stable.
 */
export function DashboardSidebar() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const { tier } = useTier();
  const { openId } = useSettingsModals();

  const badgeRef = useRef<HTMLSpanElement>(null);
  const [name, setName] = useState("you");
  const isSettings = segment === "settings";

  // Engagement instrumentation (PHE-35). The sidebar persists and observes the
  // active route segment, so its segment change is the single source of truth
  // for tab_visit/tab_duration — instrumenting here fires on EVERY navigation
  // (sidebar click, back/forward, programmatic) exactly once, and avoids the
  // double-count a per-link onClick would cause. Refs hold the tab we're on and
  // when we entered it so we can emit the duration for the tab being left.
  const activeTabRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

  // Authenticated shell: bounce to sign-in if there is no session, otherwise
  // read the display name once for the account row. Runs on mount of the
  // persistent sidebar (does not re-run on tab change).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/signin");
        return;
      }
      const next = await fetchFirstName(user.id);
      if (active) setName(next);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // The edit-profile modal can change the display name; re-read it when that
  // modal closes so the account row never shows a stale name.
  const prevOpenRef = useRef(openId);
  useEffect(() => {
    const closedEditProfile = prevOpenRef.current === "edit-profile" && openId === null;
    prevOpenRef.current = openId;
    if (!closedEditProfile) return;
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const next = await fetchFirstName(user.id);
      if (active) setName(next);
    })();
    return () => {
      active = false;
    };
  }, [openId]);

  // The one authority for tier-dependent shell UI. Re-applied on every tier
  // change; toggles via DOM mutation rather than conditional unmount.
  useEffect(() => {
    applyTierUI(tier, { badge: badgeRef.current });
  }, [tier]);

  // Tab engagement: on each segment change, emit a tab_duration for the tab
  // being left, then a tab_visit for the newly-active tab. The first run (mount)
  // emits the landing tab_visit with previous=null and no duration. Fires on
  // segment change only — not on mount of individual tab content.
  useEffect(() => {
    const tab = segment ?? "daily";
    const previous = activeTabRef.current;
    if (previous === tab) return;
    if (previous !== null) {
      const seconds = Math.max(0, Math.round((Date.now() - enteredAtRef.current) / 1000));
      trackTabDuration(previous, seconds);
    }
    trackTabVisit(tab, previous);
    activeTabRef.current = tab;
    enteredAtRef.current = Date.now();
  }, [segment]);

  return (
    <nav
      aria-label="dashboard"
      className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[#1a1a1a] bg-[#0A0A0A] px-5 py-7 [@media(max-width:760px)]:hidden"
    >
      {/* Brand block: stellar orb + wordmark + plan pill. Pill text + data-tier
          owned by applyTierUI; the static "free" / data-tier here is the
          pre-load default. */}
      <div className="mb-2 flex items-center gap-2.5 border-b border-[#FFFDFD]/[0.07] pb-[18px]">
        <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-full" style={ORB_STYLE} />
        <span className="text-[12.5px] font-semibold tracking-[0.14em] text-[#FFFDFD]">PHENYX</span>
        <span
          ref={badgeRef}
          data-tier="free"
          className="ml-auto rounded-full border border-[rgba(var(--s-rgb),0.3)] px-[9px] py-[3px] text-[10px] tracking-[0.12em] uppercase text-[rgba(var(--s-rgb),0.9)]"
        >
          free
        </span>
      </div>

      {/* Tab nav — rendered in TABS order, never sorted. */}
      <ul className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const isActive = segment === tab.id;
          return (
            <li key={tab.id}>
              <Link
                href={`/dashboard/${tab.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-xl px-3 py-[11px] text-[14px] lowercase transition-colors motion-reduce:transition-none ${
                  isActive
                    ? "bg-[#FFFDFD]/[0.05] font-medium text-[#FFFDFD]/90"
                    : "text-[#FFFDFD]/50 hover:bg-[#FFFDFD]/[0.04] hover:text-[#FFFDFD]/70"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Account row: first name + settings gear. The gear lights up in the
          accent while the settings segment is active. */}
      <div className="mt-auto flex items-center gap-[11px] border-t border-[#FFFDFD]/[0.07] pt-3.5">
        <span className="min-w-0 truncate text-[13.5px] font-medium text-[#FFFDFD]">{name}</span>
        <button
          type="button"
          aria-label="settings"
          aria-current={isSettings ? "page" : undefined}
          onClick={() => router.push("/dashboard/settings")}
          className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none ${
            isSettings
              ? "border-[rgba(var(--s-rgb),0.35)] bg-[rgba(var(--s-rgb),0.10)] text-[#FFFDFD]"
              : "border-[#FFFDFD]/10 text-[#FFFDFD]/70 hover:border-[#FFFDFD]/20 hover:bg-[#FFFDFD]/[0.05] hover:text-[#FFFDFD]"
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
