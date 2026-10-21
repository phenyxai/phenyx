export type PaidAccessTier = "pro" | "gifted";

/** Display prices and allowances (PHE-129, company overview section 17). Stripe price IDs stay in env; this is UI copy only. */
export const V67_PRICING = {
  monthly: 12.99,
  yearly: 132.5,
  annualDiscountPercent: 15,
  /** Polaris points per month by plan. Mirrors the backend authority. */
  polarisMonthlyPoints: { full: 300, free: 30 },
  /** Bought points: steps of 100 up to 2,000, at this price per 100. */
  pointsPer100: 4.99,
  pointsStep: 100,
  pointsMax: 2000,
  /** New discoveries per week by plan. Mirrors the backend authority. */
  weeklyDiscoveries: { full: 10, free: 1 },
  /** Discovery packs: size → price. */
  discoveryPacks: [
    { size: 1, price: 0.99 },
    { size: 3, price: 1.99 },
    { size: 10, price: 4.99 },
  ],
} as const;

/** What a polaris turn costs (rebuild doc, section 8). Mirrors backend `turnCost`. */
export const POINT_COSTS = { clarify: 3, understand: 4, decide: 5, followUp: 2 } as const;

/** A follow-up costs 2; an opening question its mode, a typed one what understand does. */
export function turnCost(followUp: boolean, mode: "clarify" | "understand" | "decide" | null): number {
  if (followUp) return POINT_COSTS.followUp;
  return mode ? POINT_COSTS[mode] : POINT_COSTS.understand;
}

export function hasFullAccess(tier: string | null | undefined): boolean {
  return tier === "pro" || tier === "gifted";
}

/** Monthly polaris points for a tier: the fallback until the backend allowance loads. */
export function polarisMonthlyPointsFor(tier: string | null | undefined): number {
  return hasFullAccess(tier) ? V67_PRICING.polarisMonthlyPoints.full : V67_PRICING.polarisMonthlyPoints.free;
}

/** "$14.97" for 300 points. */
export function pointsPrice(points: number): string {
  return `$${((points / V67_PRICING.pointsStep) * V67_PRICING.pointsPer100).toFixed(2)}`;
}
