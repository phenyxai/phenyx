"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { useTier, applyTierUI, type Tier } from "@/lib/use-tier";
import { trackTabVisit, trackTabDuration } from "@/lib/analytics";
import { DASHBOARD_HOME, DASHBOARD_TABS, SETTINGS_HREF, segmentTab, tabTransition } from "@/lib/dashboard-nav";
import type { TabClock } from "@/lib/dashboard-nav";
import { GearIcon, NavIcon } from "@/components/phenyx/nav-icons";
import { StellarMark } from "@/components/phenyx/stellar-mark";

/** Per-viewer convenience only: whether the desktop sidebar is folded to its icon rail. */
const COLLAPSED_KEY = "phenyx:sidebar-collapsed";

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
      className="ml-1.5 text-[12px] tracking-[0.08em] lowercase text-ph-white/65"
    >
      free
    </span>
  );
}

/**
 * Orbit mark + wordmark, linking home. Shared by the sidebar and the phone top
 * bar. The mark is the circular stellar icon in the person's accent. The
 * wordmark is a RailLabel, so the icon rail keeps only the mark.
 */
function BrandLink() {
  return (
    <Link href={DASHBOARD_HOME} aria-label="PHENYX, go to constellation" className="flex items-center gap-2.5 no-underline">
      <StellarMark revealed />
      <RailLabel className="text-[11.5px] font-semibold tracking-[0.09em] text-ph-white/90">PHENYX</RailLabel>
    </Link>
  );
}

/**
 * Text that folds away on the icon rail: when the sidebar is collapsed
 * (`data-collapsed` on the nav) and always from 641 to 999px, where tablets get
 * the rail instead of the full sidebar. It stays readable to screen readers.
 */
function RailLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`${className} group-data-[collapsed=true]/side:sr-only rail:sr-only`}
    >
      {children}
    </span>
  );
}

/** Sidebar rows share one shape: the four tabs and settings at the foot. Hover lights the icon in the accent. */
function navItemClass(isActive: boolean, size = "text-[16px]"): string {
  return `group/item flex h-11 items-center gap-3 rounded-xl px-3 ${size} font-light lowercase transition-colors duration-200 motion-reduce:transition-none group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0 rail:justify-center rail:px-0 ${
    isActive ? "text-ph-white/90" : "text-ph-white/60 hover:text-ph-white/85"
  }`;
}

/** Icon slot of a sidebar row: accent when active or hovered (--ph-accent, PHE-98, stellar var as fallback). */
function NavItemIcon({ isActive, children }: { isActive: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex shrink-0 transition-colors duration-200 ${
        isActive ? "text-[var(--ph-accent,var(--s))]" : "text-ph-white/45 group-hover/item:text-[var(--ph-accent,var(--s))]"
      }`}
    >
      {children}
    </span>
  );
}

/** The chevron that folds the sidebar to its rail (‹) and opens it again (›). */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} />
    </svg>
  );
}

/** Settings gear in the phone top bar (the sidebar foot carries a full row instead). */
function SettingsLink({ active }: { active: boolean }) {
  return (
    <Link
      href={SETTINGS_HREF}
      aria-label="settings"
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : undefined}
      className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none ${
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
 * Top to bottom: brand (orbit mark + PHENYX + plan tier), the four tabs in
 * DASHBOARD_TABS order with their icons, and settings at the foot, a regular
 * row with a gear (PHE-126), beside the chevron that folds the sidebar to an
 * icon rail (PHE-129). From 641 to 999px it is always the rail. At or below
 * 640px it is display:none and the bottom nav plus MobileTopBar take over. It
 * stays mounted there, so the session bounce and tab analytics below still run
 * on phones.
 */
export function DashboardSidebar() {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const active = segmentTab(segment);
  const [collapsed, setCollapsed] = useState(false);

  // The fold is remembered per browser; read after mount so SSR matches.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((was) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, was ? "0" : "1");
      } catch {}
      return !was;
    });
  };

  // Engagement instrumentation (PHE-35). The sidebar persists and observes the
  // active route segment, so its segment change is the single source of truth
  // for tab_visit/tab_duration — instrumenting here fires on EVERY navigation
  // (sidebar or bottom-nav click, back/forward, programmatic) exactly once, and
  // avoids the double-count a per-link onClick would cause. The ref holds the
  // tab we're on and when we entered it so we can emit the duration for the
  // tab being left.
  const clockRef = useRef<TabClock>({ tab: null, enteredAt: Date.now() });

  // Authenticated shell: bounce to sign-in if there is no session. Runs on
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
      data-collapsed={collapsed ? "true" : undefined}
      className="group/side sticky top-0 h-screen w-[224px] shrink-0 flex-col border-r border-ph-white/[0.055] bg-[var(--ph-black,#080808)] px-5 pt-8 pb-6 data-[collapsed=true]:w-[62px] data-[collapsed=true]:px-2.5 [@media(max-width:640px)]:hidden [@media(min-width:641px)]:flex rail:w-[62px] rail:px-2.5"
    >
      <div className="mb-7 flex items-center gap-1 border-b border-ph-white/[0.055] pb-[22px] group-data-[collapsed=true]/side:justify-center rail:justify-center">
        <BrandLink />
        {/* flex, so the badge gets its own line box and sits level with PHENYX
            instead of on the baseline of a 16px line. */}
        <RailLabel className="flex">
          <TierBadge />
        </RailLabel>
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
                className={navItemClass(isActive)}
              >
                <NavItemIcon isActive={isActive}>
                  <NavIcon tab={tab.id} size={17} />
                </NavItemIcon>
                <RailLabel>{tab.label}</RailLabel>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Settings sits at the foot as a regular row with a gear, styled like
          the tabs and lit in the accent while its segment is active. The fold
          chevron sits beside it, and under it on the rail, so the way back
          stays in reach. Tablets have no chevron: the rail is their layout. */}
      <div className="mt-auto flex items-center gap-1 group-data-[collapsed=true]/side:flex-col group-data-[collapsed=true]/side:gap-3">
        <Link
          href={SETTINGS_HREF}
          aria-current={active === "settings" ? "page" : undefined}
          data-active={active === "settings" ? "true" : undefined}
          className={`min-w-0 flex-1 ${navItemClass(active === "settings", "text-[14px]")} group-data-[collapsed=true]/side:w-full`}
        >
          <NavItemIcon isActive={active === "settings"}>
            <GearIcon size={16} />
          </NavItemIcon>
          <RailLabel>settings</RailLabel>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "open the sidebar" : "collapse the sidebar"}
          aria-expanded={!collapsed}
          className="h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-ph-white/45 transition-colors duration-200 hover:text-[var(--ph-accent,var(--s))] [@media(max-width:999px)]:hidden [@media(min-width:1000px)]:flex"
        >
          <Chevron open={!collapsed} />
        </button>
      </div>
    </nav>
  );
}

/**
 * Phone-width top bar: the brand linking home, the plan tier beside it, and
 * the settings gear (phones have no drawer, so this is how settings stays
 * reachable). Rendered at the top of the main column; hidden above 640px,
 * where the sidebar is in view.
 */
export function MobileTopBar() {
  const segment = useSelectedLayoutSegment();
  return (
    <header className="sticky top-0 z-[110] h-[calc(52px+env(safe-area-inset-top,0px))] items-center gap-2 border-b border-ph-white/[0.07] bg-[color-mix(in_srgb,var(--ph-black,#080808)_94%,transparent)] px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-[14px] [@media(max-width:640px)]:flex [@media(min-width:641px)]:hidden">
      <BrandLink />
      <TierBadge />
      <SettingsLink active={segmentTab(segment) === "settings"} />
    </header>
  );
}
