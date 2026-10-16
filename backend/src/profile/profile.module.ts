import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StripeModule } from "../stripe/stripe.module";
import { SynthesisModule } from "../synthesis/synthesis.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 / PHE-75 / PHE-95 — Profile overview + identity/notification
 * writes. Depends on AuthModule (owner guard + ConfirmCodeService),
 * StripeModule (renewal date for the subscription modal) and SynthesisModule
 * (queues a missing insights reading); SupabaseModule is global. No tier gate. Gifted is never returned as product copy.
 */
@Module({
  imports: [AuthModule, StripeModule, SynthesisModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
