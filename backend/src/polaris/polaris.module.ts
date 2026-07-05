import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SynthesisModule } from "../synthesis/synthesis.module";
import { StripeModule } from "../stripe/stripe.module";
import { PolarisController } from "./polaris.controller";
import { PolarisService } from "./polaris.service";
import { TokenBudgetService } from "./token-budget.service";

/**
 * PHE-22 — Polaris answer engine (Lane 5 Chain P foundation).
 *
 * Imports AuthModule for the SupabaseAuthGuard, SynthesisModule for the existing
 * CrisisService (crisis pre-flight on the question), and StripeModule for the
 * BillingService tier source of truth (PHE-27 token budget). SupabaseService,
 * EncryptionService, and VoiceStandardService are all provided by @Global modules.
 */
@Module({
  imports: [AuthModule, SynthesisModule, StripeModule],
  controllers: [PolarisController],
  providers: [PolarisService, TokenBudgetService],
})
export class PolarisModule {}
