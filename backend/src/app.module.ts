import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { VoiceStandardModule } from "./voice-standard/voice-standard.module";
import { StripeModule } from "./stripe/stripe.module";
import { SynthesisModule } from "./synthesis/synthesis.module";
import { PersonaModule } from "./persona/persona.module";
import { PolarisModule } from "./polaris/polaris.module";
import { EventsModule } from "./events/events.module";
import { ObservationsModule } from "./observations/observations.module";
import { DiscoverModule } from "./discover/discover.module";
import { OnairosModule } from "./onairos/onairos.module";
import { AccountModule } from "./account/account.module";
import { ConstellationModule } from "./constellation/constellation.module";
import { ProfileModule } from "./profile/profile.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per-IP HTTP request-rate limiting (defense-in-depth at the transport layer).
    // Baseline global cap; OTP sends carry their own per-email ledger.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(),
    CommonModule,
    SupabaseModule,
    PrismaModule,
    VoiceStandardModule,
    AuthModule,
    StripeModule,
    SynthesisModule,
    PersonaModule,
    PolarisModule,
    EventsModule,
    ObservationsModule,
    DiscoverModule,
    OnairosModule,
    AccountModule,
    ConstellationModule,
    ProfileModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
