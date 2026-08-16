"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import { useTier } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { DailyHeader } from "@/components/phenyx/daily-header";
import { ObservationCard, type Observation } from "@/components/phenyx/observation-card";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { useDailySignpost } from "@/lib/first-visit";

// ============================================================================
// Daily tab — Observations feed (PHE-26)
// ----------------------------------------------------------------------------
// The default landing surface and core passive loop: the user reads what
// surfaced rather than being prompted to reflect. Header = mantra + first-visit
// signpost slot + "✦ ask polaris anything" quick-action. Below = the
// OBSERVATIONS feed with a pulsing live dot, cards rendered freshest-first.
//
// Observation CONTENT + ranking comes from the engine (backend PHE-37 /
// 06-engine-data.md) via `apiFetch("/observations")`. That endpoint may not be
// live yet, so the read fails soft: any error renders the empty state.
//
// Gating: every tier sees observation bodies. Free sees evidence traces on the
// first two of the local day; the rest keep the sentence and lock the trace
// (PHE-69). Do not client-hide bodies.
// ============================================================================

interface DailyFeedResponse {
  /** Two-line mantra: tuple or "line1 / line2" string. */
  mantra?: string | [string, string] | null;
  observations?: Observation[];
}

// The pulsing OBSERVATIONS live dot. Keyframe injected once; frozen under
// prefers-reduced-motion (mirrors PolarisBadge / observation-card).
const LIVE_GREEN = "#4ADE80";
let liveDotInjected = false;

function injectLiveDotStyles() {
  if (liveDotInjected || typeof document === "undefined") return;
  liveDotInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-phenyx-daily-live-dot", "");
  style.textContent = `
    @keyframes phenyx-daily-live-pulse {
      0%, 100% { opacity: 1;   box-shadow: 0 0 0 0 ${LIVE_GREEN}66; }
      50%      { opacity: 0.4; box-shadow: 0 0 0 4px ${LIVE_GREEN}00; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phenyx-daily-live-dot {
        animation: none !important;
        opacity: 1 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function DailyTabPage() {
  const router = useRouter();
  const { isPro } = useTier();
  const { openModal } = useSettingsModals();
  const showSignpost = useDailySignpost();

  const [loading, setLoading] = useState(true);
  const [mantra, setMantra] = useState<DailyFeedResponse["mantra"]>(null);
  const [observations, setObservations] = useState<Observation[]>([]);

  useEffect(() => {
    injectLiveDotStyles();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/observations");
        if (!res.ok) throw new Error(`observations ${res.status}`);
        const data = (await res.json()) as DailyFeedResponse | Observation[];
        // Tolerate either a bare array or a { mantra, observations } envelope.
        const list = Array.isArray(data) ? data : data.observations ?? [];
        const m = Array.isArray(data) ? null : data.mantra ?? null;
        if (!active) return;
        // Freshest-first: the engine orders by surfaced_at DESC; we do not
        // re-sort (created_at is not always on the served shape) but keep the
        // server order as authoritative.
        setObservations(list);
        setMantra(m);
      } catch {
        // Endpoint not live / transport error → empty feed (empty state renders).
        if (active) {
          setObservations([]);
          setMantra(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openUpgrade = () => openModal("upgrade");

  const goToPolaris = () => {
    // PHE-35 seam: fire the `tab_visit` engagement event here once the
    // instrumentation helper lands. Routing is independent of it.
    router.push("/dashboard/polaris");
  };

  // Token label is the weekly Polaris allowance (v67): 800 for pro, lock copy for free.
  const tokenLabel = isPro ? "800 weekly tokens" : "polaris is on pro";

  // v67: observation bodies are never locked. `observation.locked` means the
  // evidence trace is behind the free daily budget (PHE-69 / PHE-71).
  const lockedTraceCount = observations.filter((o) => o.locked).length;

  return (
    <section style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
      {/* First-visit intro banner for the Daily tab (PHE-33). */}
      <IntroBanner tab="daily" copy={INTRO_COPY.daily} className="mb-6" />

      <DailyHeader
        mantra={mantra}
        tokenLabel={tokenLabel}
        onAskPolaris={goToPolaris}
        // First-visit signpost (PHE-33) — one-time, keyed independently of the
        // Daily intro banner. Rendered only until it has been seen once.
        signpost={
          showSignpost ? (
            <p
              className="animate-fade-in"
              style={{
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1.5,
                color: "rgba(255,253,253,0.5)",
                margin: 0,
                marginBottom: 20,
              }}
            >
              start with daily to see what emerged this week.
            </p>
          ) : null
        }
      />

      {/* OBSERVATIONS section header with the pulsing live dot. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 44, marginBottom: 20 }}>
        <span
          aria-hidden="true"
          className="phenyx-daily-live-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: LIVE_GREEN,
            flexShrink: 0,
            animation: "phenyx-daily-live-pulse 2s ease-in-out infinite",
          }}
        />
        <h2
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,253,253,0.45)",
            margin: 0,
          }}
        >
          observations
        </h2>
      </div>

      {loading ? (
        <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,253,253,0.35)" }}>
          loading…
        </p>
      ) : observations.length === 0 ? (
        <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.55, color: "rgba(255,253,253,0.4)" }}>
          nothing has surfaced yet. connect more platforms or check back tomorrow.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {observations.map((obs) => (
              <ObservationCard
                key={obs.id}
                observation={obs}
                locked={false}
                onUpgrade={openUpgrade}
              />
            ))}
          </div>

          {lockedTraceCount > 0 && (
            <button
              type="button"
              onClick={openUpgrade}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "none",
                marginTop: 20,
                padding: 0,
                fontSize: 13,
                color: "rgba(255,253,253,0.4)",
                textAlign: "center",
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              more traces on pro
            </button>
          )}
        </>
      )}
    </section>
  );
}
