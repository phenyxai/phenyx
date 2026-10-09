"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchProfile } from "@/lib/api-client";
import { BRAND_BLUE, colorName, hexToRgb } from "@/lib/stellar";

/**
 * s3 — the stellar color reveal. The color is the account's persisted, immutable
 * identity (server-assigned in PHE-13); this screen only reads and reveals it.
 * The orb animates in, then the copy staggers — unless the visitor prefers
 * reduced motion, in which case the orb + copy appear at once with no stagger.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [stellarColor, setStellarColor] = useState(BRAND_BLUE);
  const [firstName, setFirstName] = useState("traveler");
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Reveal stages: 0 = nothing, 1 = orb, 2 = copy + button.
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = mq.matches;
    setReduceMotion(reduce);

    const applyColor = (color: string) => {
      setStellarColor(color);
      const root = document.documentElement;
      root.style.setProperty("--s", color);
      root.style.setProperty("--s-rgb", hexToRgb(color));
    };

    // Paint the last-known color immediately to avoid a flash, then reconcile
    // against the authoritative persisted profile.
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) applyColor(stored);

    fetchProfile()
      .then((profile) => {
        if (profile?.stellar_color) {
          applyColor(profile.stellar_color);
          localStorage.setItem("phenyx_stellar_color", profile.stellar_color);
        }
        if (profile?.display_name) {
          setFirstName(profile.display_name.split(" ")[0]);
        }
      })
      .catch(() => {
        // Best-effort: keep the stored/default color and generic name.
      });

    setMounted(true);

    if (reduce) {
      // No stagger — reveal everything at once.
      setStage(2);
      return;
    }
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleContinue = () => {
    // s3 welcome → onboarding. The onboarding page self-routes via the persisted
    // onboarding_step (defaulting to the s3b fork when unset), so we just hand
    // off to /onboarding here — no step is set on this side. (PHE-14)
    router.push("/onboarding");
  };

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "var(--black)" }} />;
  }

  // Reduced motion gets no transition/translate; full motion fades + lifts in.
  const orbVisible = stage >= 1;
  const copyVisible = stage >= 2;
  const transition = reduceMotion ? "none" : "opacity 0.7s ease, transform 0.7s ease";

  return (
    <main
      className={`onb-v67${reduceMotion ? "" : " animate-fade-in"}`}
      style={{
        minHeight: "100vh",
        background: "var(--black)",
        position: "relative",
      }}
    >
      {/* Topbar */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "10px",
          padding: "20px 24px",
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          aria-label="Go to homepage"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
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
              color: "rgba(var(--white-rgb), 0.38)",
              letterSpacing: "0.08em",
              fontWeight: 300,
            }}
          >
            PHENYX
          </span>
        </Link>
      </header>

      <div className="onb-block onb-block--welcome">
        <div className="onb-welcome-body">
          {/* The assigned color, revealed as a glowing orb. */}
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "var(--s)",
              boxShadow: "0 0 24px var(--s), 0 0 48px rgba(var(--s-rgb), 0.5)",
              opacity: orbVisible ? 1 : 0,
              transform: orbVisible ? "scale(1)" : "scale(0.6)",
              transition,
              animation: reduceMotion ? undefined : "pulse 3s ease-in-out infinite",
            }}
          />

          {/* Welcome copy — staggers in after the orb (or appears at once on RM). */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              opacity: copyVisible ? 1 : 0,
              transform: copyVisible || reduceMotion ? "translateY(0)" : "translateY(8px)",
              transition,
            }}
          >
            <h1
              style={{
                fontSize: "21px",
                fontWeight: 300,
                color: "var(--white)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              welcome, <b style={{ fontWeight: 500 }}>{firstName}.</b>
            </h1>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 300,
                color: "rgba(var(--white-rgb), 0.38)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              your color is {colorName(stellarColor)}.
            </p>
          </div>
        </div>

        <button
          className="onb-action btn-primary"
          onClick={handleContinue}
          style={{
            border: "0.5px solid var(--s)",
            borderRadius: "10px",
            padding: "14px 32px",
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--s)",
            cursor: "pointer",
            transition: reduceMotion ? "none" : "all 0.2s ease",
            fontFamily: "inherit",
            width: "100%",
            opacity: copyVisible ? 1 : 0,
            pointerEvents: copyVisible ? "auto" : "none",
          }}
        >
          continue
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </main>
  );
}
