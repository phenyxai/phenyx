"use client";

import { useEffect } from "react";

import { STELLAR_DEFAULT } from "@/lib/stellar";
import {
  EvidenceTrace,
  type Evidence,
} from "@/components/phenyx/evidence-trace";
import {
  UnderneathReading,
  type Underneath,
} from "@/components/phenyx/underneath-reading";
import { ObservationFeedback } from "./observation-feedback";

// ============================================================================
// ObservationCard: collapsed Daily-feed card (PHE-70 / v67)
// ----------------------------------------------------------------------------
// Collapsed: one sentence + pillar tag + chevron. Expanded in place, in order:
//   1. supporting points
//   2. source tags + date span
//   3. evidence trace / underneath / feedback slot (PHE-71 / PHE-72)
//   4. ✦ explore
//
// The PHE-26 locked-body variant (`unlock on pro`) is gone. Every tier reads
// the sentence. `observation.locked` means the evidence *trace* is withheld
// (sources + span omitted); never the body.
// ============================================================================

/** The rendered observation shape (served by the engine, PHE-37 / PHE-70). */
export interface Observation {
  id: string;
  /** Pillar label, e.g. "origin" | "self_creation". */
  pillar_tag: string;
  /** Stellar-family hex for the pillar tag; falls back to a per-pillar color. */
  pillar_color?: string | null;
  /** Full observation body. Always present on the v67 feed. */
  body?: string | null;
  /** Collapsed one-liner. Derived from `body` when the server omits it. */
  sentence?: string | null;
  /** Counts behind the claim. Shown only when expanded. */
  points?: string[] | null;
  /** Platform badges, e.g. ["instagram","spotify"]. Omitted when the trace is locked. */
  sources?: string[] | null;
  /** Date span next to source tags, e.g. "2016 - 2026". */
  span?: string | null;
  /** Muted meta line, used as a span fallback. */
  meta_line?: string | null;
  /** Opening question for ✦ explore. */
  explore_prompt?: string | null;
  /** First-ever render to this user → green-glow "new" badge. */
  is_new?: boolean;
  /** True when the evidence trace is redacted (free, after the daily budget). */
  locked?: boolean;
  /**
   * True when this card is today's Daily underneath (Pro body or free lock).
   * The reading itself lives on `underneath` and is omitted for free.
   */
  under?: string | boolean | null;
  evidence?: Evidence | null;
  underneath?: Underneath | null;
  /** v66 pattern type. Analytics only; never the observation body. */
  signal_type?: string | null;
  /** Persisted `does this land?` state. Null when untouched. */
  feedback?: { verdict: "new" | "known" | "reading" | null; opened: boolean } | null;
}

const PILLAR_COLORS: Record<string, string> = {
  origin: "#E87722",
  emergence: "#E8B822",
  self_creation: "#77BBFF",
  convergence: "#5599FF",
  becoming: "#88AAEE",
  recognition: "#CCDDFF",
  transcendence: "#4488EE",
};

/** Normalize a pillar tag to its lookup key: "SELF CREATION" → "self_creation". */
export function pillarKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Display label: "self_creation" → "self-creation". */
export function pillarLabel(tag: string): string {
  return tag.trim().toLowerCase().replace(/[_]+/g, "-").replace(/\s+/g, "-");
}

export function firstSentence(body: string): string {
  const cleaned = body.replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return (match ? match[0] : cleaned).trim();
}

export function observationSentence(o: Observation): string {
  if (o.sentence && o.sentence.trim()) return o.sentence.trim();
  if (o.body && o.body.trim()) return firstSentence(o.body);
  return "";
}

export function observationExplorePrompt(o: Observation): string {
  if (o.explore_prompt && o.explore_prompt.trim()) return o.explore_prompt.trim();
  return observationSentence(o);
}

function resolvePillarColor(o: Observation): string {
  if (o.pillar_color) return o.pillar_color;
  const key = pillarKey(o.pillar_tag);
  return PILLAR_COLORS[key] ?? STELLAR_DEFAULT;
}

const NEW_GREEN = "#4ADE80";
let cardStylesInjected = false;

function injectCardStyles() {
  if (cardStylesInjected || typeof document === "undefined") return;
  cardStylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-obs-card", "");
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
      .phenyx-obs-chevron {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export interface ObservationCardProps {
  observation: Observation;
  expanded: boolean;
  onToggle: () => void;
  /** Pro → route to Polaris. Free → open the upgrade modal. */
  onExplore: () => void;
  /** Accent for chevron / explore / focused border. */
  accent?: string;
  /** Pro daily-focus match: slightly stronger border. */
  focused?: boolean;
  /** Locked evidence / underneath opens the Pro modal. */
  onUpgrade?: () => void;
  /** `{n} more, all of them yours to export.` opens the export surface. */
  onExport?: () => void;
  /** After upgrade `_proReturn`, auto-expand the evidence chain. */
  autoExpandEvidence?: boolean;
}

export function ObservationCard({
  observation,
  expanded,
  onToggle,
  onExplore,
  accent = "var(--s, #5599FF)",
  focused = false,
  onUpgrade,
  onExport,
  autoExpandEvidence = false,
}: ObservationCardProps) {
  useEffect(() => {
    injectCardStyles();
  }, []);

  const color = resolvePillarColor(observation);
  const label = pillarLabel(observation.pillar_tag);
  const sentence = observationSentence(observation);
  const points = (observation.points ?? []).filter((p) => p && p.trim());
  const sources = observation.locked ? [] : (observation.sources ?? []);
  const span = observation.locked
    ? ""
    : (observation.span ?? observation.meta_line ?? "").trim();

  return (
    <article
      aria-label={`${label} observation`}
      aria-expanded={expanded}
      style={{
        background: expanded ? "#090909" : focused ? "#0d0d0d" : "#0b0b0b",
        border: `1px solid ${
          focused
            ? `${color}73`
            : expanded
              ? "rgba(255,253,253,0.12)"
              : "#1c1c1c"
        }`,
        borderRadius: 12,
        padding: expanded ? "30px 32px 32px" : "13px 20px",
        position: "relative",
        transition: "border-color 0.35s ease, padding 0.4s ease, background 0.4s ease",
      }}
      className="motion-reduce:transition-none"
    >
      <span
        style={{
          position: "absolute",
          top: -10,
          right: 16,
          zIndex: 2,
          fontSize: 11.5,
          letterSpacing: "0.09em",
          textTransform: "lowercase",
          color,
          background: "#0b0b0d",
          border: `1px solid ${color}6B`,
          borderRadius: 20,
          padding: "3px 12px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {label}
        {observation.is_new && (
          <span
            className="phenyx-obs-new-badge"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEW_GREEN,
              lineHeight: 1,
              animation: "phenyx-obs-new-glow 2.4s ease-in-out infinite",
            }}
          >
            new
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <p
          style={{
            flex: 1,
            fontSize: expanded ? 16 : 14,
            fontWeight: 300,
            lineHeight: expanded ? 1.72 : 1.75,
            color: "rgba(255,253,253,0.78)",
            margin: 0,
          }}
        >
          {sentence}
        </p>
        <span
          className="phenyx-obs-chevron"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            fontSize: 20,
            lineHeight: 1.2,
            color: expanded ? accent : "rgba(255,253,253,0.52)",
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.28s ease, color 0.2s",
            marginTop: -1,
          }}
        >
          ›
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 2 }}>
          {points.length > 0 && (
            <ul
              style={{
                margin: "10px 0 0",
                paddingLeft: 18,
                listStyle: "disc",
              }}
            >
              {points.map((point) => (
                <li
                  key={point}
                  style={{
                    fontSize: 12,
                    color: "rgba(255,253,253,0.58)",
                    lineHeight: 1.6,
                    margin: "3px 0",
                    paddingLeft: 2,
                  }}
                >
                  {point}
                </li>
              ))}
            </ul>
          )}

          {(sources.length > 0 || span) && (
            <div
              aria-label={
                sources.length
                  ? `sourced from ${sources.join(", ")}${span ? `, ${span}` : ""}`
                  : span
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              {sources.map((src) => (
                <span
                  key={src}
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "lowercase",
                    padding: "3px 8px",
                    border: "1px solid #242424",
                    borderRadius: 20,
                    color: "rgba(255,253,253,0.62)",
                    background: "#0d0d0d",
                    whiteSpace: "nowrap",
                  }}
                >
                  {src}
                </span>
              ))}
              {sources.length > 0 && span ? (
                <span style={{ color: "rgba(255,253,253,0.4)", fontSize: 10 }} aria-hidden="true">
                  ·
                </span>
              ) : null}
              {span ? (
                <span
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    color: "rgba(255,253,253,0.52)",
                  }}
                >
                  {span}
                </span>
              ) : null}
            </div>
          )}

          {observation.evidence ? (
            <EvidenceTrace
              observationId={observation.id}
              evidence={observation.evidence}
              onUpgrade={() => onUpgrade?.()}
              onExport={onExport}
              autoExpand={autoExpandEvidence}
            />
          ) : (
            <div data-slot="evidence" />
          )}
          {observation.under ? (
            <UnderneathReading
              observationId={observation.id}
              underneath={observation.underneath ?? null}
              onUpgrade={() => onUpgrade?.()}
            />
          ) : null}
          <ObservationFeedback
            observationId={observation.id}
            pillar={pillarKey(observation.pillar_tag)}
            signalType={observation.signal_type ?? null}
            initial={observation.feedback ?? null}
            accent={accent}
          />

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExplore();
              }}
              title="ask polaris about this"
              style={{
                background: "none",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                padding: "8px 6px",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 13, color: accent }}>✦</span>
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: "0.03em",
                  color: "rgba(255,253,253,0.6)",
                }}
              >
                explore
              </span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default ObservationCard;
