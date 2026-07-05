import { Module } from "@nestjs/common";
import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { BillingService } from "./billing.service";

@Module({
  controllers: [StripeController],
  providers: [StripeService, BillingService],
  exports: [StripeService, BillingService],
})
export class StripeModule {}
