"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// ============================================================================
// Mobile drawer state for the dashboard sidebar
// ----------------------------------------------------------------------------
// At or below 760px the sidebar leaves the layout and becomes an off-canvas
// drawer. It opens from the hamburger in MobileTopBar or the menu item in
// MobileBottomNav, and closes on the scrim, Escape, the close button, or a
// navigation. Leaving the phone width closes it, so a rotated tablet never
// keeps a scrim over the desktop layout.
//
// NOTE (Onairos CSS collision): onairos.css ships its own Tailwind utilities
// (.flex, .hidden, .fixed, .block, ...) and loads after globals.css, so a bare
// utility beats our responsive variant for the same property. Anything that
// changes between phone and desktop sets BOTH sides with a media variant
// ([@media(max-width:760px)]: and [@media(min-width:761px)]:) and never pairs
// a bare utility with one.
// ============================================================================

export const PHONE_QUERY = "(max-width: 760px)";

interface DrawerState {
  open: boolean;
  isPhone: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerState | null>(null);

function subscribePhone(onChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True at phone width. False during SSR, where the drawer is always closed. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

export function DashboardDrawerProvider({ children }: { children: ReactNode }) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!isPhone) setOpen(false);
  }, [isPhone]);

  // The page underneath should not scroll while the drawer covers it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const value = useMemo(() => ({ open, isPhone, setOpen, toggle }), [open, isPhone, toggle]);
  return (
    <DrawerContext.Provider value={value}>
      {children}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="animate-in fade-in fixed inset-0 z-[135] bg-black/55 duration-200 motion-reduce:animate-none [@media(min-width:761px)]:hidden"
        />
      )}
    </DrawerContext.Provider>
  );
}

export function useDashboardDrawer(): DrawerState {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDashboardDrawer must be used inside DashboardDrawerProvider");
  return ctx;
}

/** The id the drawer toggles point their aria-controls at. */
export const DRAWER_ID = "dashboard-sidebar";
