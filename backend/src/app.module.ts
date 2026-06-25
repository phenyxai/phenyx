import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { CommonModule } from "./common/common.module";
import { VoiceStandardModule } from "./voice-standard/voice-standard.module";
import { StripeModule } from "./stripe/stripe.module";
import { SynthesisModule } from "./synthesis/synthesis.module";
import { PersonaModule } from "./persona/persona.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    SupabaseModule,
    VoiceStandardModule,
    AuthModule,
    StripeModule,
    SynthesisModule,
    PersonaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
