"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";

type BillingPeriod = "monthly" | "yearly";

/** Display prices align with Stripe products (yearly billed once as $192). */
const PRICING = {
  pro: { monthly: 20, yearly: 192 },
  gift: 75,
};

export default function UpgradePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");
  const [currentTier, setCurrentTier] = useState("free");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) setStellarColor(stored);
    setMounted(true);

    const fetchTier = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("tier")
          .eq("id", user.id)
          .single();
        if (profile) setCurrentTier(profile.tier);
      }
    };
    fetchTier();
  }, []);

  const checkout = async (checkoutKind: "pro" | "gift") => {
    setIsLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/signin");
        return;
      }

      const body: Record<string, unknown> = {
        checkoutKind,
        userId: user.id,
      };
      if (checkoutKind === "pro") {
        body.billingPeriod = billingPeriod;
      }

      const response = await apiFetch("/stripe/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = (await response.json()) as { url?: string | null };

      if (url) {
        window.location.assign(url);
        return;
      }

      setError("Checkout could not be started. Try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main
      className="min-h-screen flex flex-col"
      style={
        {
          background: "#0A0A0A",
          color: "#FFFDFD",
          "--color-stellar": stellarColor,
        } as React.CSSProperties
      }
    >
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          href="/constellation"
          className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
        >
          <Image src="/phenyx-logo.png" alt="PHENYX" width={20} height={20} />
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
        <Link
          href="/constellation"
          style={{ fontSize: "11px", color: "#555" }}
          className="hover:text-white transition-colors"
        >
          back to constellation
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 300,
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          expand your universe
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "#666",
            marginBottom: "32px",
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          one pro membership unlocks full access. choose monthly, pay yearly and save, or gift a constellation to
          someone else.
        </p>

        <div
          className="flex items-center gap-2 p-1 rounded-full mb-8"
          style={{ background: "#111", border: "0.5px solid #1e1e1e" }}
        >
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className="px-4 py-2 rounded-full text-xs transition-all"
            style={{
              background: billingPeriod === "monthly" ? "#1a1a1a" : "transparent",
              color: billingPeriod === "monthly" ? "#FFFDFD" : "#666",
            }}
          >
            monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("yearly")}
            className="px-4 py-2 rounded-full text-xs transition-all flex items-center gap-2"
            style={{
              background: billingPeriod === "yearly" ? "#1a1a1a" : "transparent",
              color: billingPeriod === "yearly" ? "#FFFDFD" : "#666",
            }}
          >
            yearly
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: stellarColor, color: "#0A0A0A", fontSize: "9px" }}
            >
              save vs month-by-month
            </span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl">
          {/* Free */}
          <div
            className="flex-1 p-6 rounded-2xl"
            style={{
              background: "#0E0E0E",
              border: currentTier === "free" ? `1px solid ${stellarColor}` : "0.5px solid #1e1e1e",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>reflection</h3>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "16px" }}>free forever</p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              $0<span style={{ fontSize: "12px", color: "#555" }}>/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "1 daily reflection prompt",
                "7 pillar framework",
                "basic constellation view",
                "30-day history",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "#888" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "free" && (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "#1a1a1a", color: "#666" }}
              >
                current plan
              </div>
            )}
          </div>

          {/* Pro */}
          <div
            className="flex-1 p-6 rounded-2xl relative"
            style={{
              background: "#0E0E0E",
              border: currentTier === "pro" ? `1px solid ${stellarColor}` : "0.5px solid #1e1e1e",
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs"
              style={{ background: stellarColor, color: "#0A0A0A" }}
            >
              pro
            </div>
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>pro</h3>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "16px" }}>
              full access · signal & observatory experience modes in settings
            </p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              $
              {billingPeriod === "yearly"
                ? Math.round(PRICING.pro.yearly / 12)
                : PRICING.pro.monthly}
              <span style={{ fontSize: "12px", color: "#555" }}>/month</span>
              {billingPeriod === "yearly" && (
                <span style={{ fontSize: "11px", color: "#555", display: "block", marginTop: "4px" }}>
                  ${PRICING.pro.yearly} billed once for the year
                </span>
              )}
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "two reflections per session",
                "source signals behind constellation points",
                "faster constellation development",
                "signal & observatory modes (in settings)",
                "manage subscription (monthly) from settings",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "#FFFDFD" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stellarColor} strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "pro" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "#1a1a1a", color: "#666" }}
              >
                current plan
              </div>
            ) : currentTier === "gifted" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "#1a1a1a", color: "#666" }}
              >
                gifted constellation already includes pro access
              </div>
            ) : (
              <button
                type="button"
                onClick={() => checkout("pro")}
                disabled={isLoading}
                className="w-full py-3 rounded-lg text-xs transition-all"
                style={{
                  background: stellarColor,
                  border: `0.5px solid ${stellarColor}`,
                  color: "#0A0A0A",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = stellarColor;
                  e.currentTarget.style.borderColor = stellarColor;
                }}
              >
                {isLoading ? "loading..." : "subscribe to pro"}
              </button>
            )}
          </div>

          {/* Gift */}
          <div
            className="flex-1 p-6 rounded-2xl"
            style={{
              background: "#0E0E0E",
              border: currentTier === "gifted" ? `1px solid ${stellarColor}` : "0.5px solid #1e1e1e",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>gifted constellation</h3>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "16px" }}>one-time · full pro access</p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              ${PRICING.gift}
              <span style={{ fontSize: "12px", color: "#555" }}> once</span>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "same full access as pro",
                "no recurring charge",
                "perfect as a gift",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "#FFFDFD" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stellarColor} strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "gifted" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "#1a1a1a", color: "#666" }}
              >
                you have gifted access
              </div>
            ) : (
              <button
                type="button"
                onClick={() => checkout("gift")}
                disabled={isLoading}
                className="w-full py-3 rounded-lg text-xs transition-all"
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
                {isLoading ? "loading..." : `buy gifted constellation · $${PRICING.gift}`}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: "11px", color: "#E84422", marginTop: "16px", textAlign: "center" }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: "11px", color: "#444", marginTop: "40px", textAlign: "center" }}>
          signal and observatory are experience styles in{" "}
          <Link href="/settings" style={{ color: stellarColor }} className="hover:underline">
            settings
          </Link>
          {" — available on pro or gifted constellation."}
        </p>

        <p style={{ fontSize: "11px", color: "#444", marginTop: "16px", textAlign: "center" }}>
          questions? read our{" "}
          <Link href="/faq" style={{ color: stellarColor }} className="hover:underline">
            frequently asked questions
          </Link>
        </p>
      </div>
    </main>
  );
}
