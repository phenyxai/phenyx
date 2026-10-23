import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SynthesisController } from "./synthesis.controller";
import { SynthesisService } from "./synthesis.service";
import { CrisisService } from "./crisis.service";
import { TraitProfileService } from "./trait-profile.service";
import { OnairosSnapshotService } from "../persona/onairos-snapshot.service";

@Module({
  imports: [AuthModule],
  controllers: [SynthesisController],
  // OnairosSnapshotService is stateless, so it is provided here directly:
  // PersonaModule imports this module, and importing it back would be a cycle.
  providers: [SynthesisService, CrisisService, TraitProfileService, OnairosSnapshotService],
  // TraitProfileService is exported so the Polaris module (PHE-22, other chain)
  // can inject it cross-module in the P3 reconciliation and call inferTraitInsight.
  // SynthesisService is exported so the profile overview can queue a missing
  // insights reading (PHE-124).
  exports: [CrisisService, TraitProfileService, SynthesisService],
})
export class SynthesisModule {}
