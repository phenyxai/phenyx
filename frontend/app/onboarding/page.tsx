"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { OnairosCompleteData } from "onairos";
import { OnairosButtonWrapper } from "@/components/onairos-button-wrapper";
import { PolarisBadge } from "@/components/phenyx/polaris-badge";
import { redactOnairosForProfile } from "@/lib/onairos-snapshot";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";

const STELLAR_PALETTE = [
  "#CC3300", "#E84422", "#E87722", "#E8B822",
  "#D4C87A", "#C8C8C8", "#88AAEE", "#77BBFF",
  "#5599FF", "#4488EE", "#3366DD", "#2255CC",
  "#1144BB", "#0033AA"
];

// ============================================================================
// Onboarding step machine (PHE-14 foundation)
// ----------------------------------------------------------------------------
// `onboarding_step` is the single source of truth for the user's position in
// the post-auth narrative funnel. It is persisted to user_profiles so the flow
// is resumable across refresh and across devices (see setOnboardingStep + the
// resume logic in the init effect). The 8 values mirror the prototype go()
// router and the DB enum added in
//   supabase/migrations/20260626000000_user_profiles_onboarding_step.sql
//
// Flow: welcome (separate /welcome route) → fork → manifesto → polaris_intro →
//       connect → synthesizing → reveal → done (→ /constellation dashboard).
//
// The fork branches: "show me how it works" → manifesto; the skip link jumps
// straight to connect, bypassing manifesto + polaris_intro (not marked seen).
// ============================================================================
type OnboardingStep =
  | "welcome"
  | "fork"
  | "manifesto"
  | "polaris_intro"
  | "connect"
  | "synthesizing"
  | "reveal"
  | "done";

// Forward "continue" target for the linear (non-fork) part of the funnel.
// The fork's two branches are handled explicitly in its button handlers.
const NEXT_STEP: Record<OnboardingStep, OnboardingStep> = {
  welcome: "fork",
  fork: "manifesto",
  manifesto: "polaris_intro",
  polaris_intro: "connect",
  connect: "synthesizing",
  synthesizing: "reveal",
  reveal: "done",
  done: "done",
};

// Back-arrow target for each screen. On the NORMAL path s6 (connect) follows the
// Polaris intro, so `back` returns there. The s3b skip-path reaches connect by
// bypassing manifesto + polaris_intro; if such a user taps back they land on the
// polaris_intro screen (which they skipped) and the polaris_intro→manifesto→fork
// chain remains intact — a sensible, non-dead-ending choice (PHE-17 decision).
const PREV_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  manifesto: "fork",
  polaris_intro: "manifesto",
  connect: "polaris_intro",
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
}

// ----------------------------------------------------------------------------
// Synthesis result captured for the reveal's node-glow (PHE-18 → consumed by
// PHE-19). Mirrors the 4 ACTIVE pillar scores from `constellation_state`
// (0-100 ints) plus their synthesis paragraphs; the engine round-trips extra
// fields, so an index signature keeps any additional payload intact. The 3
// LOCKED pillars (becoming/recognition/transcendence) carry no score.
//
// Lifecycle:
//   - null  → synthesis hasn't landed yet, OR it failed, OR no trigger ran.
//             The reveal (PHE-19) falls back to neutral/equal glow on the 4
//             active nodes; the dashboard hydrates the real scores later.
//   - set   → synthesis resolved before/while the reveal plays; PHE-19 reads
//             these score fields to scale active-node glow intensity.
// Node POSITIONS never depend on this — only glow intensity does.
// ----------------------------------------------------------------------------
interface ConstellationState {
  origin_score?: number | null;
  emergence_score?: number | null;
  self_creation_score?: number | null;
  convergence_score?: number | null;
  [key: string]: unknown;
}

// Normalized, lowercased platform/source names connected through the Onairos
// SDK. `connectedSources` is the SDK's Ascend-friendly normalized list; we treat
// its length as the authoritative count of connected platforms (with the trait
// summary's accountsCount as a fallback for the >=1 gate in the callback).
function getConnectedPlatforms(result: OnairosCompleteData): string[] {
  const sources = Array.isArray(result.connectedSources) ? result.connectedSources : [];
  return sources
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter((s) => s.length > 0);
}

export default function OnboardingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("fork");
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [userId, setUserId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // s6 connect notice — shown when the SDK returns 0 connected platforms so the
  // user stays on s6 and is prompted to connect at least one (PHE-17 gating).
  const [connectNotice, setConnectNotice] = useState<string | null>(null);

  // Synthesis result for the reveal's node-glow (PHE-18). Holds the resolved
  // `constellation_state` scores IF synthesis lands while the user is still in
  // the flow; stays null on failure/absence (reveal falls back to neutral glow).
  // PHE-19 reads this to drive active-node glow intensity.
  const [constellationState, setConstellationState] = useState<ConstellationState | null>(null);

  // Duplicate-trigger guard (PHE-18). The synthesis POST must fire AT MOST ONCE
  // per successful connection — a re-render, a double success callback, or a
  // retry must not double-fire it. This is a CLIENT-side guard only; server-side
  // idempotency (trigger_event_id + per-user advisory lock) is owned by the
  // engine lane (06-engine-data.md), not this ticket.
  const synthesisTriggeredRef = useRef(false);

  // --------------------------------------------------------------------------
  // Init: stellar color, reduced-motion, user, and resume-on-load.
  // Reads persisted onboarding_step and renders the shell at the saved step.
  // - "done"        → route to /constellation (dashboard); never render shell.
  // - null/"welcome" → default to "fork" (welcome already completed).
  // - otherwise     → resume exactly where the user left off.
  // setMounted(true) is deferred until the step is resolved to avoid a flash of
  // the fork screen before resuming at a later step.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
      document.documentElement.style.setProperty("--color-stellar", stored);
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("stellar_color, onboarding_step")
          .eq("id", user.id)
          .single();

        if (profile?.stellar_color) {
          setStellarColor(profile.stellar_color);
          document.documentElement.style.setProperty("--color-stellar", profile.stellar_color);
        }

        const saved = profile?.onboarding_step as OnboardingStep | null | undefined;
        if (saved === "done") {
          // Onboarding already complete — go straight to the dashboard surface.
          router.replace("/constellation");
          return;
        }
        // Unset/null or the welcome sentinel both resolve to the fork (s3b).
        setStep(saved && saved !== "welcome" ? saved : "fork");
      }
      setMounted(true);
    };

    init();
  }, [router]);

  // Particle animation background (reused infra — keep across tickets)
  useEffect(() => {
    if (!mounted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 0.8 + Math.random() * 1.4,
        color: STELLAR_PALETTE[Math.floor(Math.random() * STELLAR_PALETTE.length)],
        opacity: 0.10 + Math.random() * 0.08
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [mounted, prefersReducedMotion]);

  // --------------------------------------------------------------------------
  // setOnboardingStep — the reusable forward-transition helper (PHE-14).
  // Updates local render state AND upserts user_profiles.onboarding_step so the
  // position is durable. Later tickets (PHE-15..19) call this on every forward
  // transition. Persistence is best-effort: render state always advances even
  // if the upsert fails or the user is anonymous, so the UX never stalls.
  // --------------------------------------------------------------------------
  const setOnboardingStep = useCallback(async (next: OnboardingStep) => {
    setStep(next);
    if (!userId) return;
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, onboarding_step: next });
    if (error) {
      console.warn("[onboarding] onboarding_step upsert:", error.message);
    }
  }, [userId]);

  // Back-arrow handler (placeholder semantics — see PREV_STEP).
  const goBack = useCallback(() => {
    const prev = PREV_STEP[step];
    if (prev) void setOnboardingStep(prev);
  }, [setOnboardingStep, step]);

  // --------------------------------------------------------------------------
  // synthesizing → reveal handoff (PHE-18).
  // ----------------------------------------------------------------------------
  // `synthesizing` is a TRANSIENT step — the user is NEVER parked on it. The
  // reveal animation (PHE-19) IS the loading experience that masks synthesis
  // latency, so the moment `synthesizing` mounts we hand off to `reveal` with no
  // blank/spinner frame in between (the ambient dark canvas stays continuous).
  //
  // Crucially this does NOT trigger synthesis — the synthesis POST fires ONLY
  // from the Onairos success callback (handleOnairosComplete). So a refresh that
  // resumes at the persisted `synthesizing` step advances straight to the reveal
  // WITHOUT re-running synthesis (no duplicate trigger). The transition is also
  // independent of the synthesis promise's success/failure.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (step === "synthesizing") {
      void setOnboardingStep("reveal");
    }
  }, [step, setOnboardingStep]);

  // --------------------------------------------------------------------------
  // s6 Onairos success callback (PHE-17 — the core logic).
  // ----------------------------------------------------------------------------
  // Token hygiene (acceptance criterion): the Onairos JWT (`result.token`) is
  // held in memory ONLY for the duration of this callback / the synthesis
  // trigger and is NEVER written durably — no localStorage, no onairos_connections,
  // no user_profiles, no logs/analytics. The redaction step strips it before any
  // persist; we never log `result.token`.
  // --------------------------------------------------------------------------
  const handleOnairosComplete = useCallback((result: OnairosCompleteData) => {
    // 1) Validate >= 1 connected platform. A cancel / explicit failure / empty
    //    connection set must NOT advance — synthesis cannot run on an empty
    //    trait object, so we keep the user on s6 with a visible prompt.
    const platforms = getConnectedPlatforms(result);
    // Gate the advance on the SAME source we persist (`platforms`, which feeds
    // the onairos_connections upsert) so we never advance with zero rows written.
    const connectedCount = platforms.length;
    if (result.cancelled || result.success === false || !!result.error || connectedCount < 1) {
      setConnectNotice("connect at least one platform to continue.");
      return;
    }
    setConnectNotice(null);

    // 2) Redact (strip JWT/credential fields) before ANY durable persist.
    const redacted = redactOnairosForProfile(result);

    // 3) Persist per-platform connection rows + redacted snapshot (token-free).
    //    `onairos_connections` is owned by another lane (PHE-31) and may not
    //    exist in the DB yet — write defensively so a missing-table/RLS error is
    //    logged + swallowed but never blocks the flow. Keyed on (user_id, platform).
    if (userId && platforms.length > 0) {
      const rows = platforms.map((platform) => ({
        user_id: userId,
        platform,
        status: "connected",
        redacted_snapshot: redacted,
        // A reconnect must clear any stale disconnect timestamp.
        disconnected_at: null,
      }));
      void supabase
        .from("onairos_connections")
        .upsert(rows, { onConflict: "user_id,platform" })
        .then(({ error }) => {
          if (error) {
            console.warn("[onboarding] onairos_connections upsert:", error.message);
          }
        });
    }

    // Also keep a redacted (token-free) profile snapshot for personalization.
    if (userId && Object.keys(redacted).length > 0) {
      void supabase
        .from("user_profiles")
        .upsert({ id: userId, onairos_data: redacted })
        .then(({ error }) => {
          if (error) {
            console.warn("[onboarding] user_profiles.onairos_data upsert:", error.message);
          }
        });
    }

    // 4) Hand the FULL trait object to synthesis (the engine round-trips it
    //    byte-identical as `onairos_snapshot`). STRICT FIRE-AND-FORGET (PHE-18):
    //    the POST is LAUNCHED but NEVER awaited — step 5 below advances the user
    //    immediately, regardless of synthesis latency or outcome. `apiFetch`
    //    awaits the Supabase session internally before issuing the request, but
    //    because we do NOT await `apiFetch` here, that lookup can never delay
    //    navigation. The promise rejection is swallowed into a non-blocking
    //    no-op (no unhandled rejection, no UI block). Guarded by
    //    `synthesisTriggeredRef` so a re-render / double success-callback / retry
    //    fires synthesis at most once per successful connection.
    if (userId && !synthesisTriggeredRef.current) {
      synthesisTriggeredRef.current = true;
      apiFetch("/synthesize-constellation", {
        method: "POST",
        body: JSON.stringify({ userId, onairosData: result })
      })
        // `apiFetch` does NOT check `res.ok`, so a 4xx/5xx error body must not be
        // stored as a non-null constellationState. Only parse on a 2xx response.
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ConstellationState | null) => {
          // SUCCESS: if synthesis lands while the user is still in the flow,
          // capture the scores so the reveal (PHE-19) can glow the active nodes
          // by intensity. If it never lands in time the reveal just uses the
          // neutral fallback and the dashboard hydrates later — either is fine.
          // Only store a score-bearing object: at least one of the four scores
          // must be a finite number, else honor the "null on failure" contract.
          if (data && typeof data === "object") {
            const hasScore = [
              data.origin_score,
              data.emergence_score,
              data.self_creation_score,
              data.convergence_score,
            ].some((v) => typeof v === "number" && Number.isFinite(v));
            if (hasScore) setConstellationState(data);
          }
        })
        .catch(() => {
          // FAILURE (network / Claude error / crisis short-circuit / malformed
          // trait): non-blocking. `constellationState` stays null, the user
          // still reaches the dashboard via the reveal, and the dashboard shows
          // its own "still forming" state (owned by 04-dashboard.md). This catch
          // does NOT alter or block the synthesizing→reveal→done transitions.
        });
    }

    // 5) Persist onboarding_step = synthesizing and advance toward the reveal.
    //    This is NOT gated on the synthesis promise above — the user proceeds
    //    immediately into the reveal animation (PHE-19), which IS the loading
    //    experience, so there is never a blank loader/spinner.
    void setOnboardingStep("synthesizing");
  }, [userId, setOnboardingStep]);

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "#0A0A0A" }} />;
  }

  const showBack = Boolean(PREV_STEP[step]);

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", position: "relative", overflow: "hidden" }}>
      {/* Particle canvas (reused infra) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none"
        }}
      />

      {/* Screen reader announcer */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="step-announcer">
        {step === "fork" && "new or familiar fork"}
        {step === "manifesto" && "what phenyx is"}
        {step === "polaris_intro" && "introducing polaris"}
        {step === "connect" && "connect your platforms"}
        {step === "synthesizing" && "synthesizing your constellation"}
        {step === "reveal" && "constellation reveal"}
      </div>

      {/* Back arrow (non-fork screens) */}
      {showBack && (
        <button
          onClick={goBack}
          aria-label="go back to previous step"
          style={{
            position: "fixed",
            top: 24,
            left: 24,
            zIndex: 10,
            background: "none",
            border: "none",
            color: "#555",
            fontSize: "18px",
            cursor: "pointer",
            padding: "8px",
            transition: "color 0.2s ease"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
        >
          ←
        </button>
      )}

      {/* Main content. Keyed by step so the fade-in re-fires cleanly on every
          transition (no stale animation/visibility state on back-nav). */}
      <div
        key={step}
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}
      >
        {/* ================================================================ */}
        {/* s3b — NEW/FAMILIAR FORK (PHE-14, fully implemented)              */}
        {/* ================================================================ */}
        {step === "fork" && (
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <p
              className="animate-fade-in"
              style={{
                fontSize: "10px",
                color: stellarColor,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                marginBottom: "20px"
              }}
            >
              before we continue
            </p>

            <h1
              className="animate-fade-in"
              style={{
                animationDelay: "150ms",
                animationFillMode: "both",
                fontSize: "24px",
                fontWeight: 300,
                color: "#FFFDFD",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
                marginBottom: "20px"
              }}
            >
              new here, or already know phenyx?
            </h1>

            <p
              className="animate-fade-in"
              style={{
                animationDelay: "300ms",
                animationFillMode: "both",
                fontSize: "14px",
                fontWeight: 300,
                color: "#888",
                lineHeight: 1.7,
                marginBottom: "40px"
              }}
            >
              {"if you've used phenyx before, skip straight to connecting your platforms. otherwise, it's worth a minute to see how this works."}
            </p>

            {/* Primary: show me how it works → manifesto (s4) */}
            <button
              onClick={() => void setOnboardingStep("manifesto")}
              aria-label="show me how it works"
              className="animate-fade-in"
              style={{
                animationDelay: "450ms",
                animationFillMode: "both",
                background: "transparent",
                border: `0.5px solid ${stellarColor}`,
                color: stellarColor,
                borderRadius: "8px",
                padding: "13px 36px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFFDFD";
                e.currentTarget.style.color = "#0A0A0A";
                e.currentTarget.style.borderColor = "#FFFDFD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = stellarColor;
                e.currentTarget.style.borderColor = stellarColor;
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
            >
              show me how it works
            </button>

            {/* Skip: connect my platforms → connect (s6), bypassing s4 + s5 */}
            <div style={{ marginTop: "24px" }}>
              <button
                onClick={() => void setOnboardingStep("connect")}
                aria-label="skip the intro, connect my platforms"
                className="animate-fade-in"
                style={{
                  animationDelay: "600ms",
                  animationFillMode: "both",
                  background: "none",
                  border: "none",
                  color: "#555",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.2s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                skip the intro, connect my platforms
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PLACEHOLDER screens — replaced wholesale by later tickets.       */}
        {/* Each advances onboarding_step to the correct next step.          */}
        {/* ================================================================ */}

        {/* ================================================================ */}
        {/* s4A/s4B — MANIFESTO MOMENT (PHE-15, fully implemented)           */}
        {/* Variant is resolved centrally (MANIFESTO_VARIANT = "s4B"); the    */}
        {/* gentle s4B renders, the staggered s4A ships but is unreachable.   */}
        {/* ================================================================ */}
        {step === "manifesto" && (
          <ManifestoScreen
            stellarColor={stellarColor}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("polaris_intro")}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* s5A/s5B — POLARIS INTRODUCTION MOMENT (PHE-16, fully implemented) */}
        {/* Variant is resolved centrally (POLARIS_VARIANT = "s5B"); the      */}
        {/* gentle s5B renders, the staggered s5A ships but is unreachable.   */}
        {/* The example Q&A is authored STATIC copy — no Claude call / token  */}
        {/* spend, no constellation_state dependency.                        */}
        {/* ================================================================ */}
        {step === "polaris_intro" && (
          <PolarisIntroScreen
            stellarColor={stellarColor}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("connect")}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* s6 — ONAIROS PLATFORM CONNECT (PHE-17, fully implemented)        */}
        {/* Self-contained: the s3b skip-path lands here directly without the */}
        {/* manifesto / polaris_intro having run, so this screen assumes no   */}
        {/* prior narrative state. The CTA mounts the real Onairos SDK; the   */}
        {/* success callback (handleOnairosComplete) validates >=1 platform,  */}
        {/* persists a redacted (token-free) snapshot, fires synthesis, and   */}
        {/* advances to synthesizing.                                        */}
        {/* ================================================================ */}
        {step === "connect" && (
          <ConnectScreen
            stellarColor={stellarColor}
            notice={connectNotice}
            onComplete={handleOnairosComplete}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* synthesizing — BACKGROUND SYNTHESIS HANDOFF (PHE-18)             */}
        {/* ---------------------------------------------------------------- */}
        {/* Deliberately renders NO spinner and NO blank loader. This is a   */}
        {/* transient: the handoff effect above immediately advances to      */}
        {/* `reveal`, and the ambient dark canvas (the fixed particle bg)    */}
        {/* stays visible the whole time, so the transition into the reveal  */}
        {/* animation is visually continuous. PHE-19 owns the actual reveal; */}
        {/* `synthesizing` must hand off to it without a blank frame.        */}
        {/* ================================================================ */}
        {step === "synthesizing" && (
          <div aria-hidden="true" style={{ width: "100%", minHeight: "100vh" }} />
        )}

        {/* ================================================================ */}
        {/* reveal — CONSTELLATION REVEAL scrC (PHE-19 will implement)       */}
        {/* ---------------------------------------------------------------- */}
        {/* PHE-19 replaces this placeholder with the 5-phase particle       */}
        {/* animation (~10s), reading `constellationState` for active-node   */}
        {/* glow intensity (null → neutral fallback). For now the placeholder */}
        {/* renders a CTA (not a blank/spinner) and, on completion, sets      */}
        {/* onboarding_step = done BEFORE routing to /constellation (PHE-14   */}
        {/* wiring — keep this order so the dashboard never bounces back into */}
        {/* onboarding). The transition is independent of synthesis outcome.  */}
        {/* ================================================================ */}
        {step === "reveal" && (
          <PlaceholderScreen
            label={constellationState ? "reveal (scores ready)" : "reveal"}
            stellarColor={stellarColor}
            ctaLabel="finish"
            onContinue={() => {
              void setOnboardingStep("done");
              router.replace("/constellation");
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

// Minimal placeholder for not-yet-built steps. Later tickets replace the whole
// block above; this just renders the step name + a single advancing CTA so the
// funnel is navigable end-to-end.
function PlaceholderScreen({
  label,
  stellarColor,
  ctaLabel,
  onContinue,
}: {
  label: string;
  stellarColor: string;
  ctaLabel: string;
  onContinue: () => void;
}) {
  return (
    <div style={{ textAlign: "center", maxWidth: 420 }}>
      <p
        className="animate-fade-in"
        style={{ fontSize: "11px", color: "#444", letterSpacing: "0.15em", marginBottom: "8px" }}
      >
        PLACEHOLDER
      </p>
      <p
        className="animate-fade-in"
        style={{
          animationDelay: "150ms",
          animationFillMode: "both",
          fontSize: "18px",
          fontWeight: 300,
          color: "#FFFDFD",
          marginBottom: "32px"
        }}
      >
        {label}
      </p>
      <button
        onClick={onContinue}
        aria-label={ctaLabel}
        className="animate-fade-in"
        style={{
          animationDelay: "300ms",
          animationFillMode: "both",
          background: "transparent",
          border: `0.5px solid ${stellarColor}`,
          color: stellarColor,
          borderRadius: "8px",
          padding: "10px 32px",
          fontSize: "13px",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.2s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#FFFDFD";
          e.currentTarget.style.color = "#0A0A0A";
          e.currentTarget.style.borderColor = "#FFFDFD";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = stellarColor;
          e.currentTarget.style.borderColor = stellarColor;
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ============================================================================
// s6 Onairos Platform Connect (PHE-17)
// ----------------------------------------------------------------------------
// Verbatim, all-lowercase framing + 4 data-point bullets + the "sign in with
// onairos" CTA (the real Onairos SDK, mounted via OnairosButtonWrapper). The
// success path (validate >=1 platform → redact → persist → synthesize → advance)
// lives in the parent's handleOnairosComplete; this screen only renders + wires
// the SDK and surfaces the 0-platform notice.
//
// Self-contained: the s3b skip-path lands here directly, so it assumes no prior
// manifesto / polaris_intro state.
//
// NOTE (.hidden CSS-collision guard, acceptance criterion): the Onairos SDK
// leaks a global `.hidden` class into the page. PHENYX must NOT rely on a bare
// `hidden` utility class anywhere or it gets clobbered — use Tailwind responsive
// (`max-lg:hidden`) / scoped variants instead. Enforced via eslint.config.mjs
// (no-restricted-syntax) + components/phenyx/CONVENTIONS.md.
// ============================================================================
const ONAIROS_BULLETS = [
  "we never store your raw data. it's processed and immediately discarded.",
  "everything your constellation produces belongs to you, always.",
  "you can disconnect any platform at any time, directly through onairos.",
  "connect at least 3 for the fuller picture, but you can start with one and add more whenever you want.",
] as const;

function ConnectScreen({
  stellarColor,
  notice,
  onComplete,
  onBack,
}: {
  stellarColor: string;
  notice: string | null;
  onComplete: (result: OnairosCompleteData) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
      <p
        className="animate-fade-in"
        style={{
          fontSize: "10px",
          color: stellarColor,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          marginBottom: "20px",
        }}
      >
        powered by onairos
      </p>

      <h1
        className="animate-fade-in"
        style={{
          animationDelay: "150ms",
          animationFillMode: "both",
          fontSize: "26px",
          fontWeight: 300,
          color: "#FFFDFD",
          letterSpacing: "0.01em",
          lineHeight: 1.4,
          marginBottom: "24px",
        }}
      >
        your data is the source of truth.
      </h1>

      <p
        className="animate-fade-in"
        style={{
          animationDelay: "300ms",
          animationFillMode: "both",
          fontSize: "15px",
          fontWeight: 300,
          color: "#888",
          lineHeight: 1.7,
          marginBottom: "32px",
        }}
      >
        onairos reads the signal layer beneath your platforms. not what you posted, the patterns underneath. what you play at 2am. what you search and don&apos;t act on. what you return to without thinking.
      </p>

      {/* 4 data-point bullets (exact order) */}
      <ul
        className="animate-fade-in"
        style={{
          animationDelay: "450ms",
          animationFillMode: "both",
          listStyle: "none",
          padding: 0,
          margin: "0 auto 32px",
          maxWidth: 440,
          textAlign: "left",
        }}
      >
        {ONAIROS_BULLETS.map((bullet, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: i === ONAIROS_BULLETS.length - 1 ? 0 : "16px",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: "5px",
                height: "5px",
                marginTop: "8px",
                borderRadius: "50%",
                background: stellarColor,
              }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 300,
                color: "#999",
                lineHeight: 1.6,
              }}
            >
              {bullet}
            </span>
          </li>
        ))}
      </ul>

      {/* 0-platform prompt — rendered only when the SDK returned no platforms. */}
      {notice && (
        <p
          role="alert"
          aria-live="assertive"
          style={{
            fontSize: "13px",
            fontWeight: 400,
            color: "#E84422",
            lineHeight: 1.5,
            marginBottom: "20px",
          }}
        >
          {notice}
        </p>
      )}

      {/* CTA — the real Onairos SDK mounts behind "sign in with onairos". */}
      <div
        className="animate-fade-in"
        style={{
          animationDelay: "600ms",
          animationFillMode: "both",
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <OnairosButtonWrapper
          webpageName="PHENYX COLLECTIVE"
          requestedData={["personality"]}
          buttonType="pill"
          buttonText="sign in with onairos"
          textColor="white"
          onComplete={onComplete}
        />
      </div>

      {/* back link → polaris_intro on the normal path (see PREV_STEP). */}
      <div className="animate-fade-in" style={{ animationDelay: "750ms", animationFillMode: "both" }}>
        <button
          onClick={onBack}
          aria-label="go back to the previous step"
          style={{
            background: "none",
            border: "none",
            color: "#555",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#999")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${stellarColor}`;
            e.currentTarget.style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none";
          }}
        >
          back
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Staggered reveal — reusable mechanism (PHE-15; reused by PHE-16 for s5).
// ----------------------------------------------------------------------------
// State-driven (not CSS `.in`-class driven): given an ordered list of `data-d`
// millisecond offsets, useStaggeredReveal returns a boolean[] of the same
// length where entry `i` flips true at `offsets[i] + lead` ms after mount.
// Each rendered element toggles its own opacity/transform off that flag via
// revealStyle(), and any CTA additionally gates pointer-events on it so it
// stays inert until its own offset elapses.
//
// Re-entry replay: screens mount fresh via the `key={step}` wrapper, so mount
// === screen entry. The effect still explicitly resets every entry to `false`
// before scheduling, so a back-then-forward replays from hidden rather than
// showing a static already-revealed screen. Timers are cleared on unmount to
// avoid leaks / double-fires.
//
// Reduced motion: every entry starts (and stays) true — no timers, no fade-in,
// CTA enabled immediately — so reduced-motion users are never gated.
// ============================================================================
function useStaggeredReveal(
  offsets: number[],
  opts: { lead: number; reducedMotion: boolean }
): boolean[] {
  const { lead, reducedMotion } = opts;
  const key = offsets.join(",");
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    offsets.map(() => reducedMotion)
  );

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(offsets.map(() => true));
      return;
    }
    // Clear-then-set so re-entry re-fires instead of showing a static screen.
    setRevealed(offsets.map(() => false));
    const timers = offsets.map((d, i) =>
      setTimeout(() => {
        setRevealed((prev) => {
          const next = prev.slice();
          next[i] = true;
          return next;
        });
      }, d + lead)
    );
    return () => timers.forEach(clearTimeout);
    // `key` captures the offsets list by value; offsets identity is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lead, reducedMotion]);

  return revealed;
}

// Per-element reveal style: hidden = faded + nudged down; shown = settled in.
function revealStyle(shown: boolean): CSSProperties {
  return {
    opacity: shown ? 1 : 0,
    transform: shown ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 0.8s ease, transform 0.8s ease",
  };
}

// ============================================================================
// Manifesto Moment (s4A/s4B) — PHE-15
// ----------------------------------------------------------------------------
// Variant selection is centralized here, NOT branched in screen markup: per the
// locked decision the gentle s4B renders. s4A is retained as data + rendered
// markup but is unreachable unless MANIFESTO_VARIANT is flipped back to "s4A".
// ============================================================================
type ManifestoVariant = "s4A" | "s4B";
const MANIFESTO_VARIANT: ManifestoVariant = "s4B";

type RevealBlock = {
  kind:
    | "eyebrow"
    | "heading"
    | "body"
    | "line"
    | "cta"
    | "back"
    | "badge"
    | "example";
  text?: string; // primary copy (unused by "badge"/"example")
  d: number; // data-d ms offset
  stellar?: boolean;
  muted?: boolean; // dimmer line (s5A muted reflections)
  // "example" block fields — authored STATIC Q&A, no Claude call / token spend.
  label?: string;
  q?: string;
  a?: string;
};

// s4A (manifesto) — retained-but-unreachable staggered emotional read. Lead +200
// ports the prototype's animML('#ml4').
const S4A_BLOCKS: RevealBlock[] = [
  { kind: "line", text: "you have spent years becoming someone acceptable.", d: 0 },
  { kind: "line", text: "editing yourself before anyone could see you.", d: 1400 },
  { kind: "line", text: "waiting until you were ready. until you were enough.", d: 2800 },
  { kind: "line", text: "you already are.", d: 4400, stellar: true },
  { kind: "cta", text: "continue", d: 5800 },
];

// s4B (gentle) — the shipped variant. Lead +150 ports animGR('#s4B').
const S4B_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "what phenyx is", d: 0 },
  { kind: "heading", text: "a mirror, not a map.", d: 200 },
  {
    kind: "body",
    text:
      "most identity tools show you who you could become. PHENYX shows you who you already are, using the behavioral signals you leave behind every day without realizing it.",
    d: 700,
  },
  {
    kind: "body",
    text:
      "the patterns you leave behind every day, what you return to, what you avoid, what you cannot stop doing, those are the signals. PHENYX reads them.",
    d: 1500,
  },
  { kind: "cta", text: "continue", d: 3400 },
  { kind: "back", text: "back", d: 3600 },
];

const MANIFESTO_CONFIG: Record<ManifestoVariant, { lead: number; blocks: RevealBlock[] }> = {
  s4A: { lead: 200, blocks: S4A_BLOCKS },
  s4B: { lead: 150, blocks: S4B_BLOCKS },
};

function ManifestoScreen({
  stellarColor,
  reducedMotion,
  onContinue,
  onBack,
}: {
  stellarColor: string;
  reducedMotion: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { lead, blocks } = MANIFESTO_CONFIG[MANIFESTO_VARIANT];
  const revealed = useStaggeredReveal(
    blocks.map((b) => b.d),
    { lead, reducedMotion }
  );

  return (
    <div style={{ textAlign: "center", maxWidth: 560, width: "100%" }}>
      {blocks.map((block, i) => {
        const shown = revealed[i];
        const reveal = revealStyle(shown);

        switch (block.kind) {
          case "eyebrow":
            return (
              <p
                key={i}
                style={{
                  ...reveal,
                  fontSize: "10px",
                  color: stellarColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  marginBottom: "20px",
                }}
              >
                {block.text}
              </p>
            );

          case "heading":
            return (
              <h1
                key={i}
                style={{
                  ...reveal,
                  fontSize: "28px",
                  fontWeight: 300,
                  color: "#FFFDFD",
                  letterSpacing: "0.01em",
                  lineHeight: 1.4,
                  marginBottom: "28px",
                }}
              >
                {block.text}
              </h1>
            );

          case "body":
          case "line":
            return (
              <p
                key={i}
                style={{
                  ...reveal,
                  fontSize: block.kind === "line" ? "20px" : "15px",
                  fontWeight: 300,
                  color: block.stellar ? stellarColor : "#888",
                  lineHeight: 1.7,
                  marginBottom: "22px",
                }}
              >
                {block.text}
              </p>
            );

          case "cta":
            // Gated: inert (pointer-events none + disabled) until its own
            // data-d offset elapses, so the user cannot skip ahead.
            return (
              <button
                key={i}
                onClick={onContinue}
                disabled={!shown}
                aria-label={block.text}
                style={{
                  ...reveal,
                  pointerEvents: shown ? "all" : "none",
                  marginTop: "16px",
                  background: "transparent",
                  border: `0.5px solid ${stellarColor}`,
                  color: stellarColor,
                  borderRadius: "8px",
                  padding: "13px 36px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: shown ? "pointer" : "default",
                  fontFamily: "inherit",
                  transition:
                    "opacity 0.8s ease, transform 0.8s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!shown) return;
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = stellarColor;
                  e.currentTarget.style.borderColor = stellarColor;
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                {block.text}
              </button>
            );

          case "back":
            // Gentle-only "back" link → fork. Also gated on its own offset.
            return (
              <div key={i} style={{ marginTop: "24px" }}>
                <button
                  onClick={onBack}
                  disabled={!shown}
                  aria-label="go back to the previous step"
                  style={{
                    ...reveal,
                    pointerEvents: shown ? "all" : "none",
                    background: "none",
                    border: "none",
                    color: "#555",
                    fontSize: "12px",
                    cursor: shown ? "pointer" : "default",
                    fontFamily: "inherit",
                    transition:
                      "opacity 0.8s ease, transform 0.8s ease, color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!shown) return;
                    e.currentTarget.style.color = "#999";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#555";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                >
                  {block.text}
                </button>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// ============================================================================
// Polaris Introduction Moment (s5A/s5B) — PHE-16
// ----------------------------------------------------------------------------
// Reuses PHE-15's staggered-reveal mechanism (useStaggeredReveal + revealStyle)
// and variant pattern: variant selection is centralized here, NOT branched in
// markup. Per the locked decision the gentle s5B renders; s5A is retained as
// data + rendered markup but is unreachable unless POLARIS_VARIANT is flipped.
//
// The screen carries the shared <PolarisBadge> (a "badge" reveal block at the
// top) and an authored STATIC example Q&A (an "example" reveal block). The
// example is illustrative onboarding copy — it makes ZERO API/synthesis calls
// (no apiFetch, no /generate-prompts, no /synthesize-constellation) and has no
// constellation_state dependency (the user has not synthesized yet).
// ============================================================================
type PolarisVariant = "s5A" | "s5B";
const POLARIS_VARIANT: PolarisVariant = "s5B";

// Shared authored example Q&A (verbatim) — static copy, identical across variants.
const POLARIS_EXAMPLE = {
  label: "an example",
  q: "what do people see when they first meet me?",
  a: "someone who listens before they speak. and chooses words like they matter.",
} as const;

// s5A (manifesto) — retained-but-unreachable staggered emotional read. Lead +200
// ports the prototype's animML('#ml5', 'polEx'). Intermediate offsets (badge 0,
// example 5800 ≈ 1400ms after the last line at 4400) chosen to match the
// prototype's polEx fade-in; the CTA lands at 5600 per spec.
const S5A_BLOCKS: RevealBlock[] = [
  { kind: "badge", d: 0 },
  { kind: "line", text: "most things that claim to know you just flatter you.", d: 0 },
  { kind: "line", text: "polaris doesn't.", d: 1400 },
  {
    kind: "line",
    text:
      "it's built directly on your constellation. the actual patterns in your data, not who you wish you were. it answers questions. it reflects things back.",
    d: 2800,
    muted: true,
  },
  {
    kind: "line",
    text: "it tells you what's true. not what you hoped was.",
    d: 4400,
    muted: true,
  },
  { kind: "example", ...POLARIS_EXAMPLE, d: 5800 },
  { kind: "cta", text: "understood", d: 5600 },
];

// s5B (gentle) — the shipped variant. Lead +150 ports animGR('#s5B'). CTA 4200 /
// back 4400 are fixed by spec; the badge (0), heading (200), body (700/1500) and
// example (2600) offsets are chosen to match the gentle manifesto cadence.
const S5B_BLOCKS: RevealBlock[] = [
  { kind: "badge", d: 0 },
  {
    kind: "heading",
    text: "built on your constellation. not on who you say you are.",
    d: 200,
  },
  {
    kind: "body",
    text:
      "polaris is an AI that lives inside your constellation. ask it anything about how you show up. how others might perceive you. what patterns keep recurring.",
    d: 700,
  },
  {
    kind: "body",
    text: "it doesn't perform. it doesn't reassure. it reflects what's actually there.",
    d: 1500,
  },
  { kind: "example", ...POLARIS_EXAMPLE, d: 2600 },
  { kind: "cta", text: "continue", d: 4200 },
  { kind: "back", text: "back", d: 4400 },
];

const POLARIS_CONFIG: Record<PolarisVariant, { lead: number; blocks: RevealBlock[] }> = {
  s5A: { lead: 200, blocks: S5A_BLOCKS },
  s5B: { lead: 150, blocks: S5B_BLOCKS },
};

function PolarisIntroScreen({
  stellarColor,
  reducedMotion,
  onContinue,
  onBack,
}: {
  stellarColor: string;
  reducedMotion: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { lead, blocks } = POLARIS_CONFIG[POLARIS_VARIANT];
  const revealed = useStaggeredReveal(
    blocks.map((b) => b.d),
    { lead, reducedMotion }
  );

  return (
    <div style={{ textAlign: "center", maxWidth: 560, width: "100%" }}>
      {blocks.map((block, i) => {
        const shown = revealed[i];
        const reveal = revealStyle(shown);

        switch (block.kind) {
          case "badge":
            // Shared Polaris badge near the top. The blink is pure CSS; under
            // reduced motion the dot is frozen at full opacity (frozen prop).
            return (
              <div
                key={i}
                style={{ ...reveal, display: "flex", justifyContent: "center", marginBottom: "28px" }}
              >
                <PolarisBadge frozen={reducedMotion} />
              </div>
            );

          case "heading":
            return (
              <h1
                key={i}
                style={{
                  ...reveal,
                  fontSize: "26px",
                  fontWeight: 300,
                  color: "#FFFDFD",
                  letterSpacing: "0.01em",
                  lineHeight: 1.4,
                  marginBottom: "28px",
                }}
              >
                {block.text}
              </h1>
            );

          case "body":
          case "line":
            return (
              <p
                key={i}
                style={{
                  ...reveal,
                  fontSize: block.kind === "line" ? "20px" : "15px",
                  fontWeight: 300,
                  color: block.stellar
                    ? stellarColor
                    : block.muted
                      ? "#666"
                      : block.kind === "line"
                        ? "#FFFDFD"
                        : "#888",
                  lineHeight: 1.7,
                  marginBottom: "22px",
                }}
              >
                {block.text}
              </p>
            );

          case "example":
            // Authored STATIC Q&A card — NOT a live Claude call. No API/synthesis
            // request fires from this screen; the copy is hard-coded above.
            return (
              <div
                key={i}
                style={{
                  ...reveal,
                  maxWidth: 440,
                  margin: "0 auto 28px",
                  padding: "20px 22px",
                  textAlign: "left",
                  border: "0.5px solid rgba(255,253,253,0.12)",
                  borderRadius: "12px",
                  background: "rgba(255,253,253,0.02)",
                }}
              >
                <p
                  style={{
                    fontSize: "9px",
                    color: stellarColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    marginBottom: "12px",
                  }}
                >
                  {block.label}
                </p>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "#CFCFCF",
                    lineHeight: 1.5,
                    marginBottom: "10px",
                  }}
                >
                  {block.q}
                </p>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 300,
                    color: "#888",
                    lineHeight: 1.6,
                  }}
                >
                  {block.a}
                </p>
              </div>
            );

          case "cta":
            // Gated: inert (pointer-events none + disabled) until its own data-d
            // offset elapses. CTA → connect (s6).
            return (
              <button
                key={i}
                onClick={onContinue}
                disabled={!shown}
                aria-label={block.text}
                style={{
                  ...reveal,
                  pointerEvents: shown ? "all" : "none",
                  marginTop: "16px",
                  background: "transparent",
                  border: `0.5px solid ${stellarColor}`,
                  color: stellarColor,
                  borderRadius: "8px",
                  padding: "13px 36px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: shown ? "pointer" : "default",
                  fontFamily: "inherit",
                  transition:
                    "opacity 0.8s ease, transform 0.8s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!shown) return;
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = stellarColor;
                  e.currentTarget.style.borderColor = stellarColor;
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                {block.text}
              </button>
            );

          case "back":
            // Gentle-only "back" link → manifesto (s4). Gated on its own offset.
            return (
              <div key={i} style={{ marginTop: "24px" }}>
                <button
                  onClick={onBack}
                  disabled={!shown}
                  aria-label="go back to the previous step"
                  style={{
                    ...reveal,
                    pointerEvents: shown ? "all" : "none",
                    background: "none",
                    border: "none",
                    color: "#555",
                    fontSize: "12px",
                    cursor: shown ? "pointer" : "default",
                    fontFamily: "inherit",
                    transition: "opacity 0.8s ease, transform 0.8s ease, color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!shown) return;
                    e.currentTarget.style.color = "#999";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#555";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                >
                  {block.text}
                </button>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
