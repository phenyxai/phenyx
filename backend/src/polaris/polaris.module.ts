import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SynthesisModule } from "../synthesis/synthesis.module";
import { PolarisController } from "./polaris.controller";
import { PolarisService } from "./polaris.service";

/**
 * PHE-22 — Polaris answer engine (Lane 5 Chain P foundation).
 *
 * Imports AuthModule for the SupabaseAuthGuard and SynthesisModule for the existing
 * CrisisService (crisis pre-flight on the question). SupabaseService, EncryptionService,
 * and VoiceStandardService are all provided by @Global modules.
 */
@Module({
  imports: [AuthModule, SynthesisModule],
  controllers: [PolarisController],
  providers: [PolarisService],
})
export class PolarisModule {}
