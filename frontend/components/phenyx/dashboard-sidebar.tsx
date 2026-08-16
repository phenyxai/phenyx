"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { useTier, applyTierUI } from "@/lib/use-tier";
import { trackTabVisit, trackTabDuration } from "@/lib/analytics";

/**
 * Nav items in fixed product order. Rendered in array order — never sorted.
 * (Daily, Polaris, Constellation, Profile.)
 */
const TABS = [
  { id: "daily", label: "daily" },
  { id: "polaris", label: "polaris" },
  { id: "constellation", label: "constellation" },
  { id: "profile", label: "profile" },
] as const;

/**
 * Persistent left sidebar for the dashboard shell. Lives in the dashboard layout
 * so it does NOT remount on tab change — Constellation canvas/RAF state survives
 * navigating away and back. The active tab derives from the route segment (no
 * client-only tab state that can desync from the URL).
 *
 * Tier-dependent UI (upgrade button visibility + footer badge label) is applied
 * through the single applyTierUI() authority on load and on any tier change; the
 * upgrade button and badge are always rendered and only toggled, so their DOM
 * identity stays stable.
 */
export function DashboardSidebar() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const { tier } = useTier();

  const upgradeRef = useRef<HTMLButtonElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);

  // Engagement instrumentation (PHE-35). The sidebar persists and observes the
  // active route segment, so its segment change is the single source of truth
  // for tab_visit/tab_duration — instrumenting here fires on EVERY navigation
  // (sidebar click, back/forward, programmatic) exactly once, and avoids the
  // double-count a per-link onClick would cause. Refs hold the tab we're on and
  // when we entered it so we can emit the duration for the tab being left.
  const activeTabRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

  // Authenticated shell: bounce to sign-in if there is no session. Runs once on
  // mount of the persistent sidebar (does not re-run on tab change).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active && !user) router.replace("/signin");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // The one authority for tier-dependent shell UI. Re-applied on every tier
  // change; toggles via DOM mutation rather than conditional unmount.
  useEffect(() => {
    applyTierUI(tier, { upgradeButton: upgradeRef.current, badge: badgeRef.current });
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
      className="flex h-screen w-[240px] shrink-0 flex-col border-r border-[#1a1a1a] bg-[#0A0A0A] px-5 py-7 sticky top-0"
    >
      {/* Tab nav — rendered in TABS order, never sorted. */}
      <ul className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const isActive = segment === tab.id;
          return (
            <li key={tab.id}>
              <Link
                href={`/dashboard/${tab.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-[14px] font-light lowercase tracking-wide transition-colors motion-reduce:transition-none ${
                  isActive
                    ? "bg-[#141414] text-[#FFFDFD]"
                    : "text-[#FFFDFD]/50 hover:text-[#FFFDFD]/80"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Upgrade CTA — hidden for pro/gifted via applyTierUI (display:none). */}
      <button
        ref={upgradeRef}
        type="button"
        onClick={() => router.push("/upgrade")}
        className="mt-6 w-full rounded-full border border-[#FFFDFD]/15 px-4 py-2.5 text-[13px] font-light lowercase tracking-wide text-[#FFFDFD]/80 transition-colors hover:border-[#FFFDFD]/40 hover:text-[#FFFDFD] motion-reduce:transition-none"
      >
        upgrade to pro
      </button>

      {/* Footer: PHENYX logo + tier badge. Badge text + data-tier owned by
          applyTierUI; the static "free" / data-tier here is the pre-load default. */}
      <footer className="mt-auto flex items-center gap-2.5 pt-6">
        <Image src="/phenyx-logo.png" alt="PHENYX" width={20} height={20} className="opacity-90" />
        <span
          ref={badgeRef}
          data-tier="free"
          className="rounded-full border border-[#FFFDFD]/10 px-2 py-0.5 text-[11px] lowercase tracking-wide text-[#FFFDFD]/45"
        >
          free
        </span>
      </footer>
    </nav>
  );
}
