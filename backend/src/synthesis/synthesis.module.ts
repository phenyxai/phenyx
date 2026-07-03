import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SynthesisController } from "./synthesis.controller";
import { SynthesisService } from "./synthesis.service";
import { CrisisService } from "./crisis.service";
import { TraitProfileService } from "./trait-profile.service";

@Module({
  imports: [AuthModule],
  controllers: [SynthesisController],
  providers: [SynthesisService, CrisisService, TraitProfileService],
  // TraitProfileService is exported so the Polaris module (PHE-22, other chain)
  // can inject it cross-module in the P3 reconciliation and call inferTraitInsight.
  exports: [CrisisService, TraitProfileService],
})
export class SynthesisModule {}
