"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STELLAR_DEFAULT, hexToRgb } from "@/lib/stellar";
import { signin, otpSend, otpVerify, passphraseResetRequest } from "@/lib/api-client";
import { supabaseBrowser as supabase, setSessionFromTokens } from "@/lib/supabase-browser";
import { setOtpFlowContext, clearOtpFlowContext } from "@/lib/otp-flow-context";

// ssignin = name + passphrase. emailcode = enter email for a one-time code.
// otp = enter that code. sforgot = request a reset link.
type View = "signin" | "emailcode" | "otp" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [view, setView] = useState<View>("signin");

  // ssignin fields.
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // email-code + otp fields.
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  // sforgot field + success latch.
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

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
      // (not random); the persisted color is adopted once the user signs in.
      setStellarColor(STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--color-stellar", STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--s-rgb", hexToRgb(STELLAR_DEFAULT));
    }
  }, []);

  useEffect(() => {
    if (view === "otp") {
      setShowResend(false);
      const timer = setTimeout(() => setShowResend(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  /**
   * Land a freshly authenticated user.
   * - returnTo wins (deep link).
   * - OTP started from sign-in (`_otpFlowContext='signin'`) always returns to
   *   the product, never welcome/onboarding (PHE-77 / PHE-45).
   * - Passphrase sign-in still routes by whether a persona already exists.
   */
  const proceed = async (mode: "passphrase" | "otp" = "passphrase") => {
    if (returnTo) {
      clearOtpFlowContext();
      router.push(returnTo);
      return;
    }
    if (mode === "otp") {
      clearOtpFlowContext();
      router.push("/dashboard");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: personaData } = await supabase
        .from("user_persona")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      router.push(personaData && personaData.length > 0 ? "/dashboard" : "/onboarding");
    } else {
      router.push("/onboarding");
    }
  };

  // ssignin: name + passphrase → /auth/signin → session.
  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Both fields required before submit; the message is intentionally generic
    // (no hint about which field / whether the name exists).
    if (!name.trim() || !passphrase.trim()) {
      setError("enter your name and passphrase to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signin({ name: name.trim(), passphrase: passphrase.trim() });
      if (result.ok && result.session) {
        await setSessionFromTokens(result.session);
        setPassphrase("");
        await proceed();
        return;
      }
      // Single generic failure for unknown name / wrong passphrase / lockout.
      setError("enter your name and passphrase to continue.");
      setIsLoading(false);
    } catch {
      setError("enter your name and passphrase to continue.");
      setIsLoading(false);
    }
  };

  // email-code alternate: send a one-time code to the entered email (purpose=signin).
  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!EMAIL_RE.test(email.trim())) {
      setError("enter a valid email to continue.");
      return;
    }

    setIsLoading(true);
    try {
      setOtpFlowContext("signin");
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
    try {
      const result = await otpVerify({
        purpose: "signin",
        email: email.trim().toLowerCase(),
        code: otp.trim(),
      });

      if (result.status === "ok" && result.session) {
        await setSessionFromTokens(result.session);
        await proceed("otp");
        return;
      }

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
      await otpSend({ purpose: "signin", email: email.trim().toLowerCase() });
    } catch {
      // best-effort; the timer is re-armed regardless
    } finally {
      setTimeout(() => setShowResend(true), 30000);
    }
  };

  // sforgot: request a reset link. Success copy shows regardless of account state.
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!EMAIL_RE.test(forgotEmail.trim())) {
      setError("enter a valid email to continue.");
      return;
    }

    setIsLoading(true);
    try {
      await passphraseResetRequest({ email: forgotEmail.trim().toLowerCase() });
      setForgotSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  const goToSignin = () => {
    setView("signin");
    setError("");
    setOtp("");
    setForgotSent(false);
  };

  // --- shared styles (kept consistent with /join) --------------------------

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

  const headingStyles: React.CSSProperties = {
    fontSize: "21px",
    fontWeight: 300,
    color: "#FFFDFD",
    letterSpacing: "-0.01em",
    lineHeight: 1.26,
    marginBottom: "8px",
  };

  const subStyles: React.CSSProperties = {
    fontSize: "14.5px",
    fontWeight: 300,
    color: "rgba(255,253,253,.55)",
    lineHeight: 1.7,
    marginBottom: "24px",
  };

  const linkButtonStyles: React.CSSProperties = {
    fontSize: "11px",
    color: "#555",
    textAlign: "center",
    cursor: "pointer",
    display: "block",
    background: "none",
    border: "none",
    fontFamily: "inherit",
    width: "100%",
    transition: "color 0.2s ease",
  };

  const onPrimaryEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "#FFFDFD";
    e.currentTarget.style.borderColor = "#FFFDFD";
    e.currentTarget.style.color = "#0A0A0A";
  };
  const onPrimaryLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.borderColor = stellarColor;
    e.currentTarget.style.color = stellarColor;
  };

  return (
    <main
      className={
        view === "otp"
          ? "onb-v67 min-h-screen bg-[#080808] animate-fade-in"
          : "min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 animate-fade-in"
      }
    >
      {/* Topbar */}
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between"
        style={{ padding: "20px 24px 16px" }}
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
        <Link
          href="/join"
          className="transition-opacity hover:opacity-100"
          style={{ color: stellarColor, opacity: 0.8, fontSize: "11px" }}
          aria-label="create an account"
        >
          create an account
        </Link>
      </header>

      {/* Card */}
      <div
        className={view === "otp" ? "onb-block onb-block--sm onb-block--otp" : undefined}
        style={view === "otp" ? undefined : cardStyle}
      >
        {view === "signin" && (
          <>
            <h1 style={headingStyles}>welcome back.</h1>
            <p style={subStyles}>use your name and passphrase to return.</p>

            <form onSubmit={handleSignin} aria-label="sign in with your name and passphrase">
              <div>
                <label htmlFor="signinName" style={labelStyles}>
                  your name
                </label>
                <input
                  id="signinName"
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

              <div style={{ marginTop: "18px" }}>
                <label htmlFor="signinPass" style={labelStyles}>
                  passphrase
                </label>
                <input
                  id="signinPass"
                  type="password"
                  autoComplete="current-password"
                  aria-required="true"
                  placeholder="your personal phrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="auth-input"
                />
                <button
                  type="button"
                  className="auth-field-link"
                  onClick={() => {
                    setView("forgot");
                    setError("");
                  }}
                >
                  forgot your passphrase?
                </button>
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
                aria-label="enter"
                style={{ ...sendButtonStyles, marginTop: "26px" }}
                onMouseEnter={onPrimaryEnter}
                onMouseLeave={onPrimaryLeave}
              >
                {isLoading ? "..." : "enter"}
              </button>
            </form>

            <div className="auth-form-foot">
              <button
                type="button"
                className="auth-form-alt"
                onClick={() => {
                  setOtpFlowContext("signin");
                  setView("emailcode");
                  setError("");
                }}
              >
                sign in with an email code instead
              </button>
            </div>
          </>
        )}

        {view === "emailcode" && (
          <>
            <h1 style={headingStyles}>sign in with a code.</h1>
            <p style={subStyles}>
              enter your email and we&apos;ll send a one-time code.
            </p>

            <form onSubmit={handleSendEmailCode} aria-label="sign in with an email code">
              <div>
                <label htmlFor="signinEmail" style={labelStyles}>
                  email
                </label>
                <input
                  id="signinEmail"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  placeholder="the email tied to your account"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="auth-input"
                />
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
                aria-label="send code"
                style={{ ...sendButtonStyles, marginTop: "26px" }}
                onMouseEnter={onPrimaryEnter}
                onMouseLeave={onPrimaryLeave}
              >
                {isLoading ? "sending..." : "send code"}
              </button>
            </form>

            <button
              type="button"
              onClick={goToSignin}
              style={{ ...linkButtonStyles, marginTop: "20px" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
            >
              back to sign in
            </button>
          </>
        )}

        {view === "otp" && (
          <>
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

              <div role="alert" aria-live="polite" style={{ minHeight: "20px", marginTop: "8px" }}>
                {error && (
                  <p style={{ fontSize: "11px", color: "#E84422", textAlign: "center" }}>
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
                onMouseEnter={onPrimaryEnter}
                onMouseLeave={onPrimaryLeave}
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
                onClick={goToSignin}
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
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(255,253,253,.55)")
                }
              >
                back
              </button>
            </form>
          </>
        )}

        {view === "forgot" && (
          <>
            <h1 style={headingStyles}>reset your passphrase.</h1>
            <p style={subStyles}>
              enter the email tied to your account. we&apos;ll send a reset link.
            </p>

            {forgotSent ? (
              <>
                <p
                  role="status"
                  aria-live="polite"
                  style={{ fontSize: "13px", color: "#FFFDFD", lineHeight: 1.7, marginBottom: "24px" }}
                >
                  reset link sent. check your inbox.
                </p>
                <button
                  type="button"
                  onClick={goToSignin}
                  style={linkButtonStyles}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  back to sign in
                </button>
              </>
            ) : (
              <>
                <form onSubmit={handleForgot} aria-label="request a passphrase reset link">
                  <div>
                    <label htmlFor="forgotEmail" style={labelStyles}>
                      email
                    </label>
                    <input
                      id="forgotEmail"
                      type="email"
                      autoComplete="email"
                      aria-required="true"
                      placeholder="the email tied to your account"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                      className="auth-input"
                    />
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
                    aria-label="send reset link"
                    style={{ ...sendButtonStyles, marginTop: "26px" }}
                    onMouseEnter={onPrimaryEnter}
                    onMouseLeave={onPrimaryLeave}
                  >
                    {isLoading ? "sending..." : "send reset link"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={goToSignin}
                  style={{ ...linkButtonStyles, marginTop: "20px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  back to sign in
                </button>
              </>
            )}
          </>
        )}
      </div>

    </main>
  );
}
