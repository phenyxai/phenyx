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
        // Pinned runtime API version. Cast guards against stripe-SDK "apiVersion"
        // literal-type drift when the lockfile-less install pulls a newer patch
        // (see project memory: stripe drift). Does not change the version sent.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiVersion: "2026-04-22.dahlia" as any,
      });
    }
    return this.stripe;
  }
}
