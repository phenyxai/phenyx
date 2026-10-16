"use client";

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";
import { fetchProfile } from "@/lib/api-client";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { LEGACY_ACCENT_VARS, STELLAR_DEFAULT, accentVars, resolveAccent } from "@/lib/stellar";

// PHE-13: the session color is the user's persisted, server-assigned identity
// (user_profiles.stellar_color) — never random. PHE-98: this provider is the
// single writer of the accent. It publishes `--ph-accent` / `--ph-accent-rgb` on
// <html>; globals.css aliases the legacy names (`--s`, `--s-rgb`,
// `--color-stellar`, `--stellar`) to them, so every consumer follows one value.

interface SessionColorContextType {
  sessionColor: string;
  /**
   * Publish a color learned after mount (PHE-97: the welcome screen, reached by
   * client-side navigation right after sign-up, before this provider has seen
   * the new account).
   */
  applySessionColor: (color: string) => void;
}

const SessionColorContext = createContext<SessionColorContextType>({
  sessionColor: STELLAR_DEFAULT,
  applySessionColor: () => {},
});

export function SessionColorProvider({ children }: { children: ReactNode }) {
  const [sessionColor, setSessionColor] = useState<string>(STELLAR_DEFAULT);

  const applySessionColor = useCallback((value: string | null) => {
    const color = resolveAccent(value);
    setSessionColor(color);
    const root = document.documentElement;
    for (const [name, v] of Object.entries(accentVars(color))) root.style.setProperty(name, v);
    // Older screens set the aliased names inline; clear them so the aliases win.
    for (const name of LEGACY_ACCENT_VARS) root.style.removeProperty(name);
    if (color !== STELLAR_DEFAULT) localStorage.setItem("phenyx_stellar_color", color);
  }, []);

  useEffect(() => {
    let active = true;

    const apply = (value: string | null) => {
      if (active) applySessionColor(value);
    };

    // Reconcile against the authoritative server-assigned color. Anonymous
    // visitors have no profile, so the neutral default stands (no random).
    const reconcile = () =>
      fetchProfile()
        .then((profile) => {
          if (profile) apply(profile.stellar_color);
        })
        .catch(() => {
          // Best-effort: the optimistic paint stays.
        });

    // Optimistic paint from the last persisted value (avoids a flash on reload).
    apply(localStorage.getItem("phenyx_stellar_color"));
    reconcile();

    // Signing in or out happens without a full reload; follow it.
    const { data } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") reconcile();
      if (event === "SIGNED_OUT") apply(null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySessionColor]);

  return (
    <SessionColorContext.Provider value={{ sessionColor, applySessionColor }}>
      {children}
    </SessionColorContext.Provider>
  );
}

export function useSessionColor() {
  return useContext(SessionColorContext);
}
