"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STELLAR_DEFAULT } from "@/lib/stellar";
import { signupStart, otpSend, otpVerify } from "@/lib/api-client";
import { setSessionFromTokens } from "@/lib/supabase-browser";

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
    } else {
      // Pre-auth: no persisted identity yet. Use the deterministic default accent
      // (not random) — the server-assigned color is adopted after account creation.
      setStellarColor(STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--color-stellar", STELLAR_DEFAULT);
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
    background: "#0A0A0A",
    border: "0.5px solid #1a1a1a",
    borderRadius: "16px",
    padding: "36px 32px",
    maxWidth: "400px",
    width: "100%",
  };

  const sendButtonStyles: React.CSSProperties = {
    width: "100%",
    padding: "15px 24px",
    fontSize: "13px",
    fontWeight: 400,
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    borderRadius: "40px",
    cursor: "pointer",
    transition: "all 0.25s ease",
    textAlign: "center",
    background: "transparent",
    border: `0.5px solid ${stellarColor}`,
    color: stellarColor,
  };

  const inputStyles: React.CSSProperties = {
    width: "100%",
    background: "#0d0d0d",
    border: "0.5px solid #1e1e1e",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#FFFDFD",
    fontSize: "14px",
    fontWeight: 300,
    lineHeight: 1.5,
    transition: "border-color 0.2s ease",
  };

  const labelStyles: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.04em",
    color: "#888",
    marginBottom: "8px",
  };

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = stellarColor;
    e.target.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${stellarColor} 8%, transparent)`;
    e.target.style.outline = "none";
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#1e1e1e";
    e.target.style.boxShadow = "none";
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4 animate-fade-in">
      {/* Topbar */}
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between"
        style={{ padding: "20px 24px 16px" }}
      >
        <Link href="/" className="flex items-center" style={{ gap: "8px" }}>
          <Image
            src="/phenyx-logo.png"
            alt="PHENYX COLLECTIVE"
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
            PHENYX COLLECTIVE
          </span>
        </Link>
        <div className="flex items-center gap-2" style={{ fontSize: "11px" }}>
          <span style={{ color: "#444" }}>already here?</span>
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
      <div style={cardStyle}>
        {screen === "s2" ? (
          <>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 400,
                color: "#FFFDFD",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                marginBottom: "8px",
              }}
            >
              check your email.
            </h1>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 300,
                color: "#555",
                lineHeight: 1.7,
                marginBottom: "28px",
              }}
            >
              we sent a code to{" "}
              <span style={{ color: "#FFFDFD" }}>{maskedEmail}</span>
            </p>

            <form
              onSubmit={handleVerify}
              aria-label="verify your code"
              className="space-y-6"
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
                  placeholder="______"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #2a2a2a",
                    borderRadius: "0",
                    color: "#FFFDFD",
                    fontSize: "28px",
                    letterSpacing: "0.5em",
                    textAlign: "center",
                    width: "220px",
                    padding: "0 0 8px 0",
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
                {isLoading ? "verifying..." : "verify"}
              </button>

              {showResend ? (
                <button
                  type="button"
                  onClick={handleResendCode}
                  aria-label="resend verification code"
                  className="w-full transition-colors"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                    color: "#555",
                    textAlign: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  resend code
                </button>
              ) : (
                // Cooldown state: a fresh code is on its way; resend re-enables in 30s.
                <p
                  aria-live="polite"
                  style={{
                    fontSize: "11px",
                    color: "#444",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  code sent
                </p>
              )}

              <button
                type="button"
                onClick={handleStartOver}
                style={{
                  fontSize: "11px",
                  color: "#333",
                  textAlign: "center",
                  cursor: "pointer",
                  display: "block",
                  marginTop: "12px",
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  width: "100%",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
              >
                start over
              </button>
            </form>
          </>
        ) : (
          <>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 400,
                color: "#FFFDFD",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                marginBottom: "8px",
              }}
            >
              create your account.
            </h1>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 300,
                color: "#555",
                lineHeight: 1.7,
                marginBottom: "28px",
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
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              {/* email */}
              <div style={{ marginTop: "20px" }}>
                <label htmlFor="email" style={labelStyles}>
                  email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  placeholder="we'll send a verification code"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              {/* your passphrase */}
              <div style={{ marginTop: "20px" }}>
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
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
                <p style={{ fontSize: "10px", color: "#444", marginTop: "8px", lineHeight: 1.6 }}>
                  yours to keep. you&apos;ll use it alongside your name every time
                  you return.
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
                style={{ ...sendButtonStyles, marginTop: "24px" }}
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

      {/* Footer */}
      <footer
        className="fixed bottom-0 left-0 right-0 text-center"
        style={{
          padding: "20px 0 24px",
          marginTop: "28px",
        }}
      >
        <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.8, margin: 0 }}>
          we never sell your data. your synthesis is yours.
        </p>
        <Link
          href="/privacy"
          className="transition-all hover:underline"
          style={{
            fontSize: "10px",
            color: stellarColor,
            lineHeight: 1.8,
            textDecoration: "none",
          }}
        >
          read our privacy policy
        </Link>
      </footer>
    </main>
  );
}
