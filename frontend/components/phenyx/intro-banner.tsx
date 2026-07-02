"use client";

import { useIntroBanner, type DashboardTab } from "@/lib/first-visit";

// ============================================================================
// IntroBanner — one-time, dismissible per-tab orientation line (PHE-33)
// ----------------------------------------------------------------------------
// Shows verbatim intro copy on a tab's first visit only. First-visit gating and
// per-user localStorage persistence live in `useIntroBanner` (lib/first-visit);
// this component is the presentation + the `×` dismiss control. It renders
// nothing (returns null) until the gate resolves client-side, so there is no
// SSR flash or hydration mismatch. The enter animation reuses `.animate-fade-in`,
// which is already frozen under `prefers-reduced-motion` in globals.css.
// ============================================================================

/** Verbatim, lowercase intro copy per tab (single source of truth, per AC). */
export const INTRO_COPY: Record<DashboardTab, string> = {
  daily: "daily shows what surfaced from your data this week, freshest first.",
  polaris:
    "polaris answers what you ask, using only what your constellation has already shown.",
  constellation:
    "each point is a pillar of your identity. tap one to see what it is built from.",
  profile: "this is what we know about you so far, and where you can manage your data.",
};

export interface IntroBannerProps {
  /** Which tab this banner belongs to — namespaces the localStorage flag. */
  tab: DashboardTab;
  /** Verbatim, lowercase banner copy for the tab. */
  copy: string;
  /** Optional side-effect on dismiss (e.g. instrumentation); gating is internal. */
  onDismiss?: () => void;
  /** Extra classes for the banner root — spacing collapses with it when hidden. */
  className?: string;
}

export function IntroBanner({ tab, copy, onDismiss, className }: IntroBannerProps) {
  const { visible, dismiss } = useIntroBanner(tab);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss();
    onDismiss?.();
  };

  return (
    <div
      role="note"
      className={`animate-fade-in flex items-start justify-between gap-4 rounded-xl border border-[#1C1C1C] bg-[#0E0E0E] px-5 py-3.5${
        className ? ` ${className}` : ""
      }`}
    >
      <p className="m-0 text-[13px] font-light lowercase leading-relaxed text-[#FFFDFD]/70">
        {copy}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="dismiss"
        className="-mr-1 -mt-0.5 shrink-0 text-[16px] leading-none text-[#FFFDFD]/40 transition-colors hover:text-[#FFFDFD] motion-reduce:transition-none"
      >
        ×
      </button>
    </div>
  );
}

export default IntroBanner;
