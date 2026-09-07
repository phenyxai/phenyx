import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StripeModule } from "../stripe/stripe.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 / PHE-75 / PHE-95 — Profile overview + identity/notification
 * writes. Depends on AuthModule (owner guard + PassphraseService) and
 * StripeModule (renewal date for the subscription modal); SupabaseModule is
 * global. No tier gate. Gifted is never returned as product copy.
 */
@Module({
  imports: [AuthModule, StripeModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
