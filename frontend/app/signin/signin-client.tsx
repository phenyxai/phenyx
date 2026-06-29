"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STELLAR_DEFAULT } from "@/lib/stellar";
import { signin, otpSend, otpVerify, passphraseResetRequest } from "@/lib/api-client";
import { supabaseBrowser as supabase, setSessionFromTokens } from "@/lib/supabase-browser";

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
    } else {
      // Pre-auth: no persisted identity yet. Use the deterministic default accent
      // (not random); the persisted color is adopted once the user signs in.
      setStellarColor(STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--color-stellar", STELLAR_DEFAULT);
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
   * Land a freshly authenticated user. returnTo wins; otherwise route by whether
   * they already have a persona (existing constellation) or still need onboarding.
   * Mirrors the prior signin routing — read the user id from the adopted session.
   */
  const proceed = async () => {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: personaData } = await supabase
        .from("user_persona")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      router.push(personaData && personaData.length > 0 ? "/constellation" : "/onboarding");
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
        await proceed();
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

  const headingStyles: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: 400,
    color: "#FFFDFD",
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
    marginBottom: "8px",
  };

  const subStyles: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 300,
    color: "#555",
    lineHeight: 1.7,
    marginBottom: "28px",
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

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = stellarColor;
    e.target.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${stellarColor} 8%, transparent)`;
    e.target.style.outline = "none";
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#1e1e1e";
    e.target.style.boxShadow = "none";
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
          <span style={{ color: "#444" }}>new here?</span>
          <Link
            href="/join"
            className="transition-opacity hover:opacity-100"
            style={{ color: stellarColor, opacity: 0.8 }}
            aria-label="create a new account"
          >
            join
          </Link>
        </div>
      </header>

      {/* Card */}
      <div style={cardStyle}>
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
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              <div style={{ marginTop: "20px" }}>
                <label htmlFor="signinPass" style={labelStyles}>
                  passphrase
                </label>
                <input
                  id="signinPass"
                  type="password"
                  autoComplete="current-password"
                  aria-required="true"
                  placeholder="the phrase only you know"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
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
                aria-label="enter"
                style={{ ...sendButtonStyles, marginTop: "24px" }}
                onMouseEnter={onPrimaryEnter}
                onMouseLeave={onPrimaryLeave}
              >
                {isLoading ? "..." : "enter"}
              </button>
            </form>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setView("emailcode");
                  setError("");
                }}
                style={linkButtonStyles}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
              >
                sign in with email code
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("forgot");
                  setError("");
                }}
                style={linkButtonStyles}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
              >
                forgot your passphrase?
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
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
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
                style={{ ...sendButtonStyles, marginTop: "24px" }}
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
            <h1 style={headingStyles}>check your email.</h1>
            <p style={subStyles}>
              we sent a code to <span style={{ color: "#FFFDFD" }}>{email}</span>
            </p>

            <form onSubmit={handleVerify} aria-label="verify your code" className="space-y-6">
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
                style={sendButtonStyles}
                onMouseEnter={onPrimaryEnter}
                onMouseLeave={onPrimaryLeave}
              >
                {isLoading ? "verifying..." : "verify"}
              </button>

              {showResend ? (
                <button
                  type="button"
                  onClick={handleResendCode}
                  aria-label="resend verification code"
                  className="w-full transition-colors"
                  style={{ ...linkButtonStyles }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  resend code
                </button>
              ) : (
                <p
                  aria-live="polite"
                  style={{ fontSize: "11px", color: "#444", textAlign: "center", margin: 0 }}
                >
                  code sent
                </p>
              )}

              <button
                type="button"
                onClick={goToSignin}
                style={{ ...linkButtonStyles, color: "#333", marginTop: "12px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
              >
                back to sign in
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
                      style={inputStyles}
                      onFocus={onInputFocus}
                      onBlur={onInputBlur}
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
                    style={{ ...sendButtonStyles, marginTop: "24px" }}
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

      {/* Footer */}
      <footer
        className="fixed bottom-0 left-0 right-0 text-center"
        style={{ padding: "20px 0 24px", marginTop: "28px" }}
      >
        <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.8, margin: 0 }}>
          we never sell your data. your synthesis is yours.
        </p>
        <Link
          href="/privacy"
          className="transition-all hover:underline"
          style={{ fontSize: "10px", color: stellarColor, lineHeight: 1.8, textDecoration: "none" }}
        >
          read our privacy policy
        </Link>
      </footer>
    </main>
  );
}
