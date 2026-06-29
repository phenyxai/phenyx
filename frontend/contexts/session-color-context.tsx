"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchProfile } from "@/lib/api-client";
import { STELLAR_DEFAULT, hexToRgb } from "@/lib/stellar";

// PHE-13: the session color is the user's persisted, server-assigned identity
// (user_profiles.stellar_color) — never random. This provider is the single
// source of truth: on shell mount it resolves that color and publishes it as the
// CSS vars `--s` / `--s-rgb` (read by the orb, cursor, and accent glows), with
// `--color-stellar` kept in sync for existing consumers of the legacy var.

interface SessionColorContextType {
  sessionColor: string;
}

const SessionColorContext = createContext<SessionColorContextType>({
  sessionColor: STELLAR_DEFAULT,
});

export function SessionColorProvider({ children }: { children: ReactNode }) {
  const [sessionColor, setSessionColor] = useState<string>(STELLAR_DEFAULT);

  useEffect(() => {
    let active = true;

    const apply = (color: string) => {
      if (!active) return;
      setSessionColor(color);
      const root = document.documentElement;
      root.style.setProperty("--s", color);
      root.style.setProperty("--s-rgb", hexToRgb(color));
      // Keep the legacy accent var in sync so existing screens stay consistent.
      root.style.setProperty("--color-stellar", color);
      localStorage.setItem("phenyx_stellar_color", color);
    };

    // Optimistic paint from the last persisted value (avoids a flash on reload)...
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) apply(stored);
    else apply(STELLAR_DEFAULT);

    // ...then reconcile against the authoritative server-assigned color. Anonymous
    // visitors have no profile, so the deterministic default stands (no random).
    fetchProfile()
      .then((profile) => {
        if (profile?.stellar_color) apply(profile.stellar_color);
      })
      .catch(() => {
        // Best-effort: ambient default already applied.
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <SessionColorContext.Provider value={{ sessionColor }}>
      {children}
    </SessionColorContext.Provider>
  );
}

export function useSessionColor() {
  return useContext(SessionColorContext);
}
