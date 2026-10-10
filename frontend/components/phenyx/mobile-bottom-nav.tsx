"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { DASHBOARD_TABS, segmentTab } from "@/lib/dashboard-nav";
import { NavIcon } from "@/components/phenyx/nav-icons";

// ============================================================================
// Mobile bottom nav (PHE-91 / v244, PHE-96)
// ----------------------------------------------------------------------------
// At or below 760px this fixed bar is the only navigation: constellation,
// discover, polaris, insights, in DASHBOARD_TABS order (the sidebar's order).
// There is no drawer; settings sits in MobileTopBar. The active item mirrors
// the route segment, the same way the sidebar does, and carries
// aria-current="page" + data-active. Rendered once from the dashboard layout.
//
// NOTE (Onairos CSS collision): onairos.css ships its own Tailwind utilities
// (.flex, .hidden, .fixed, .block, ...) and loads after globals.css, so a bare
// utility beats our responsive variant for the same property. Anything that
// changes between phone and desktop sets BOTH sides with a media variant
// ([@media(max-width:760px)]: and [@media(min-width:761px)]:) and never pairs
// a bare utility with one.
// ============================================================================

const ITEM_BASE =
  "flex min-w-0 flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 transition-colors motion-reduce:transition-none";
// Accent read as --ph-accent (PHE-98) with the stellar var as fallback.
const ITEM_ON = "text-[var(--ph-accent,var(--s))]";
const ITEM_OFF = "text-[#FFFDFD]/50";

export function MobileBottomNav() {
  const active = segmentTab(useSelectedLayoutSegment());

  return (
    <nav
      aria-label="sections"
      className="fixed inset-x-0 bottom-0 z-[120] items-stretch justify-around border-t border-[#FFFDFD]/[0.07] bg-[color-mix(in_srgb,var(--ph-black,#080808)_94%,transparent)] px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-[14px] [@media(max-width:760px)]:flex [@media(min-width:761px)]:hidden"
    >
      {DASHBOARD_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            data-active={isActive ? "true" : undefined}
            className={`${ITEM_BASE} ${isActive ? ITEM_ON : ITEM_OFF}`}
          >
            <span className="flex h-[22px] items-center justify-center">
              <NavIcon tab={tab.id} size={20} />
            </span>
            <span className="text-[10px] tracking-[0.02em]">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
