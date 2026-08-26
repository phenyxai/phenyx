"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STELLAR_DEFAULT, hexToRgb } from "@/lib/stellar";
import { signupStart, otpSend, otpVerify } from "@/lib/api-client";
import { setSessionFromTokens } from "@/lib/supabase-browser";
import { setOtpFlowContext, clearOtpFlowContext } from "@/lib/otp-flow-context";

// s1 = account creation (name + email + passphrase); s2 = email OTP.
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
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [screen, setScreen] = useState<Screen>("s1");

  // s1 fields — name, email, passphrase. Nothing else.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // s2 state.
  const [draftId, setDraftId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
      document.documentElement.style.setProperty("--color-stellar", stored);
      document.documentElement.style.setProperty("--s-rgb", hexToRgb(stored));
    } else {
      // Pre-auth: no persisted identity yet. Use the deterministic default accent
      // (not random) — the server-assigned color is adopted after account creation.
      setStellarColor(STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--color-stellar", STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--s-rgb", hexToRgb(STELLAR_DEFAULT));
    }

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

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side mirror of the server validation (server is the source of truth).
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassphrase = passphrase.trim();

    if (trimmedName.length < 2) {
      setError("your name needs at least 2 characters");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("please enter a valid email");
      return;
    }
    if (trimmedPassphrase.length < 8) {
      setError("your passphrase needs at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      localStorage.setItem("phenyx_stellar_color", stellarColor);
      setOtpFlowContext("signup");

      const { draft_id, maskedEmail: masked } = await signupStart({
        name: trimmedName,
        email: trimmedEmail,
        passphrase: trimmedPassphrase,
      });

      // Discard the raw passphrase from component state once it is staged server-side.
      setPassphrase("");
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
      // Verify the code; on success the backend creates the account (signup) and
      // returns a session the browser adopts so the user is authenticated.
      const result = await otpVerify({
        draftId,
        code: otp.trim(),
        purpose: "signup",
      });

      if (result.status === "ok" && result.session) {
        await setSessionFromTokens(result.session);
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        clearOtpFlowContext();
        router.push("/welcome");
        return;
      }

      // Distinct copy for expired vs. wrong (verbatim per spec).
      setError(
        result.status === "expired"
          ? "that code has expired. request a new one below."
          : "that code didn't work. check it and try again."
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

  const cardStyle = {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    padding: "44px 40px",
    maxWidth: "400px",
    width: "100%",
  };

  const sendButtonStyles: React.CSSProperties = {
    width: "100%",
    padding: "15px",
    fontSize: "14px",
    fontWeight: 400,
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.25s ease",
    textAlign: "center",
    background: "transparent",
    border: "1px solid #4d4d4d",
    color: "rgba(255,253,253,.92)",
  };

  const labelStyles: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.13em",
    color: "rgba(255,253,253,.5)",
    textTransform: "uppercase",
    marginBottom: "6px",
  };

  return (
    <main
      className={
        screen === "s2"
          ? "onb-v67 min-h-screen bg-[#080808] animate-fade-in"
          : "min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 animate-fade-in"
      }
    >
      {/* Topbar */}
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between"
        style={{ padding: "20px 24px 16px", zIndex: 10 }}
      >
        <Link href="/" className="flex items-center" style={{ gap: "8px" }}>
          <Image
            src="/phenyx-logo.png"
            alt="PHENYX"
            width={20}
            height={20}
            style={{ opacity: 0.9 }}
          />
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              fontWeight: 600,
              color: "#FFFDFD",
              opacity: 0.9,
            }}
          >
            PHENYX
          </span>
        </Link>
        <div style={{ fontSize: "11px" }}>
          <Link
            href="/signin"
            className="transition-opacity hover:opacity-100"
            style={{ color: stellarColor, opacity: 0.8 }}
            aria-label="sign in to your existing account"
          >
            sign in
          </Link>
        </div>
      </header>

      {/* Card */}
      <div
        className={screen === "s2" ? "onb-block onb-block--sm onb-block--otp" : undefined}
        style={screen === "s2" ? undefined : cardStyle}
      >
        {screen === "s2" ? (
          <>
            <h1
              className="onb-h1"
              style={{
                marginBottom: 0,
              }}
            >
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

            <form
              onSubmit={handleVerify}
              aria-label="verify your code"
            >
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
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #2a2a2a",
                    borderRadius: "0",
                    color: "#FFFDFD",
                    fontSize: "34px",
                    letterSpacing: "0.5em",
                    textIndent: "0.5em",
                    textAlign: "center",
                    width: "260px",
                    padding: "18px 0",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderBottomColor = stellarColor)}
                  onBlur={(e) => (e.target.style.borderBottomColor = "#2a2a2a")}
                />
              </div>

              <div
                role="alert"
                aria-live="polite"
                style={{ minHeight: "20px", marginTop: "8px" }}
              >
                {error && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#E84422",
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                aria-label="verify my code"
                className="onb-action"
                style={sendButtonStyles}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = stellarColor;
                  e.currentTarget.style.color = stellarColor;
                }}
              >
                {isLoading ? "verifying..." : "continue"}
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
                    didn&apos;t get it?{" "}
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

              <button
                type="button"
                onClick={handleStartOver}
                className="onb-back"
                style={{
                  fontSize: "12px",
                  color: "rgba(255,253,253,.55)",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,253,253,.55)")}
              >
                back
              </button>
            </form>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: "21px",
                fontWeight: 300,
                color: "#FFFDFD",
                letterSpacing: "-0.01em",
                lineHeight: 1.26,
                marginBottom: "8px",
              }}
            >
              create your account.
            </h1>
            <p
              style={{
                fontSize: "14.5px",
                fontWeight: 300,
                color: "rgba(255,253,253,.55)",
                lineHeight: 1.7,
                marginBottom: "24px",
              }}
            >
              a few things first.
            </p>

            <form onSubmit={handleContinue} aria-label="create your account">
              {/* your name */}
              <div>
                <label htmlFor="name" style={labelStyles}>
                  your name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  aria-required="true"
                  placeholder="how the world knows you"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="auth-input"
                />
              </div>

              {/* email */}
              <div style={{ marginTop: "18px" }}>
                <label htmlFor="email" style={labelStyles}>
                  email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  placeholder="we'll send a code to confirm it is you"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>

              {/* your passphrase */}
              <div style={{ marginTop: "18px" }}>
                <label htmlFor="passphrase" style={labelStyles}>
                  your passphrase
                </label>
                <input
                  id="passphrase"
                  type="password"
                  autoComplete="new-password"
                  aria-required="true"
                  placeholder="a phrase or line that means something to you"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="auth-input"
                />
                <p style={{ fontSize: "10px", color: "#444", marginTop: "8px", lineHeight: 1.6 }}>
                  used with your name each time you return.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  style={{ fontSize: "11px", color: "#E84422", marginTop: "16px" }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                aria-label="continue"
                style={{ ...sendButtonStyles, marginTop: "26px" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = stellarColor;
                  e.currentTarget.style.color = stellarColor;
                }}
              >
                {isLoading ? "..." : "continue"}
              </button>
            </form>
          </>
        )}
      </div>

    </main>
  );
}
