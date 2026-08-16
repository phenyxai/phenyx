import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { StripeService } from "./stripe.service";
import { SupabaseService } from "../supabase/supabase.service";
import type { Stripe } from "stripe/cjs/stripe.core.js";

type CheckoutKind = "pro" | "gift";

interface CheckoutBody {
  checkoutKind?: CheckoutKind;
  userId?: string;
  billingPeriod?: "monthly" | "yearly";
}

interface BillingPortalBody {
  userId?: string;
}

@Controller("stripe")
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService
  ) {}

  /**
   * POST /stripe/checkout
   * Body: { checkoutKind: "pro" | "gift", userId: string, billingPeriod?: "monthly" | "yearly" }
   */
  @Post("checkout")
  async checkout(@Body() body: CheckoutBody, @Headers() headers: Record<string, string>) {
    try {
      const stripe = this.stripeService.getClient();
      const { checkoutKind, userId, billingPeriod } = body;

      if (!checkoutKind || !userId) {
        throw new HttpException(
          { error: "Missing checkoutKind or userId" },
          400
        );
      }

      const proMonthly = this.config.get<string>("STRIPE_PRO_MONTHLY_PRICE_ID");
      const proYearly = this.config.get<string>("STRIPE_PRO_YEARLY_PRICE_ID");
      const giftPrice = this.config.get<string>("STRIPE_GIFT_PRICE_ID");

      const origin = headers["origin"] || "http://localhost:3000";

      if (checkoutKind === "gift") {
        if (!giftPrice) {
          throw new HttpException(
            { error: "Gift checkout not configured" },
            500
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

        return {
          sessionId: session.id,
          url: session.url ?? null,
        };
      }

      if (checkoutKind !== "pro") {
        throw new HttpException({ error: "Invalid checkoutKind" }, 400);
      }

      if (billingPeriod !== "monthly" && billingPeriod !== "yearly") {
        throw new HttpException(
          { error: "Pro checkout requires billingPeriod monthly or yearly" },
          400
        );
      }

      if (billingPeriod === "monthly") {
        if (!proMonthly) {
          throw new HttpException(
            { error: "Pro monthly price not configured" },
            500
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

        return {
          sessionId: session.id,
          url: session.url ?? null,
        };
      }

      // Yearly: one-time payment (Price is one_time in Stripe)
      if (!proYearly) {
        throw new HttpException(
          { error: "Pro yearly price not configured" },
          500
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

      return {
        sessionId: session.id,
        url: session.url ?? null,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error({ msg: "checkout_failed", err: String(err) });
      throw new HttpException(
        { error: "Failed to create checkout session" },
        500
      );
    }
  }

  /**
   * POST /stripe/webhook
   * Stripe-signed; raw body is mounted in main.ts via express.raw().
   */
  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request,
    @Headers("stripe-signature") signature: string | undefined
  ) {
    if (!signature) {
      throw new HttpException({ error: "No signature" }, 400);
    }

    const stripe = this.stripeService.getClient();
    const supabaseAdmin = this.supabaseService.getClient();
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;
    try {
      // req.body is a Buffer because /stripe/webhook is mounted with express.raw().
      const rawBody = req.body as Buffer;
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret as string
      );
    } catch (err) {
      this.logger.error({
        msg: "webhook_signature_verification_failed",
        err: String(err),
      });
      throw new HttpException({ error: "Invalid signature" }, 400);
    }

    const proPriceIds = (): Set<string> => {
      const ids = [
        this.config.get<string>("STRIPE_PRO_MONTHLY_PRICE_ID"),
        this.config.get<string>("STRIPE_PRO_YEARLY_PRICE_ID"),
      ].filter(Boolean) as string[];
      return new Set(ids);
    };
    const giftPriceId = (): string | undefined =>
      this.config.get<string>("STRIPE_GIFT_PRICE_ID");
    const tierFromSubscriptionPrice = (priceId: string): "free" | "pro" =>
      proPriceIds().has(priceId) ? "pro" : "free";

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId =
            session.client_reference_id || session.metadata?.userId || null;
          const customerId = session.customer as string | null;

          if (!userId) {
            this.logger.error({
              msg: "webhook_missing_user_id",
              event_id: event.id,
              event_type: event.type,
            });
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

            this.logger.log({
              msg: "webhook_checkout_subscription",
              event_id: event.id,
              user_id: userId,
              tier,
              status: subscription.status,
            });
            break;
          }

          if (session.mode === "payment") {
            const expanded = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ["line_items.data.price"],
            });
            const line = expanded.line_items?.data[0];
            const priceId = line?.price?.id;
            const giftId = giftPriceId();
            const topupId = this.config.get<string>("STRIPE_POLARIS_TOPUP_PRICE_ID");

            // One-time Polaris top-ups must not touch `user_profiles.tier`.
            // Unknown prices used to fall through to `free` and wipe Pro.
            if (topupId && priceId === topupId) {
              this.logger.log({
                msg: "webhook_checkout_topup_no_tier_change",
                event_id: event.id,
                user_id: userId,
                price_id: priceId,
              });
              break;
            }

            let tier: "pro" | "gifted" | "free" | null = null;
            if (giftId && priceId === giftId) {
              tier = "gifted";
            } else if (priceId && proPriceIds().has(priceId)) {
              tier = "pro";
            } else {
              this.logger.error({
                msg: "webhook_checkout_payment_unknown_price",
                event_id: event.id,
                user_id: userId,
                price_id: priceId,
              });
              break;
            }

            await supabaseAdmin
              .from("user_profiles")
              .update({
                tier,
                stripe_customer_id: customerId ?? undefined,
                stripe_subscription_id: null,
                subscription_status:
                  tier === "gifted"
                    ? "gift"
                    : tier === "pro"
                    ? "yearly_paid"
                    : "inactive",
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId);

            this.logger.log({
              msg: "webhook_checkout_payment",
              event_id: event.id,
              user_id: userId,
              tier,
            });
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
              ["canceled", "unpaid", "incomplete_expired", "ended"].includes(
                status
              )
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

            this.logger.log({
              msg: "webhook_subscription_ended",
              event_id: event.id,
              user_id: profile.id,
              tier: "free",
            });
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
          this.logger.log({
            msg: "webhook_unhandled_event",
            event_id: event.id,
            event_type: event.type,
          });
      }

      return { received: true };
    } catch (err) {
      this.logger.error({
        msg: "webhook_processing_failed",
        event_id: event.id,
        event_type: event.type,
        err: String(err),
      });
      throw new HttpException({ error: "Webhook handler failed" }, 500);
    }
  }

  /**
   * POST /stripe/billing-portal
   * Body: { userId: string }
   */
  @Post("billing-portal")
  async billingPortal(
    @Body() body: BillingPortalBody,
    @Headers() headers: Record<string, string>
  ) {
    try {
      const { userId } = body;
      if (!userId) {
        throw new HttpException({ error: "Missing userId" }, 400);
      }

      const supabase = this.supabaseService.getClient();
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();

      if (error || !profile?.stripe_customer_id) {
        throw new HttpException({ error: "No billing account on file" }, 400);
      }

      const origin = headers["origin"] || "http://localhost:3000";
      const stripe = this.stripeService.getClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${origin}/settings`,
      });

      return { url: session.url };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error({ msg: "billing_portal_failed", err: String(e) });
      throw new HttpException({ error: "Portal failed" }, 500);
    }
  }
}
