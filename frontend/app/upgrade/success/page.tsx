"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stellarColor, setStellarColor] = useState("#5599FF");

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) setStellarColor(stored);
    setMounted(true);

    // Redirect to constellation after 5 seconds
    const timeout = setTimeout(() => {
      router.push("/dashboard/constellation");
    }, 5000);

    return () => clearTimeout(timeout);
  }, [router]);

  if (!mounted) return null;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background: "#0A0A0A",
        color: "#FFFDFD",
        "--color-stellar": stellarColor,
      } as React.CSSProperties}
    >
      {/* Success Icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{
          background: `radial-gradient(circle, ${stellarColor}20 0%, transparent 70%)`,
          boxShadow: `0 0 60px ${stellarColor}30`,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke={stellarColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: 300, marginBottom: "8px", textAlign: "center" }}>
        welcome to the expanded universe
      </h1>
      <p style={{ fontSize: "13px", color: "#666", marginBottom: "32px", textAlign: "center", maxWidth: "400px" }}>
        your subscription is now active. prepare to explore deeper dimensions of self-discovery.
      </p>

      <Link
        href="/dashboard/constellation"
        className="px-8 py-3 rounded-lg text-sm transition-all"
        style={{
          background: "transparent",
          border: `0.5px solid ${stellarColor}`,
          color: stellarColor,
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
        enter your constellation
      </Link>

      <p style={{ fontSize: "10px", color: "#444", marginTop: "24px" }}>
        redirecting automatically in 5 seconds...
      </p>
    </main>
  );
}
