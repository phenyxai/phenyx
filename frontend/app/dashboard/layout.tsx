import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/phenyx/dashboard-sidebar";
import { MobileBottomNav } from "@/components/phenyx/mobile-bottom-nav";
import { DashboardInstrumentation } from "@/components/phenyx/dashboard-instrumentation";
import { SettingsModalsProvider } from "@/components/phenyx/settings-modals/modal-host";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | PHENYX",
  },
};

/**
 * Authenticated dashboard shell. The sidebar lives here (persistent across tab
 * transitions — it does not remount when the active segment changes), and the
 * tab content is route-driven via {children}. At or below 760px the sidebar is
 * hidden and MobileBottomNav takes over; the main column is padded so content
 * clears the fixed bar.
 *
 * SettingsModalsProvider wraps the whole shell so any tab (settings rows,
 * Daily/Constellation upgrade CTAs, feedback) can open a modal by id via
 * `useSettingsModals().openModal(id)` against a single shared host.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsModalsProvider>
      {/* Load-time engagement instrumentation (PHE-35): identify + login +
          days_since_last_visit. Renders nothing; runs once per shell load. */}
      <DashboardInstrumentation />
      {/* Keyboard users can jump past the nav; visually hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:border focus:border-[var(--s)] focus:bg-[#101013] focus:px-[18px] focus:py-3 focus:text-[13px] focus:tracking-[0.02em] focus:text-[#FFFDFD] focus:no-underline"
      >
        skip to content
      </a>
      <div className="flex min-h-screen bg-[#0A0A0A] text-[#FFFDFD]">
        <DashboardSidebar />
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none [@media(max-width:760px)]:pb-[calc(72px+env(safe-area-inset-bottom,0px))]"
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </SettingsModalsProvider>
  );
}
