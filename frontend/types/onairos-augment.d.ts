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
  }
}
