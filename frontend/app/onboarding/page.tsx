"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnairosCompleteData } from "onairos";
import { OnairosButtonWrapper } from "@/components/onairos-button-wrapper";
import { clearOnairosClientToken } from "@/lib/onairos";
import { PolarisBadge } from "@/components/phenyx/polaris-badge";
import { redactOnairosForProfile } from "@/lib/onairos-snapshot";
import { normalizeOnairosResult, buildOnairosTraitObject } from "@/lib/onairos-result";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";
import {
  FORMATION_ANIMATION_DURATION_MS,
  assignParticlesToNodes,
  formationTimeline,
} from "@/lib/constellation-reveal";

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
// Flow: welcome (separate /welcome route) → fork → manifesto (s4B) →
//       polaris_intro (s5B) → connect (s6 Onairos) → synthesizing → reveal →
//       done (→ Daily). s4A/s5A ship but are not on the live path.
//
// The fork branches: "show me how it works" → manifesto; "skip intro" jumps
// straight to s6 (Onairos), bypassing manifesto + polaris_intro. It does NOT
// skip connections.
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
  // Reveal-glow scores (PHE-19). Synthesis now runs server-side via the verified
  // /onairos/connect callback (PHE-40) rather than a client round-trip, so these
  // scores are not fetched inline; the reveal uses its neutral fallback glow and
  // the dashboard hydrates the constellation once synthesis lands.
  const [constellationState] = useState<ConstellationState | null>(null);

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
          router.replace("/dashboard");
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
    // 1) Normalize the SDK payload before judging it. The completion object is
    //    schema-loose and, with `autoFetch`, the traits/platform body lands under
    //    `result.apiResponse` — NOT on the result root — so the shape has to be
    //    probed rather than assumed (see lib/onairos-result.ts).
    const normalized = normalizeOnairosResult(result);
    const platforms = normalized.platforms;

    // A cancel / explicit failure must NOT advance. Neither must a genuinely
    // empty connection — synthesis cannot run on an empty trait object.
    // `hasTraits` is a second, independent proof of connection: a trained trait
    // payload cannot exist unless at least one platform was connected, so a
    // payload that carries traits but omits the platform NAMES still advances
    // (blocking there was the bug — the user connected, we just failed to read it).
    if (!normalized.ok || (platforms.length < 1 && !normalized.hasTraits)) {
      setConnectNotice("connect at least one platform to continue.");
      return;
    }
    setConnectNotice(null);

    // 2) Build the compact, allowlisted trait object, then redact (strip
    //    JWT/credential fields) before ANY durable persist. The allowlist means
    //    redaction is a belt-and-braces pass, not the only barrier.
    const redacted = redactOnairosForProfile(buildOnairosTraitObject(normalized));

    // 3) Route connect through the verified server callback (PHE-40). The server
    //    re-verifies the Onairos token, DISCARDS it, redacts the trait object,
    //    upserts onairos_connections on (user_id, platform), and enqueues
    //    synthesis exactly once — so the raw token never touches our DB and the
    //    connection state is server-authoritative (not a client-direct write).
    //    STRICT FIRE-AND-FORGET (PHE-18): the POST is LAUNCHED but NEVER awaited,
    //    so step 5 advances the user into the reveal regardless of synthesis
    //    latency or outcome. Guarded by `synthesisTriggeredRef` so a re-render /
    //    double success-callback / retry connects at most once per success.
    //    Requires at least one NAMED platform — `onairos_connections` is keyed on
    //    (user_id, platform), so there is no row to write without one. The
    //    traits-but-no-names case still advances (above) and still persists the
    //    profile snapshot below; it just cannot record the connection row.
    if (userId && platforms.length < 1) {
      console.warn(
        "[onboarding] onairos returned traits but no platform names — skipping /onairos/connect"
      );
    }
    if (userId && platforms.length >= 1 && !synthesisTriggeredRef.current) {
      synthesisTriggeredRef.current = true;
      apiFetch("/onairos/connect", {
        method: "POST",
        body: JSON.stringify({
          platforms,
          trait_object: redacted,
          // The Onairos JWT is sent ONCE to our own verified callback for
          // server-side verification, then discarded server-side. It is never
          // stored client-side (purged from localStorage in step 4 below).
          token: (result as { token?: string }).token,
          trigger: "onboarding",
        }),
      }).catch(() => {
        // Non-blocking: a failed connect leaves the user in the reveal with the
        // neutral fallback glow; the dashboard hydrates connection state later.
        // Does NOT alter or block the synthesizing→reveal→done transitions.
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

    // 4) Purge the raw Onairos JWT the SDK persisted in localStorage. The token is
    //    verified server-side per connect; nothing client-side reuses it (PHE-40).
    clearOnairosClientToken();

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
  const isWalkthrough =
    step === "fork" ||
    step === "manifesto" ||
    step === "polaris_intro" ||
    step === "connect";

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
        className={isWalkthrough ? "onb-v67" : undefined}
        style={
          isWalkthrough
            ? undefined
            : {
                position: "relative",
                zIndex: 1,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }
        }
      >
        {/* ================================================================ */}
        {/* s3b — NEW/FAMILIAR FORK (PHE-14, fully implemented)              */}
        {/* ================================================================ */}
        {step === "fork" && (
          <div className="onb-block onb-block--sm">
            <p
              className="onb-ey animate-fade-in"
              style={{
                fontSize: "10px",
                color: stellarColor,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
              }}
            >
              before we continue
            </p>

            <h1
              className="onb-h1 animate-fade-in"
              style={{
                animationDelay: "150ms",
                animationFillMode: "both",
                fontSize: "24px",
                fontWeight: 300,
                color: "#FFFDFD",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              new here, or already know phenyx?
            </h1>

            <p
              className="onb-sub animate-fade-in"
              style={{
                animationDelay: "300ms",
                animationFillMode: "both",
                fontSize: "14px",
                fontWeight: 300,
                color: "#888",
                lineHeight: 1.7,
              }}
            >
              {"if you've used phenyx before, skip straight to connecting your platforms. otherwise, it's worth a minute to see how this works."}
            </p>

            {/* Primary: show me how it works → manifesto (s4B) */}
            <button
              onClick={() => void setOnboardingStep("manifesto")}
              aria-label="show me how it works"
              className="onb-action animate-fade-in"
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
                transition: "all 0.2s ease",
                width: "100%",
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

            {/* Skip intro → s6 Onairos, not skip connections */}
            <div className="onb-skip">
              <button
                onClick={() => void setOnboardingStep("connect")}
                aria-label="skip intro"
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
                  transition: "color 0.2s ease",
                  width: "100%",
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
                skip intro
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
        {/* reveal — CONSTELLATION REVEAL scrC (PHE-19, fully implemented)   */}
        {/* ---------------------------------------------------------------- */}
        {/* The cinematic payoff: a full-viewport canvas particle animation   */}
        {/* that materializes the constellation in 5 phases                  */}
        {/* (APPEAR→FLOAT→CONDENSE→LINES→REVEAL) into 7 nodes + 7 canonical    */}
        {/* edges, lands the reveal line, and AUTO-ADVANCES to Daily.         */}
        {/* It reads `constellationState` for active-node glow intensity      */}
        {/* (null → neutral fallback). `prefers-reduced-motion` snaps the     */}
        {/* finished constellation + line in ≤2s. On auto-advance it sets     */}
        {/* onboarding_step = done BEFORE routing to /dashboard (Daily);      */}
        {/* order so the dashboard never bounces back into onboarding); the   */}
        {/* transition is independent of synthesis outcome. RevealScreen owns  */}
        {/* its own full-screen canvas + rAF loop + label interval and cleans  */}
        {/* them up on unmount.                                              */}
        {/* ================================================================ */}
        {step === "reveal" && (
          <RevealScreen
            stellarColor={stellarColor}
            reducedMotion={prefersReducedMotion}
            constellationState={constellationState}
            onConfirmMount={() => void setOnboardingStep("reveal")}
            onDone={() => {
              void setOnboardingStep("done");
              router.replace("/dashboard");
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

// ============================================================================
// Constellation Reveal scrC (PHE-19)
// ----------------------------------------------------------------------------
// Self-contained, full-viewport canvas reveal. Owns its OWN canvas + rAF loop +
// SLABELS interval + reveal-sequence timers (the ambient background particle
// canvas in the parent is separate and untouched). All loops/intervals/timers
// are cancelled on unmount (React strict-mode double-mount safe). Fresh canvas
// implementation rather than reusing constellation.tsx — that component is an
// SVG / React-state build, a fundamentally different paradigm from this
// imperative particle-system rAF loop (200 particles condensing into 7 nodes).
//
// Canonical Pillar Model (spec 03-onboarding-reveal.md "Pillar Model"):
//   idx 0-3 ACTIVE  (ORIGIN, EMERGENCE, SELF-CREATION, CONVERGENCE) — glow in
//                    stellarColor, intensity ∝ synthesis score.
//   idx 4-6 LOCKED  (BECOMING, RECOGNITION, TRANSCENDENCE) — render dim always.
// Node POSITIONS are fixed (never depend on score) — only glow intensity does.
// ============================================================================

// The exact reveal line (v67 formation end card). Auto-advances to Daily.
const REVEAL_LINE = "none of it is new. it is only in one piece now.";

// Every phase derives from this one total-duration decision. The selected
// 17.085s value is 15% faster than the original 20.1s choreography.
const FORMATION = formationTimeline(FORMATION_ANIMATION_DURATION_MS);

// Canonical 7 pillars (index 0-6). nx/ny are fractions of the viewport.
// ORIGIN bottom anchor; EMERGENCE+SELF-CREATION form a diamond into the
// CONVERGENCE hub; a vertical chain rises through the 3 locked to TRANSCENDENCE.
const PILLARS: { nx: number; ny: number; active: boolean; baseR: number }[] = [
  { nx: 0.5, ny: 0.9, active: true, baseR: 4 }, // 0 ORIGIN
  { nx: 0.33, ny: 0.72, active: true, baseR: 4 }, // 1 EMERGENCE
  { nx: 0.67, ny: 0.72, active: true, baseR: 4 }, // 2 SELF-CREATION
  { nx: 0.5, ny: 0.56, active: true, baseR: 5.5 }, // 3 CONVERGENCE (hub — larger)
  { nx: 0.5, ny: 0.41, active: false, baseR: 4 }, // 4 BECOMING (locked)
  { nx: 0.5, ny: 0.26, active: false, baseR: 4 }, // 5 RECOGNITION (locked)
  { nx: 0.5, ny: 0.11, active: false, baseR: 4 }, // 6 TRANSCENDENCE (locked)
];

// Canonical 7-edge list (draw order). Each edge draws only once BOTH its
// endpoint nodes are locked.
const CLINES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
];

// SLABELS — cycling FLOAT labels (one per pillar) + the closing label.
const SLABELS = [
  "where it all begins",
  "what pulled you forward",
  "what you made yourself into",
  "where everything meets",
  "who you are becoming",
  "how the world sees you",
  "what you are reaching for",
  "it's all here",
];

// Maps active-pillar index → its `constellation_state` score field.
const SCORE_FIELDS = [
  "origin_score",
  "emergence_score",
  "self_creation_score",
  "convergence_score",
] as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface RevealParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  birthDelay: number;
  condenseDelay: number;
  target: number;
  cf: { x: number; y: number } | null; // captured drift pos at condense start
}

function RevealScreen({
  stellarColor,
  reducedMotion,
  constellationState,
  onConfirmMount,
  onDone,
}: {
  stellarColor: string;
  reducedMotion: boolean;
  constellationState: ConstellationState | null;
  onConfirmMount: () => void;
  onDone: () => void;
}) {
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const labelIntervalRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);

  // Text overlays + screen fade (rcLoad / rc / scrC).
  const [loadText, setLoadText] = useState(SLABELS[0]);
  const [loadVisible, setLoadVisible] = useState(false);
  const [loadFade, setLoadFade] = useState(false); // final rcLoad fade-out
  const [revealText, setRevealText] = useState("");
  const [revealVisible, setRevealVisible] = useState(false);
  const [intro, setIntro] = useState(false); // canvas+screen fade-in
  const [screenFade, setScreenFade] = useState(false); // scrC fade-out

  useEffect(() => {
    // Confirm the persisted step is `reveal` on mount (idempotent). The
    // synthesizing→reveal handoff / resume may already have set it.
    onConfirmMount();
    setIntro(true);

    const canvas = cvsRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeCanvas = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    const [sr, sg, sb] = hexToRgb(stellarColor);
    const LOCKED: [number, number, number] = [96, 106, 122]; // dim grey-blue

    // Per-pillar glow alpha from synthesis score. Active: 0.30..0.92 by score;
    // null/absent score → neutral fallback (0.6 norm). Locked: fixed dim.
    const glow = PILLARS.map((p, i) => {
      if (!p.active) return { rgb: LOCKED, alpha: 0.16, norm: 0 };
      const raw = constellationState
        ? (constellationState[SCORE_FIELDS[i]] as number | null | undefined)
        : null;
      const norm = typeof raw === "number" ? clamp01(raw / 100) : 0.6;
      return { rgb: [sr, sg, sb] as [number, number, number], alpha: 0.3 + norm * 0.62, norm };
    });

    const nodePos = () => PILLARS.map((p) => ({ x: p.nx * W, y: p.ny * H }));

    const drawNode = (
      x: number,
      y: number,
      baseR: number,
      rgb: [number, number, number],
      alpha: number,
      active: boolean,
      t: number,
      i: number,
    ) => {
      const [r, g, b] = rgb;
      // Subtle breathing pulse on active nodes only.
      const a = active ? alpha * (0.86 + 0.14 * Math.sin(t / 600 + i)) : alpha;
      // Outer radial glow.
      let grad = ctx.createRadialGradient(x, y, 0, x, y, baseR * 7);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a * 0.42})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, baseR * 7, 0, Math.PI * 2);
      ctx.fill();
      // Inner radial glow.
      grad = ctx.createRadialGradient(x, y, 0, x, y, baseR * 2.6);
      grad.addColorStop(0, `rgba(${r},${g},${b},${Math.min(1, a * 0.9)})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, baseR * 2.6, 0, Math.PI * 2);
      ctx.fill();
      // Core.
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a + 0.2)})`;
      ctx.beginPath();
      ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fill();
      // Bright center dot.
      ctx.fillStyle = `rgba(255,253,253,${Math.min(1, 0.5 + a * 0.5)})`;
      ctx.beginPath();
      ctx.arc(x, y, baseR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawEdge = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      progress: number,
    ) => {
      const x2 = ax + (bx - ax) * progress;
      const y2 = ay + (by - ay) * progress;
      ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.34)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const nodeLocked = (i: number, t: number) =>
      t - FORMATION.condenseAtMs >=
        i * FORMATION.nodeStaggerMs + FORMATION.pullDurationMs;

    // ----------------------------------------------------------------------
    // Reduced-motion: bypass the rAF loop entirely. Snap all 7 locked nodes +
    // 7 full edges into place, fade the reveal line in, ≤2s total, auto-advance.
    // ----------------------------------------------------------------------
    if (reducedMotion) {
      const np = nodePos();
      ctx.clearRect(0, 0, W, H);
      CLINES.forEach(([i, j]) => drawEdge(np[i].x, np[i].y, np[j].x, np[j].y, 1));
      PILLARS.forEach((p, i) =>
        drawNode(np[i].x, np[i].y, p.baseR, glow[i].rgb, glow[i].alpha, p.active, 0, i),
      );
      setLoadVisible(false);
      setRevealText(REVEAL_LINE);
      setRevealVisible(true);
      timersRef.current.push(window.setTimeout(() => setScreenFade(true), 1200));
      timersRef.current.push(
        window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }, 1800),
      );
      return () => {
        window.removeEventListener("resize", sizeCanvas);
        timersRef.current.forEach((id) => clearTimeout(id));
        timersRef.current = [];
      };
    }

    // ----------------------------------------------------------------------
    // Full animated path — build 200 particles, run the 5-phase rAF loop.
    // ----------------------------------------------------------------------
    const N = 200;
    const M = 60; // inset margin
    const seeds = Array.from({ length: N }, () => ({
      x: M + Math.random() * Math.max(1, W - 2 * M),
      y: M + Math.random() * Math.max(1, H - 2 * M),
    }));
    const assignments = assignParticlesToNodes(seeds, nodePos());
    const particles: RevealParticle[] = seeds.map((seed, i) => {
      const target = assignments[i].node;
      return {
        ...seed,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 0.4 + Math.random() * 1.6,
        birthDelay: Math.random() * FORMATION.appearDurationMs,
        condenseDelay:
          target * FORMATION.nodeStaggerMs +
          (target === 3 ? FORMATION.hubDelayMs : 0) +
          Math.random() * FORMATION.condenseJitterMs,
        target,
        cf: null,
      };
    });

    // SLABELS cycling follows the scaled formation clock with a short
    // cross-fade; it clamps on the closing label and clears at REVEAL.
    setLoadVisible(true);
    let labelIdx = 0;
    const advanceLabel = () => {
      setLoadVisible(false);
      timersRef.current.push(
        window.setTimeout(() => {
          labelIdx = Math.min(labelIdx + 1, SLABELS.length - 1);
          setLoadText(SLABELS[labelIdx]);
          setLoadVisible(true);
        }, FORMATION.labelFadeDurationMs),
      );
    };
    labelIntervalRef.current = window.setInterval(advanceLabel, FORMATION.appearDurationMs);

    // Reveal sequence timers (absolute offsets from animation start).
    timersRef.current.push(
      window.setTimeout(() => {
        if (labelIntervalRef.current !== null) {
          clearInterval(labelIntervalRef.current);
          labelIntervalRef.current = null;
        }
        setLoadFade(true);
      }, FORMATION.revealAtMs),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setRevealText(REVEAL_LINE);
        setRevealVisible(true);
      }, FORMATION.revealAtMs + FORMATION.loadFadeDurationMs),
    );
    timersRef.current.push(
      window.setTimeout(
        () => setScreenFade(true),
        FORMATION.completeAtMs - FORMATION.screenFadeDurationMs,
      ),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, FORMATION.completeAtMs),
    );

    const start = performance.now();
    const loop = (now: number) => {
      const t = now - start;
      const np = nodePos();
      ctx.clearRect(0, 0, W, H);

      // Particles (APPEAR fade-in → FLOAT drift → CONDENSE pull into nodes).
      for (const p of particles) {
        const cStart = FORMATION.condenseAtMs + p.condenseDelay;
        let cx: number;
        let cy: number;
        if (t < cStart) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < M || p.x > W - M) p.vx *= -1;
          if (p.y < M || p.y > H - M) p.vy *= -1;
          p.x = Math.max(M, Math.min(W - M, p.x));
          p.y = Math.max(M, Math.min(H - M, p.y));
          cx = p.x;
          cy = p.y;
        } else {
          if (!p.cf) p.cf = { x: p.x, y: p.y };
          const prog = clamp01((t - cStart) / FORMATION.pullDurationMs);
          const e = easeInOut(prog);
          const node = np[p.target];
          cx = p.cf.x + (node.x - p.cf.x) * e;
          cy = p.cf.y + (node.y - p.cf.y) * e;
        }
        const birth = clamp01((t - p.birthDelay) / FORMATION.appearDurationMs);
        let alpha = (0.45 + p.radius * 0.18) * birth;
        if (t >= cStart) {
          // Dim as it merges so the node glow takes over.
          alpha *= 1 - clamp01((t - cStart) / FORMATION.pullDurationMs) * 0.6;
        }
        if (alpha > 0.002) {
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.fillStyle = stellarColor;
          ctx.beginPath();
          ctx.arc(cx, cy, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Edges (LINES) — staggered, each gated on BOTH endpoints locked.
      CLINES.forEach(([i, j], li) => {
        if (!nodeLocked(i, t) || !nodeLocked(j, t)) return;
        const prog = clamp01(
          (t - (FORMATION.linesAtMs + li * FORMATION.nodeStaggerMs)) /
            FORMATION.linesDurationMs,
        );
        if (prog <= 0) return;
        drawEdge(np[i].x, np[i].y, np[j].x, np[j].y, easeOut(prog));
      });

      // Nodes (CONDENSE) — draw only locked nodes.
      PILLARS.forEach((p, i) => {
        if (!nodeLocked(i, t)) return;
        drawNode(np[i].x, np[i].y, p.baseR, glow[i].rgb, glow[i].alpha, p.active, t, i);
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", sizeCanvas);
      cancelAnimationFrame(rafRef.current);
      if (labelIntervalRef.current !== null) {
        clearInterval(labelIntervalRef.current);
        labelIntervalRef.current = null;
      }
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
    // Animation params are captured once at mount; props are stable for the
    // lifetime of the reveal step (constellationState may resolve once, but a
    // mid-flight re-glow is intentionally not required — see ticket).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        background: "#0A0A0A",
        opacity: !intro ? 0 : screenFade ? 0 : 1,
        transition: `opacity ${screenFade ? FORMATION.screenFadeDurationMs : FORMATION.loadFadeDurationMs}ms ease`,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={cvsRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* rcLoad — cycling phase labels under the canvas. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "12%",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: 300,
          letterSpacing: "0.18em",
          textTransform: "lowercase",
          color: "#888",
          opacity: loadFade || !loadVisible ? 0 : 0.85,
          transition: `opacity ${loadFade ? FORMATION.loadFadeDurationMs : FORMATION.labelFadeDurationMs}ms ease`,
        }}
      >
        {loadText}
      </div>

      {/* rc — the final reveal line. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          textAlign: "center",
          padding: "0 24px",
          fontSize: "22px",
          fontWeight: 300,
          letterSpacing: "0.01em",
          color: "#FFFDFD",
          opacity: revealVisible ? 1 : 0,
          transition: `opacity ${reducedMotion ? 600 : FORMATION.revealInDurationMs}ms ease`,
        }}
      >
        {revealText}
      </div>
    </div>
  );
}

// ============================================================================
// s6 Onairos Platform Connect (PHE-17, copy patched in PHE-77)
// ----------------------------------------------------------------------------
// Verbatim v67 framing: "your signals are the source of truth.", three promises,
// privacy-policy link, and a single "continue with onairos" CTA (the real
// Onairos SDK via OnairosButtonWrapper). No local platform picker or permission
// checkboxes. The success path lives in handleOnairosComplete.
//
// Self-contained: the s3b skip-intro path lands here directly, so it assumes no
// prior manifesto / polaris_intro state.
//
// NOTE (.hidden CSS-collision guard, acceptance criterion): the Onairos SDK
// leaks a global `.hidden` class into the page. PHENYX must NOT rely on a bare
// `hidden` utility class anywhere or it gets clobbered — use Tailwind responsive
// (`max-lg:hidden`) / scoped variants instead. Enforced via eslint.config.mjs
// (no-restricted-syntax) + components/phenyx/CONVENTIONS.md.
// ============================================================================
const ONAIROS_PROMISES = [
  "read once, then discarded. nothing kept.",
  "what phenyx finds belongs to you.",
  "disconnect any platform, any time.",
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
    <div className="onb-block">
      <p
        className="onb-ey animate-fade-in"
        style={{
          fontSize: "10px",
          color: stellarColor,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
        }}
      >
        powered by onairos
      </p>

      <h1
        className="onb-h1 animate-fade-in"
        style={{
          animationDelay: "150ms",
          animationFillMode: "both",
          fontSize: "26px",
          fontWeight: 300,
          color: "#FFFDFD",
          letterSpacing: "0.01em",
          lineHeight: 1.4,
        }}
      >
        your signals are the <b style={{ fontWeight: 600 }}>source of truth.</b>
      </h1>

      <p
        className="onb-sub animate-fade-in"
        style={{
          animationDelay: "300ms",
          animationFillMode: "both",
          fontSize: "15px",
          fontWeight: 300,
          color: "#888",
          lineHeight: 1.7,
        }}
      >
        onairos reads the layer beneath your platforms. not what you posted, what sits underneath it.
      </p>

      <ul
        className="onb-stack animate-fade-in"
        style={{
          animationDelay: "450ms",
          animationFillMode: "both",
          listStyle: "none",
          padding: 0,
          marginLeft: "auto",
          marginRight: "auto",
          maxWidth: 440,
          textAlign: "left",
        }}
      >
        {ONAIROS_PROMISES.map((promise, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginBottom: i === ONAIROS_PROMISES.length - 1 ? 0 : "16px",
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
              {promise}
            </span>
          </li>
        ))}
      </ul>

      <p
        className="animate-fade-in"
        style={{
          animationDelay: "500ms",
          animationFillMode: "both",
          fontSize: "12px",
          fontWeight: 300,
          color: "#555",
          lineHeight: 1.6,
          marginTop: "14px",
        }}
      >
        all of it is written out in the{" "}
        <Link
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: stellarColor, textDecoration: "underline", textUnderlineOffset: "3px" }}
        >
          privacy policy
        </Link>
        .
      </p>

      {notice && (
        <p
          role="alert"
          aria-live="assertive"
          style={{
            fontSize: "13px",
            fontWeight: 400,
            color: "#E84422",
            lineHeight: 1.5,
            marginTop: "16px",
          }}
        >
          {notice}
        </p>
      )}

      <div className="onb-action animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "both" }}>
        <OnairosButtonWrapper
          webpageName="PHENYX"
          requestedData={["personality"]}
          buttonType="pill"
          buttonText="continue with onairos"
          textColor="white"
          onComplete={onComplete}
        />
      </div>

      <div className="onb-back animate-fade-in" style={{ animationDelay: "750ms", animationFillMode: "both" }}>
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
            width: "100%",
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
  emphasis?: string; // bold suffix on headings (v67 <b>)
  d: number; // data-d ms offset
  stellar?: boolean;
  muted?: boolean; // dimmer line (s5A muted reflections)
  // "example" block fields — authored STATIC Q&A, no Claude call / token spend.
  label?: string;
  q?: string;
  a?: string;
  src?: string;
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
  { kind: "heading", text: "a mirror, ", emphasis: "not a map.", d: 200 },
  {
    kind: "body",
    text: "most tools show you who you could become. phenyx shows you what you have actually done.",
    d: 640,
  },
  {
    kind: "body",
    text: "it reads the accounts you already use and finds what repeats. what you come back to, what you drop, what you do every year without planning it.",
    d: 1060,
  },
  { kind: "cta", text: "continue", d: 1480 },
  { kind: "back", text: "back", d: 1620 },
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
    <div className="onb-block">
      {blocks.map((block, i) => {
        const shown = revealed[i];
        const reveal = revealStyle(shown);

        switch (block.kind) {
          case "eyebrow":
            return (
              <p
                key={i}
                className="onb-ey"
                style={{
                  ...reveal,
                  fontSize: "10px",
                  color: stellarColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                }}
              >
                {block.text}
              </p>
            );

          case "heading":
            return (
              <h1
                key={i}
                className="onb-h1"
                style={{
                  ...reveal,
                  fontSize: "28px",
                  fontWeight: 300,
                  color: "#FFFDFD",
                  letterSpacing: "0.01em",
                  lineHeight: 1.4,
                }}
              >
                {block.text}
                {block.emphasis ? <b style={{ fontWeight: 600 }}>{block.emphasis}</b> : null}
              </h1>
            );

          case "body":
          case "line":
            return (
              <p
                key={i}
                className={block.kind === "body" ? "onb-sub" : undefined}
                style={{
                  ...reveal,
                  fontSize: block.kind === "line" ? "20px" : "15px",
                  fontWeight: 300,
                  color: block.stellar ? stellarColor : "#888",
                  lineHeight: 1.7,
                  marginBottom: block.kind === "line" ? "22px" : undefined,
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
                className="onb-action"
                onClick={onContinue}
                disabled={!shown}
                aria-label={block.text}
                style={{
                  ...reveal,
                  pointerEvents: shown ? "all" : "none",
                  background: "transparent",
                  border: `0.5px solid ${stellarColor}`,
                  color: stellarColor,
                  borderRadius: "8px",
                  padding: "13px 36px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: shown ? "pointer" : "default",
                  fontFamily: "inherit",
                  width: "100%",
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
              <div key={i} className="onb-back">
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
                    width: "100%",
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
  q: '"why do i keep starting over?"',
  a: "you haven't. you've started nine things since 2021, and they're all the same three ideas.",
  src: "chatgpt, pinterest · 2021-2026",
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
      "it's built directly on your constellation. the actual patterns in your signals, not who you wish you were. it answers questions. it reflects things back.",
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

// s5B (gentle) — the shipped variant. Lead +150 ports animGR('#s5B'). CTA 1680 /
// back 1820 match the v67 walkthrough; the example is the worked polaris Q&A.
const S5B_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "polaris", d: 0 },
  {
    kind: "heading",
    text: "built on your constellation. ",
    emphasis: "not on who you say you are.",
    d: 200,
  },
  {
    kind: "body",
    text: "polaris lives inside your constellation. ask it anything.",
    d: 420,
  },
  { kind: "example", ...POLARIS_EXAMPLE, d: 1260 },
  { kind: "cta", text: "continue", d: 1680 },
  { kind: "back", text: "back", d: 1820 },
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
    <div className="onb-block">
      {blocks.map((block, i) => {
        const shown = revealed[i];
        const reveal = revealStyle(shown);

        switch (block.kind) {
          case "eyebrow":
            return (
              <p
                key={i}
                className="onb-ey"
                style={{
                  ...reveal,
                  fontSize: "10px",
                  color: stellarColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                }}
              >
                {block.text}
              </p>
            );

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
                className="onb-h1"
                style={{
                  ...reveal,
                  fontSize: "26px",
                  fontWeight: 300,
                  color: "#FFFDFD",
                  letterSpacing: "0.01em",
                  lineHeight: 1.4,
                }}
              >
                {block.text}
                {block.emphasis ? <b style={{ fontWeight: 600 }}>{block.emphasis}</b> : null}
              </h1>
            );

          case "body":
          case "line":
            return (
              <p
                key={i}
                className={block.kind === "body" ? "onb-sub" : undefined}
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
                  marginBottom: block.kind === "line" ? "22px" : undefined,
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
                className="onb-stack"
                style={{
                  ...reveal,
                  maxWidth: 440,
                  marginLeft: "auto",
                  marginRight: "auto",
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
                    marginBottom: block.src ? "10px" : 0,
                  }}
                >
                  {block.a}
                </p>
                {block.src ? (
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 300,
                      color: "#555",
                      letterSpacing: "0.02em",
                      margin: 0,
                    }}
                  >
                    {block.src}
                  </p>
                ) : null}
              </div>
            );

          case "cta":
            // Gated: inert (pointer-events none + disabled) until its own data-d
            // offset elapses. CTA → connect (s6).
            return (
              <button
                key={i}
                className="onb-action"
                onClick={onContinue}
                disabled={!shown}
                aria-label={block.text}
                style={{
                  ...reveal,
                  pointerEvents: shown ? "all" : "none",
                  background: "transparent",
                  border: `0.5px solid ${stellarColor}`,
                  color: stellarColor,
                  borderRadius: "8px",
                  padding: "13px 36px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: shown ? "pointer" : "default",
                  fontFamily: "inherit",
                  width: "100%",
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
              <div key={i} className="onb-back">
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
                    width: "100%",
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
