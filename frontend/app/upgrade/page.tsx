"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";
import { V67_PRICING } from "@/lib/billing";

type BillingPeriod = "monthly" | "yearly";

// PHE-98: the accent comes from --ph-accent (brand blue since PHE-162).
const ACCENT = "var(--ph-accent)";

export default function UpgradePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");
  const [currentTier, setCurrentTier] = useState("free");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
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

      setError("checkout could not be started. please try again.");
    } catch {
      setError("something went wrong. please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--ph-black)", color: "var(--ph-white)" }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          href="/dashboard/constellation"
          className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
        >
          <Image src="/phenyx-logo.png" alt="PHENYX" width={20} height={20} />
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255,253,253,0.4)",
              letterSpacing: "0.08em",
              fontWeight: 300,
            }}
          >
            PHENYX
          </span>
        </Link>
        <Link
          href="/dashboard/constellation"
          style={{ fontSize: "11px", color: "rgba(255,253,253,0.33)" }}
          className="transition-colors"
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
            color: "rgba(255,253,253,0.4)",
            marginBottom: "32px",
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          one full membership unlocks everything. choose monthly, pay yearly and save, or gift a constellation to
          someone.
        </p>

        <div
          className="flex items-center gap-2 p-1 rounded-full mb-8"
          style={{ background: "rgba(255,253,253,0.04)", border: "0.5px solid rgba(255,253,253,0.1)" }}
        >
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className="px-4 py-2 rounded-full text-xs transition-all"
            style={{
              background: billingPeriod === "monthly" ? "rgba(var(--ph-accent-rgb),0.08)" : "transparent",
              border: `0.5px solid ${billingPeriod === "monthly" ? ACCENT : "transparent"}`,
              color: billingPeriod === "monthly" ? ACCENT : "rgba(255,253,253,0.4)",
            }}
          >
            monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("yearly")}
            className="px-4 py-2 rounded-full text-xs transition-all flex items-center gap-2"
            style={{
              background: billingPeriod === "yearly" ? "rgba(var(--ph-accent-rgb),0.08)" : "transparent",
              border: `0.5px solid ${billingPeriod === "yearly" ? ACCENT : "transparent"}`,
              color: billingPeriod === "yearly" ? ACCENT : "rgba(255,253,253,0.4)",
            }}
          >
            yearly
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: ACCENT, color: "var(--ph-black)", fontSize: "9px" }}
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
              background: "rgba(255,253,253,0.02)",
              border: currentTier === "free" ? `1px solid ${ACCENT}` : "0.5px solid rgba(255,253,253,0.1)",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>free</h3>
            <p style={{ fontSize: "11px", color: "rgba(255,253,253,0.33)", marginBottom: "16px" }}>free forever</p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              $0<span style={{ fontSize: "12px", color: "rgba(255,253,253,0.33)" }}>/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "every point and moment, with what happened and its sources",
                "the whole insights page",
                "7 new discoveries a week",
                "30 polaris points a month and past conversations",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "rgba(255,253,253,0.53)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,253,253,0.33)" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "free" && (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(255,253,253,0.07)", color: "rgba(255,253,253,0.4)" }}
              >
                current plan
              </div>
            )}
          </div>

          {/* Full (tier id stays `pro`) */}
          <div
            className="flex-1 p-6 rounded-2xl relative"
            style={{
              background: "rgba(255,253,253,0.02)",
              border: currentTier === "pro" ? `1px solid ${ACCENT}` : "0.5px solid rgba(255,253,253,0.1)",
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs"
              style={{ background: ACCENT, color: "var(--ph-black)" }}
            >
              full
            </div>
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>full</h3>
            <p style={{ fontSize: "11px", color: "rgba(255,253,253,0.33)", marginBottom: "16px" }}>
              full access
            </p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              {billingPeriod === "yearly" ? (
                <>
                  ${V67_PRICING.yearly.toFixed(2)}
                  <span style={{ fontSize: "12px", color: "rgba(255,253,253,0.33)" }}>/year</span>
                </>
              ) : (
                <>
                  $12.99
                  <span style={{ fontSize: "12px", color: "rgba(255,253,253,0.33)" }}>/month</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,253,253,0.33)", display: "block", marginTop: "4px" }}>
                    or ${V67_PRICING.yearly.toFixed(2)}/year, {V67_PRICING.annualDiscountPercent}% off
                  </span>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "why each moment matters and what it connects to",
                "300 polaris points a month",
                "questions to return to",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "var(--ph-white)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "pro" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(255,253,253,0.07)", color: "rgba(255,253,253,0.4)" }}
              >
                current plan
              </div>
            ) : currentTier === "gifted" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(255,253,253,0.07)", color: "rgba(255,253,253,0.4)" }}
              >
                your gifted constellation already includes full access
              </div>
            ) : (
              <button
                type="button"
                onClick={() => checkout("pro")}
                disabled={isLoading}
                data-ph-hover="off"
                className="w-full py-3 rounded-lg text-xs transition-all hover:opacity-90"
                style={{
                  background: ACCENT,
                  border: `0.5px solid ${ACCENT}`,
                  color: "var(--ph-black)",
                }}
              >
                {isLoading
                  ? "loading..."
                  : billingPeriod === "yearly"
                    ? `continue with full, $${V67_PRICING.yearly.toFixed(2)}/year`
                    : "continue with full, $12.99/month"}
              </button>
            )}
          </div>

          {/* Grandfathered gifted grant — v67 does not sell new gifted plans. */}
          {currentTier === "gifted" && (
          <div
            className="flex-1 p-6 rounded-2xl"
            style={{
              background: "rgba(255,253,253,0.02)",
              border: `1px solid ${ACCENT}`,
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>full</h3>
            <p style={{ fontSize: "11px", color: "rgba(255,253,253,0.33)", marginBottom: "16px" }}>
              your account already has full access
            </p>
            <div
              className="w-full py-3 rounded-lg text-center text-xs"
              style={{ background: "rgba(255,253,253,0.07)", color: "rgba(255,253,253,0.4)" }}
            >
              current plan
            </div>
          </div>
          )}
        </div>

        {error && (
          <p style={{ fontSize: "11px", color: "var(--ph-red)", marginTop: "16px", textAlign: "center" }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: "11px", color: "rgba(255,253,253,0.27)", marginTop: "40px", textAlign: "center" }}>
          questions? read our{" "}
          <Link href="/faq" style={{ color: ACCENT }} className="hover:underline">
            frequently asked questions
          </Link>
        </p>
      </div>
    </main>
  );
}
