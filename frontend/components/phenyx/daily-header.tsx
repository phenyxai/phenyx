"use client";

import type { ReactNode } from "react";

// ============================================================================
// DailyHeader — the top of the Daily tab (PHE-26)
// ----------------------------------------------------------------------------
// Renders, in order:
//   1. the two-line personalized mantra (verbatim, lowercase, two lines);
//   2. an optional first-visit signpost slot (PHE-33 owns its one-time
//      localStorage logic — this component only renders whatever node is passed
//      in, so the seam stays clean); and
//   3. the "✦ ask polaris anything" quick-action with a secondary token label
//      ("800 weekly tokens" pro / lock copy for free) that routes to Polaris.
//
// Mantra input is tolerant: a two-element tuple, or a single string split on
// "/" into two lines. Absent mantra → the block is skipped gracefully.
// ============================================================================

export interface DailyHeaderProps {
  /** Two-line mantra: a [line1, line2] tuple, a "line1 / line2" string, or null. */
  mantra?: string | [string, string] | null;
  /** Secondary token label, e.g. "800 weekly tokens" (pro). */
  tokenLabel: string;
  /** Route to /dashboard/polaris (and fire tab_visit — see page seam). */
  onAskPolaris: () => void;
  /**
   * First-visit signpost node (PHE-33). Rendered as-is when provided; PHE-33
   * decides visibility via localStorage. Left null here.
   */
  signpost?: ReactNode;
}

/** Resolve the mantra input into exactly two display lines (or null). */
function mantraLines(mantra: DailyHeaderProps["mantra"]): [string, string] | null {
  if (!mantra) return null;
  if (Array.isArray(mantra)) {
    const [a = "", b = ""] = mantra;
    return [a.trim(), b.trim()];
  }
  const parts = mantra.split("/");
  const line1 = (parts[0] ?? "").trim();
  const line2 = parts.slice(1).join("/").trim();
  return [line1, line2];
}

export function DailyHeader({ mantra, tokenLabel, onAskPolaris, signpost }: DailyHeaderProps) {
  const lines = mantraLines(mantra);

  return (
    <header>
      {lines && (
        <p
          style={{
            fontSize: 22,
            fontWeight: 300,
            lineHeight: 1.5,
            color: "#FFFDFD",
            margin: 0,
            marginBottom: 20,
          }}
        >
          {lines[0]}
          {lines[1] && (
            <>
              <br />
              {lines[1]}
            </>
          )}
        </p>
      )}

      {/* First-visit signpost slot (PHE-33 owns the one-time localStorage flag). */}
      {signpost}

      <button
        type="button"
        onClick={onAskPolaris}
        aria-label="ask polaris anything"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "0.5px solid rgba(255,253,253,0.18)",
          borderRadius: 999,
          padding: "10px 18px",
          fontSize: 13,
          color: "#FFFDFD",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.2s ease",
        }}
        className="motion-reduce:transition-none"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,253,253,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,253,253,0.18)";
        }}
      >
        <span>✦ ask polaris anything</span>
        <span style={{ fontSize: 12, color: "rgba(255,253,253,0.4)" }}>{tokenLabel}</span>
      </button>
    </header>
  );
}

export default DailyHeader;
