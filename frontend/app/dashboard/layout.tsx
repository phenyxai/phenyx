import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/phenyx/dashboard-sidebar";

/**
 * Authenticated dashboard shell. The sidebar lives here (persistent across tab
 * transitions — it does not remount when the active segment changes), and the
 * tab content is route-driven via {children}.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-[#FFFDFD]">
      <DashboardSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
