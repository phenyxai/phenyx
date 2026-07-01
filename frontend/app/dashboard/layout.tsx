import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/phenyx/dashboard-sidebar";
import { SettingsModalsProvider } from "@/components/phenyx/settings-modals/modal-host";

/**
 * Authenticated dashboard shell. The sidebar lives here (persistent across tab
 * transitions — it does not remount when the active segment changes), and the
 * tab content is route-driven via {children}.
 *
 * SettingsModalsProvider wraps the whole shell so any tab (Profile SETTINGS
 * rows, Daily/Constellation upgrade CTAs, feedback) can open a modal by id via
 * `useSettingsModals().openModal(id)` against a single shared host.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsModalsProvider>
      <div className="flex min-h-screen bg-[#0A0A0A] text-[#FFFDFD]">
        <DashboardSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </SettingsModalsProvider>
  );
}
