"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useTier } from "@/lib/use-tier";
import {
  useSettingsModals,
  type SettingsModalId,
} from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch } from "@/lib/api-client";
import { colorName } from "@/lib/stellar";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { IntroBanner } from "@/components/phenyx/intro-banner";
import { pickHeldConstants, type HeldConstant } from "./held";

const CONTACT_EMAIL = "contact@phenyxai.com";

interface ProfileOverview {
  display_name: string | null;
  email: string | null;
  joined: string | null;
  stellar_color: string | null;
  connected_platforms: string[];
  held: HeldConstant[];
  tier: "free" | "pro";
}

type SettingsRow = {
  id: SettingsModalId;
  label: string;
  sub: string;
};

const ACCESS_ROWS: SettingsRow[] = [
  {
    id: "passphrase",
    label: "passphrase",
    sub: "how you return to PHENYX",
  },
  {
    id: "my-connections",
    label: "platform connections",
    sub: "what feeds your constellation",
  },
  {
    id: "notifications",
    label: "notifications",
    sub: "what PHENYX can surface to you",
  },
];

const DATA_ROWS: SettingsRow[] = [
  {
    id: "data-management",
    label: "export or delete",
    sub: "take everything with you, or remove it",
  },
  {
    id: "account",
    label: "account",
    sub: "sign out, or close your account",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-5 text-[11px] font-semibold tracking-[0.15em] text-[#FFFDFD]/52 uppercase">
      {children}
    </h2>
  );
}

/**
 * Profile tab (PHE-75 / v67). One screen: identity, connected platforms,
 * stellar colour, what has held, grouped settings, get in touch. Gifted is
 * never shown; freeze/pause does not exist.
 */
export default function ProfileTabPage() {
  const { tier, isPro } = useTier();
  const { openModal, openId, stellarColor } = useSettingsModals();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [subscriptionError, setSubscriptionError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/profile/overview");
      if (res.ok) {
        const body = (await res.json()) as ProfileOverview;
        setOverview({
          ...body,
          held: pickHeldConstants(body.held ?? []),
        });
        return;
      }
    } catch {
      // fall through
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setOverview(null);
      return;
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("display_name, stellar_color, created_at")
      .eq("id", user.id)
      .maybeSingle();
    setOverview({
      display_name: profile?.display_name ?? null,
      email: user.email ?? null,
      joined: null,
      stellar_color: profile?.stellar_color ?? null,
      connected_platforms: [],
      held: pickHeldConstants([]),
      tier: isPro ? "pro" : "free",
    });
  }, [isPro]);

  useEffect(() => {
    void load();
  }, [load]);

  const prevOpen = useRef(openId);
  useEffect(() => {
    if (prevOpen.current !== null && openId === null) void load();
    prevOpen.current = openId;
  }, [openId, load]);

  const handleSubscription = async () => {
    setSubscriptionError("");
    if (!isPro) {
      openModal("upgrade");
      return;
    }
    if (tier === "gifted") return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubscriptionError("sign in again to manage your subscription.");
      return;
    }
    try {
      const res = await apiFetch("/stripe/billing-portal", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("billing portal unavailable");
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error("billing portal unavailable");
    } catch {
      setSubscriptionError(
        "could not open subscription management. please try again.",
      );
    }
  };

  const displayName = overview?.display_name?.trim() ?? "";
  const email = overview?.email?.trim() ?? "";
  const joined = overview?.joined?.trim() ?? "";
  const platforms = overview?.connected_platforms ?? [];
  const held = overview?.held ?? [];
  const swatch = overview?.stellar_color || stellarColor;
  const stellarName = colorName(swatch);
  const badge = isPro ? "pro" : "free";
  const tierLabel =
    tier === "gifted" ? "pro" : isPro ? "pro · downgrade" : "free · upgrade";

  return (
    <>
      <IntroBanner
        tab="profile"
        copy="this is what we know about you so far, and where you can manage your account."
        className="mx-10 mt-10"
      />

      <section className="flex max-w-[1280px] flex-col px-10 pt-8 pb-10">
        <div className="mb-[38px] flex flex-wrap items-start gap-x-14 gap-y-8 border-b border-[#FFFDFD]/[0.06] pb-8">
          <div className="flex min-w-[200px] flex-col gap-1">
            <div className="flex items-center gap-2.5">
              {displayName && (
                <p className="text-[15px] font-medium tracking-[-0.01em] text-[#FFFDFD]">
                  {displayName}
                </p>
              )}
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-[7px] py-0.5 text-[9px] tracking-[0.14em] uppercase ${
                  isPro
                    ? "border-[rgba(var(--s-rgb),0.4)] text-[var(--s)]"
                    : "border-[#FFFDFD]/18 text-[#FFFDFD]/50"
                }`}
              >
                {badge}
              </span>
              <button
                type="button"
                title="edit name and email"
                aria-label="edit name and email"
                onClick={() => openModal("edit-profile")}
                className="flex min-h-[26px] min-w-[26px] items-center justify-center p-1.5 text-[#FFFDFD]/60 transition-colors hover:text-[var(--s)]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            </div>
            {email && (
              <p className="text-[13px] tracking-[0.02em] text-[#FFFDFD]/62">
                {email}
              </p>
            )}
            {joined && (
              <p className="mt-1 text-[11px] tracking-[0.02em] text-[#FFFDFD]/50">
                {joined}
              </p>
            )}
          </div>

          <div className="min-w-[240px] flex-1">
            <SectionLabel>connected platforms</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {platforms.length === 0 ? (
                <p className="text-[11px] text-[#888]">no platforms connected.</p>
              ) : (
                platforms.map((platform) => (
                  <span
                    key={platform}
                    className="rounded-lg border border-[rgba(185,213,255,0.16)] px-[9px] py-0.5 text-[11px] tracking-[0.03em] lowercase text-[#888]"
                  >
                    {platform}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="min-w-[220px]">
            <SectionLabel>stellar colour</SectionLabel>
            <div className="flex items-center gap-3">
              <div
                className="h-[18px] w-[18px] shrink-0 rounded-full"
                style={{
                  background: swatch,
                  boxShadow: `0 0 10px color-mix(in srgb, ${swatch} 40%, transparent)`,
                }}
                aria-hidden="true"
              />
              <p className="text-[13.5px] font-light leading-relaxed text-[#FFFDFD]/72">
                {stellarName}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-[52px]">
          <SectionLabel>what has held</SectionLabel>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {held.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[#FFFDFD]/[0.07] bg-[#FFFDFD]/[0.008] px-[22px] py-5"
              >
                <p className="mb-1.5 text-[13px] tracking-[0.01em] text-[var(--s)]">
                  {item.title}
                </p>
                <p className="text-[13px] leading-relaxed text-[#FFFDFD]/78">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-[52px]">
          <SectionLabel>settings</SectionLabel>
          <div className="flex flex-col">
            <p className="mb-0.5 text-[10.5px] font-semibold tracking-[0.14em] text-[#FFFDFD]/42 uppercase">
              plan
            </p>
            <SettingsRowButton
              label="subscription"
              sub="what you are on, and how to change it"
              trailing={
                <span className="text-[12px] tracking-[0.02em] text-[var(--s)] opacity-85">
                  {tierLabel}
                </span>
              }
              onClick={handleSubscription}
            />
            {subscriptionError && (
              <p role="alert" className="pt-2 text-[11px] text-[#c97a6a]">
                {subscriptionError}
              </p>
            )}

            <p className="mt-[26px] mb-0.5 text-[10.5px] font-semibold tracking-[0.14em] text-[#FFFDFD]/42 uppercase">
              access
            </p>
            {ACCESS_ROWS.map((row) => (
              <SettingsRowButton
                key={row.id}
                label={row.label}
                sub={row.sub}
                onClick={() => openModal(row.id)}
              />
            ))}

            <p className="mt-[26px] mb-0.5 text-[10.5px] font-semibold tracking-[0.14em] text-[#FFFDFD]/42 uppercase">
              your data
            </p>
            {DATA_ROWS.map((row) => (
              <SettingsRowButton
                key={row.id}
                label={row.label}
                sub={row.sub}
                onClick={() => openModal(row.id)}
              />
            ))}
          </div>
        </div>

        <div className="pb-10">
          <SectionLabel>get in touch</SectionLabel>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-block py-1.5 text-[11px] tracking-[0.02em] text-[#FFFDFD]/62 no-underline transition-colors hover:text-[#999]"
            >
              {CONTACT_EMAIL}
            </a>
            <span className="text-[11.5px] text-[#888]">·</span>
            <button
              type="button"
              onClick={() => openModal("feedback")}
              className="inline-block border-0 bg-transparent py-1.5 text-[11px] tracking-[0.02em] text-[#FFFDFD]/62 transition-colors hover:text-[#999]"
            >
              share feedback
            </button>
            <span className="text-[11.5px] text-[#888]">·</span>
            <a
              href="/privacy-policy"
              className="inline-block py-1.5 text-[11px] tracking-[0.02em] text-[#FFFDFD]/62 no-underline transition-colors hover:text-[#999]"
            >
              privacy policy
            </a>
            <span className="text-[11.5px] text-[#888]">·</span>
            <a
              href="/terms"
              className="inline-block py-1.5 text-[11px] tracking-[0.02em] text-[#FFFDFD]/62 no-underline transition-colors hover:text-[#999]"
            >
              terms
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function SettingsRowButton({
  label,
  sub,
  trailing,
  onClick,
}: {
  label: string;
  sub: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ps-row group relative flex w-full cursor-pointer items-center justify-between border-0 border-b border-[#1a1a1a] bg-transparent py-[15px] text-left font-[inherit] text-[14px] text-[#FFFDFD]/85 transition-colors duration-200 after:pointer-events-none after:absolute after:right-0 after:-bottom-px after:left-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(var(--s-rgb),0.55)_18%,rgba(var(--s-rgb),0.55)_82%,transparent)] after:opacity-0 after:transition-opacity after:duration-[450ms] before:pointer-events-none before:absolute before:right-0 before:-bottom-[7px] before:left-0 before:h-[13px] before:bg-[radial-gradient(ellipse_at_center,rgba(var(--s-rgb),0.20),transparent_72%)] before:opacity-0 before:blur-[3px] before:transition-opacity before:duration-500 last:border-b-0 hover:text-[#FFFDFD] hover:after:opacity-100 hover:before:opacity-100 [@media(pointer:coarse)]:py-[22px]"
    >
      <span className="ps-label flex flex-col gap-[3px] text-left">
        <span>{label}</span>
        <span className="ps-sub text-[11.5px] font-light tracking-normal text-[#FFFDFD]/45">
          {sub}
        </span>
      </span>
      {trailing ?? (
        <span
          aria-hidden="true"
          className="ps-arrow text-[11px] text-[#888] transition-[color,transform] duration-[350ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:translate-x-[3px] group-hover:text-[var(--s)]"
        >
          →
        </span>
      )}
    </button>
  );
}
