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
        enableLogging: process.env.NODE_ENV !== "production",
        timeout: 30000,
        retryAttempts: 3,
      });
      
      initialized = true;
      console.log("[Onairos] SDK initialized successfully");
    } catch (error) {
      console.error("[Onairos] SDK initialization failed:", error);
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
