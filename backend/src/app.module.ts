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
import { ObservationsModule } from "./observations/observations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per-IP HTTP request-rate limiting (defense-in-depth at the transport layer,
    // complementing the per-account/per-IP failure lockout in LoginThrottleService).
    // Baseline global cap; PHE-12 should add a tighter @Throttle on POST /auth/signin
    // (e.g. { limit: 5, ttl: 60000 }) for the brute-force-sensitive verify route.
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
    ObservationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
