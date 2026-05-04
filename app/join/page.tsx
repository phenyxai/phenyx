"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getRandomStellarColor } from "@/lib/stellar";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

type AuthMethod = "email" | "phone" | null;
type FormState = "initial" | "input" | "otp";

export default function JoinPage() {
  const router = useRouter();
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [formState, setFormState] = useState<FormState>("initial");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      const color = getRandomStellarColor();
      setStellarColor(color);
      localStorage.setItem("phenyx_stellar_color", color);
      document.documentElement.style.setProperty("--color-stellar", color);
    }
  }, []);

  useEffect(() => {
    if (formState === "otp") {
      setShowResend(false);
      const timer = setTimeout(() => setShowResend(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [formState]);

  const handleMethodSelect = (method: AuthMethod) => {
    setAuthMethod(method);
    setFormState("input");
    setError("");
  };

  const handleSwitchMethod = () => {
    const newMethod = authMethod === "email" ? "phone" : "email";
    setOtp("");
    if (authMethod === "email") {
      setEmail("");
    } else {
      setPhone("");
    }
    setAuthMethod(newMethod);
    setFormState("input");
    setError("");
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (authMethod === "email" && !email.trim()) {
      setError("please enter your email");
      setIsLoading(false);
      return;
    }

    if (authMethod === "phone" && !phone.trim()) {
      setError("please enter your phone number");
      setIsLoading(false);
      return;
    }

    try {
      localStorage.setItem("phenyx_stellar_color", stellarColor);

      // CAPTCHA FIX: To resolve "captcha verification process failed":
      // 1. Go to Supabase Dashboard → Authentication → Settings
      // 2. Under "Bot and Abuse Protection", disable captcha OR
      // 3. Implement hCaptcha/Turnstile and pass the token here
      if (authMethod === "email") {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        });

        if (signInError) {
          // Provide user-friendly message for captcha errors
          if (signInError.message.toLowerCase().includes("captcha")) {
            setError("verification service unavailable. please try again later.");
            console.error("[v0] Captcha error - disable captcha in Supabase Dashboard > Authentication > Settings");
          } else {
            setError(signInError.message);
          }
          setIsLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          phone: phone.trim(),
        });

        if (signInError) {
          // Provide user-friendly message for captcha errors
          if (signInError.message.toLowerCase().includes("captcha")) {
            setError("verification service unavailable. please try again later.");
            console.error("[v0] Captcha error - disable captcha in Supabase Dashboard > Authentication > Settings");
          } else {
            setError(signInError.message);
          }
          setIsLoading(false);
          return;
        }
      }

      setFormState("otp");
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
      if (authMethod === "email") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "email"
        });
        
        if (error) {
          setError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.user) {
          await supabase.from("user_profiles").upsert({
            id: data.user.id,
            stellar_color: localStorage.getItem("phenyx_stellar_color") ?? "#5599FF",
            constellation_age: 0,
            tier: "free",
            experience_mode: "reflection"
          }, { onConflict: "id" });
        }
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phone.trim(),
          token: otp.trim(),
          type: "sms"
        });
        
        if (error) {
          setError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.user) {
          await supabase.from("user_profiles").upsert({
            id: data.user.id,
            stellar_color: localStorage.getItem("phenyx_stellar_color") ?? "#5599FF",
            constellation_age: 0,
            tier: "free",
            experience_mode: "reflection"
          }, { onConflict: "id" });
        }
      }

      // navigation happens here regardless of whether upsert succeeded
      router.push("/welcome");

    } catch (err) {
      setError("something went wrong. please try again.");
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setShowResend(false);
    setError("");

    try {
      if (authMethod === "email") {
        const { error: resendError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        });

        if (resendError) {
          if (resendError.message.toLowerCase().includes("captcha")) {
            setError("verification service unavailable. please try again later.");
          } else {
            setError(resendError.message);
          }
        }
      } else {
        const { error: resendError } = await supabase.auth.signInWithOtp({
          phone: phone.trim(),
        });

        if (resendError) {
          if (resendError.message.toLowerCase().includes("captcha")) {
            setError("verification service unavailable. please try again later.");
          } else {
            setError(resendError.message);
          }
        }
      }

      setTimeout(() => setShowResend(true), 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to resend code");
    }
  };

  const cardStyle = {
    background: "#0A0A0A",
    border: "0.5px solid #1a1a1a",
    borderRadius: "16px",
    padding: "36px 32px",
    maxWidth: "400px",
    width: "100%",
  };

  const methodButtonStyles: React.CSSProperties = {
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
    border: "0.5px solid #222",
    color: "#666",
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
              opacity: 0.9 
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
        <h1 
          style={{ 
            fontSize: "24px", 
            fontWeight: 400, 
            color: "#FFFDFD",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            marginBottom: "8px"
          }}
        >
          who are you?
        </h1>
        <p 
          style={{ 
            fontSize: "13px", 
            fontWeight: 300, 
            color: "#555",
            lineHeight: 1.7,
            marginBottom: "28px"
          }}
        >
          before we map the stars, we need to find you.
        </p>

        {formState === "otp" ? (
          <form onSubmit={handleVerify} aria-label="verify your code" className="space-y-6">
            <p style={{ fontSize: "13px", color: "#777", textAlign: "center" }}>
              we sent a code to <span style={{ color: "#FFFDFD" }}>{authMethod === "email" ? email : phone}</span>
            </p>

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
                  background: "transparent !important",
                  border: "none !important",
                  borderBottom: "1px solid #2a2a2a",
                  borderRadius: "0 !important",
                  color: "#FFFDFD",
                  fontSize: "28px",
                  letterSpacing: "0.5em",
                  textAlign: "center",
                  width: "220px",
                  padding: "0 0 8px 0 !important",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => e.target.style.borderBottomColor = stellarColor}
                onBlur={(e) => e.target.style.borderBottomColor = "#2a2a2a"}
              />
            </div>

            <div 
              role="alert" 
              aria-live="polite"
              style={{ minHeight: "20px", marginTop: "8px" }}
            >
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

            {showResend && (
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
                onMouseEnter={(e) => e.currentTarget.style.color = "#FFFDFD"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
              >
                resend code
              </button>
            )}

            <button
              type="button"
              onClick={handleSwitchMethod}
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
              onMouseEnter={(e) => e.currentTarget.style.color = "#555"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#333"}
            >
              {authMethod === "email" ? "use my phone number instead" : "use my email instead"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendCode} aria-label="create your account">
            {/* Method buttons - show immediately, no name field */}
            <div 
              className="flex flex-col"
              style={{ 
                gap: "10px",
                opacity: authMethod ? 0.4 : 1, 
                transition: "opacity 0.3s ease" 
              }}
            >
              <button
                type="button"
                onClick={() => handleMethodSelect("email")}
                aria-label="continue with my email address"
                style={methodButtonStyles}
                onMouseEnter={(e) => {
                  if (!authMethod) {
                    e.currentTarget.style.borderColor = stellarColor;
                    e.currentTarget.style.color = "#FFFDFD";
                    e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${stellarColor} 10%, transparent)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#222";
                  e.currentTarget.style.color = "#666";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                continue with my email
              </button>
              <button
                type="button"
                onClick={() => handleMethodSelect("phone")}
                aria-label="continue with my phone number"
                style={methodButtonStyles}
                onMouseEnter={(e) => {
                  if (!authMethod) {
                    e.currentTarget.style.borderColor = stellarColor;
                    e.currentTarget.style.color = "#FFFDFD";
                    e.currentTarget.style.boxShadow = `0 0 20px color-mix(in srgb, ${stellarColor} 10%, transparent)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#222";
                  e.currentTarget.style.color = "#666";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                continue with my phone number
              </button>
            </div>

            {/* Sliding input for email */}
            {authMethod === "email" && formState === "input" && (
              <div 
                className="animate-fade-in"
                style={{ marginTop: "20px" }}
              >
                <label 
                  htmlFor="email" 
                  style={{ 
                    display: "block", 
                    fontSize: "11px", 
                    letterSpacing: "0.04em",
                    color: "#888",
                    marginBottom: "8px"
                  }}
                >
                  email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  placeholder="your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  style={inputStyles}
                  onFocus={(e) => {
                    e.target.style.borderColor = stellarColor;
                    e.target.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${stellarColor} 8%, transparent)`;
                    e.target.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#1e1e1e";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            )}

            {/* Sliding input for phone */}
            {authMethod === "phone" && formState === "input" && (
              <div 
                className="animate-fade-in"
                style={{ marginTop: "20px" }}
              >
                <label 
                  htmlFor="phone" 
                  style={{ 
                    display: "block", 
                    fontSize: "11px", 
                    letterSpacing: "0.04em",
                    color: "#888",
                    marginBottom: "8px"
                  }}
                >
                  phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  aria-required="true"
                  placeholder="+1 555 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  style={inputStyles}
                  onFocus={(e) => {
                    e.target.style.borderColor = stellarColor;
                    e.target.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${stellarColor} 8%, transparent)`;
                    e.target.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#1e1e1e";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <p style={{ fontSize: "10px", color: "#444", marginTop: "8px" }}>
                  standard message rates may apply.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" aria-live="polite" style={{ fontSize: "11px", color: "#E84422", marginTop: "16px" }}>
                {error}
              </p>
            )}

            {/* Send button only shows after method selected */}
            {authMethod && formState === "input" && (
              <button
                type="submit"
                disabled={isLoading}
                aria-label="send verification code"
                style={{ ...sendButtonStyles, marginTop: "16px" }}
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
                {isLoading ? "sending..." : "send my code"}
              </button>
            )}
          </form>
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
          style={{ fontSize: "10px", color: stellarColor, lineHeight: 1.8, textDecoration: "none" }}
        >
          read our privacy policy
        </Link>
      </footer>
    </main>
  );
}
