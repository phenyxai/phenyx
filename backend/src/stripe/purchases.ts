/**
 * PHE-129 — what can be bought on either plan (company overview, section 17):
 * Polaris points in steps of 100 up to 2,000 at $4.99 per 100, and discovery
 * packs of 1, 3 or 10 for $0.99, $1.99 or $4.99. Both are a separate balance
 * that never expires and survives plan changes. Priced here, inline, so no
 * Stripe product has to exist; the webhook credits purchased_balances by the
 * session's metadata through credit_purchase(), once per session.
 */

export type PurchaseKind = "points" | "discoveries";

export const POINTS_STEP = 100;
export const POINTS_MAX = 2000;
/** Cents per 100 points. */
export const POINTS_PRICE_CENTS = 499;
/** Cents per discovery pack, by its size. */
export const DISCOVERY_PACKS: Record<number, number> = { 1: 99, 3: 199, 10: 499 };

export interface PurchaseLine {
  /** What the checkout's order line reads. */
  name: string;
  /** Cents per unit. */
  unitAmount: number;
  quantity: number;
  /** What lands on the balance: points or discoveries. */
  amount: number;
}

/** The checkout line for a purchase, or null when the amount is not one that is sold. */
export function purchaseLine(kind: unknown, amount: unknown): PurchaseLine | null {
  const n = Number(amount);
  if (!Number.isInteger(n)) return null;
  if (kind === "points") {
    if (n < POINTS_STEP || n > POINTS_MAX || n % POINTS_STEP !== 0) return null;
    return { name: "100 polaris points", unitAmount: POINTS_PRICE_CENTS, quantity: n / POINTS_STEP, amount: n };
  }
  if (kind === "discoveries") {
    const cents = DISCOVERY_PACKS[n];
    if (!cents) return null;
    return { name: n === 1 ? "1 discovery" : `${n} discoveries`, unitAmount: cents, quantity: 1, amount: n };
  }
  return null;
}
