import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Lazy Stripe instance so `next build` does not require STRIPE_SECRET_KEY at module load. */
export function getStripeServer(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }
    stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return stripe;
}
