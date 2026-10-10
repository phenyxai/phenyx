"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { otpSend, otpVerify } from "@/lib/api-client";
import { setSessionFromTokens, signInWithGoogle } from "@/lib/supabase-browser";
import { postAuthDestination } from "@/lib/auth-redirect";
import { AuthBrand, GoogleIcon, TermsLine } from "@/components/phenyx/auth-chrome";

// PHE-97: two doors only. choose = "come in." with google or email.
// email = enter an email for a one-time code. otp = enter that code.
type View = "choose" | "email" | "otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GOOGLE_ERROR = "google sign-in didn’t finish. try again, or use your email.";

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [view, setView] = useState<View>("choose");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  // /auth/callback sends a failed Google round trip back here with ?error=google.
  const [error, setError] = useState(searchParams.get("error") === "google" ? GOOGLE_ERROR : "");
  const [noAccount, setNoAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    if (view === "otp") {
      setShowResend(false);
      const timer = setTimeout(() => setShowResend(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const goTo = (next: View) => {
    setView(next);
    setError("");
    setNoAccount(false);
  };

  // Google: Supabase leaves for Google and comes back through /auth/callback,
  // which completes the profile and routes. We only handle a failure to start.
  const handleGoogle = async () => {
    setError("");
    setGoogleBusy(true);
    const started = await signInWithGoogle(returnTo);
    if (!started) {
      setError(GOOGLE_ERROR);
      setGoogleBusy(false);
    }
  };

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNoAccount(false);

    if (!EMAIL_RE.test(email.trim())) {
      setError("enter a valid email to continue.");
      return;
    }

    setIsLoading(true);
    try {
      await otpSend({ purpose: "signin", email: email.trim().toLowerCase() });
      setOtp("");
      setView("otp");
    } catch {
      setError("could not send a code. please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return;

    setIsLoading(true);
    setError("");
    setNoAccount(false);
    try {
      const result = await otpVerify({
        purpose: "signin",
        email: email.trim().toLowerCase(),
        code: otp.trim(),
      });

      if (result.status === "ok" && result.session) {
        await setSessionFromTokens(result.session);
        router.push(postAuthDestination({ isNew: result.is_new === true, returnTo }));
        return;
      }

      if (result.status === "no_account") {
        setNoAccount(true);
      } else {
        setError(
          result.status === "expired"
            ? "that code has expired. request a new one below."
            : "that code didn’t work. check it and try again."
        );
      }
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
      await otpSend({ purpose: "signin", email: email.trim().toLowerCase() });
    } catch {
      // best-effort; the timer is re-armed regardless
    } finally {
      setTimeout(() => setShowResend(true), 30000);
    }
  };

  return (
    <main
      className={
        view === "otp"
          ? "onb-v67 min-h-screen bg-[#080808] animate-fade-in"
          : "min-h-screen bg-[#080808] flex flex-col items-center justify-center px-5 py-24"
      }
    >
      <header className="auth-topbar">
        <AuthBrand />
        <Link href="/join" className="auth-topbar-link">
          create an account
        </Link>
      </header>

      {view === "choose" && (
        <section className="auth-flow" aria-labelledby="signin-title">
          <p className="auth-eyebrow auth-reveal" style={{ "--d": "80ms" } as React.CSSProperties}>
            welcome to PHENYX
          </p>
          <h1 id="signin-title" className="auth-h auth-reveal" style={{ "--d": "260ms" } as React.CSSProperties}>
            come in.
          </h1>
          <p className="auth-lede auth-reveal" style={{ "--d": "520ms" } as React.CSSProperties}>
            sign in to begin, or to return to the constellation you have already started.
          </p>

          <div className="auth-actions auth-reveal" style={{ "--d": "820ms" } as React.CSSProperties}>
            <button
              type="button"
              className="auth-brand-btn"
              onClick={handleGoogle}
              disabled={googleBusy}
              aria-busy={googleBusy}
            >
              <GoogleIcon />
              <span>{googleBusy ? "connecting to google…" : "continue with google"}</span>
            </button>
            <button
              type="button"
              className="auth-brand-btn auth-brand-btn--outline"
              onClick={() => goTo("email")}
            >
              sign in with email
            </button>
            {error && (
              <p role="alert" aria-live="polite" className="auth-error">
                {error}
              </p>
            )}
            <TermsLine />
          </div>
        </section>
      )}

      {view === "email" && (
        <section className="auth-flow" aria-labelledby="signin-email-title">
          <h1 id="signin-email-title" className="auth-h auth-reveal">
            sign in with email.
          </h1>
          <p className="auth-lede auth-reveal" style={{ "--d": "180ms" } as React.CSSProperties}>
            we’ll send a one-time code to the email you use with PHENYX.
          </p>

          <form
            onSubmit={handleSendEmailCode}
            aria-label="sign in with an email code"
            className="auth-form auth-reveal"
            style={{ "--d": "360ms" } as React.CSSProperties}
          >
            <label htmlFor="signinEmail" className="auth-label">
              email
            </label>
            <input
              id="signinEmail"
              type="email"
              autoComplete="email"
              aria-required="true"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="auth-input"
            />

            {error && (
              <p role="alert" aria-live="polite" className="auth-error">
                {error}
              </p>
            )}

            <div className="auth-actions">
              <button type="submit" className="auth-brand-btn" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? "sending…" : "send code"}
              </button>
              <button
                type="button"
                className="auth-text-action"
                onClick={handleGoogle}
                disabled={googleBusy}
              >
                continue with google instead
              </button>
            </div>
          </form>
        </section>
      )}

      {view === "otp" && (
        <div className="onb-block onb-block--sm onb-block--otp">
          <h1 className="onb-h1">check your email.</h1>
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
            {email}
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
              {noAccount && (
                <p className="auth-error">
                  there’s no PHENYX account for this email yet.{" "}
                  <Link href="/join">create your account</Link>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label="verify my code"
              className="onb-action auth-brand-btn"
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

            <button type="button" onClick={() => goTo("email")} className="onb-back auth-text-action">
              use a different email
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
