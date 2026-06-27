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

// Back-arrow target for each screen. Placeholder semantics — later tickets
// (PHE-15/16/17) own the real back behavior for their screens. `connect` goes
// back to `fork` so the skip-path remains self-contained.
const PREV_STEP: Partial<Record<OnboardingStep, OnboardingStep>> = {
  manifesto: "fork",
  polaris_intro: "manifesto",
  connect: "fork",
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

export default function OnboardingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("fork");
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [userId, setUserId] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Onairos state (used by the connect placeholder; PHE-17 builds the real s6)
  const [onairosConnected, setOnairosConnected] = useState(false);

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

  // Convenience: advance one step along the linear funnel.
  const advance = useCallback(() => {
    void setOnboardingStep(NEXT_STEP[step]);
  }, [setOnboardingStep, step]);

  // Back-arrow handler (placeholder semantics — see PREV_STEP).
  const goBack = useCallback(() => {
    const prev = PREV_STEP[step];
    if (prev) void setOnboardingStep(prev);
  }, [setOnboardingStep, step]);

  // Onairos completion — persist redacted snapshot + fire-and-forget synthesis.
  // Kept here (reused infra) so PHE-17 can build the real s6 on top of it.
  const handleOnairosComplete = useCallback((result: OnairosCompleteData) => {
    setOnairosConnected(true);

    if (result.token) {
      localStorage.setItem("onairos_token", result.token);
    }

    const profilePayload = redactOnairosForProfile(result);
    if (userId && Object.keys(profilePayload).length > 0) {
      void supabase
        .from("user_profiles")
        .upsert({ id: userId, onairos_data: profilePayload })
        .then(({ error }) => {
          if (error) {
            console.warn("[onboarding] user_profiles.onairos_data upsert:", error.message);
          }
        });
    }

    if (userId && result) {
      apiFetch("/synthesize-constellation", {
        method: "POST",
        body: JSON.stringify({ userId, onairosData: result })
      })
        .then((res) => res.json())
        .catch(() => {
          // Non-blocking — synthesis runs in the background (see spec feature 5).
        });
    }
  }, [userId]);

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

        {/* PHE-17 will implement: connect (s6 — Onairos platform connect).
            The OnairosButtonWrapper + handleOnairosComplete are mounted here as
            the reusable foundation; PHE-17 builds the real framing/copy/gating.
            For now, "continue" advances to synthesizing. */}
        {step === "connect" && (
          <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
            <p
              className="animate-fade-in"
              style={{ fontSize: "11px", color: "#444", letterSpacing: "0.15em", marginBottom: "8px" }}
            >
              PHE-17 PLACEHOLDER
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
              connect
            </p>

            <div
              className="animate-fade-in"
              style={{
                animationDelay: "300ms",
                animationFillMode: "both",
                display: "flex",
                justifyContent: "center",
                marginBottom: "32px"
              }}
            >
              {!onairosConnected ? (
                <OnairosButtonWrapper
                  webpageName="PHENYX COLLECTIVE"
                  requestedData={["personality"]}
                  buttonType="pill"
                  buttonText="connect with onairos"
                  textColor="white"
                  onComplete={(result) => handleOnairosComplete(result)}
                />
              ) : (
                <span style={{ fontSize: "13px", color: "#666" }}>platforms connected</span>
              )}
            </div>

            <button
              onClick={advance}
              aria-label="continue"
              style={{
                background: "transparent",
                border: `0.5px solid ${stellarColor}`,
                color: stellarColor,
                borderRadius: "8px",
                padding: "10px 32px",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              continue
            </button>
          </div>
        )}

        {/* PHE-18 will implement: synthesizing (background-synthesis UX) */}
        {step === "synthesizing" && (
          <PlaceholderScreen
            label="synthesizing"
            stellarColor={stellarColor}
            ctaLabel="continue"
            onContinue={advance}
          />
        )}

        {/* PHE-19 will implement: reveal (constellation reveal scrC).
            On completion it sets onboarding_step = done and routes to the
            dashboard. The placeholder does both now. */}
        {step === "reveal" && (
          <PlaceholderScreen
            label="reveal"
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
                <PolarisBadge color={stellarColor} frozen={reducedMotion} />
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
