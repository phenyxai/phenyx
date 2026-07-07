import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StripeModule } from "../stripe/stripe.module";
import { ConstellationController } from "./constellation.controller";
import { ConstellationService } from "./constellation.service";

/**
 * PHE-31 — Constellation read surface. Depends on AuthModule (owner guard) and
 * StripeModule (BillingService tier gate); reuses the observation engine's pure
 * gating helpers (`applyReadGate`) directly, so no dependency on ObservationsModule
 * is needed. SupabaseModule is global.
 */
@Module({
  imports: [AuthModule, StripeModule],
  controllers: [ConstellationController],
  providers: [ConstellationService],
})
export class ConstellationModule {}
