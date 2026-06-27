"use client";

import type { CSSProperties } from "react";

// ============================================================================
// PolarisBadge — reusable Polaris identity pill (PHE-16)
// ----------------------------------------------------------------------------
// A small pill containing a blinking dot + the `POLARIS` label, tinted in the
// Polaris/stellar blue. Extracted as a standalone component so the same
// markup/CSS is reused across surfaces (the onboarding Polaris-intro screen
// here, and the dashboard Polaris tab later) without duplicating the blink
// keyframe.
//
// The blink is a pure CSS keyframe (`phenyx-polaris-blink`, ~2s ease-in-out,
// opacity 1↔0.2) defined ONCE inside this component and scoped to the badge's
// own class names — it runs independently of any JS reveal timers.
//
// Reduced motion: the dot is frozen at full opacity in two complementary ways,
// so a non-blinking full-opacity dot is guaranteed:
//   1. the `frozen` prop (callers that already know the user's preference can
//      pass it directly, e.g. the onboarding screen's `reducedMotion`); and
//   2. a `@media (prefers-reduced-motion: reduce)` rule as a safety net.
//
// NOTE: class names are intentionally namespaced (`phenyx-polaris-*`) and we do
// NOT use a bare `.hidden` utility anywhere — a later ticket bans `.hidden`
// because the Onairos SDK leaks a global `.hidden` rule into the page.
// ============================================================================

export interface PolarisBadgeProps {
  /** Tint color for the dot, label, border, and fill. Defaults to Polaris blue. */
  color?: string;
  /** Pill scale. `sm` is the compact onboarding/dashboard size; `md` is larger. */
  size?: "sm" | "md";
  /**
   * Freeze the dot at full opacity (no blink). Pass the caller's reduced-motion
   * preference here. A `prefers-reduced-motion` media query also freezes it as a
   * safety net, so either path alone is sufficient.
   */
  frozen?: boolean;
  /** Extra inline style for positioning (e.g. margins) — merged onto the pill. */
  style?: CSSProperties;
  /** Optional extra class names appended to the pill. */
  className?: string;
}

// Default Polaris/stellar blue (matches the lighter end of the stellar palette).
const DEFAULT_POLARIS_BLUE = "#77BBFF";

const SIZES = {
  sm: { padV: 4, padH: 10, dot: 6, gap: 7, font: 9, radius: 999 },
  md: { padV: 6, padH: 14, dot: 8, gap: 9, font: 11, radius: 999 },
} as const;

export function PolarisBadge({
  color = DEFAULT_POLARIS_BLUE,
  size = "sm",
  frozen = false,
  style,
  className,
}: PolarisBadgeProps) {
  const s = SIZES[size];

  return (
    <span
      className={`phenyx-polaris-badge${className ? ` ${className}` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${s.gap}px`,
        padding: `${s.padV}px ${s.padH}px`,
        borderRadius: `${s.radius}px`,
        border: `0.5px solid ${color}`,
        // Low-alpha fill of the tint color, plus the tint as the label color.
        background: `${color}14`,
        color,
        fontSize: `${s.font}px`,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        className="phenyx-polaris-dot"
        style={{
          width: `${s.dot}px`,
          height: `${s.dot}px`,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
          // The blink is CSS-keyframe driven; `frozen` short-circuits it.
          opacity: frozen ? 1 : undefined,
          animation: frozen
            ? "none"
            : "phenyx-polaris-blink 2s ease-in-out infinite",
        }}
      />
      <span className="phenyx-polaris-label">POLARIS</span>

      {/* Blink keyframe + reduced-motion freeze — defined ONCE here. Identical
          @keyframes across multiple mounted badges are idempotent by name. */}
      <style>{`
        @keyframes phenyx-polaris-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @media (prefers-reduced-motion: reduce) {
          .phenyx-polaris-dot {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </span>
  );
}

export default PolarisBadge;
