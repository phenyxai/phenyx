"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchProfile } from "@/lib/api-client";
import { BRAND_BLUE, hexToRgb } from "@/lib/stellar";

// PHE-13: the session color is the user's persisted, server-assigned identity
// (user_profiles.stellar_color) — never random. This provider is the single
// source of truth: on shell mount it resolves that color and publishes it as the
// CSS vars `--s` / `--s-rgb`, the accent token every component reads
// (PHE-98). Before sign-in globals.css leaves both on brand blue.

interface SessionColorContextType {
  sessionColor: string;
}

const SessionColorContext = createContext<SessionColorContextType>({
  sessionColor: BRAND_BLUE,
});

export function SessionColorProvider({ children }: { children: ReactNode }) {
  const [sessionColor, setSessionColor] = useState<string>(BRAND_BLUE);

  useEffect(() => {
    let active = true;

    const apply = (color: string) => {
      if (!active) return;
      setSessionColor(color);
      const root = document.documentElement;
      root.style.setProperty("--s", color);
      root.style.setProperty("--s-rgb", hexToRgb(color));
      localStorage.setItem("phenyx_stellar_color", color);
    };

    // Optimistic paint from the last persisted value (avoids a flash on reload)...
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) apply(stored);

    // ...then reconcile against the authoritative server-assigned color. Anonymous
    // visitors have no profile, so the brand-blue default stands.
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
