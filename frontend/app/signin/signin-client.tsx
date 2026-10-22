"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithGoogle } from "@/lib/supabase-browser";
import { AuthBrand, GoogleIcon, TermsLine } from "@/components/phenyx/auth-chrome";

// PHE-97 / PHE-129: sign-in is google only ("come in."). Google creates the
// account on a first visit, so there is no separate sign-up; /join redirects
// here. A failed round trip comes back from /auth/callback with ?error=google.

const GOOGLE_ERROR = "google sign-in didn’t finish. please try again.";

export default function SignInClient() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [error, setError] = useState(searchParams.get("error") === "google" ? GOOGLE_ERROR : "");
  const [googleBusy, setGoogleBusy] = useState(false);

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

  return (
    <main className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-5 py-24">
      <header className="auth-topbar">
        <AuthBrand />
      </header>

      <section className="auth-flow" aria-labelledby="signin-title">
        <p className="auth-eyebrow auth-reveal" style={{ "--d": "80ms" } as React.CSSProperties}>
          welcome to PHENYX
        </p>
        <h1 id="signin-title" className="auth-h auth-reveal" style={{ "--d": "260ms" } as React.CSSProperties}>
          come in.
        </h1>
        <p className="auth-lede auth-reveal" style={{ "--d": "520ms" } as React.CSSProperties}>
          sign in with google to begin, or to return to the constellation you have already started.
        </p>

        <div className="auth-actions auth-reveal" style={{ "--d": "820ms" } as React.CSSProperties}>
          <button
            type="button"
            className="auth-brand-btn"
            data-ph-hover="off"
            onClick={handleGoogle}
            disabled={googleBusy}
            aria-busy={googleBusy}
          >
            <GoogleIcon />
            <span>{googleBusy ? "connecting to google…" : "continue with google"}</span>
          </button>
          {error && (
            <p role="alert" aria-live="polite" className="auth-error">
              {error}
            </p>
          )}
          <TermsLine />
        </div>
      </section>
    </main>
  );
}
