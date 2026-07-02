"use client";

import { useEffect, useState } from "react";

import { useTier } from "@/lib/use-tier";
import {
  useSettingsModals,
  type SettingsModalId,
} from "@/components/phenyx/settings-modals/modal-host";
import { fetchProfileOverview, type ProfileOverview } from "@/lib/api-client";
import { ProfileTierCard } from "@/components/phenyx/profile-tier-card";

const CONTACT_EMAIL = "contact@phenyxcollective.com";

/**
 * SETTINGS rows in fixed product order. Each row's `id` is the modal it opens
 * against the shared PHE-32 host — the label is the verbatim, lowercase copy.
 */
const SETTINGS_ROWS: { id: SettingsModalId; label: string }[] = [
  { id: "passphrase", label: "passphrase" },
  { id: "notifications", label: "notifications" },
  { id: "my-connections", label: "my connections" },
  { id: "data-management", label: "data management" },
  { id: "account", label: "account" },
];

/** stellar-accented section label ("WHAT WE HAVE SEEN", "SETTINGS", …). */
function SectionLabel({
  children,
  stellarColor,
}: {
  children: string;
  stellarColor: string;
}) {
  return (
    <h2
      className="text-[10px] font-medium uppercase tracking-[0.12em]"
      style={{ color: stellarColor }}
    >
      {children}
    </h2>
  );
}

/**
 * Profile tab. Two-column surface: a main column (identity header, WHAT WE HAVE
 * SEEN snapshot, SETTINGS menu, GET IN TOUCH) and a 260px sidebar (tier card +
 * WHAT PHENYX FORESEES). Tier comes from useTier; everything else from the
 * engine overview (PHE-38), which degrades to empty states until it is live.
 */
export default function ProfileTabPage() {
  const { tier } = useTier();
  const { openModal, stellarColor } = useSettingsModals();
  const [overview, setOverview] = useState<ProfileOverview | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await fetchProfileOverview();
      if (active) setOverview(data);
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = overview?.display_name?.trim() ?? "";
  const platforms = overview?.connected_platforms ?? [];
  const snapshot = overview?.snapshot ?? [];
  const foresight = overview?.foresight?.trim() ?? "";

  return (
    <section className="flex flex-col gap-10 p-10 lg:flex-row">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        {/* Header card — display name + connected-platform badges. */}
        <div className="rounded-xl border border-[#1C1C1C] bg-[#0E0E0E] p-6">
          {displayName && (
            <h1 className="text-[20px] font-light lowercase text-[#FFFDFD]">
              {displayName}
            </h1>
          )}
          {platforms.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-[#FFFDFD]/10 px-3 py-1 text-[11px] font-light lowercase tracking-wide text-[#FFFDFD]/60"
                >
                  {platform}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* WHAT WE HAVE SEEN — exactly 3 pillar-labelled sentences (engine). */}
        {snapshot.length > 0 && (
          <div className="flex flex-col gap-4">
            <SectionLabel stellarColor={stellarColor}>what we have seen</SectionLabel>
            <ul className="flex flex-col gap-4">
              {snapshot.map((item, i) => (
                <li
                  key={`${item.pillar_label}-${i}`}
                  className="rounded-xl border border-[#1C1C1C] bg-[#0E0E0E] p-5"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#FFFDFD]/45">
                    {item.pillar_label}
                  </p>
                  <p className="mt-2 text-[14px] font-light leading-relaxed text-[#FFFDFD]/85">
                    {item.sentence}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SETTINGS — rows in fixed order; each opens its PHE-32 modal by id. */}
        <div className="flex flex-col gap-4">
          <SectionLabel stellarColor={stellarColor}>settings</SectionLabel>
          <ul className="flex flex-col overflow-hidden rounded-xl border border-[#1C1C1C] bg-[#0E0E0E]">
            {SETTINGS_ROWS.map((row) => (
              <li key={row.id} className="border-b border-[#1C1C1C] last:border-b-0">
                <button
                  type="button"
                  onClick={() => openModal(row.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-light lowercase text-[#FFFDFD]/80 transition-colors hover:bg-[#141414] hover:text-[#FFFDFD] motion-reduce:transition-none"
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true" className="text-[#FFFDFD]/30">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* GET IN TOUCH — contact (mailto) + share feedback (feedback modal). */}
        <div className="flex flex-col gap-4">
          <SectionLabel stellarColor={stellarColor}>get in touch</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-full border border-[#FFFDFD]/15 px-5 py-2.5 text-[13px] font-light lowercase tracking-wide text-[#FFFDFD]/80 transition-colors hover:border-[#FFFDFD]/40 hover:text-[#FFFDFD] motion-reduce:transition-none"
            >
              contact us
            </a>
            <button
              type="button"
              onClick={() => openModal("feedback")}
              className="rounded-full border border-[#FFFDFD]/15 px-5 py-2.5 text-[13px] font-light lowercase tracking-wide text-[#FFFDFD]/80 transition-colors hover:border-[#FFFDFD]/40 hover:text-[#FFFDFD] motion-reduce:transition-none"
            >
              share feedback
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar — tier card + WHAT PHENYX FORESEES. */}
      <aside className="flex w-full flex-col gap-6 lg:w-[260px] lg:shrink-0">
        <ProfileTierCard
          tier={tier}
          stellarColor={stellarColor}
          onUpgrade={() => openModal("upgrade")}
        />

        {foresight && (
          <div className="rounded-xl border border-[#1C1C1C] bg-[#0E0E0E] p-5">
            <SectionLabel stellarColor={stellarColor}>what phenyx foresees</SectionLabel>
            <p className="mt-3 text-[13px] font-light italic leading-relaxed text-[#FFFDFD]/70">
              {foresight}
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
