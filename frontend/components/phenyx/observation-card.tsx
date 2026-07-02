"use client";

import { useEffect } from "react";

// ============================================================================
// ObservationCard — a single Daily-feed observation (PHE-26)
// ----------------------------------------------------------------------------
// Two variants share one component:
//   • unlocked — the colored uppercase pillar tag, a 2–3 sentence body, source
//     platform badges + a muted meta line, and a green-glow "new" badge for
//     first-time observations (`is_new`).
//   • locked   — free-tier gating: only a redacted hint plus an "unlock on
//     pro ✦" button that opens the upgrade modal. The server redacts `body` and
//     `sources` for locked observations, so this variant never receives them —
//     it renders a hint line only, never client-hidden real content.
//
// Colors: the pillar tag is tinted by `pillar_color` (a stellar-family hex from
// the engine); when the payload omits it we fall back to a deterministic
// per-pillar stellar color so an active pillar always reads in-family.
//
// The "new" badge glow is a CSS keyframe (`phenyx-obs-new-glow`) injected once
// and frozen under `prefers-reduced-motion: reduce`, mirroring PolarisBadge.
// ============================================================================

import { STELLAR_DEFAULT } from "@/lib/stellar";

/** The rendered observation shape (served by the engine, PHE-37 / 06-engine-data.md). */
export interface Observation {
  id: string;
  /** Pillar label, e.g. "origin" | "self_creation". Rendered uppercased. */
  pillar_tag: string;
  /** Stellar-family hex for the pillar tag; falls back to a per-pillar color. */
  pillar_color?: string | null;
  /** 2–3 sentence observation body. Absent on locked (server-redacted). */
  body?: string | null;
  /** Platform badges, e.g. ["instagram","spotify"]. Absent on locked. */
  sources?: string[] | null;
  /** Muted meta line, e.g. "cross-platform pattern / 6 months". */
  meta_line?: string | null;
  /** First-ever render to this user → green-glow "new" badge. */
  is_new?: boolean;
  /** Server gating flag. The page also enforces gating by tier + index. */
  locked?: boolean;
  /** Redacted hint string served in place of the body on locked cards. */
  hint?: string | null;
}

// Deterministic fallback color per active pillar (stellar family). Only used
// when the engine does not attach a `pillar_color`. Keyed by the normalized
// pillar tag (lowercased, spaces/underscores collapsed).
const PILLAR_COLORS: Record<string, string> = {
  origin: "#E87722",
  emergence: "#E8B822",
  self_creation: "#77BBFF",
  convergence: "#5599FF",
};

/** Normalize a pillar tag to its lookup key: "SELF CREATION" → "self_creation". */
function pillarKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** "self_creation" → "SELF CREATION" for the pillar tag label. */
function pillarLabel(tag: string): string {
  return tag.trim().replace(/[_-]+/g, " ").toUpperCase();
}

function resolvePillarColor(o: Observation): string {
  if (o.pillar_color) return o.pillar_color;
  return PILLAR_COLORS[pillarKey(o.pillar_tag)] ?? STELLAR_DEFAULT;
}

// Green used for the "new" glow. Injected once; frozen under reduced motion.
const NEW_GREEN = "#4ADE80";
let glowInjected = false;

function injectNewGlowStyles() {
  if (glowInjected || typeof document === "undefined") return;
  glowInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-obs-new-glow", "");
  style.textContent = `
    @keyframes phenyx-obs-new-glow {
      0%, 100% { box-shadow: 0 0 4px ${NEW_GREEN}66, 0 0 0 ${NEW_GREEN}00; }
      50%      { box-shadow: 0 0 10px ${NEW_GREEN}99, 0 0 2px ${NEW_GREEN}66; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phenyx-obs-new-badge {
        animation: none !important;
        box-shadow: 0 0 6px ${NEW_GREEN}66 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export interface ObservationCardProps {
  observation: Observation;
  /** Render the locked (free-tier) variant. */
  locked: boolean;
  /** Open the upgrade modal — wired to the locked-variant "unlock on pro ✦" CTA. */
  onUpgrade: () => void;
}

export function ObservationCard({ observation, locked, onUpgrade }: ObservationCardProps) {
  useEffect(() => {
    injectNewGlowStyles();
  }, []);

  const color = resolvePillarColor(observation);
  const label = pillarLabel(observation.pillar_tag);

  const tag = (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
      }}
    >
      {label}
    </span>
  );

  // -- locked variant -------------------------------------------------------
  // Only the pillar tag, a redacted hint, and the unlock CTA. No body/sources.
  if (locked) {
    return (
      <article
        aria-label={`${observation.pillar_tag} observation — locked`}
        aria-disabled="true"
        style={{
          background: "#0E0E0E",
          border: "0.5px solid #1C1C1C",
          borderRadius: 12,
          padding: "18px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {tag}
        </div>
        <p
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: "rgba(255,253,253,0.28)",
            fontStyle: "italic",
            margin: 0,
            marginBottom: 16,
          }}
        >
          {observation.hint ?? "something surfaced here."}
        </p>
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            background: "transparent",
            border: "0.5px solid rgba(255,253,253,0.18)",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12,
            color: "rgba(255,253,253,0.55)",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s ease",
          }}
          className="motion-reduce:transition-none"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,253,253,0.4)";
            e.currentTarget.style.color = "#FFFDFD";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,253,253,0.18)";
            e.currentTarget.style.color = "rgba(255,253,253,0.55)";
          }}
        >
          unlock on pro ✦
        </button>
      </article>
    );
  }

  // -- unlocked variant -----------------------------------------------------
  const sources = observation.sources ?? [];
  return (
    <article
      aria-label={`${observation.pillar_tag} observation`}
      style={{
        background: "#0D0D0D",
        border: "0.5px solid #1A1A1A",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {tag}
        {observation.is_new && (
          <span
            className="phenyx-obs-new-badge"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEW_GREEN,
              border: `0.5px solid ${NEW_GREEN}80`,
              borderRadius: 999,
              padding: "2px 8px",
              lineHeight: 1,
              animation: "phenyx-obs-new-glow 2.4s ease-in-out infinite",
            }}
          >
            new
          </span>
        )}
      </div>

      {observation.body && (
        <p
          style={{
            fontSize: 15,
            fontWeight: 300,
            lineHeight: 1.55,
            color: "#FFFDFD",
            margin: 0,
            marginBottom: sources.length || observation.meta_line ? 16 : 0,
          }}
        >
          {observation.body}
        </p>
      )}

      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: observation.meta_line ? 8 : 0 }}>
          {sources.map((src) => (
            <span
              key={src}
              style={{
                fontSize: 11,
                color: "rgba(255,253,253,0.55)",
                background: "rgba(255,253,253,0.04)",
                border: "0.5px solid rgba(255,253,253,0.12)",
                borderRadius: 999,
                padding: "3px 10px",
                lineHeight: 1.3,
              }}
            >
              {src}
            </span>
          ))}
        </div>
      )}

      {observation.meta_line && (
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,253,253,0.3)",
            margin: 0,
          }}
        >
          {observation.meta_line}
        </p>
      )}
    </article>
  );
}

export default ObservationCard;
