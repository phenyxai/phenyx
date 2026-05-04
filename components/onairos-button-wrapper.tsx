"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { OnairosButton } from "onairos";
import type { OnairosCompleteData } from "onairos";
import { initializeOnairos } from "@/lib/onairos";

/** Connector IDs — see vendor/onairos/CONNECTORS.md */
export const DEFAULT_ONAIROS_ALLOWED_PLATFORMS = [
  "youtube",
  "linkedin",
  "chatgpt",
  "reddit",
] as const;

interface OnairosButtonWrapperProps {
  webpageName: string;
  requestedData: string[];
  /** Connector IDs (lowercase), e.g. youtube, linkedin, chatgpt, reddit */
  allowedPlatforms?: string[] | null;
  autoFetch?: boolean;
  onComplete: (result: OnairosCompleteData) => void;
  children: ReactNode;
}

/**
 * OnairosButtonWrapper - Wraps the Onairos SDK OnairosButton component
 * Handles SDK initialization and renders the actual OnairosButton
 */
export function OnairosButtonWrapper({
  webpageName,
  requestedData,
  allowedPlatforms = [...DEFAULT_ONAIROS_ALLOWED_PLATFORMS],
  autoFetch = true,
  onComplete,
  children,
}: OnairosButtonWrapperProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initAttempted = useRef(false);

  // Initialize the Onairos SDK on mount
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    console.log("[v0] Starting Onairos initialization...");
    initializeOnairos()
      .then(() => {
        console.log("[v0] Onairos initialized successfully");
        setInitialized(true);
      })
      .catch((err: unknown) => {
        console.error("[v0] Onairos initialization failed:", err);
        const msg =
          err instanceof Error ? err.message : "Unknown Onairos initialization error";
        setError(msg);
      });
  }, []);

  // Convert requestedData array to the SDK's requestData object format
  const requestData: Record<string, { type: string; reward: string }> = {};
  
  requestedData.forEach((item) => {
    const key = item.toLowerCase().replace(/\s+/g, "_");
    if (item.toLowerCase().includes("personality") || item.toLowerCase().includes("traits")) {
      requestData.personality = { type: "personality", reward: "Personalized experience" };
    } else if (item.toLowerCase().includes("preference")) {
      requestData.preferences = { type: "preferences", reward: "Better recommendations" };
    } else if (item.toLowerCase().includes("basic")) {
      requestData.basic = { type: "basic", reward: "Access to features" };
    }
  });

  // If no specific data types matched, default to personality traits
  if (Object.keys(requestData).length === 0) {
    requestData.personality = { type: "personality", reward: "Personalized experience" };
  }

  if (error) {
    return (
      <div style={{ color: "#888", fontSize: "12px", padding: "12px", maxWidth: 360, lineHeight: 1.5 }}>
        <strong style={{ color: "#E84422" }}>Onairos did not start.</strong>
        <br />
        {error}
        <br />
        <span style={{ color: "#555", fontSize: "11px" }}>
          Check: <code style={{ color: "#aaa" }}>NEXT_PUBLIC_ONAIROS_API_KEY</code> in{" "}
          <code style={{ color: "#aaa" }}>.env.local</code>, restart <code style={{ color: "#aaa" }}>pnpm dev</code>,
          allow this site in the Onairos dashboard, and allow pop-ups for this page.
        </span>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div style={{ color: "#666", fontSize: "12px", padding: "12px" }}>
        Initializing Onairos...
      </div>
    );
  }

  return (
    <OnairosButton
      webpageName={webpageName}
      requestData={requestData}
      testMode={false}
      allowedPlatforms={allowedPlatforms}
      autoFetch={autoFetch}
      onComplete={onComplete}
    >
      {children}
    </OnairosButton>
  );
}
