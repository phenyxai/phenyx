"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { STELLAR_DEFAULT } from "@/lib/stellar";
import { passphraseResetConfirm } from "@/lib/api-client";

// form = enter a new passphrase. done = it's set, sign in again. The token comes
// from the emailed link (?token=...); a missing/rejected token shows one generic
// "invalid or expired" message — the old passphrase stays unrecoverable, no hint.
type View = "form" | "done";

export default function ResetClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [view, setView] = useState<View>("form");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
      document.documentElement.style.setProperty("--color-stellar", stored);
    } else {
      // Pre-auth: no persisted identity yet. Use the deterministic default accent
      // (not random) rather than inventing an identity color on the client.
      setStellarColor(STELLAR_DEFAULT);
      document.documentElement.style.setProperty("--color-stellar", STELLAR_DEFAULT);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("this reset link is invalid or has expired.");
      return;
    }
    const next = newPassphrase.trim();
    if (next.length < 8) {
      setError("your passphrase needs at least 8 characters");
      return;
    }
    if (next !== confirmPassphrase.trim()) {
      setError("those passphrases don't match");
      return;
    }

    setIsLoading(true);
    try {
      const result = await passphraseResetConfirm({ token, newPassphrase: next });
      if (result.ok) {
        setNewPassphrase("");
        setConfirmPassphrase("");
        setView("done");
        return;
      }
      // Rejected token (invalid / expired / already used) — one generic outcome.
      setError("this reset link is invalid or has expired.");
      setIsLoading(false);
    } catch {
      setError("something went wrong. please try again.");
      setIsLoading(false);
    }
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

  const inputStyles: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #1a1a1a",
    borderRadius: 0,
    padding: "8px 0",
    color: "#FFFDFD",
    fontSize: "14px",
    fontWeight: 300,
    lineHeight: 1.5,
    transition: "border-color 0.2s ease",
  };

  const labelStyles: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    letterSpacing: "0.13em",
    color: "rgba(255,253,253,.5)",
    textTransform: "uppercase",
    marginBottom: "6px",
  };

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderBottomColor = stellarColor;
    e.target.style.outline = "none";
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderBottomColor = "#1a1a1a";
  };

  return (
    <main className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 animate-fade-in">
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
      </header>

      {/* Card */}
      <div style={cardStyle}>
        {view === "done" ? (
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
              passphrase updated.
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
              your old passphrase no longer works. sign in with your new one.
            </p>
            <Link href="/signin" aria-label="go to sign in" style={{ textDecoration: "none" }}>
              <span
                style={{
                  ...sendButtonStyles,
                  display: "block",
                  boxSizing: "border-box",
                }}
              >
                sign in
              </span>
            </Link>
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
              set a new passphrase.
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
              choose something only you would know. you&apos;ll use it with your
              name to return.
            </p>

            <form onSubmit={handleSubmit} aria-label="set a new passphrase">
              <div>
                <label htmlFor="newPassphrase" style={labelStyles}>
                  new passphrase
                </label>
                <input
                  id="newPassphrase"
                  type="password"
                  autoComplete="new-password"
                  aria-required="true"
                  placeholder="a phrase or line that means something to you"
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  autoFocus
                  style={inputStyles}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              <div style={{ marginTop: "18px" }}>
                <label htmlFor="confirmPassphrase" style={labelStyles}>
                  confirm passphrase
                </label>
                <input
                  id="confirmPassphrase"
                  type="password"
                  autoComplete="new-password"
                  aria-required="true"
                  placeholder="type it once more"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
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
                aria-label="set passphrase"
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
                {isLoading ? "..." : "set passphrase"}
              </button>
            </form>
          </>
        )}
      </div>

    </main>
  );
}
