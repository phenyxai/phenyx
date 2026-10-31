"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// PHE-98: the accent comes from --ph-accent (brand blue since PHE-162).
const ACCENT = "var(--ph-accent)";

export default function UpgradeSuccessPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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
      style={{ background: "var(--ph-black)", color: "var(--ph-white)" }}
    >
      {/* Success Icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{
          background: "radial-gradient(circle, rgba(var(--ph-accent-rgb),0.125) 0%, transparent 70%)",
          boxShadow: "0 0 60px rgba(var(--ph-accent-rgb),0.19)",
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
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
      <p style={{ fontSize: "13px", color: "rgba(255,253,253,0.4)", marginBottom: "32px", textAlign: "center", maxWidth: "400px" }}>
        your subscription is now active. prepare to explore deeper dimensions of self-discovery.
      </p>

      <Link
        href="/dashboard/constellation"
        className="px-8 py-3 rounded-lg text-sm transition-all hover:bg-[rgba(var(--ph-accent-rgb),0.08)]"
        style={{
          border: `0.5px solid ${ACCENT}`,
          color: ACCENT,
        }}
      >
        enter your constellation
      </Link>

      <p style={{ fontSize: "10px", color: "rgba(255,253,253,0.27)", marginTop: "24px" }}>
        redirecting automatically in 5 seconds...
      </p>
    </main>
  );
}
