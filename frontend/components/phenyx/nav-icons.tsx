import type { ReactNode } from "react";
import type { DashboardTabId } from "@/lib/dashboard-nav";

/** Stroke icon paths per tab, from the PHE-129 demo's nav: polaris is a small circle, discover a telescope. */
const PATHS: Record<DashboardTabId, ReactNode> = {
  constellation: (
    <>
      <circle cx="5" cy="15" r="1.6" />
      <circle cx="9" cy="7" r="1.6" />
      <circle cx="14" cy="11" r="1.6" />
      <circle cx="19" cy="5" r="1.6" />
      <circle cx="18" cy="17" r="1.6" />
      <path d="M6.3 13.8L8.2 8.4M10.5 7.7l2.4 2.4M15.5 9.8l2.2-3.3M15.3 12.1l1.8 3.4" />
    </>
  ),
  discover: (
    <>
      <path d="M5 7.5l8.8 4.4-2.2 4.3L2.8 11.8z" />
      <path d="M13.8 11.9l3.2-6.3 3.1 1.6-3.2 6.3" />
      <path d="M10.8 15.7l-2.2 4.1M12.7 16.4l2.2 3.4" />
    </>
  ),
  polaris: <circle cx="12" cy="12" r="5.5" />,
  insights: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2" />
    </>
  ),
};

export function NavIcon({ tab, size = 18 }: { tab: DashboardTabId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[tab]}
    </svg>
  );
}

/** The settings gear shared by the sidebar foot and the phone top bar. */
export function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  );
}
