"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { useTier, applyTierUI, type Tier } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackTabVisit, trackTabDuration } from "@/lib/analytics";
import { DASHBOARD_HOME, DASHBOARD_TABS, SETTINGS_HREF, segmentTab, tabTransition } from "@/lib/dashboard-nav";
import type { TabClock } from "@/lib/dashboard-nav";
import { GearIcon, NavIcon } from "@/components/phenyx/nav-icons";

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

const ShellTierContext = createContext<Tier>("free");

/**
 * Reads the tier once for the shell chrome. The sidebar and the phone top bar
 * each show a TierBadge (one of them hidden at any width), and both read this
 * instead of running their own useTier() query.
 */
export function ShellTierProvider({ children }: { children: ReactNode }) {
  const { tier } = useTier();
  return <ShellTierContext.Provider value={tier}>{children}</ShellTierContext.Provider>;
}

/**
 * The plan tier beside the PHENYX wordmark: "free" or "full" (gifted reads
 * full). Text + data-tier are owned by applyTierUI; the static "free" is the
 * pre-load default, and the element is only mutated, never remounted.
 */
function TierBadge() {
  const tier = useContext(ShellTierContext);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    applyTierUI(tier, { badge: ref.current });
  }, [tier]);
  return (
    <span
      ref={ref}
      data-tier="free"
      className="text-[10px] tracking-[0.08em] lowercase text-[color-mix(in_srgb,var(--ph-accent,var(--s))_76%,transparent)]"
    >
      free
    </span>
  );
}

/** Orb + wordmark, linking home. Shared by the sidebar and the phone top bar. */
function BrandLink() {
  return (
    <Link href={DASHBOARD_HOME} className="flex items-center gap-2.5 no-underline">
      <span aria-hidden="true" className="h-[16px] w-[16px] shrink-0 rounded-full" style={ORB_STYLE} />
      <span className="text-[12px] font-semibold tracking-[0.14em] text-ph-white">PHENYX</span>
    </Link>
  );
}

/** Settings gear: the account row on desktop, the top bar on phones. */
function SettingsLink({ active, size }: { active: boolean; size: string }) {
  return (
    <Link
      href={SETTINGS_HREF}
      aria-label="settings"
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : undefined}
      className={`ml-auto flex ${size} shrink-0 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none ${
        active
          ? "border-[rgba(var(--s-rgb),0.35)] bg-[rgba(var(--s-rgb),0.10)] text-ph-white"
          : "border-ph-white/10 text-ph-white/70 hover:border-ph-white/20 hover:bg-ph-white/[0.05] hover:text-ph-white"
      }`}
    >
      <GearIcon />
    </Link>
  );
}

/**
 * Persistent left sidebar for the dashboard shell (v244, PHE-96). Lives in the
 * dashboard layout so it does NOT remount on tab change — Constellation
 * canvas/RAF state survives navigating away and back. The active tab derives
 * from the route segment (no client-only tab state that can desync from the URL).
 *
 * Top to bottom: brand (stellar orb + PHENYX + plan tier), the four tabs in
 * DASHBOARD_TABS order with their icons, and the account row (first name +
 * settings gear). Desktop only: at or below 760px it is display:none and the
 * bottom nav plus MobileTopBar take over. It stays mounted there, so the
 * session bounce and tab analytics below still run on phones.
 */
export function DashboardSidebar() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const { openId } = useSettingsModals();
  const [name, setName] = useState("you");
  const active = segmentTab(segment);

  // Engagement instrumentation (PHE-35). The sidebar persists and observes the
  // active route segment, so its segment change is the single source of truth
  // for tab_visit/tab_duration — instrumenting here fires on EVERY navigation
  // (sidebar or bottom-nav click, back/forward, programmatic) exactly once, and
  // avoids the double-count a per-link onClick would cause. The ref holds the
  // tab we're on and when we entered it so we can emit the duration for the
  // tab being left.
  const clockRef = useRef<TabClock>({ tab: null, enteredAt: Date.now() });

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

  // Tab engagement: on each segment change, emit a tab_duration for the tab
  // being left, then a tab_visit for the newly-active tab (rules in
  // tabTransition). The first run (mount) emits the landing tab_visit with
  // previous=null and no duration. Fires on segment change only — not on mount
  // of individual tab content.
  useEffect(() => {
    const { clock, duration, visit } = tabTransition(clockRef.current, segment, Date.now());
    if (duration) trackTabDuration(duration.tab, duration.seconds);
    if (visit) trackTabVisit(visit.tab, visit.previous);
    clockRef.current = clock;
  }, [segment]);

  return (
    <nav
      aria-label="dashboard"
      className="sticky top-0 h-screen w-[240px] shrink-0 flex-col border-r border-[rgba(255,253,253,0.08)] bg-[var(--ph-black,#080808)] px-5 pt-7 pb-7 [@media(max-width:760px)]:hidden [@media(min-width:761px)]:flex"
    >
      <div className="mb-2 flex items-center gap-2 border-b border-ph-white/[0.07] pb-[18px]">
        <BrandLink />
        <TierBadge />
      </div>

      {/* Tab nav — rendered in DASHBOARD_TABS order, never sorted. The active
          item carries aria-current="page" + data-active for styling hooks. */}
      <ul className="flex flex-col gap-1">
        {DASHBOARD_TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive ? "true" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-[11px] text-[14px] lowercase transition-colors motion-reduce:transition-none ${
                  isActive
                    ? "bg-ph-white/[0.05] font-medium text-ph-white/90"
                    : "text-ph-white/50 hover:bg-ph-white/[0.04] hover:text-ph-white/70"
                }`}
              >
                {/* Accent read as --ph-accent (PHE-98) with the stellar var as fallback. */}
                <span
                  className={`flex shrink-0 ${isActive ? "text-[var(--ph-accent,var(--s))]" : "text-ph-white/40"}`}
                >
                  <NavIcon tab={tab.id} size={17} />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Account row: first name + settings gear. The gear lights up in the
          accent while the settings segment is active. */}
      <div className="mt-auto flex items-center gap-[11px] border-t border-ph-white/[0.07] pt-3.5">
        <span className="min-w-0 truncate text-[13.5px] font-medium text-ph-white">{name}</span>
        <SettingsLink active={active === "settings"} size="h-8 w-8" />
      </div>
    </nav>
  );
}

/**
 * Phone-width top bar: the brand linking home, the plan tier beside it, and
 * the settings gear (phones have no drawer, so this is how settings stays
 * reachable). Rendered at the top of the main column; hidden above 760px,
 * where the sidebar is in view.
 */
export function MobileTopBar() {
  const segment = useSelectedLayoutSegment();
  return (
    <header className="sticky top-0 z-[110] h-[calc(52px+env(safe-area-inset-top,0px))] items-center gap-2 border-b border-ph-white/[0.07] bg-[color-mix(in_srgb,var(--ph-black,#080808)_94%,transparent)] px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-[14px] [@media(max-width:760px)]:flex [@media(min-width:761px)]:hidden">
      <BrandLink />
      <TierBadge />
      <SettingsLink active={segmentTab(segment) === "settings"} size="h-9 w-9" />
    </header>
  );
}
