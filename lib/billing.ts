/** Subscription / purchase tier stored on `user_profiles.tier`. */
export type PaidAccessTier = "pro" | "gifted";

export function hasFullAccess(tier: string | null | undefined): boolean {
  return tier === "pro" || tier === "gifted";
}
