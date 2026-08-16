export type PaidAccessTier = "pro" | "gifted";

/** v67 display prices. Stripe price IDs stay in env; this is UI copy only. */
export const V67_PRICING = {
  monthly: 12.99,
  yearly: 99,
  topup: 4.99,
  polarisWeeklyTokens: 800,
} as const;

export function hasFullAccess(tier: string | null | undefined): boolean {
  return tier === "pro" || tier === "gifted";
}

export function polarisWeeklyTokenLabel(tier: string | null | undefined): string {
  return hasFullAccess(tier) ? `${V67_PRICING.polarisWeeklyTokens} weekly tokens` : "polaris is on pro";
}
