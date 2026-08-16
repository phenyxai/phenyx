"use client";

import { useEffect, useState } from "react";

import { postObservationFeedback } from "@/lib/api-client";
import { trackObservationFeedback } from "@/lib/analytics";

// ============================================================================
// ObservationFeedback: v67 `does this land?` (PHE-72)
// ----------------------------------------------------------------------------
// Expanded card, below evidence/underneath. Three buttons, then confirm copy
// plus `change it`. Verdicts stored as new | known | reading (never shown).
// Opening the evidence chain is a passive `opened=true` signal — export
// `markObservationOpened` so PHE-71 can call it without owning this ticket.
// ============================================================================

export type ObservationVerdict = "new" | "known" | "reading";

export interface ObservationFeedbackState {
  verdict: ObservationVerdict | null;
  opened: boolean;
}

export interface ObservationFeedbackProps {
  observationId: string;
  pillar: string;
  signalType?: string | null;
  initial?: ObservationFeedbackState | null;
  accent?: string;
}

const CONFIRM: Record<ObservationVerdict, string> = {
  new: "noted as something you had not seen. this changes what surfaces next.",
  known: "noted as something you already knew. this changes what surfaces next.",
  reading:
    "flagged: the records are right, the reading is not. this changes what surfaces next.",
};

const BUTTONS: { verdict: ObservationVerdict; label: string; negative?: boolean }[] = [
  { verdict: "new", label: "yes" },
  { verdict: "known", label: "yes, already knew" },
  { verdict: "reading", label: "not quite", negative: true },
];

let stylesInjected = false;

function injectFeedbackStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-obs-feedback", "");
  style.textContent = `
    .phenyx-fb-b:hover {
      border-color: color-mix(in srgb, var(--phenyx-fb-accent, #5599FF) 50%, #202020);
      color: #fffdfd;
    }
    @media (max-width: 700px) {
      .phenyx-fb-row { flex-direction: column; align-items: flex-start; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phenyx-fb-b { transition: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Passive evidence-opened signal. PHE-71 should call this when the evidence
 * chain is opened, even if no feedback button has been pressed.
 */
export async function markObservationOpened(
  id: string,
  context?: { pillar?: string; signal_type?: string | null },
): Promise<void> {
  if (!id) return;
  try {
    const result = await postObservationFeedback(id, { opened: true });
    if (result === undefined) return;
    trackObservationFeedback({
      pillar: context?.pillar ?? "",
      signal_type: context?.signal_type ?? null,
      opened: true,
    });
  } catch {
    // fail open: opening evidence must never block the card
  }
}

export function ObservationFeedback({
  observationId,
  pillar,
  signalType = null,
  initial = null,
  accent = "var(--s, #5599FF)",
}: ObservationFeedbackProps) {
  useEffect(() => {
    injectFeedbackStyles();
  }, []);

  const [verdict, setVerdict] = useState<ObservationVerdict | null>(
    initial?.verdict ?? null,
  );
  const [pending, setPending] = useState(false);

  const persist = async (
    next: ObservationVerdict | null,
    previous: ObservationVerdict | null,
  ) => {
    setPending(true);
    const result = await postObservationFeedback(observationId, { verdict: next });
    setPending(false);
    if (result === undefined) {
      // transport / 4xx: restore previous so we fail open with buttons (or confirm)
      setVerdict(previous);
      return;
    }
    if (next) {
      trackObservationFeedback({
        pillar,
        signal_type: signalType ?? null,
        verdict: next,
      });
    }
  };

  const choose = (next: ObservationVerdict) => {
    const previous = verdict;
    setVerdict(next);
    void persist(next, previous);
  };

  const undo = () => {
    const previous = verdict;
    setVerdict(null);
    void persist(null, previous);
  };

  return (
    <div
      style={{
        marginTop: 26,
        paddingTop: 20,
        borderTop: "1px solid #151515",
        ["--phenyx-fb-accent" as string]: accent,
      }}
    >
      {verdict ? (
        <div>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,253,253,0.52)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {CONFIRM[verdict]}
          </p>
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            style={{
              fontFamily: "inherit",
              fontSize: 10.5,
              background: "none",
              border: "none",
              padding: "4px 0 0",
              color: accent,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            change it
          </button>
        </div>
      ) : (
        <>
          <p
            style={{
              fontSize: 10.5,
              letterSpacing: "0.05em",
              color: "rgba(255,253,253,0.52)",
              margin: "0 0 7px",
            }}
          >
            does this land?
          </p>
          <div
            className="phenyx-fb-row"
            style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
          >
            {BUTTONS.map((b) => (
              <button
                key={b.verdict}
                type="button"
                className="phenyx-fb-b"
                disabled={pending}
                onClick={() => choose(b.verdict)}
                style={{
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "7px 12px",
                  minHeight: 26,
                  border: "1px solid #202020",
                  borderRadius: 20,
                  background: "transparent",
                  color: b.negative
                    ? "rgba(255,253,253,0.52)"
                    : "rgba(255,253,253,0.6)",
                  cursor: pending ? "wait" : "pointer",
                  transition: "border-color 0.2s, color 0.2s",
                  textAlign: "left",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ObservationFeedback;
