"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupStart, otpSend, otpVerify } from "@/lib/api-client";
import { setSessionFromTokens, signInWithGoogle } from "@/lib/supabase-browser";
import { postAuthDestination } from "@/lib/auth-redirect";
import { AuthBrand, GoogleIcon, TermsLine } from "@/components/phenyx/auth-chrome";

// s1 = create your account (name + email, or google); s2 = email OTP.
type Screen = "s1" | "s2";

// Staged draft survives an s2 refresh within its TTL (see edge cases in PHE-7).
const DRAFT_STORAGE_KEY = "phenyx_signup_draft";
const DRAFT_TTL_MS = 15 * 60 * 1000;

interface StoredDraft {
  draftId: string;
  maskedEmail: string;
  expiresAt: number;
}

export default function JoinPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("s1");

  // s1 fields — name and email. Nothing else (PHE-97: no passphrase).
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // s2 state.
  const [draftId, setDraftId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    // Rehydrate a staged draft so refreshing s2 keeps the OTP screen. An expired
    // draft is discarded and the user restarts at s1.
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as StoredDraft;
        if (draft.expiresAt > Date.now()) {
          setDraftId(draft.draftId);
          setMaskedEmail(draft.maskedEmail);
          setScreen("s2");
        } else {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (screen === "s2") {
      setShowResend(false);
      const timer = setTimeout(() => setShowResend(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Google creates the account on its own round trip; /auth/callback completes
  // the profile and sends a new person to welcome.
  const handleGoogle = async () => {
    setError("");
    setGoogleBusy(true);
    const started = await signInWithGoogle();
    if (!started) {
      setError("google sign-in didn’t start. try again, or use your email.");
      setGoogleBusy(false);
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side mirror of the server validation (server is the source of truth).
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError("your name needs at least 2 characters");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("please enter a valid email");
      return;
    }

    setIsLoading(true);
    try {
      const { draft_id, maskedEmail: masked } = await signupStart({
        name: trimmedName,
        email: trimmedEmail,
      });

      setDraftId(draft_id);
      setMaskedEmail(masked);

      const draft: StoredDraft = {
        draftId: draft_id,
        maskedEmail: masked,
        expiresAt: Date.now() + DRAFT_TTL_MS,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

      setScreen("s2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return;

    setIsLoading(true);
    setError("");

    try {
      // Verify the code; on success the backend creates the account (or, for an
      // email that already has one, signs that person in) and returns a session.
      const result = await otpVerify({
        draftId,
        code: otp.trim(),
        purpose: "signup",
      });

      if (result.status === "ok" && result.session) {
        await setSessionFromTokens(result.session);
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        router.push(postAuthDestination({ isNew: result.is_new !== false }));
        return;
      }

      // Distinct copy for expired vs. wrong (verbatim per spec).
      setError(
        result.status === "expired"
          ? "that code has run out. we can send a fresh one."
          : "that one did not match. no rush, have another look."
      );
      setIsLoading(false);
    } catch {
      setError("something went wrong. please try again.");
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setShowResend(false);
    setError("");

    try {
      // Re-trigger the OTP send for the staged draft — a fresh code invalidates
      // the prior one server-side.
      await otpSend({ draftId, purpose: "signup" });
    } catch {
      // swallow — resend is best-effort; the timer is re-armed regardless
    } finally {
      setTimeout(() => setShowResend(true), 30000);
    }
  };

  const handleStartOver = () => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    setOtp("");
    setDraftId("");
    setMaskedEmail("");
    setError("");
    setScreen("s1");
  };

  return (
    <main
      className={
        screen === "s2"
          ? "onb-v67 min-h-screen bg-[#080808] animate-fade-in"
          : "min-h-screen bg-[#080808] flex flex-col items-center justify-center px-5 py-24"
      }
    >
      <header className="auth-topbar">
        <AuthBrand />
        <Link href="/signin" className="auth-topbar-link" aria-label="sign in to your existing account">
          sign in
        </Link>
      </header>

      {screen === "s2" ? (
        <div className="onb-block onb-block--sm onb-block--otp">
          <h1 className="onb-h1" style={{ marginBottom: 0 }}>
            check your email.
          </h1>
          <p
            className="onb-otp-lead"
            style={{
              fontSize: "14.5px",
              fontWeight: 300,
              color: "rgba(255,253,253,.55)",
              lineHeight: 1.7,
              marginBottom: "10px",
            }}
          >
            we sent a code to
          </p>
          <p
            className="onb-otp-address"
            style={{
              color: "#FFFDFD",
              fontSize: "13px",
              letterSpacing: ".02em",
              marginBottom: 0,
            }}
          >
            {maskedEmail}
          </p>

          <form onSubmit={handleVerify} aria-label="verify your code">
            <div className="flex justify-center">
              <label htmlFor="otp" className="sr-only">
                enter the 6 digit code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                aria-label="6 digit verification code"
                placeholder="······"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="onb-otp-input"
                style={{
                  letterSpacing: "0.5em",
                  textIndent: "0.5em",
                  textAlign: "center",
                  transition: "border-color 0.2s ease",
                }}
              />
            </div>

            <div role="alert" aria-live="polite" style={{ minHeight: "20px", marginTop: "8px" }}>
              {error && <p className="auth-error">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label="verify my code"
              className="onb-action auth-brand-btn"
              data-ph-hover="off"
            >
              {isLoading ? "verifying…" : "continue"}
            </button>

            <p
              className="onb-otp-resend"
              aria-live="polite"
              style={{
                color: "rgba(255,253,253,.5)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {showResend ? (
                <>
                  didn’t get it?{" "}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    aria-label="resend verification code"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      font: "inherit",
                      padding: 0,
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    resend code
                  </button>
                </>
              ) : (
                "code sent"
              )}
            </p>

            <button type="button" onClick={handleStartOver} className="onb-back auth-text-action">
              back
            </button>
          </form>
        </div>
      ) : (
        <section className="auth-flow" aria-labelledby="join-title">
          <h1 id="join-title" className="auth-h auth-reveal" style={{ "--d": "80ms" } as React.CSSProperties}>
            create your account.
          </h1>
          <p className="auth-lede auth-reveal" style={{ "--d": "260ms" } as React.CSSProperties}>
            just enough to make this space yours. you can change these later.
          </p>

          <form
            onSubmit={handleContinue}
            aria-label="create your account"
            className="auth-form auth-reveal"
            style={{ "--d": "520ms" } as React.CSSProperties}
          >
            <label htmlFor="name" className="auth-label">
              your name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              aria-required="true"
              placeholder="what you’d like to be called"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="auth-input"
            />

            <label htmlFor="email" className="auth-label" style={{ marginTop: "18px" }}>
              email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-required="true"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
            <p className="auth-hint">we’ll send your sign-in code here.</p>

            {error && (
              <p role="alert" aria-live="polite" className="auth-error">
                {error}
              </p>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="auth-brand-btn"
                data-ph-hover="off"
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? "…" : "continue"}
              </button>
              <p className="auth-or" aria-hidden="true">
                or
              </p>
              <button
                type="button"
                className="auth-brand-btn auth-brand-btn--outline"
                onClick={handleGoogle}
                disabled={googleBusy}
                aria-busy={googleBusy}
              >
                <GoogleIcon />
                <span>{googleBusy ? "connecting to google…" : "continue with google"}</span>
              </button>
              <TermsLine />
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
