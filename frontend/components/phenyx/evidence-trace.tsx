"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

// ============================================================================
// EvidenceTrace: `where this comes from` (PHE-71 / v67)
// ----------------------------------------------------------------------------
// Unlocked: a disclosure whose body is `hidden` until open. Order inside:
// visualization, what we read, what happened in order, what this does not claim.
// Locked: `<sig> the N entries behind this` opens the Pro modal. Chain fields
// are absent from the payload — the client keys off that, not a CSS flag.
// ============================================================================

export const PRO_RETURN_KEY = "phenyx_pro_return";

export function rememberProReturn(observationId: string) {
  try {
    sessionStorage.setItem(PRO_RETURN_KEY, observationId);
  } catch {
    // sessionStorage can throw in private mode; the upgrade still opens.
  }
}

export function peekProReturn(): string | null {
  try {
    return sessionStorage.getItem(PRO_RETURN_KEY);
  } catch {
    return null;
  }
}

export function consumeProReturn(): string | null {
  try {
    const id = sessionStorage.getItem(PRO_RETURN_KEY);
    if (id) sessionStorage.removeItem(PRO_RETURN_KEY);
    return id;
  } catch {
    return null;
  }
}

export type EvidenceChart =
  | { k: "part"; a: number; b: number; la?: string }
  | { k: "split"; a: number; b: number; la?: string; lb?: string }
  | { k: "clock"; hrs?: number[]; unit?: "hour" | "month"; label?: string }
  | { k: "run"; gap: [number, number]; length?: number; label?: string }
  | { k: "steps"; steps: Array<{ l: string; d: number }> }
  | { k: "series"; pre: number[]; post: number[]; la?: string; lb?: string }
  | { k: "swap"; before: string[]; after: string[] }
  | { k: "ring"; note?: string };

export interface EvidenceEntry {
  t: string;
  s: string;
  w: string;
  l: string;
}

export interface Evidence {
  sig: string;
  recs: number;
  sources?: string[];
  span?: string;
  certainty?: string;
  chart?: EvidenceChart | null;
  entries?: EvidenceEntry[];
  closer?: string;
}

export interface EvidenceTraceProps {
  observationId: string;
  evidence: Evidence;
  /** Opens the Pro modal. Locked rows call this; never the chain. */
  onUpgrade: () => void;
  /** Opens the existing export surface (data management). */
  onExport?: () => void;
  /** After `_proReturn`, start open and scroll into view. */
  autoExpand?: boolean;
}

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-evidence", "");
  style.textContent = `
    @keyframes phenyx-ev-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: none; }
    }
    .phenyx-ev-chain { list-style: none; margin: 2px 0 0; padding: 0; counter-reset: evstep; }
    .phenyx-ev-chain > li { position: relative; padding: 0 0 22px 26px; border-left: 1px solid rgba(var(--s-rgb, 85, 153, 255), .22); margin-left: 5px; }
    .phenyx-ev-chain > li:last-child { padding-bottom: 2px; border-left-color: transparent; }
    .phenyx-ev-chain > li::before {
      counter-increment: evstep; content: counter(evstep);
      position: absolute; left: -8px; top: 0; width: 16px; height: 16px; border-radius: 50%;
      background: #080808; border: 1px solid rgba(var(--s-rgb, 85, 153, 255), .4);
      color: var(--s, #5599FF); font-size: 9.5px; display: flex; align-items: center; justify-content: center;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 560px) {
      .phenyx-ev-rec { grid-template-columns: 1fr !important; }
      .phenyx-ev-rec-why { grid-column: 1 !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phenyx-ev-body, .phenyx-ev-arw { animation: none !important; transition: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function isChain(evidence: Evidence): boolean {
  return Array.isArray(evidence.entries);
}

export function EvidenceTrace({
  observationId,
  evidence,
  onUpgrade,
  onExport,
  autoExpand = false,
}: EvidenceTraceProps) {
  const reactId = useId();
  const bodyId = `ev-${observationId}-${reactId.replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(autoExpand);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (!autoExpand) return;
    setOpen(true);
    rootRef.current?.scrollIntoView({ block: "center" });
  }, [autoExpand]);

  const chain = isChain(evidence);
  const recs = evidence.recs ?? 0;

  const openUpgrade = () => {
    rememberProReturn(observationId);
    onUpgrade();
  };

  const toggle = () => setOpen((v) => !v);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (chain) toggle();
      else openUpgrade();
    }
  };

  if (!chain) {
    return (
      <div
        ref={rootRef}
        data-slot="evidence"
        className="phenyx-ev phenyx-ev-locked"
        style={rowWrap}
      >
        <button
          type="button"
          className="phenyx-ev-btn"
          onClick={openUpgrade}
          onKeyDown={onKeyDown}
          style={btnStyle}
        >
          <span style={kindStyle}>{evidence.sig}</span>
          <span style={lineStyle}>
            the {recs.toLocaleString()} entries behind this
          </span>
          <span aria-hidden="true" style={lockStyle}>
            ◆
          </span>
        </button>
      </div>
    );
  }

  const sources = evidence.sources ?? [];
  const span = (evidence.span ?? "").trim();
  const entries = evidence.entries ?? [];
  const more = Math.max(0, recs - entries.length);
  const from = sources.length ? ` records from ${sources.join(", ")}` : " records";
  const readLine = `${recs.toLocaleString()}${from}${span ? `, ${span}` : ""}. ${evidence.certainty ?? ""}`.trim();

  return (
    <div
      ref={rootRef}
      data-slot="evidence"
      className={open ? "phenyx-ev open" : "phenyx-ev"}
      style={rowWrap}
    >
      <button
        type="button"
        className="phenyx-ev-btn"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        onKeyDown={onKeyDown}
        style={btnStyle}
      >
        <span style={kindStyle}>{evidence.sig}</span>
        <span style={lineStyle}>where this comes from</span>
        <span
          className="phenyx-ev-arw"
          aria-hidden="true"
          style={{
            ...arwStyle,
            transform: open ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </span>
      </button>
      <div
        id={bodyId}
        className="phenyx-ev-body"
        hidden={!open}
        style={{ padding: open ? "11px 0 2px" : undefined, animation: open ? "phenyx-ev-in 0.34s cubic-bezier(.2,.7,.3,1)" : undefined }}
      >
        {evidence.chart ? <EvidenceChartFigure chart={evidence.chart} /> : null}

        <ol className="phenyx-ev-chain">
          <li>
            <span style={stepStyle}>what we read</span>
            <p style={chainP}>{readLine}</p>
          </li>
          <li>
            <span style={stepStyle}>what happened, in order</span>
            {entries.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <p style={recLbl}>
                  the entries
                  <span style={recLblCount}>
                    {entries.length} of {recs.toLocaleString()}
                  </span>
                </p>
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {entries.map((entry, i) => (
                    <li
                      key={`${entry.t}-${entry.l}-${i}`}
                      className="phenyx-ev-rec"
                      style={{
                        ...recRow,
                        borderTop: i === 0 ? "none" : "1px solid #131313",
                        paddingTop: i === 0 ? 0 : 8,
                      }}
                    >
                      <span style={recWhen}>{entry.t}</span>
                      <span style={recSrc}>{entry.s}</span>
                      <span style={recWhat}>{entry.w}</span>
                      <span className="phenyx-ev-rec-why" style={recWhy}>{entry.l}</span>
                    </li>
                  ))}
                </ol>
                {more > 0 && (
                  <p style={recMore}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport?.();
                      }}
                      style={exportBtn}
                    >
                      {more.toLocaleString()} more, all of them yours to export.
                    </button>
                  </p>
                )}
              </div>
            )}
          </li>
        </ol>

        {evidence.closer ? (
          <p style={noteStyle}>
            <span style={noteLbl}>what this does not claim</span>
            {evidence.closer}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EvidenceChartFigure({ chart }: { chart: EvidenceChart }) {
  const S = "var(--s, #5599FF)";
  const G = "rgba(255,253,253,.13)";
  const F = "rgba(255,253,253,.4)";
  const fmt = (x: number) => (x >= 1000 ? x.toLocaleString() : String(x));

  let h = 46;
  let inner: ReactNode = null;
  let label = "";

  if (chart.k === "part") {
    const pct = Math.max(2, Math.round((chart.a / (chart.b || 1)) * 100));
    label = `${chart.a} of ${chart.b}${chart.la ? `, ${chart.la}` : ""}`;
    inner = (
      <>
        <rect x="0" y="8" width="300" height="14" rx="7" fill={G} />
        <rect x="0" y="8" width={pct * 3} height="14" rx="7" fill={S} opacity=".85" />
        <text x="0" y="40" fontSize="12" fill={S} fontFamily="inherit">
          {chart.a} of {chart.b}
        </text>
        <text x="300" y="40" fontSize="11" fill={F} fontFamily="inherit" textAnchor="end">
          {chart.la || ""}
        </text>
      </>
    );
  } else if (chart.k === "split") {
    h = 64;
    const m = Math.max(chart.a, chart.b) || 1;
    const wa = Math.max(3, Math.round((chart.a / m) * 220));
    const wb = Math.max(3, Math.round((chart.b / m) * 220));
    label = `${chart.la || ""} ${chart.a}, against ${chart.lb || ""} ${chart.b}`;
    inner = (
      <>
        <text x="0" y="14" fontSize="11" fill={F} fontFamily="inherit">
          {chart.la || ""}
        </text>
        <rect x="0" y="20" width={wa} height="10" rx="5" fill={S} opacity=".85" />
        <text x={wa + 9} y="29" fontSize="12" fill={S} fontFamily="inherit">
          {fmt(chart.a)}
        </text>
        <text x="0" y="48" fontSize="11" fill={F} fontFamily="inherit">
          {chart.lb || ""}
        </text>
        <rect x="0" y="54" width={wb} height="10" rx="5" fill={G} />
        <text x={wb + 9} y="63" fontSize="12" fill={F} fontFamily="inherit">
          {fmt(chart.b)}
        </text>
      </>
    );
  } else if (chart.k === "clock") {
    const total = chart.unit === "month" ? 12 : 24;
    const on = new Set(chart.hrs || []);
    h = 48;
    label = chart.label || "";
    inner = (
      <>
        {Array.from({ length: total }, (_, i) => {
          const lit = on.has(i);
          const w = 300 / total;
          return (
            <rect
              key={i}
              x={i * w + 1}
              y={lit ? 4 : 15}
              width={w - 2.5}
              height={lit ? 26 : 8}
              rx="2"
              fill={lit ? S : G}
              opacity={lit ? 0.85 : 1}
            />
          );
        })}
        <text x="0" y="45" fontSize="11" fill={S} fontFamily="inherit">
          {chart.label || ""}
        </text>
      </>
    );
  } else if (chart.k === "run") {
    const len = chart.length || 30;
    const [gs, ge] = chart.gap;
    const w = 300 / len;
    label = chart.label || "";
    inner = (
      <>
        {Array.from({ length: len }, (_, i) => {
          const hole = i >= gs && i <= ge;
          return (
            <rect
              key={i}
              x={i * w + 0.6}
              y={hole ? 18 : 5}
              width={Math.max(1.2, w - 1.4)}
              height={hole ? 3 : 24}
              rx="1"
              fill={hole ? G : S}
              opacity={hole ? 1 : 0.6}
            />
          );
        })}
        <text x="0" y="43" fontSize="11" fill={F} fontFamily="inherit">
          {chart.label || ""}
        </text>
      </>
    );
  } else if (chart.k === "steps") {
    const st = chart.steps;
    const max = Math.max(...st.map((x) => x.d), 1);
    h = st.length * 22 + 12;
    label = st.map((x) => x.l).join(", then ");
    inner = (
      <>
        {st.map((x, i) => {
          const cx = 8 + (x.d / max) * 268;
          const y = 12 + i * 22;
          return (
            <g key={`${x.l}-${i}`}>
              <line x1="8" y1={y} x2="292" y2={y} stroke={G} strokeWidth="1" />
              <circle cx={cx} cy={y} r="4.5" fill={S} opacity=".9" />
              <text
                x={cx < 150 ? cx + 11 : cx - 11}
                y={y + 4}
                fontSize="11"
                fill={F}
                fontFamily="inherit"
                textAnchor={cx < 150 ? "start" : "end"}
              >
                {x.l}
                {x.d ? ` · day ${x.d}` : ""}
              </text>
            </g>
          );
        })}
      </>
    );
  } else if (chart.k === "series") {
    const all = chart.pre.concat(chart.post);
    const mx = Math.max(...all, 1);
    const pt = (arr: number[], off: number) =>
      arr
        .map((y, i) => `${off + i * (140 / Math.max(arr.length - 1, 1))},${44 - (y / mx) * 36}`)
        .join(" ");
    h = 62;
    label = `${chart.la || ""} before, ${chart.lb || ""} after`;
    inner = (
      <>
        <polyline points={pt(chart.pre, 0)} fill="none" stroke={G} strokeWidth="2" />
        <polyline points={pt(chart.post, 160)} fill="none" stroke={S} strokeWidth="2" opacity=".9" />
        <line x1="150" y1="4" x2="150" y2="46" stroke={S} strokeOpacity=".28" strokeDasharray="3 3" />
        <text x="0" y="60" fontSize="11" fill={F} fontFamily="inherit">
          {chart.la || ""}
        </text>
        <text x="300" y="60" fontSize="11" fill={S} fontFamily="inherit" textAnchor="end">
          {chart.lb || ""}
        </text>
      </>
    );
  } else if (chart.k === "swap") {
    const rows = Math.max(chart.before.length, chart.after.length);
    h = rows * 20 + 10;
    label = `${chart.before.join(", ")} traded for ${chart.after.join(", ")}`;
    inner = (
      <>
        {chart.before.map((w, i) => (
          <text key={`b-${i}`} x="0" y={16 + i * 20} fontSize="12.5" fill={G} fontFamily="inherit">
            {w}
          </text>
        ))}
        {chart.after.map((w, i) => (
          <text
            key={`a-${i}`}
            x="300"
            y={16 + i * 20}
            fontSize="12.5"
            fill={S}
            fontFamily="inherit"
            textAnchor="end"
          >
            {w}
          </text>
        ))}
        <line
          x1="150"
          y1="4"
          x2="150"
          y2={rows * 20 + 2}
          stroke={S}
          strokeOpacity=".25"
          strokeDasharray="3 3"
        />
      </>
    );
  } else if (chart.k === "ring") {
    label = chart.note || "";
    inner = (
      <>
        <line x1="4" y1="20" x2="296" y2="20" stroke={G} strokeWidth="1.5" />
        <circle cx="4" cy="20" r="5" fill={S} />
        <circle cx="296" cy="20" r="5" fill={S} />
        <text x="150" y="42" fontSize="11" fill={F} fontFamily="inherit" textAnchor="middle">
          {chart.note || ""}
        </text>
      </>
    );
  }

  if (!inner) return null;

  return (
    <figure style={{ margin: "0 0 13px", maxWidth: 340 }}>
      <svg
        viewBox={`0 0 300 ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        {inner}
      </svg>
    </figure>
  );
}

const rowWrap: CSSProperties = {
  marginTop: 11,
  borderTop: "1px solid #171717",
  paddingTop: 9,
};

const btnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 0",
  minHeight: 24,
  background: "none",
  border: 0,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  color: "rgba(255,253,253,.52)",
  fontSize: 10.5,
  letterSpacing: "0.05em",
};

const kindStyle: CSSProperties = {
  color: "var(--s, #5599FF)",
  opacity: 0.75,
  letterSpacing: "0.09em",
};

const lineStyle: CSSProperties = {
  flex: "1 1 100%",
  minWidth: 0,
  lineHeight: 1.6,
};

const arwStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 13,
  transition: "transform 0.28s cubic-bezier(.2,.7,.3,1)",
};

const lockStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 9,
  color: "var(--s, #5599FF)",
  opacity: 0.6,
  flexShrink: 0,
};

const stepStyle: CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "rgba(255,253,253,.52)",
  margin: "1px 0 8px",
};

const chainP: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.72,
  color: "rgba(255,253,253,.7)",
  margin: 0,
  maxWidth: "62ch",
};

const recLbl: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  fontSize: 9.5,
  letterSpacing: "0.14em",
  color: "rgba(255,253,253,.52)",
  textTransform: "uppercase",
  margin: "0 0 9px",
};

const recLblCount: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.06em",
  color: "rgba(var(--s-rgb, 85, 153, 255), .55)",
  textTransform: "none",
};

const recRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "132px 74px 1fr",
  gap: 10,
  alignItems: "baseline",
  padding: "8px 0",
  fontSize: 11.5,
  lineHeight: 1.5,
};

const recWhen: CSSProperties = {
  color: "rgba(255,253,253,.5)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.01em",
};

const recSrc: CSSProperties = {
  color: "var(--s, #5599FF)",
  opacity: 0.7,
  fontSize: 10,
  letterSpacing: "0.06em",
};

const recWhat: CSSProperties = { color: "rgba(255,253,253,.62)" };

const recWhy: CSSProperties = {
  gridColumn: 3,
  fontSize: 9.5,
  letterSpacing: "0.07em",
  color: "rgba(255,253,253,.52)",
  marginTop: 2,
};

const recMore: CSSProperties = {
  fontSize: 10.5,
  color: "rgba(255,253,253,.52)",
  margin: "9px 0 0",
};

const exportBtn: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  margin: 0,
  fontFamily: "inherit",
  fontSize: "inherit",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const noteStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,253,253,.52)",
  margin: "20px 0 0",
  lineHeight: 1.7,
  paddingTop: 18,
  borderTop: "1px solid #151515",
  maxWidth: "62ch",
};

const noteLbl: CSSProperties = {
  display: "block",
  color: "rgba(255,253,253,.52)",
  letterSpacing: "0.06em",
  fontSize: 10,
  marginBottom: 3,
};

export default EvidenceTrace;
