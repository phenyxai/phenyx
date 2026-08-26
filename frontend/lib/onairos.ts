"use client";

import { initializeApiKey } from "onairos";

/** Client-side API key (NEXT_PUBLIC_*) — configure in Cloudflare/Vercel env. */
export function getOnairosApiKey(): string {
  const key = process.env.NEXT_PUBLIC_ONAIROS_API_KEY?.trim();
  return key ?? "";
}

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Onairos SDK
 * This should be called once before using any Onairos components
 */
export async function initializeOnairos(): Promise<void> {
  if (initialized) return;
  
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      const apiKey = getOnairosApiKey();
      if (!apiKey) {
        throw new Error(
          "Missing NEXT_PUBLIC_ONAIROS_API_KEY — add it to .env.local or CI secrets."
        );
      }
      await initializeApiKey({
        apiKey,
        environment: process.env.NODE_ENV === "production" ? "production" : "development",
        // The completion includes a short-lived JWT. Keep vendor logging off in
        // every environment so no credential can enter browser logs.
        enableLogging: false,
        timeout: 30000,
        retryAttempts: 3,
      });
      
      initialized = true;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
}

/**
 * Check if Onairos SDK is initialized
 */
export function isOnairosInitialized(): boolean {
  return initialized;
}

// localStorage keys the Onairos SDK writes on completion. `onairos_user_token`
// holds the raw JWT and `onairosUser` holds a user object that embeds it.
const ONAIROS_TOKEN_KEYS = [
  "onairos_user_token",
  "onairosUser",
  "onairos_user_email",
] as const;

/**
 * PHE-40: purge the raw Onairos JWT the SDK persists in localStorage. The token
 * is verified server-side per connect and is never reused client-side, so it must
 * not linger in browser storage. Safe to call anytime (no-op on the server / when
 * the keys are absent).
 */
export function clearOnairosClientToken(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of ONAIROS_TOKEN_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable (private mode / disabled) — nothing to purge.
  }
}
