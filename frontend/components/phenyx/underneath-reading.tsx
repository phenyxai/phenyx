"use client";

import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent } from "react";

import { rememberProReturn } from "./evidence-trace";

// ============================================================================
// UnderneathReading: `something sits under this one` (PHE-71 / v67)
// ----------------------------------------------------------------------------
// At most one per local day on Daily (server-picked). Closed by default.
// Pro: headline, said-vs-gap, mechanism, the tell, basis.
// Free: the same label as a lock, no reading payload.
// ============================================================================

export interface Underneath {
  id: string;
  headline: string;
  belief: { said: string; n: number; where: string };
  gap: string;
  mechanism: string;
  tell: string;
  basis: string;
  recs: number;
  sources: string[];
  hedge: string;
}

export interface UnderneathReadingProps {
  observationId: string;
  /** Present for Pro. Absent for free — render the lock, never a hidden body. */
  underneath?: Underneath | null;
  onUpgrade: () => void;
}

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-underneath", "");
  style.textContent = `
    @keyframes phenyx-und-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phenyx-und-body { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export function UnderneathReading({
  observationId,
  underneath,
  onUpgrade,
}: UnderneathReadingProps) {
  const reactId = useId();
  const bodyId = `und-${observationId}-${reactId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    injectStyles();
  }, []);

  const openUpgrade = () => {
    rememberProReturn(observationId);
    onUpgrade();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (underneath) setOpen((v) => !v);
      else openUpgrade();
    }
  };

  if (!underneath) {
    return (
      <div data-slot="underneath" className="phenyx-und phenyx-ev-locked" style={wrap}>
        <button
          type="button"
          className="phenyx-und-open"
          onClick={openUpgrade}
          onKeyDown={onKeyDown}
          style={btnStyle}
        >
          <span aria-hidden="true" style={dotStyle} />
          <span style={{ flex: 1 }}>something sits under this one</span>
          <span aria-hidden="true" style={lockStyle}>
            ◆
          </span>
        </button>
      </div>
    );
  }

  const beliefMeta = [underneath.belief.n ? `${underneath.belief.n} times` : "", underneath.belief.where]
    .filter(Boolean)
    .join(" · ");
  const sourceLine = underneath.sources.filter(Boolean).join(", ");
  const basis = [
    underneath.basis,
    underneath.recs
      ? `made from ${underneath.recs.toLocaleString()} records${sourceLine ? ` across ${sourceLine}` : ""}`
      : "",
    underneath.hedge,
  ]
    .filter((x) => x && String(x).trim())
    .join(". ")
    .replace(/\.\./g, ".");

  return (
    <div data-slot="underneath" className={open ? "phenyx-und open" : "phenyx-und"} style={wrap}>
      <button
        type="button"
        className="phenyx-und-open"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        style={btnStyle}
      >
        <span
          aria-hidden="true"
          style={{
            ...dotStyle,
            opacity: open ? 1 : 0.5,
            boxShadow: open ? "0 0 6px var(--s, #5599FF)" : "none",
          }}
        />
        <span>something sits under this one</span>
      </button>
      <div
        id={bodyId}
        className="phenyx-und-body"
        hidden={!open}
        style={{
          padding: open ? "9px 0 2px" : undefined,
          animation: open ? "phenyx-und-in 0.38s cubic-bezier(.2,.7,.3,1)" : undefined,
        }}
      >
        <p style={headStyle}>{underneath.headline}</p>
        <div>
          <p style={saidStyle}>
            {underneath.belief.said}
            {beliefMeta ? <span style={saidMeta}>{beliefMeta}</span> : null}
          </p>
          <p style={vsStyle}>{underneath.gap}</p>
          <p style={mechStyle}>{underneath.mechanism}</p>
          <p style={tellStyle}>
            <span style={tellLbl}>the tell</span>
            {underneath.tell}
          </p>
          <p style={basisStyle}>{basis}</p>
        </div>
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  marginTop: 4,
};

const btnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  background: "none",
  border: 0,
  padding: "8px 0",
  minHeight: 24,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 10.5,
  letterSpacing: "0.05em",
  color: "rgba(255,253,253,.52)",
  textAlign: "left",
};

const dotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "var(--s, #5599FF)",
  opacity: 0.5,
  flexShrink: 0,
};

const lockStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 9,
  color: "var(--s, #5599FF)",
  opacity: 0.6,
  flexShrink: 0,
};

const headStyle: CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.6,
  color: "rgba(255,253,253,.92)",
  margin: "0 0 11px",
  letterSpacing: "-0.01em",
  paddingLeft: 13,
  borderLeft: "2px solid rgba(var(--s-rgb, 85, 153, 255), .4)",
};

const saidStyle: CSSProperties = {
  fontSize: 13,
  fontStyle: "italic",
  color: "rgba(255,253,253,.72)",
  margin: "0 0 9px",
  lineHeight: 1.5,
};

const saidMeta: CSSProperties = {
  display: "block",
  fontStyle: "normal",
  fontSize: 10,
  color: "rgba(255,253,253,.52)",
  marginTop: 4,
  letterSpacing: "0.04em",
};

const vsStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--s, #5599FF)",
  opacity: 0.9,
  margin: "0 0 9px",
};

const mechStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.62,
  color: "rgba(255,253,253,.6)",
  margin: "0 0 9px",
};

const tellStyle: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.55,
  color: "rgba(255,253,253,.5)",
  margin: "0 0 9px",
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
};

const tellLbl: CSSProperties = {
  color: "rgba(255,253,253,.52)",
  letterSpacing: "0.06em",
  fontSize: 10,
  flex: "0 0 42px",
  paddingTop: 1,
};

const basisStyle: CSSProperties = {
  fontSize: 10.5,
  lineHeight: 1.55,
  color: "rgba(255,253,253,.52)",
  margin: "0 0 11px",
  paddingTop: 8,
  borderTop: "1px solid #151515",
};

export default UnderneathReading;
