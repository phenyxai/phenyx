export type PaidAccessTier = "pro" | "gifted";

/** v244 display prices and allowances. Stripe price IDs stay in env; this is UI copy only. */
export const V67_PRICING = {
  monthly: 12.99,
  yearly: 99,
  topup: 4.99,
  /** Weekly Polaris question allowance per plan (PHE-94). Mirrors the backend authority. */
  polarisWeeklyQuestions: { full: 40, free: 3 },
} as const;

export function hasFullAccess(tier: string | null | undefined): boolean {
  return tier === "pro" || tier === "gifted";
}

/**
 * Weekly Polaris question allowance for a tier — the client-side fallback used
 * before the backend allowance has loaded. The backend `allowance.limit` is the
 * authority once it arrives.
 */
export function polarisWeeklyQuestionsFor(tier: string | null | undefined): number {
  return hasFullAccess(tier)
    ? V67_PRICING.polarisWeeklyQuestions.full
    : V67_PRICING.polarisWeeklyQuestions.free;
}

/**
 * The allowance badge text: "<remaining> of <limit> questions left this week".
 * `limit` defaults to the tier's allowance; pass the backend `allowance.limit`
 * when it is known so both numbers come from the server.
 */
export function polarisAllowanceLabel(
  remaining: number,
  tier: string | null | undefined,
  limit: number = polarisWeeklyQuestionsFor(tier),
): string {
  return `${remaining} of ${limit} questions left this week`;
}
