"use client";

import { hasFullAccess } from "@/lib/billing";

/**
 * Profile sidebar tier card. A pure function of `tier` via hasFullAccess():
 *
 *   - free   → "FREE PLAN" + the one-observation body + an "upgrade to pro"
 *              button (opens the upgrade modal via `onUpgrade`).
 *   - pro    → "PRO PLAN" + the full-access body, no button.
 *   - gifted → renders identically to pro (gifted is pro-equivalent for
 *              entitlement); the word "gifted" is never surfaced.
 *
 * Copy is verbatim from the prototype — the PLAN titles stay uppercase.
 */
export function ProfileTierCard({
  tier,
  stellarColor,
  onUpgrade,
}: {
  tier: string;
  stellarColor: string;
  onUpgrade: () => void;
}) {
  const isPro = hasFullAccess(tier);

  return (
    <div className="rounded-xl border border-[#1C1C1C] bg-[#0E0E0E] p-5">
      <p
        className="text-[11px] font-medium uppercase tracking-[0.12em]"
        style={{ color: stellarColor }}
      >
        {isPro ? "PRO PLAN" : "FREE PLAN"}
      </p>
      <p className="mt-3 text-[13px] font-light leading-relaxed text-[#FFFDFD]/70">
        {isPro
          ? "you are seeing everything your data reveals."
          : "you are seeing one observation. upgrade to see everything your data reveals."}
      </p>
      {!isPro && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 w-full rounded-full px-4 py-2.5 text-[13px] font-light lowercase tracking-wide text-[#0A0A0A] transition-opacity hover:opacity-90 motion-reduce:transition-none"
          style={{ background: stellarColor }}
        >
          upgrade to pro
        </button>
      )}
    </div>
  );
}
