import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe-server";

export type CheckoutKind = "pro" | "gift";

/**
 * Body: { checkoutKind: "pro" | "gift", userId: string, billingPeriod?: "monthly" | "yearly" }
 * - Pro monthly: Stripe subscription (recurring).
 * - Pro yearly: Stripe one-time payment (your yearly price is a one-time Price in Stripe).
 * - Gift: one-time payment.
 */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripeServer();
    const body = await req.json();
    const { checkoutKind, userId, billingPeriod } = body as {
      checkoutKind?: CheckoutKind;
      userId?: string;
      billingPeriod?: "monthly" | "yearly";
    };

    if (!checkoutKind || !userId) {
      return NextResponse.json(
        { error: "Missing checkoutKind or userId" },
        { status: 400 }
      );
    }

    const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const proYearly = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
    const giftPrice = process.env.STRIPE_GIFT_PRICE_ID;

    const origin = req.headers.get("origin") || "http://localhost:3000";

    if (checkoutKind === "gift") {
      if (!giftPrice) {
        return NextResponse.json(
          { error: "Gift checkout not configured" },
          { status: 500 }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: giftPrice, quantity: 1 }],
        success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/upgrade`,
        client_reference_id: userId,
        metadata: {
          userId,
          checkoutKind: "gift",
        },
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url ?? null,
      });
    }

    if (checkoutKind !== "pro") {
      return NextResponse.json({ error: "Invalid checkoutKind" }, { status: 400 });
    }

    if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
      return NextResponse.json(
        { error: "Pro checkout requires billingPeriod monthly or yearly" },
        { status: 400 }
      );
    }

    if (billingPeriod === "monthly") {
      if (!proMonthly) {
        return NextResponse.json(
          { error: "Pro monthly price not configured" },
          { status: 500 }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: proMonthly, quantity: 1 }],
        success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/upgrade`,
        client_reference_id: userId,
        metadata: {
          userId,
          checkoutKind: "pro",
          billingPeriod: "monthly",
        },
      });

      return NextResponse.json({
        sessionId: session.id,
        url: session.url ?? null,
      });
    }

    // Yearly: one-time payment (Price is one_time in Stripe)
    if (!proYearly) {
      return NextResponse.json(
        { error: "Pro yearly price not configured" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: proYearly, quantity: 1 }],
      success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade`,
      client_reference_id: userId,
      metadata: {
        userId,
        checkoutKind: "pro",
        billingPeriod: "yearly",
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url ?? null,
    });
  } catch (err) {
    console.error("[Stripe Checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
