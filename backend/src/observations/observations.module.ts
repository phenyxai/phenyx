import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StripeModule } from "../stripe/stripe.module";
import { ObservationsController } from "./observations.controller";
import { ObservationsService } from "./observations.service";
import { ObservationsCron } from "./observations.cron";

/**
 * PHE-37 — Observation Generation Engine module. Depends on AuthModule (owner
 * guard), StripeModule (BillingService tier gate), and the globally-registered
 * SupabaseModule / VoiceStandardModule. Exports the service so PHE-34's synthesis
 * lane can enqueue generation once Lane 5 lands.
 */
@Module({
  imports: [AuthModule, StripeModule],
  controllers: [ObservationsController],
  providers: [ObservationsService, ObservationsCron],
  exports: [ObservationsService],
})
export class ObservationsModule {}
