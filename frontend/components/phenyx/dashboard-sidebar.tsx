"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { useTier, applyTierUI } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackTabVisit, trackTabDuration } from "@/lib/analytics";
import { DRAWER_ID, useDashboardDrawer } from "@/components/phenyx/dashboard-drawer";

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

/** Shared by the sidebar close button and the top bar toggle. */
const ICON_BUTTON =
  "h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FFFDFD]/10 text-[#FFFDFD]/80 transition-colors active:bg-[#FFFDFD]/[0.06] motion-reduce:transition-none";

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
 * links, and the account row (first name + settings gear). At or below 760px
 * it becomes an off-canvas drawer (see dashboard-drawer.tsx), opened from
 * MobileTopBar or MobileBottomNav; closed, it is inert so its links drop out of
 * the tab order.
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
  const { open, isPhone, setOpen } = useDashboardDrawer();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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

  // Drawer: a navigation closes it (covers back/forward too).
  useEffect(() => {
    setOpen(false);
  }, [segment, setOpen]);

  // Drawer focus: move into the drawer on open and back to whatever opened it
  // on close. Escape closes.
  useEffect(() => {
    if (!open) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return;
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

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
      id={DRAWER_ID}
      aria-label="dashboard"
      inert={isPhone && !open}
      className={`flex shrink-0 flex-col border-r border-[#1a1a1a] bg-[#0A0A0A] px-5 pt-7 [@media(min-width:761px)]:sticky [@media(min-width:761px)]:top-0 [@media(min-width:761px)]:h-screen [@media(min-width:761px)]:w-[240px] [@media(min-width:761px)]:pb-7 [@media(max-width:760px)]:fixed [@media(max-width:760px)]:inset-y-0 [@media(max-width:760px)]:left-0 [@media(max-width:760px)]:z-[140] [@media(max-width:760px)]:w-[min(280px,84vw)] [@media(max-width:760px)]:pb-[calc(20px+env(safe-area-inset-bottom,0px))] [@media(max-width:760px)]:transition-transform [@media(max-width:760px)]:duration-300 [@media(max-width:760px)]:ease-out motion-reduce:transition-none ${
        open
          ? "[@media(max-width:760px)]:translate-x-0 [@media(max-width:760px)]:shadow-[0_0_40px_rgba(0,0,0,0.6)]"
          : "[@media(max-width:760px)]:-translate-x-full"
      }`}
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
        <button
          ref={closeRef}
          type="button"
          aria-label="close menu"
          onClick={() => setOpen(false)}
          className={`${ICON_BUTTON} [@media(max-width:760px)]:flex [@media(min-width:761px)]:hidden`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
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
                onClick={() => setOpen(false)}
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
          onClick={() => {
            setOpen(false);
            router.push("/dashboard/settings");
          }}
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

/**
 * Phone-width top bar: the brand mark and the hamburger that toggles the
 * sidebar drawer. Rendered at the top of the main column; hidden above 760px,
 * where the sidebar is always in view.
 */
export function MobileTopBar() {
  const { open, toggle } = useDashboardDrawer();
  return (
    <header className="sticky top-0 z-[110] h-[calc(52px+env(safe-area-inset-top,0px))] items-center gap-2.5 border-b border-[#FFFDFD]/[0.07] bg-[rgba(8,8,8,0.94)] px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-[14px] [@media(max-width:760px)]:flex [@media(min-width:761px)]:hidden">
      <button
        type="button"
        aria-label={open ? "close menu" : "open menu"}
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={toggle}
        className={`${ICON_BUTTON} flex`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span aria-hidden="true" className="h-[16px] w-[16px] shrink-0 rounded-full" style={ORB_STYLE} />
      <span className="text-[12px] font-semibold tracking-[0.14em] text-[#FFFDFD]">PHENYX</span>
    </header>
  );
}
