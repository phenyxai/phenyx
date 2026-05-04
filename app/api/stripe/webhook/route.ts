import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe-server";
import { getSupabaseServiceRole } from "@/lib/supabase-service-role";

function proPriceIds(): Set<string> {
  const ids = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];
  return new Set(ids);
}

function giftPriceId(): string | undefined {
  return process.env.STRIPE_GIFT_PRICE_ID;
}

function tierFromSubscriptionPrice(priceId: string): "free" | "pro" {
  return proPriceIds().has(priceId) ? "pro" : "free";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const stripe = getStripeServer();
  const supabaseAdmin = getSupabaseServiceRole();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.client_reference_id || session.metadata?.userId || null;
        const customerId = session.customer as string | null;

        if (!userId) {
          console.error("[Stripe Webhook] No userId in session");
          break;
        }

        if (session.mode === "subscription") {
          const subscriptionId = session.subscription as string;
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const tier =
            priceId && tierFromSubscriptionPrice(priceId) === "pro"
              ? "pro"
              : "free";

          await supabaseAdmin
            .from("user_profiles")
            .update({
              tier,
              stripe_customer_id: customerId ?? undefined,
              stripe_subscription_id: subscriptionId,
              subscription_status: subscription.status ?? "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          console.log(`[Stripe Webhook] User ${userId} checkout subscription → ${tier}`);
          break;
        }

        if (session.mode === "payment") {
          const expanded = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["line_items.data.price"],
          });
          const line = expanded.line_items?.data[0];
          const priceId = line?.price?.id;
          const giftId = giftPriceId();
          let tier: "pro" | "gifted" | "free" = "free";

          if (giftId && priceId === giftId) {
            tier = "gifted";
          } else if (priceId && proPriceIds().has(priceId)) {
            tier = "pro";
          }

          await supabaseAdmin
            .from("user_profiles")
            .update({
              tier,
              stripe_customer_id: customerId ?? undefined,
              stripe_subscription_id: null,
              subscription_status:
                tier === "gifted" ? "gift" : tier === "pro" ? "yearly_paid" : "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          console.log(`[Stripe Webhook] User ${userId} checkout payment → ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id,tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          const priceId = subscription.items.data[0]?.price.id;
          const pro = priceId ? proPriceIds().has(priceId) : false;
          let tier: string = profile.tier ?? "free";

          if (
            status === "active" ||
            status === "trialing" ||
            status === "past_due"
          ) {
            if (pro) tier = "pro";
          } else if (
            ["canceled", "unpaid", "incomplete_expired", "ended"].includes(status)
          ) {
            tier = profile.tier === "gifted" ? "gifted" : "free";
          }

          await supabaseAdmin
            .from("user_profiles")
            .update({
              tier,
              subscription_status: status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id,tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile && profile.tier === "pro") {
          await supabaseAdmin
            .from("user_profiles")
            .update({
              tier: "free",
              subscription_status: "canceled",
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

          console.log(`[Stripe Webhook] User ${profile.id} subscription ended → free`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("user_profiles")
            .update({
              subscription_status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
