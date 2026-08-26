"use client";

import { useEffect, useState } from "react";

import { localDayNumber } from "@/components/phenyx/daily-header";
import {
  pickStillTrueForDay,
  type HeldConstant,
} from "@/app/dashboard/profile/held";

// ============================================================================
// still true today: one constant from the record (PHE-70 / v67)
// ----------------------------------------------------------------------------
// Daily surfaces a single held constant, chosen by local day number so it holds
// all day and changes tomorrow. It excludes the exact constants currently
// listed in Profile's `what has held` before applying the daily rotation.
// ============================================================================

export interface StillTrueTodayProps {
  now?: Date;
  accent?: string;
  profileHeld?: readonly HeldConstant[];
}

export function StillTrueToday({
  now,
  accent = "var(--s, #5599FF)",
  profileHeld = [],
}: StillTrueTodayProps) {
  const [mountedNow, setMountedNow] = useState<Date | null>(now ?? null);
  useEffect(() => {
    if (!now) setMountedNow(new Date());
  }, [now]);
  const when = now ?? mountedNow;
  if (!when) return null;
  const held = pickStillTrueForDay(profileHeld, localDayNumber(when));

  return (
    <aside
      style={{
        marginTop: 34,
        paddingTop: 22,
        borderTop: "1px solid rgba(255,253,253,0.06)",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,253,253,0.6)",
          margin: "0 0 10px",
        }}
      >
        still true today
      </p>
      <p
        style={{
          fontSize: 14,
          color: accent,
          margin: "0 0 5px",
        }}
      >
        {held.title}
      </p>
      <p
        style={{
          fontSize: 14,
          fontWeight: 300,
          lineHeight: 1.65,
          color: "rgba(255,253,253,0.62)",
          margin: 0,
          maxWidth: "56ch",
        }}
      >
        {held.body}
      </p>
    </aside>
  );
}

export default StillTrueToday;
