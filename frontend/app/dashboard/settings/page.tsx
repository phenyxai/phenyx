"use client";

import { useRouter } from "next/navigation";

import {
  useSettingsModals,
  type SettingsModalId,
} from "@/components/phenyx/settings-modals/modal-host";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

type SettingsRow = {
  label: string;
  sub: string;
} & ({ modal: SettingsModalId } | { href: string });

type SettingsGroup = {
  label: string;
  rows: SettingsRow[];
};

/** The Oct 20 demo's sections, with notifications kept under your data. */
const GROUPS: SettingsGroup[] = [
  {
    label: "account",
    rows: [
      { modal: "edit-profile", label: "profile & sign-in", sub: "your name and how you sign in" },
      { modal: "subscription", label: "membership", sub: "plan and billing" },
      { modal: "close-account", label: "deactivate or delete", sub: "manage account access and removal" },
    ],
  },
  {
    label: "your data",
    rows: [
      { modal: "my-connections", label: "connections", sub: "review your connected platforms" },
      { modal: "notifications", label: "notifications", sub: "choose what PHENYX sends you" },
      { modal: "data-management", label: "export your data", sub: "download your PHENYX context" },
    ],
  },
  {
    label: "help & legal",
    rows: [
      { modal: "feedback", label: "contact us", sub: "get help or share feedback" },
      { href: "/privacy-policy", label: "privacy policy", sub: "how your data is handled" },
      { href: "/terms", label: "terms", sub: "terms for using PHENYX" },
    ],
  },
];

/**
 * Settings panel (PHE-91 / PHE-95, v244, PHE-129). Not a tab: reached from the
 * sidebar foot (desktop) and the top bar gear (phones) at /dashboard/settings.
 * Three sections of rows (account, your data, help & legal) whose names sit in
 * the accent; a row opens a modal by id or a legal page. Membership opens the
 * plans, which own the billing-portal and checkout calls. Log out sits once, at
 * the very bottom, and returns to sign-in. Gifted is never shown; freeze/pause
 * does not exist.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { openModal } = useSettingsModals();

  const logOut = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  return (
    <section className="flex flex-col pt-14 pb-10 [@media(max-width:760px)]:px-5 [@media(min-width:761px)]:px-10">
      <div className="w-full max-w-[760px]">
        {GROUPS.map((group, i) => (
          <div key={group.label} className={i > 0 ? "mt-6 border-t border-ph-white/[0.08] pt-6" : ""}>
            <h2 className="mb-1.5 text-[13.5px] text-[var(--ph-accent)]">{group.label}</h2>
            {group.rows.map((row) => (
              <SettingsRowButton
                key={row.label}
                label={row.label}
                sub={row.sub}
                onClick={() => ("modal" in row ? openModal(row.modal) : router.push(row.href))}
              />
            ))}
          </div>
        ))}

        <button
          type="button"
          onClick={logOut}
          className="mt-10 mb-6 text-[13.5px] text-ph-white/55 transition-colors duration-200 hover:text-[var(--ph-accent)]"
        >
          log out
        </button>
      </div>
    </section>
  );
}

/** One settings row: label over its line, and a quiet chevron at the edge. */
function SettingsRowButton({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 py-3 text-left [@media(pointer:coarse)]:py-4"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14.5px] text-ph-white/90 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
          {label}
        </span>
        <span className="text-[12px] font-light text-ph-white/60">{sub}</span>
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-ph-white/55 transition-[color,transform] duration-200 group-hover:translate-x-[2px] group-hover:text-[var(--ph-accent)]"
      >
        <path d="M9.5 6l6 6-6 6" />
      </svg>
    </button>
  );
}
