"use server";

import { getStripeServer } from "@/lib/stripe-server";

/** Price IDs from env — used by helpers that wrap Stripe Checkout. */
export const PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
  GIFT: process.env.STRIPE_GIFT_PRICE_ID || "",
};

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripeServer();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: {
      userId,
    },
  });

  return session;
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
) {
  const stripe = getStripeServer();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
