import { Module } from "@nestjs/common";
import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { BillingService } from "./billing.service";
import { PolarisBudgetService } from "./polaris-budget.service";

@Module({
  controllers: [StripeController],
  providers: [StripeService, BillingService, PolarisBudgetService],
  exports: [StripeService, BillingService, PolarisBudgetService],
})
export class StripeModule {}
