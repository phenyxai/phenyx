"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { DRAWER_ID, useDashboardDrawer } from "@/components/phenyx/dashboard-drawer";

// ============================================================================
// Mobile bottom nav (PHE-91 / v244)
// ----------------------------------------------------------------------------
// At or below 760px the sidebar becomes a drawer and this fixed bar drives
// navigation: daily, polaris, stars (constellation), you, and a menu item that
// toggles the sidebar drawer (every destination plus the account row and
// settings). The active item mirrors the route segment, the same way the
// sidebar does. Rendered once from the dashboard layout; hidden on desktop.
// Display is set by a media variant on both sides — see the Onairos note in
// dashboard-drawer.tsx.
// ============================================================================

type TabId = "daily" | "polaris" | "constellation" | "you";

const BAR_ITEMS: readonly { id: TabId; label: string }[] = [
  { id: "daily", label: "daily" },
  { id: "polaris", label: "polaris" },
  { id: "constellation", label: "stars" },
  { id: "you", label: "you" },
];

/** 20px stroke icons, paths from the v244 prototype. */
const ICONS: Record<TabId, ReactNode> = {
  daily: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </>
  ),
  polaris: <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />,
  constellation: (
    <>
      <circle cx="6" cy="7" r="1.4" />
      <circle cx="17" cy="6" r="1.4" />
      <circle cx="12" cy="13" r="1.4" />
      <circle cx="8" cy="18" r="1.4" />
      <path d="M7 8l4 4M13 12l3-5M11 14l-2 3" />
    </>
  ),
  you: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </>
  ),
};

function Icon({ children, strokeWidth = 1.7 }: { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ITEM_BASE =
  "flex min-w-0 flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 transition-colors motion-reduce:transition-none";
const ITEM_ON = "text-[var(--s)]";
const ITEM_OFF = "text-white/50";

export function MobileBottomNav() {
  const segment = useSelectedLayoutSegment();
  const active = segment ?? "daily";
  const { open, toggle } = useDashboardDrawer();

  return (
    <nav
      aria-label="sections"
      className="fixed inset-x-0 bottom-0 z-[120] items-stretch justify-around border-t border-white/[0.07] bg-black/94 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-[14px] [@media(max-width:760px)]:flex [@media(min-width:761px)]:hidden"
    >
      {BAR_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <Link
            key={item.id}
            href={`/dashboard/${item.id}`}
            aria-current={isActive ? "page" : undefined}
            className={`${ITEM_BASE} ${isActive ? ITEM_ON : ITEM_OFF}`}
          >
            <span className="flex h-[22px] items-center justify-center">
              <Icon>{ICONS[item.id]}</Icon>
            </span>
            <span className="text-[10px] tracking-[0.02em]">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={toggle}
        className={`${ITEM_BASE} ${active === "settings" ? ITEM_ON : ITEM_OFF}`}
      >
        <span className="flex h-[22px] items-center justify-center">
          <Icon strokeWidth={1.9}>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </Icon>
        </span>
        <span className="text-[10px] tracking-[0.02em]">menu</span>
      </button>
    </nav>
  );
}

export default MobileBottomNav;
