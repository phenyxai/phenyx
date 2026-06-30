"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchProfile } from "@/lib/api-client";
import { STELLAR_DEFAULT, colorName, hexToRgb } from "@/lib/stellar";

/**
 * s3 — the stellar color reveal. The color is the account's persisted, immutable
 * identity (server-assigned in PHE-13); this screen only reads and reveals it.
 * The orb animates in, then the copy staggers — unless the visitor prefers
 * reduced motion, in which case the orb + copy appear at once with no stagger.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [stellarColor, setStellarColor] = useState(STELLAR_DEFAULT);
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
      root.style.setProperty("--color-stellar", color);
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
    return <div style={{ minHeight: "100vh", background: "#050505" }} />;
  }

  // Reduced motion gets no transition/translate; full motion fades + lifts in.
  const orbVisible = stage >= 1;
  const copyVisible = stage >= 2;
  const transition = reduceMotion ? "none" : "opacity 0.7s ease, transform 0.7s ease";

  return (
    <main
      className={reduceMotion ? undefined : "animate-fade-in"}
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
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
          justifyContent: "center",
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
              color: "#666",
              letterSpacing: "0.08em",
              fontWeight: 300,
            }}
          >
            PHENYX COLLECTIVE
          </span>
        </Link>
      </header>

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "48px",
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* The assigned color, revealed as a glowing orb. */}
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: stellarColor,
            boxShadow: `0 0 24px ${stellarColor}, 0 0 48px color-mix(in srgb, ${stellarColor} 50%, transparent)`,
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
              fontSize: "24px",
              fontWeight: 300,
              color: "#FFFDFD",
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
              color: "#666",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            this is your color. the {colorName(stellarColor)} represents you.
          </p>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          style={{
            background: "transparent",
            border: `0.5px solid ${stellarColor}`,
            borderRadius: "10px",
            padding: "14px 32px",
            fontSize: "13px",
            fontWeight: 400,
            color: stellarColor,
            cursor: "pointer",
            transition: reduceMotion ? "none" : "all 0.2s ease",
            fontFamily: "inherit",
            opacity: copyVisible ? 1 : 0,
            pointerEvents: copyVisible ? "auto" : "none",
          }}
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
          i&apos;m ready
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
