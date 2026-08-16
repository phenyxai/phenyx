"use client";

import { useEffect, useState } from "react";

// ============================================================================
// DailyFocus: Pro-only `observing: <pillar>` / change (PHE-70 / v67)
// ----------------------------------------------------------------------------
// Persists per user per local date (`phenyx_focus_<userId>_<yyyy-mm-dd>`).
// Clearing (or picking `everything`) restores the default four. Free users
// never mount this control.
// ============================================================================

export const DAILY_FOCUS_PILLARS = [
  "origin",
  "emergence",
  "self-creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
] as const;

export type DailyFocusPillar = (typeof DAILY_FOCUS_PILLARS)[number];

/** Stored value: a pillar slug, `everything`, or empty (unset → default four). */
export type DailyFocusValue = DailyFocusPillar | "everything" | "";

export function localISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailyFocusStorageKey(userId: string, now: Date = new Date()): string {
  return `phenyx_focus_${userId}_${localISODate(now)}`;
}

export function readDailyFocus(userId: string, now?: Date): DailyFocusValue {
  try {
    const raw = window.localStorage.getItem(dailyFocusStorageKey(userId, now));
    if (!raw) return "";
    if (raw === "everything") return "everything";
    if ((DAILY_FOCUS_PILLARS as readonly string[]).includes(raw)) {
      return raw as DailyFocusPillar;
    }
    return "";
  } catch {
    return "";
  }
}

export function writeDailyFocus(userId: string, value: DailyFocusValue, now?: Date): void {
  try {
    const key = dailyFocusStorageKey(userId, now);
    if (!value) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // quota / private mode: fail closed; the session still updates in memory.
  }
}

function isPillarFocus(value: DailyFocusValue): value is DailyFocusPillar {
  return value !== "" && value !== "everything";
}

export interface DailyFocusProps {
  accent: string;
  value: DailyFocusValue;
  onChange: (next: DailyFocusValue) => void;
}

export function DailyFocus({ accent, value, onChange }: DailyFocusProps) {
  const [picking, setPicking] = useState(false);

  const choose = (next: DailyFocusValue) => {
    onChange(next);
    setPicking(false);
  };

  const label = isPillarFocus(value)
    ? "observing:"
    : value === "everything"
      ? "observing everything"
      : "observing";

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          lineHeight: 1.5,
          color: "rgba(255,253,253,0.85)",
          opacity: 0.75,
        }}
      >
        {label}
        {isPillarFocus(value) && (
          <>
            {" "}
            <span style={{ color: accent }}>{value}</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => setPicking((open) => !open)}
        style={{
          background: "none",
          border: "none",
          fontFamily: "inherit",
          fontSize: 11.5,
          color: "rgba(255,253,253,0.52)",
          cursor: "pointer",
          padding: "0 0 0 8px",
          letterSpacing: "0.04em",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(255,253,253,0.52)";
        }}
      >
        {value ? "change" : "set"}
      </button>
      {picking && (
        <div
          role="listbox"
          aria-label="daily focus"
          style={{
            flexBasis: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
            justifyContent: "flex-end",
          }}
        >
          {DAILY_FOCUS_PILLARS.map((pillar) => {
            const on = value === pillar;
            return (
              <button
                key={pillar}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => choose(pillar)}
                style={{
                  background: on ? `rgba(255,253,253,0.06)` : "transparent",
                  border: `0.5px solid ${on ? accent : "rgba(255,253,253,0.14)"}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: on ? accent : "rgba(255,253,253,0.55)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {pillar}
              </button>
            );
          })}
          <button
            type="button"
            role="option"
            aria-selected={value === "everything"}
            onClick={() => choose("everything")}
            style={{
              background: "transparent",
              border: "0.5px solid rgba(255,253,253,0.14)",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              letterSpacing: "0.04em",
              color: "rgba(255,253,253,0.55)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            everything
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => choose("")}
              style={{
                background: "none",
                border: "none",
                fontFamily: "inherit",
                fontSize: 11,
                color: "rgba(255,253,253,0.4)",
                cursor: "pointer",
                padding: "4px 6px",
              }}
            >
              clear
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Load persisted focus once the signed-in user id is known. */
export function useDailyFocus(userId: string | null): {
  focus: DailyFocusValue;
  setFocus: (next: DailyFocusValue) => void;
} {
  const [focus, setFocusState] = useState<DailyFocusValue>("");

  useEffect(() => {
    if (!userId) {
      setFocusState("");
      return;
    }
    setFocusState(readDailyFocus(userId));
  }, [userId]);

  const setFocus = (next: DailyFocusValue) => {
    setFocusState(next);
    if (userId) writeDailyFocus(userId, next);
  };

  return { focus, setFocus };
}

export default DailyFocus;
