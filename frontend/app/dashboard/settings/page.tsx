"use client";

import type { ReactNode } from "react";

import { useTier } from "@/lib/use-tier";
import {
  useSettingsModals,
  type SettingsModalId,
} from "@/components/phenyx/settings-modals/modal-host";
import { PanelHeader } from "@/components/phenyx/panel-header";

const CONTACT_EMAIL = "contact@phenyxai.com";

type SettingsRow = {
  id: SettingsModalId;
  label: string;
  sub: string;
};

type SettingsGroup = {
  label: string;
  rows: SettingsRow[];
};

/** Rows under "account & plan" after the subscription row. */
const ACCOUNT_ROWS: SettingsRow[] = [
  {
    id: "account",
    label: "account",
    sub: "edit your details, or close your account",
  },
];

const GROUPS: SettingsGroup[] = [
  {
    label: "access",
    rows: [
      {
        id: "passphrase",
        label: "passphrase",
        sub: "change how you sign in",
      },
      {
        id: "my-connections",
        label: "connected accounts",
        sub: "add or disconnect accounts",
      },
      {
        id: "notifications",
        label: "notifications",
        sub: "choose what PHENYX sends you",
      },
    ],
  },
  {
    label: "what's yours",
    rows: [
      {
        id: "data-management",
        label: "your information",
        sub: "export a copy, or delete everything",
      },
    ],
  },
];

/** Section labels are lowercase in source; the uppercase treatment is styling. */
function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-5 text-[11px] font-semibold tracking-[0.15em] text-[#FFFDFD]/52 uppercase">
      {children}
    </h2>
  );
}

function GroupLabel({
  children,
  first = false,
}: {
  children: string;
  first?: boolean;
}) {
  return (
    <p
      className={`mb-0.5 text-[10.5px] font-semibold tracking-[0.14em] text-[#FFFDFD]/42 uppercase ${
        first ? "" : "mt-[26px]"
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Settings panel (PHE-91 / PHE-95, v244). Not a tab: reached from the sidebar
 * gear and the mobile menu sheet at /dashboard/settings. Three groups of rows
 * that each open a modal by id, then "get in touch". The subscription row opens
 * the subscription modal, which owns the billing-portal and checkout calls.
 * Gifted is never shown; freeze/pause does not exist.
 */
export default function SettingsPage() {
  const { tier, isPro } = useTier();
  const { openModal } = useSettingsModals();

  // Gifted has nothing to downgrade, so its label is the plan alone.
  const tierLabel =
    tier === "gifted" ? "full" : isPro ? "full · downgrade" : "free · upgrade";

  return (
    <section className="flex flex-col px-10 pt-10 pb-10">
      <div className="w-full max-w-[820px]">
        <PanelHeader
          eyebrow="settings"
          title="your account and controls"
          sub="the machinery behind PHENYX. what you connect, what it keeps, and how you sign in, all yours to change."
        />

        <div className="mb-[52px] flex flex-col">
          <GroupLabel first>account &amp; plan</GroupLabel>
          <SettingsRowButton
            label="subscription"
            sub="your plan, billing, and what's included"
            trailing={
              <span className="ps-tier ml-6 shrink-0 text-[12px] tracking-[0.02em] text-[var(--s)] opacity-85">
                {tierLabel}
              </span>
            }
            onClick={() => openModal("subscription")}
          />
          {ACCOUNT_ROWS.map((row) => (
            <SettingsRowButton
              key={row.id}
              label={row.label}
              sub={row.sub}
              onClick={() => openModal(row.id)}
            />
          ))}

          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col">
              <GroupLabel>{group.label}</GroupLabel>
              {group.rows.map((row) => (
                <SettingsRowButton
                  key={row.id}
                  label={row.label}
                  sub={row.sub}
                  onClick={() => openModal(row.id)}
                />
              ))}
            </div>
          ))}
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
      </div>
    </section>
  );
}

/**
 * One settings row: label + sub on the left, then the arrow (or a trailing
 * label) sitting 24px past the text rather than at the far edge of the column.
 */
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
      className="ps-row group relative flex w-full cursor-pointer items-center border-0 border-b border-[rgba(255,253,253,0.045)] bg-transparent py-[15px] text-left font-[inherit] text-[14px] text-[#FFFDFD]/85 transition-colors duration-200 after:pointer-events-none after:absolute after:right-0 after:-bottom-px after:left-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgba(var(--s-rgb),0.55)_18%,rgba(var(--s-rgb),0.55)_82%,transparent)] after:opacity-0 after:transition-opacity after:duration-[450ms] before:pointer-events-none before:absolute before:right-0 before:-bottom-[7px] before:left-0 before:h-[13px] before:bg-[radial-gradient(ellipse_at_center,rgba(var(--s-rgb),0.20),transparent_72%)] before:opacity-0 before:blur-[3px] before:transition-opacity before:duration-500 last:border-b-0 hover:text-[#FFFDFD] hover:after:opacity-100 hover:before:opacity-100 [@media(pointer:coarse)]:py-[22px]"
    >
      <span className="ps-label flex min-w-0 flex-col gap-[3px] text-left">
        <span>{label}</span>
        <span className="ps-sub text-[11.5px] font-light tracking-normal text-[#FFFDFD]/45">
          {sub}
        </span>
      </span>
      {trailing ?? (
        <span
          aria-hidden="true"
          className="ps-arrow ml-6 shrink-0 text-[11px] text-[#888] transition-[color,transform] duration-[350ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:translate-x-[3px] group-hover:text-[var(--s)]"
        >
          →
        </span>
      )}
    </button>
  );
}
