"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { OnairosButton } from "onairos";
import type { OnairosCompleteData } from "onairos";
import { initializeOnairos, getOnairosApiKey } from "@/lib/onairos";

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
  buttonType?: "pill" | "icon" | "rectangle";
  buttonText?: string;
  textColor?: "black" | "white";
  showIcon?: boolean;
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
  buttonType = "pill",
  buttonText = "connect with onairos",
  textColor = "white",
  showIcon = true,
}: OnairosButtonWrapperProps) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initAttempted = useRef(false);

  // Initialize the Onairos SDK on mount
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    initializeOnairos()
      .then(() => {
        setInitialized(true);
      })
      .catch((err: unknown) => {
        console.error("[onairos] SDK initialization failed:", err);
        const msg =
          err instanceof Error ? err.message : "Unknown Onairos initialization error";
        setError(msg);
      });
  }, []);

  // v8 expects an array of lowercase tier strings: ["basic", "personality", ...]
  const KNOWN_TIERS = ["basic", "personality", "preferences", "rawmemories"] as const;
  const requestData = useMemo(() => {
    const tiers = new Set<string>();
    for (const item of requestedData) {
      const lower = item.toLowerCase();
      if (lower.includes("personality") || lower.includes("traits")) tiers.add("personality");
      else if (lower.includes("preference")) tiers.add("preferences");
      else if (lower.includes("raw") || lower.includes("memor")) tiers.add("rawmemories");
      else if (lower.includes("basic")) tiers.add("basic");
      else if ((KNOWN_TIERS as readonly string[]).includes(lower)) tiers.add(lower);
    }
    if (tiers.size === 0) tiers.add("personality");
    return Array.from(tiers);
  }, [requestedData]);

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
      buttonType={buttonType}
      buttonText={buttonText}
      textColor={textColor}
      showIcon={showIcon}
      apiKey={getOnairosApiKey()}
      skipApiKeyInitialization={true}
    />
  );
}
