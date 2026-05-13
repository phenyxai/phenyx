import type { ReactNode } from "react";

declare module "onairos" {
  export function initializeApiKey(options: {
    apiKey: string;
    environment?: "development" | "production";
    enableLogging?: boolean;
    timeout?: number;
    retryAttempts?: number;
  }): Promise<void>;

  export interface OnairosProps {
    /** Custom trigger markup — supported by the SDK; omitted from some published typedefs. */
    children?: ReactNode;
    /** Per-component API key init; documented in CROSS_SDK_PARITY.md but missing from published typedefs. */
    apiKey?: string;
    /** Bypass per-button init check when `initializeApiKey` was already called globally. */
    skipApiKeyInitialization?: boolean;
  }
}
