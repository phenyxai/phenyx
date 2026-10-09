"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";

type BillingPeriod = "monthly" | "yearly";

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
      style={
        {
          background: "var(--black)",
          color: "var(--white)",
        } as React.CSSProperties
      }
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
              color: "rgba(var(--white-rgb), 0.38)",
              letterSpacing: "0.08em",
              fontWeight: 300,
            }}
          >
            PHENYX
          </span>
        </Link>
        <Link
          href="/dashboard/constellation"
          style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.32)" }}
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
            color: "rgba(var(--white-rgb), 0.38)",
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
          style={{ background: "rgba(var(--white-rgb), 0.03)", border: "0.5px solid rgba(var(--white-rgb), 0.08)" }}
        >
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className="px-4 py-2 rounded-full text-xs transition-all"
            style={{
              background: billingPeriod === "monthly" ? "rgba(var(--white-rgb), 0.065)" : "transparent",
              color: billingPeriod === "monthly" ? "var(--white)" : "rgba(var(--white-rgb), 0.38)",
            }}
          >
            monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("yearly")}
            className="px-4 py-2 rounded-full text-xs transition-all flex items-center gap-2"
            style={{
              background: billingPeriod === "yearly" ? "rgba(var(--white-rgb), 0.065)" : "transparent",
              color: billingPeriod === "yearly" ? "var(--white)" : "rgba(var(--white-rgb), 0.38)",
            }}
          >
            yearly
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: "var(--s)", color: "var(--black)", fontSize: "9px" }}
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
              background: "rgba(var(--white-rgb), 0.015)",
              border: currentTier === "free" ? "1px solid var(--s)" : "0.5px solid rgba(var(--white-rgb), 0.08)",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>free</h3>
            <p style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.32)", marginBottom: "16px" }}>free forever</p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              $0<span style={{ fontSize: "12px", color: "rgba(var(--white-rgb), 0.32)" }}>/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "every observation of the day",
                "your seven-point constellation",
                "three polaris questions each week",
                "the span of time behind each observation",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "rgba(var(--white-rgb), 0.5)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--white-rgb), 0.32)" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "free" && (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(var(--white-rgb), 0.065)", color: "rgba(var(--white-rgb), 0.38)" }}
              >
                current plan
              </div>
            )}
          </div>

          {/* Full (tier id stays `pro`) */}
          <div
            className="flex-1 p-6 rounded-2xl relative"
            style={{
              background: "rgba(var(--white-rgb), 0.015)",
              border: currentTier === "pro" ? "1px solid var(--s)" : "0.5px solid rgba(var(--white-rgb), 0.08)",
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs"
              style={{ background: "var(--s)", color: "var(--black)" }}
            >
              full
            </div>
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>full</h3>
            <p style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.32)", marginBottom: "16px" }}>
              full access
            </p>
            <div style={{ fontSize: "32px", fontWeight: 300, marginBottom: "24px" }}>
              {billingPeriod === "yearly" ? (
                <>
                  $99
                  <span style={{ fontSize: "12px", color: "rgba(var(--white-rgb), 0.32)" }}>/year</span>
                </>
              ) : (
                <>
                  $12.99
                  <span style={{ fontSize: "12px", color: "rgba(var(--white-rgb), 0.32)" }}>/month</span>
                  <span style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.32)", display: "block", marginTop: "4px" }}>
                    or $99/year
                  </span>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-6">
              {[
                "every daily observation",
                "more polaris room each week",
                "a daily point to stay close to",
                "a weekly look at what shifted",
                "a yearly look across your timeline",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2" style={{ fontSize: "12px", color: "var(--white)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--s)" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "pro" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(var(--white-rgb), 0.065)", color: "rgba(var(--white-rgb), 0.38)" }}
              >
                current plan
              </div>
            ) : currentTier === "gifted" ? (
              <div
                className="w-full py-3 rounded-lg text-center text-xs"
                style={{ background: "rgba(var(--white-rgb), 0.065)", color: "rgba(var(--white-rgb), 0.38)" }}
              >
                your gifted constellation already includes full access
              </div>
            ) : (
              <button
                type="button"
                onClick={() => checkout("pro")}
                disabled={isLoading}
                className="btn-primary w-full py-3 rounded-lg text-xs transition-all"
                style={{
                  border: "0.5px solid var(--s)",
                  color: "var(--s)",
                }}
              >
                {isLoading
                  ? "loading..."
                  : billingPeriod === "yearly"
                    ? "continue with full, $99/year"
                    : "continue with full, $12.99/month"}
              </button>
            )}
          </div>

          {/* Grandfathered gifted grant — v67 does not sell new gifted plans. */}
          {currentTier === "gifted" && (
          <div
            className="flex-1 p-6 rounded-2xl"
            style={{
              background: "rgba(var(--white-rgb), 0.015)",
              border: "1px solid var(--s)",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 400, marginBottom: "4px" }}>full</h3>
            <p style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.32)", marginBottom: "16px" }}>
              your account already has full access
            </p>
            <div
              className="w-full py-3 rounded-lg text-center text-xs"
              style={{ background: "rgba(var(--white-rgb), 0.065)", color: "rgba(var(--white-rgb), 0.38)" }}
            >
              current plan
            </div>
          </div>
          )}
        </div>

        {error && (
          <p style={{ fontSize: "11px", color: "var(--red)", marginTop: "16px", textAlign: "center" }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: "11px", color: "rgba(var(--white-rgb), 0.25)", marginTop: "40px", textAlign: "center" }}>
          questions? read our{" "}
          <Link href="/faq" style={{ color: "var(--s)" }} className="hover:underline">
            frequently asked questions
          </Link>
        </p>
      </div>
    </main>
  );
}
