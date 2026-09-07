"use client";

import { useState, type ReactNode } from "react";

import { useTier } from "@/lib/use-tier";
import {
  useSettingsModals,
  type SettingsModalId,
} from "@/components/phenyx/settings-modals/modal-host";
import { apiFetch } from "@/lib/api-client";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

const CONTACT_EMAIL = "contact@phenyxai.com";

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
 * Settings panel (PHE-91 / v244). Not a tab: reached from the sidebar gear and
 * the mobile menu sheet at /dashboard/settings. The grouped settings rows and
 * "get in touch" moved here from the you page as they were; ticket G restyles
 * them. Gifted is never shown; freeze/pause does not exist.
 */
export default function SettingsPage() {
  const { tier, isPro } = useTier();
  const { openModal } = useSettingsModals();
  const [subscriptionError, setSubscriptionError] = useState("");

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

  const tierLabel =
    tier === "gifted" ? "full" : isPro ? "full · downgrade" : "free · upgrade";

  return (
    <section className="flex max-w-[1280px] flex-col px-10 pt-10 pb-10">
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
