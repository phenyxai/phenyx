import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StripeModule } from "../stripe/stripe.module";
import { DiscoverController } from "./discover.controller";
import { DiscoverService } from "./discover.service";

/** PHE-103 discover tab. Supabase and the Voice Standard are global modules; StripeModule gives the plan's weekly count. */
@Module({
  imports: [AuthModule, StripeModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
})
export class DiscoverModule {}
