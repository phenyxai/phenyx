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
        apiVersion: "2026-04-22.dahlia",
      });
    }
    return this.stripe;
  }
}
