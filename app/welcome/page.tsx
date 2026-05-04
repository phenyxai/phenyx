"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getRandomStellarColor } from "@/lib/stellar";

export default function WelcomePage() {
  const router = useRouter();
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get or generate stellar color - use same key as join/signin pages
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
    } else {
      const color = getRandomStellarColor();
      setStellarColor(color);
      localStorage.setItem("phenyx_stellar_color", color);
    }
    setMounted(true);
  }, []);

  const handleContinue = () => {
    router.push("/onboarding");
  };

  if (!mounted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#050505",
        }}
      />
    );
  }

  return (
    <main
      className="animate-fade-in"
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
        <Link href="/" aria-label="Go to homepage" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image
            src="/phenyx-logo.png"
            alt="PHENYX"
            width={20}
            height={20}
            style={{ opacity: 0.9 }}
          />
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.08em", fontWeight: 300 }}>
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
        {/* Pulsing star */}
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: stellarColor,
            boxShadow: `0 0 20px ${stellarColor}, 0 0 40px color-mix(in srgb, ${stellarColor} 50%, transparent)`,
            animation: "pulse 3s ease-in-out infinite",
          }}
        />

        {/* Welcome text */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 300,
              color: "#FFFDFD",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            welcome to the collective
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
            your star is now part of the constellation.
            <br />
            let&apos;s set up your presence.
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
            transition: "all 0.2s ease",
            fontFamily: "inherit",
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
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </main>
  );
}
