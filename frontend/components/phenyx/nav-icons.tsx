import type { ReactNode } from "react";
import type { DashboardTabId } from "@/lib/dashboard-nav";

/** Stroke icon paths per tab, from the ph550 demo's nav (insights takes the demo's you icon). */
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
      <path d="M7 17l3.1-7.7L18 6l-3.1 7.7L7 17z" />
      <circle cx="12.5" cy="11.5" r="1.4" />
      <path d="M4 20h16" />
    </>
  ),
  polaris: <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />,
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
