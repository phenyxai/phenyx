"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

// ============================================================================
// Mobile bottom nav + menu sheet (PHE-91 / v244)
// ----------------------------------------------------------------------------
// At or below 760px the sidebar is hidden and this fixed bar drives navigation:
// daily, polaris, stars (constellation), you, and a menu item that opens a
// bottom sheet listing every destination plus settings. The active item
// mirrors the route segment, the same way the sidebar does. Rendered once from
// the dashboard layout; hidden on desktop by the same media query that hides
// the sidebar on mobile.
// ============================================================================

type TabId = "daily" | "polaris" | "constellation" | "you";

const BAR_ITEMS: readonly { id: TabId; label: string }[] = [
  { id: "daily", label: "daily" },
  { id: "polaris", label: "polaris" },
  { id: "constellation", label: "stars" },
  { id: "you", label: "you" },
];

const SHEET_ITEMS: readonly { id: TabId; label: string }[] = [
  { id: "daily", label: "daily" },
  { id: "polaris", label: "polaris" },
  { id: "constellation", label: "constellation" },
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
const ITEM_OFF = "text-[#FFFDFD]/50";
const SHEET_ROW =
  "block w-full rounded-[10px] px-1.5 py-[15px] text-left text-[16px] text-[#FFFDFD]/90 transition-colors active:bg-[#FFFDFD]/[0.04] motion-reduce:transition-none";

export function MobileBottomNav() {
  const segment = useSelectedLayoutSegment();
  const active = segment ?? "daily";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    menuRef.current?.focus();
  }, []);

  // The sheet closes on Escape, on a scrim tap, or on a row tap (below). Focus
  // moves into the panel while it is open and returns to the menu item after.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <nav
        aria-label="sections"
        className="fixed inset-x-0 bottom-0 z-[120] hidden items-stretch justify-around border-t border-[#FFFDFD]/[0.07] bg-[rgba(8,8,8,0.94)] px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] backdrop-blur-[14px] [@media(max-width:760px)]:flex"
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
          ref={menuRef}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav-sheet"
          onClick={() => setOpen(true)}
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

      {open && (
        <div id="mobile-nav-sheet" className="fixed inset-0 z-[130] hidden [@media(max-width:760px)]:block">
          <div
            aria-hidden="true"
            onClick={close}
            className="animate-in fade-in absolute inset-0 bg-black/50 duration-200 motion-reduce:animate-none"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="navigate"
            tabIndex={-1}
            className="animate-in slide-in-from-bottom absolute inset-x-0 bottom-0 rounded-t-[20px] border-t border-[#FFFDFD]/[0.08] bg-[#0c0c0c] px-4 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] outline-none duration-300 motion-reduce:animate-none"
          >
            <div aria-hidden="true" className="mx-auto mt-1.5 mb-3.5 h-1 w-[38px] rounded-sm bg-[#FFFDFD]/[0.18]" />
            {SHEET_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/${item.id}`}
                onClick={close}
                className={SHEET_ROW}
              >
                {item.label}
              </Link>
            ))}
            <div aria-hidden="true" className="mx-1.5 my-2 h-px bg-[#FFFDFD]/[0.06]" />
            <Link href="/dashboard/settings" onClick={close} className={SHEET_ROW}>
              settings
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileBottomNav;
