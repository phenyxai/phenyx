"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnairosCompleteData } from "onairos";
import { OnairosButtonWrapper } from "@/components/onairos-button-wrapper";
import { clearOnairosClientToken } from "@/lib/onairos";
import { redactOnairosForProfile } from "@/lib/onairos-snapshot";
import {
  normalizeOnairosResult,
  buildOnairosTraitObject,
  claimOnairosCompletion,
} from "@/lib/onairos-result";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";
import { ACCENT } from "@/lib/stellar";
import {
  LINE_DURATION_MS,
  PULL_AT_MS,
  REVEAL_AT_MS,
  assignParticlesToNodes,
  frameSeconds,
  lineStartMs,
  pointReady,
} from "@/lib/constellation-reveal";
import { ALL_PILLARS, EDGES, STAR_RADIUS, fitShape } from "@/lib/constellation-shape";

// ============================================================================
// Onboarding step machine (PHE-14 foundation)
// ----------------------------------------------------------------------------
// `onboarding_step` is the single source of truth for the user's position in
// the post-auth narrative funnel. It is persisted to user_profiles so the flow
// is resumable across refresh and across devices (see setOnboardingStep + the
// resume logic in the init effect). The 10 values mirror the prototype go()
// router and the DB enum added in
//   supabase/migrations/20260626000000_user_profiles_onboarding_step.sql
//   supabase/migrations/20260907000000_onboarding_step_constellation_intro.sql
//   supabase/migrations/20261016120000_phe125_onboarding_step_discover_intro.sql
//
// Flow (new accounts arrive here straight from sign-in; PHE-162 removed the
// /welcome screen): fork → manifesto ("your life so far") → constellation_intro
//       → polaris_intro → discover_intro (PHE-125) → connect (s6 Onairos)
//       → synthesizing → reveal → done (→ Constellation).
//
// The fork branches: "see how it works" → manifesto; "connect my platforms"
// jumps straight to s6 (Onairos), bypassing the four explainers. It does NOT
// skip connections.
// ============================================================================
type OnboardingStep =
  | "welcome"
  | "fork"
  | "manifesto"
  | "constellation_intro"
  | "polaris_intro"
  | "discover_intro"
  | "connect"
  | "synthesizing"
  | "reveal"
  | "done";

// Forward "continue" target for the linear (non-fork) part of the funnel.
// The fork's two branches are handled explicitly in its button handlers.
const NEXT_STEP: Record<OnboardingStep, OnboardingStep> = {
  welcome: "fork",
  fork: "manifesto",
  manifesto: "constellation_intro",
  constellation_intro: "polaris_intro",
  polaris_intro: "discover_intro",
  discover_intro: "connect",
  connect: "synthesizing",
  synthesizing: "reveal",
  reveal: "done",
  done: "done",
};

// Back-arrow target for each screen. On the NORMAL path s6 (connect) follows the
// discover intro, so `back` returns there. The s3b skip-path reaches connect by
// bypassing the walkthrough; if such a user taps back they land on the
// discover_intro screen (which they skipped) and the chain back to the fork
// remains intact — a sensible, non-dead-ending choice (PHE-17 decision).
const PREV_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  manifesto: "fork",
  constellation_intro: "manifesto",
  polaris_intro: "constellation_intro",
  discover_intro: "polaris_intro",
  connect: "discover_intro",
};

// ============================================================================
// Entrance cadence (v244, PHE-90)
// ----------------------------------------------------------------------------
// Every screen used to carry hand-authored per-element delays and no two
// agreed. Delays are now derived from each element's position in its list (the
// block arrays already list elements in visual order, CTA and back last), so
// every screen fills top-down in one rhythm. An action belongs to the beat
// before it and arrives two steps later. No DOM measurement.
// ============================================================================
const OB_LEAD = 90;
const OB_STEP = 135;

function cadenceOffsets(blocks: ReadonlyArray<Pick<RevealBlock, "kind">>): number[] {
  let last = 0;
  return blocks.map((block, i) => {
    if (i === 0) {
      last = OB_LEAD;
      return last;
    }
    const isAction = block.kind === "cta" || block.kind === "back";
    last += isAction ? 2 * OB_STEP : OB_STEP;
    return last;
  });
}

// Shared curve for copy and buttons so nothing lands out of turn.
const REVEAL_TRANSITION =
  "opacity .75s cubic-bezier(.22,.61,.36,1), transform .65s cubic-bezier(.22,.61,.36,1)";

// The fork and connect screens animate with the CSS fade-in; they take the
// same offsets as the block-driven screens.
const FORK_DELAYS = cadenceOffsets([
  { kind: "eyebrow" },
  { kind: "heading" },
  { kind: "body" },
  { kind: "cta" },
  { kind: "back" },
]);
const CONNECT_DELAYS = cadenceOffsets([
  { kind: "eyebrow" },
  { kind: "heading" },
  { kind: "body" },
  { kind: "cta" },
  { kind: "back" },
]);

function fadeDelay(ms: number): CSSProperties {
  return { animationDelay: `${ms}ms`, animationFillMode: "both" };
}

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
// PHE-19). Mirrors the seven pillar scores from `constellation_state`
// (0-100 ints, PHE-100) plus their synthesis paragraphs; the engine round-trips
// extra fields, so an index signature keeps any additional payload intact.
//
// Lifecycle:
//   - null  → synthesis hasn't landed yet, OR it failed, OR no trigger ran.
//             The reveal (PHE-19) falls back to neutral/equal glow on all
//             seven nodes; the dashboard hydrates the real scores later.
//   - set   → synthesis resolved before/while the reveal plays; PHE-19 reads
//             these score fields to scale node glow intensity.
// Node POSITIONS never depend on this — only glow intensity does.
// ----------------------------------------------------------------------------
interface ConstellationState {
  origin_score?: number | null;
  emergence_score?: number | null;
  self_creation_score?: number | null;
  convergence_score?: number | null;
  becoming_score?: number | null;
  recognition_score?: number | null;
  transcendence_score?: number | null;
  [key: string]: unknown;
}

export default function OnboardingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("fork");
  const [userId, setUserId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // s6 connect notice — shown when the SDK returns 0 connected platforms so the
  // user stays on s6 and is prompted to connect at least one (PHE-17 gating).
  const [connectNotice, setConnectNotice] = useState<string | null>(null);

  // Synthesis result for the reveal's node-glow (PHE-18). Holds the resolved
  // `constellation_state` scores IF synthesis lands while the user is still in
  // the flow; stays null on failure/absence (reveal falls back to neutral glow).
  // PHE-19 reads this to drive node glow intensity.
  // Reveal-glow scores (PHE-19). Synthesis now runs server-side via the verified
  // /onairos/connect callback (PHE-40) rather than a client round-trip, so these
  // scores are not fetched inline; the reveal uses its neutral fallback glow and
  // the dashboard hydrates the constellation once synthesis lands.
  const [constellationState] = useState<ConstellationState | null>(null);

  // Claim the first successful SDK completion before any success side effect.
  // This guards both the synthesis handoff and the constellation formation step
  // against SDK double-callbacks while still allowing retries after cancel/error.
  const connectionCompletedRef = useRef(false);

  // --------------------------------------------------------------------------
  // Init: reduced-motion, user, and resume-on-load.
  // Reads persisted onboarding_step and renders the shell at the saved step.
  // - "done"        → route to /constellation (dashboard); never render shell.
  // - null/"welcome" → default to "fork" ("welcome" is the old first step).
  // - otherwise     → resume exactly where the user left off.
  // setMounted(true) is deferred until the step is resolved to avoid a flash of
  // the fork screen before resuming at a later step.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_step")
          .eq("id", user.id)
          .single();

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
        // PHE-98: ambient dust is white (--ph-white); the accent is kept for
        // the constellation itself.
        color: "var(--ph-white)",
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
  const handleOnairosComplete = useCallback((
    result: OnairosCompleteData,
    completionError?: Error
  ) => {
    // The SDK can store the JWT as part of completion. Capture it only in this
    // callback's stack, then purge browser storage on every outcome.
    const token = (result as { token?: string }).token;
    clearOnairosClientToken();

    // A callback emitted after the first accepted success is a no-op. Purging
    // above still runs in case the SDK wrote its completion state twice.
    if (connectionCompletedRef.current) return;

    if (completionError) {
      setConnectNotice("onairos could not finish connecting. try again.");
      return;
    }

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
    if (normalized.cancelled) {
      setConnectNotice("connection cancelled. try again when you’re ready.");
      return;
    }
    if (!normalized.ok) {
      setConnectNotice("onairos could not finish connecting. try again.");
      return;
    }
    if (platforms.length < 1 && !normalized.hasTraits) {
      setConnectNotice("connect at least one platform to continue.");
      return;
    }

    // Claim success before persistence, network, or navigation side effects.
    if (!claimOnairosCompletion(connectionCompletedRef)) return;
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
    //    so step 4 advances the user into the reveal regardless of synthesis
    //    latency or outcome. The callback-wide success claim above ensures a
    //    double success-callback cannot repeat this request or the transition.
    //    Requires at least one NAMED platform — `onairos_connections` is keyed on
    //    (user_id, platform), so there is no row to write without one. The
    //    traits-but-no-names case still advances (above) and still persists the
    //    profile snapshot below; it just cannot record the connection row.
    if (userId && platforms.length < 1) {
      console.warn(
        "[onboarding] onairos returned traits but no platform names — skipping /onairos/connect"
      );
    }
    if (userId && platforms.length >= 1) {
      apiFetch("/onairos/connect", {
        method: "POST",
        body: JSON.stringify({
          platforms,
          trait_object: redacted,
          // The Onairos JWT is sent ONCE to our own verified callback for
          // server-side verification, then discarded server-side. It is never
          // stored client-side (purged from localStorage in step 4 below).
          token,
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

    // 4) Persist onboarding_step = synthesizing and advance toward the reveal.
    //    This is NOT gated on the synthesis promise above — the user proceeds
    //    immediately into the reveal animation (PHE-19), which IS the loading
    //    experience, so there is never a blank loader/spinner.
    void setOnboardingStep("synthesizing");
  }, [userId, setOnboardingStep]);

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "var(--ph-black)" }} />;
  }

  const isWalkthrough =
    step === "fork" ||
    step === "manifesto" ||
    step === "constellation_intro" ||
    step === "polaris_intro" ||
    step === "discover_intro" ||
    step === "connect";

  return (
    <main style={{ minHeight: "100vh", background: "var(--ph-black)", position: "relative", overflow: "hidden" }}>
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
        {step === "manifesto" && "your life so far"}
        {step === "constellation_intro" && "your constellation, seven chapters"}
        {step === "polaris_intro" && "introducing polaris"}
        {step === "discover_intro" && "introducing discover"}
        {step === "connect" && "connect your platforms"}
        {step === "synthesizing" && "synthesizing your constellation"}
        {step === "reveal" && "constellation reveal"}
      </div>

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
                ...fadeDelay(FORK_DELAYS[0]),
                color: ACCENT,
              }}
            >
              before you begin
            </p>

            <h1 className="onb-h1 animate-fade-in" style={fadeDelay(FORK_DELAYS[1])}>
              already know PHENYX?
            </h1>

            <p className="onb-sub animate-fade-in" style={fadeDelay(FORK_DELAYS[2])}>
              you can go straight to connecting your platforms to form your constellation, or take a quick look around first.
            </p>

            {/* Primary: see how it works → manifesto (s4B) */}
            <button
              onClick={() => void setOnboardingStep("manifesto")}
              aria-label="see how it works"
              className="onb-action animate-fade-in"
              style={{
                ...fadeDelay(FORK_DELAYS[3]),
                background: "transparent",
                border: `0.5px solid ${ACCENT}`,
                color: ACCENT,
                borderRadius: "8px",
                padding: "13px 36px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
                width: "100%",
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${ACCENT}`;
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
            >
              see how it works
            </button>

            {/* connect my platforms → s6 Onairos directly. Skips the walkthrough,
                not connections. */}
            <div className="onb-skip">
              <button
                onClick={() => void setOnboardingStep("connect")}
                aria-label="connect my platforms"
                className="animate-fade-in"
                style={{
                  ...fadeDelay(FORK_DELAYS[4]),
                  background: "none",
                  border: "none",
                  color: "rgba(242,242,243,0.33)",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "color 0.2s ease",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${ACCENT}`;
                  e.currentTarget.style.outlineOffset = "2px";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                connect my platforms
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PLACEHOLDER screens — replaced wholesale by later tickets.       */}
        {/* Each advances onboarding_step to the correct next step.          */}
        {/* ================================================================ */}

        {/* ================================================================ */}
        {/* YOUR LIFE SO FAR / manifesto (PHE-15, copy from PHE-125)         */}
        {/* ================================================================ */}
        {step === "manifesto" && (
          <WalkthroughScreen
            blocks={MANIFESTO_BLOCKS}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("constellation_intro")}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* s4C — CONSTELLATION EXPLAINER (PHE-90, v244)                     */}
        {/* The seven chapters, named and described, between the intro and   */}
        {/* the polaris intro. The fork's skip path bypasses it.             */}
        {/* ================================================================ */}
        {step === "constellation_intro" && (
          <WalkthroughScreen
            blocks={CONSTELLATION_BLOCKS}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("polaris_intro")}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* POLARIS and DISCOVER explainers (PHE-16, PHE-125). Each sample    */}
        {/* card is authored STATIC copy — no Claude call / token spend, no   */}
        {/* constellation_state dependency.                                  */}
        {/* ================================================================ */}
        {step === "polaris_intro" && (
          <WalkthroughScreen
            blocks={POLARIS_BLOCKS}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("discover_intro")}
            onBack={goBack}
          />
        )}
        {step === "discover_intro" && (
          <WalkthroughScreen
            blocks={DISCOVER_BLOCKS}
            reducedMotion={prefersReducedMotion}
            onContinue={() => void setOnboardingStep("connect")}
            onBack={goBack}
          />
        )}

        {/* ================================================================ */}
        {/* s6 — ONAIROS PLATFORM CONNECT (PHE-17, fully implemented)        */}
        {/* Self-contained: the s3b skip-path lands here directly without the */}
        {/* explainers having run, so this screen assumes no                 */}
        {/* prior narrative state. The CTA mounts the real Onairos SDK; the   */}
        {/* success callback (handleOnairosComplete) validates >=1 platform,  */}
        {/* persists a redacted (token-free) snapshot, fires synthesis, and   */}
        {/* advances to synthesizing.                                        */}
        {/* ================================================================ */}
        {step === "connect" && (
          <ConnectScreen
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
        {/* edges, lands the reveal line, and AUTO-ADVANCES to /dashboard,    */}
        {/* which redirects to Constellation, the home screen (PHE-100).      */}
        {/* It reads `constellationState` for node glow intensity             */}
        {/* (null → neutral fallback). `prefers-reduced-motion` snaps the     */}
        {/* finished constellation + line in ≤2s. On auto-advance it sets     */}
        {/* onboarding_step = done BEFORE routing to /dashboard;             */}
        {/* order so the dashboard never bounces back into onboarding); the   */}
        {/* transition is independent of synthesis outcome. RevealScreen owns  */}
        {/* its own full-screen canvas + rAF loop + label interval and cleans  */}
        {/* them up on unmount.                                              */}
        {/* ================================================================ */}
        {step === "reveal" && (
          <RevealScreen
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
// Constellation formation scrC (PHE-19, physics and timing from PHE-125)
// ----------------------------------------------------------------------------
// Self-contained, full-viewport canvas formation. Owns its OWN canvas + rAF
// loop + end timers (the ambient background particle canvas in the parent is
// separate and untouched), all cancelled on unmount (strict-mode safe).
//
// Specks drift, then pull toward their point: origin first, emergence and
// self-creation together, then convergence, becoming, recognition and
// transcendence. A point appears only once about 60% of its specks have
// gathered within about 26px of it (1.2s fallback), each line starts 0.26s
// after the later of its two points, and the physics runs on capped real
// frame time, so slower devices look the same (rules in lib/constellation-reveal).
// The labels read "pieces of your life…" then "beginning to find each other.",
// and once the last line has drawn, "your life, taking form." lands and the
// screen hands off to the constellation, about ten seconds in all.
//
// Pillar model (PHE-100, spec doc 2): all seven nodes glow in the accent,
// intensity ∝ synthesis score. Node POSITIONS, sizes and the seven lines come
// from `lib/constellation-shape` (the Big Dipper, drawn by hand),
// shared with the constellation tab, so the shape that forms here is the shape
// the person lands on. Positions never depend on score; only glow intensity
// does.
// ============================================================================

const LABEL_GATHERING = "pieces of your life…";
const LABEL_FINDING = "beginning to find each other.";
const LABEL_SWITCH_MS = 4600;
const REVEAL_LINE = "your life, taking form.";
const LABEL_FADE_MS = 350;
const LOAD_FADE_MS = 550;
const REVEAL_IN_MS = 750;
const REVEAL_HOLD_MS = 1550;
const SCREEN_FADE_MS = 1000;

// The seven pillars in ALL_PILLARS order (index 0-6), each sized from its
// star's real brightness.
const PILLARS = ALL_PILLARS.map((pillar) => ({ baseR: STAR_RADIUS[pillar] * 0.9 }));

// The seven lines as index pairs. Each line draws only once BOTH its endpoint
// nodes have appeared.
const CLINES: [number, number][] = EDGES.map(([a, b]) => [
  ALL_PILLARS.indexOf(a),
  ALL_PILLARS.indexOf(b),
]);

// Maps pillar index → its `constellation_state` score field.
const SCORE_FIELDS = ALL_PILLARS.map((pillar) => `${pillar}_score` as const);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(v: number): number {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
}
function easeOut(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3);
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
  target: number;
  phase: number;
  orbit: number;
  orbitSpeed: number;
  seed: number;
}

function RevealScreen({
  reducedMotion,
  constellationState,
  onConfirmMount,
  onDone,
}: {
  reducedMotion: boolean;
  constellationState: ConstellationState | null;
  onConfirmMount: () => void;
  onDone: () => void;
}) {
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);

  // Text overlays + screen fade (rcLoad / rc / scrC).
  const [loadText, setLoadText] = useState(LABEL_GATHERING);
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

    const [sr, sg, sb] = hexToRgb(ACCENT);

    // Per-pillar glow alpha from synthesis score: 0.30..0.92 by score;
    // null/absent score → neutral fallback (0.6 norm).
    const glow = SCORE_FIELDS.map((field) => {
      const raw = constellationState
        ? (constellationState[field] as number | null | undefined)
        : null;
      const norm = typeof raw === "number" ? clamp01(raw / 100) : 0.6;
      return { rgb: [sr, sg, sb] as [number, number, number], alpha: 0.3 + norm * 0.62, norm };
    });

    // The shape fitted uniformly (never stretched) into the viewport, inside
    // the same margins the formation has always used.
    const nodePos = () => fitShape(W * 0.05, H * 0.11, W * 0.9, H * 0.79);

    const drawNode = (
      x: number,
      y: number,
      baseR: number,
      rgb: [number, number, number],
      alpha: number,
      t: number,
      i: number,
    ) => {
      const [r, g, b] = rgb;
      // Subtle breathing pulse.
      const a = alpha * (0.86 + 0.14 * Math.sin(t / 600 + i));
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
      ctx.fillStyle = `rgba(242,242,243,${Math.min(1, 0.5 + a * 0.5)})`;
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

    const finish = () => {
      setRevealText(REVEAL_LINE);
      setRevealVisible(true);
      timersRef.current.push(window.setTimeout(() => setScreenFade(true), REVEAL_HOLD_MS));
      timersRef.current.push(
        window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }, REVEAL_HOLD_MS + SCREEN_FADE_MS),
      );
    };

    const cleanup = () => {
      window.removeEventListener("resize", sizeCanvas);
      cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };

    // ----------------------------------------------------------------------
    // Reduced-motion: no rAF loop. Snap all 7 nodes + 7 full edges into place
    // and land the closing line, then hand off.
    // ----------------------------------------------------------------------
    if (reducedMotion) {
      const np = nodePos();
      ctx.clearRect(0, 0, W, H);
      CLINES.forEach(([i, j]) => drawEdge(np[i].x, np[i].y, np[j].x, np[j].y, 1));
      PILLARS.forEach((p, i) =>
        drawNode(np[i].x, np[i].y, p.baseR, glow[i].rgb, glow[i].alpha, 0, i),
      );
      finish();
      return cleanup;
    }

    // ----------------------------------------------------------------------
    // Full animated path. Specks start in a loose cloud around the shape and
    // each is seated on a nearby point.
    // ----------------------------------------------------------------------
    const N = 140;
    const start0 = nodePos();
    const cx = start0.reduce((sum, n) => sum + n.x, 0) / start0.length;
    const cy = start0.reduce((sum, n) => sum + n.y, 0) / start0.length;
    const rx = Math.min(W * 0.3, 420);
    const ry = Math.min(H * 0.31, 280);
    const seeds = Array.from({ length: N }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.66);
      return { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
    });
    const assignments = assignParticlesToNodes(seeds, start0);
    const particles: RevealParticle[] = seeds.map((seed, i) => ({
      ...seed,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      radius: 0.7 + Math.random() * 1.45,
      target: assignments[i].node,
      phase: Math.random() * Math.PI * 2,
      orbit: 7 + Math.random() * 19,
      orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.14 + Math.random() * 0.2),
      seed: Math.random() * 1000,
    }));

    const appeared: (number | null)[] = PILLARS.map(() => null);
    let lineEnd = 0;
    let fadeAt = Infinity;
    let label = LABEL_GATHERING;
    let labelOut = false;
    let last: number | null = null;

    setLoadVisible(true);

    const start = performance.now();
    const loop = (now: number) => {
      const t = now - start;
      const dt = frameSeconds(now, last);
      last = now;
      const np = nodePos();
      ctx.clearRect(0, 0, W, H);

      // Specks: a slow drift, then a damped pull onto an orbit around their
      // point that tightens as the point's time comes.
      const fade = 1 - smoothstep((t - fadeAt) / 700);
      for (const p of particles) {
        const node = np[p.target];
        const active = smoothstep((t - PULL_AT_MS[p.target]) / 720);
        if (active > 0) {
          const dwell = smoothstep((t - (REVEAL_AT_MS[p.target] - 650)) / 420);
          const orbitR = p.orbit * (1 - 0.8 * dwell);
          const ang = p.phase + now * 0.001 * p.orbitSpeed;
          const dx = node.x + Math.cos(ang) * orbitR - p.x;
          const dy = node.y + Math.sin(ang) * orbitR * 0.68 - p.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const pull = 1.4 + 2.6 * active;
          const swirl = (1 - active * 0.5) * 10 * Math.sin(p.phase + now * 0.00042);
          p.vx += (dx * pull + (-dy / dist) * swirl) * dt;
          p.vy += (dy * pull + (dx / dist) * swirl) * dt;
        } else {
          p.vx += Math.sin(now * 0.00028 + p.seed) * 4.4 * dt;
          p.vy += Math.cos(now * 0.00024 + p.seed) * 4.4 * dt;
        }
        const drag = Math.exp(-(active > 0 ? 3.2 : 0.72) * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (fade > 0) {
          const twinkle = 0.48 + 0.52 * (0.5 + 0.5 * Math.sin(now * 0.002 + p.phase));
          ctx.globalAlpha = (0.14 + 0.3 * twinkle) * fade;
          ctx.fillStyle = ACCENT;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // A point appears once its specks have gathered.
      PILLARS.forEach((_, i) => {
        if (appeared[i] !== null) return;
        const distances = particles
          .filter((p) => p.target === i)
          .map((p) => Math.hypot(p.x - np[i].x, p.y - np[i].y));
        if (pointReady(distances, t, REVEAL_AT_MS[i])) appeared[i] = t;
      });

      // Lines, each once both its points exist.
      CLINES.forEach(([i, j]) => {
        const from = lineStartMs(appeared[i], appeared[j]);
        if (from === null) return;
        lineEnd = Math.max(lineEnd, from + LINE_DURATION_MS);
        const prog = (t - from) / LINE_DURATION_MS;
        if (prog > 0) drawEdge(np[i].x, np[i].y, np[j].x, np[j].y, easeOut(prog));
      });

      // Points light up over 0.46s from the moment they appear.
      PILLARS.forEach((p, i) => {
        const at = appeared[i];
        if (at === null) return;
        const level = easeOut((t - at) / 460);
        drawNode(np[i].x, np[i].y, p.baseR, glow[i].rgb, glow[i].alpha * level, t, i);
      });

      const formed = appeared.every((at) => at !== null);
      if (formed && fadeAt === Infinity) fadeAt = Math.max((appeared[6] ?? t) + 500, lineEnd - 200);

      // The label swaps once (fully out, then in) and leaves after the last line.
      if (label === LABEL_GATHERING && t >= LABEL_SWITCH_MS) {
        label = LABEL_FINDING;
        setLoadVisible(false);
        timersRef.current.push(
          window.setTimeout(() => {
            setLoadText(LABEL_FINDING);
            setLoadVisible(true);
          }, LABEL_FADE_MS),
        );
      }
      if (formed && !labelOut && t > Math.max(9100, lineEnd + 150)) {
        labelOut = true;
        setLoadFade(true);
      }
      if (formed && t >= Math.max(9650, lineEnd + 650)) {
        finish();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return cleanup;
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
        background: "var(--ph-black)",
        opacity: !intro ? 0 : screenFade ? 0 : 1,
        transition: `opacity ${screenFade ? SCREEN_FADE_MS : LOAD_FADE_MS}ms ease`,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={cvsRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* rcLoad — the formation labels under the canvas. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "12%",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: 300,
          letterSpacing: "0.04em",
          color: "rgba(242,242,243,0.58)",
          opacity: loadFade || !loadVisible ? 0 : 1,
          transition: `opacity ${loadFade ? LOAD_FADE_MS : LABEL_FADE_MS}ms ease`,
        }}
      >
        {loadText}
      </div>

      {/* rc — the closing line. */}
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
          color: "var(--ph-white)",
          opacity: revealVisible ? 1 : 0,
          transition: `opacity ${REVEAL_IN_MS}ms ease`,
        }}
      >
        {revealText}
      </div>
    </div>
  );
}

// ============================================================================
// s6 Onairos Platform Connect (PHE-17, copy from the demo in PHE-125)
// ----------------------------------------------------------------------------
// One line on what connecting does, the privacy-policy link, and a single
// "connect with onairos" CTA (the real Onairos SDK via OnairosButtonWrapper).
// No local platform picker or permission checkboxes. The success path lives in
// handleOnairosComplete. Final Onairos copy is still to come from @janesse.
//
// Self-contained: the s3b skip-intro path lands here directly, so it assumes no
// prior explainer state.
//
// NOTE (.hidden CSS-collision guard, acceptance criterion): the Onairos SDK
// leaks a global `.hidden` class into the page. PHENYX must NOT rely on a bare
// `hidden` utility class anywhere or it gets clobbered — use Tailwind responsive
// (`max-lg:hidden`) / scoped variants instead. Enforced via eslint.config.mjs
// (no-restricted-syntax) + components/phenyx/CONVENTIONS.md.
// ============================================================================
function ConnectScreen({
  notice,
  onComplete,
  onBack,
}: {
  notice: string | null;
  onComplete: (result: OnairosCompleteData, error?: Error) => void;
  onBack: () => void;
}) {
  return (
    <div className="onb-block">
      <p
        className="onb-ey animate-fade-in"
        style={{
          ...fadeDelay(CONNECT_DELAYS[0]),
          color: ACCENT,
        }}
      >
        powered by onairos
      </p>

      <h1 className="onb-h1 animate-fade-in" style={fadeDelay(CONNECT_DELAYS[1])}>
        all it takes is connecting your platforms.
      </h1>

      <p className="onb-sub animate-fade-in" style={fadeDelay(CONNECT_DELAYS[2])}>
        our partnership with onairos lets you choose which platforms to connect, and we help you
        understand what they reveal about you. you can learn more in our{" "}
        <Link
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: ACCENT, textDecoration: "underline", textUnderlineOffset: "3px" }}
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
            color: "var(--ph-red)",
            lineHeight: 1.5,
            marginTop: "16px",
          }}
        >
          {notice}
        </p>
      )}

      <div className="onb-action animate-fade-in" style={fadeDelay(CONNECT_DELAYS[3])}>
        <OnairosButtonWrapper
          webpageName="PHENYX"
          requestedData={["personality"]}
          buttonType="pill"
          buttonText="connect with onairos"
          textColor="white"
          onComplete={onComplete}
        />
      </div>

      <div className="onb-back animate-fade-in" style={fadeDelay(CONNECT_DELAYS[4])}>
        <button
          onClick={onBack}
          aria-label="go back to the previous step"
          style={{
            background: "none",
            border: "none",
            color: "rgba(242,242,243,0.33)",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "color 0.2s ease",
            width: "100%",
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${ACCENT}`;
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
// State-driven (not CSS `.in`-class driven): given an ordered list of
// millisecond offsets (from cadenceOffsets), useStaggeredReveal returns a
// boolean[] of the same length where entry `i` flips true at
// `offsets[i] + lead` ms after mount.
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
    transition: REVEAL_TRANSITION,
  };
}

// ============================================================================
// The four explainers: your life so far, your constellation, polaris and
// discover (PHE-15, PHE-16, PHE-90, copy from the demo in PHE-125)
// ----------------------------------------------------------------------------
// Each is an ordered RevealBlock list rendered by WalkthroughScreen, so the
// cadence and the block markup live in one place. Every explainer has an
// eyebrow, a headline and one short paragraph, plus at most one sample: the
// seven chapters (constellation) or one authored card (polaris, discover).
// The sample cards are STATIC copy — no API/synthesis call, no
// constellation_state dependency (the user has not synthesized yet).
// ============================================================================

// One entry per rendered element, listed in visual order (CTA and back last).
// Delays are not authored here; cadenceOffsets() derives them from the order
// and kind of each block (see ENTRANCE CADENCE above).
type RevealBlock = {
  kind: "eyebrow" | "heading" | "body" | "rail" | "example" | "cta" | "back";
  text?: string;
  // "rail": chapter name + its one-line description.
  items?: ReadonlyArray<{ title: string; body: string }>;
  // "example": the sample card's title, body and quiet source line, and
  // the card's own actions when it has them (PHE-129: discover's save · ask polaris).
  q?: string;
  a?: string;
  src?: string;
  acts?: readonly string[];
};

const MANIFESTO_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "your life so far" },
  { kind: "heading", text: "your story is out there, scattered." },
  {
    kind: "body",
    text: "pieces of who you are live across every platform you’ve used. PHENYX brings them together so you can see what it all adds up to.",
  },
  { kind: "cta", text: "continue" },
  { kind: "back", text: "back" },
];

// The seven chapters, one line each (the rail never wraps a description).
const CONSTELLATION_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "your constellation" },
  { kind: "heading", text: "watch it all take shape." },
  {
    kind: "body",
    text: "your constellation traces seven points, from where you began to where you’re going. it grows as you do, and over time the patterns between them come into view.",
  },
  {
    kind: "rail",
    items: [
      { title: "origin", body: "what grounded you" },
      { title: "emergence", body: "what began to appear" },
      { title: "self-creation", body: "what you chose to make your own" },
      { title: "convergence", body: "what started connecting" },
      { title: "becoming", body: "what is taking shape" },
      { title: "recognition", body: "what became visible" },
      { title: "transcendence", body: "what you may be outgrowing" },
    ],
  },
  { kind: "cta", text: "continue" },
  { kind: "back", text: "back" },
];

// Final polaris explainer copy is still to come from @janesse; this is the demo's.
const POLARIS_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "polaris" },
  { kind: "heading", text: "when you want to go deeper, ask polaris." },
  {
    kind: "body",
    text: "it meets you where you are. it already understands the context of who you are on PHENYX.",
  },
  {
    kind: "example",
    q: "“i think i want to direct something. is that actually in my history?”",
    a: "you kept returning to film through saved references and small projects, even as product became your career. what part of directing do you miss most?",
    src: "clarify · understand · decide",
  },
  { kind: "cta", text: "continue" },
  { kind: "back", text: "back" },
];

const DISCOVER_BLOCKS: RevealBlock[] = [
  { kind: "eyebrow", text: "discover" },
  { kind: "heading", text: "discover what could be next." },
  {
    kind: "body",
    text: "it brings you people, ideas, and unexpected connections drawn from who you are, so you can save what sparks something or take it to polaris.",
  },
  {
    kind: "example",
    q: "acoustic ecology",
    a: "the study of how sound shapes the places we live. it sits right between the music you keep saving and the spaces you keep pinning.",
    src: "spotify, pinterest · this week",
    acts: ["save", "ask polaris"],
  },
  { kind: "cta", text: "continue" },
  { kind: "back", text: "back" },
];

type WalkthroughScreenProps = {
  blocks: RevealBlock[];
  reducedMotion: boolean;
  onContinue: () => void;
  onBack: () => void;
};

// Renders an ordered RevealBlock list inside the shared .onb-block layout with
// the position-derived cadence. Body copy takes its size and spacing from
// .onb-sub in globals.css, the same on every screen.
function WalkthroughScreen({
  blocks,
  reducedMotion,
  onContinue,
  onBack,
}: WalkthroughScreenProps) {
  const revealed = useStaggeredReveal(cadenceOffsets(blocks), { lead: 0, reducedMotion });

  return (
    <div className="onb-block">
      {blocks.map((block, i) => {
        const shown = revealed[i];
        const reveal = revealStyle(shown);

        switch (block.kind) {
          case "eyebrow":
            return (
              <p key={i} className="onb-ey" style={{ ...reveal, color: ACCENT }}>
                {block.text}
              </p>
            );

          case "heading":
            return (
              <h1 key={i} className="onb-h1" style={reveal}>
                {block.text}
              </h1>
            );

          case "body":
            return (
              <p key={i} className="onb-sub" style={reveal}>
                {block.text}
              </p>
            );

          case "rail":
            // The seven chapters: name, then its one-line description, no
            // divider lines. A single grid keeps the description column aligned.
            return (
              <dl
                key={i}
                className="onb-stack onb-rail"
                aria-label="constellation points"
                style={reveal}
              >
                {block.items?.map((item) => (
                  <Fragment key={item.title}>
                    <dt>{item.title}</dt>
                    <dd>{item.body}</dd>
                  </Fragment>
                ))}
              </dl>
            );

          case "example":
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
                  border: "0.5px solid rgba(242,242,243,0.12)",
                  borderRadius: "12px",
                  background: "rgba(242,242,243,0.02)",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 400,
                    color: "rgba(242,242,243,0.8)",
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
                    color: "rgba(242,242,243,0.53)",
                    lineHeight: 1.6,
                    marginBottom: "10px",
                  }}
                >
                  {block.a}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 300,
                    color: ACCENT,
                    letterSpacing: "0.04em",
                    margin: 0,
                  }}
                >
                  {block.src}
                </p>
                {block.acts && (
                  <p
                    aria-hidden="true"
                    style={{ fontSize: "12px", color: "rgba(242,242,243,0.6)", margin: "12px 0 0" }}
                  >
                    {block.acts.join(" · ")}
                  </p>
                )}
              </div>
            );

          case "cta":
            // Gated: inert (pointer-events none + disabled) until its own
            // offset elapses, so the user cannot skip ahead.
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
                  border: `0.5px solid ${ACCENT}`,
                  color: ACCENT,
                  borderRadius: "8px",
                  padding: "13px 36px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: shown ? "pointer" : "default",
                  fontFamily: "inherit",
                  width: "100%",
                  transition: `${REVEAL_TRANSITION}, background 0.2s ease, color 0.2s ease, border-color 0.2s ease`,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${ACCENT}`;
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
            // "back" to the previous step, also gated on its own offset.
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
                    color: "rgba(242,242,243,0.33)",
                    fontSize: "12px",
                    cursor: shown ? "pointer" : "default",
                    fontFamily: "inherit",
                    width: "100%",
                    transition: `${REVEAL_TRANSITION}, color 0.2s ease`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${ACCENT}`;
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
