import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import StripeSDK from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  getClient(): Stripe {
    if (!this.stripe) {
      const key = this.config.get<string>("STRIPE_SECRET_KEY");
      if (!key) {
        throw new Error("Missing STRIPE_SECRET_KEY");
      }
      this.stripe = new StripeSDK(key, {
        // Pin the account's API version. Cast decouples this literal from the
        // SDK's bundled LatestApiVersion type, which bumps on patch releases
        // (stripe@22.3.0 expects 2026-06-24.dahlia) and would otherwise break
        // the build whenever the pinned dahlia date differs from the SDK's.
        apiVersion: "2026-04-22.dahlia" as NonNullable<
          ConstructorParameters<typeof StripeSDK>[1]
        >["apiVersion"],
      });
    }
    return this.stripe;
  }
}
