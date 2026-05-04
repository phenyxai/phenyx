import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SynthesisController } from "./synthesis.controller";
import { SynthesisService } from "./synthesis.service";
import { CrisisService } from "./crisis.service";

@Module({
  imports: [AuthModule],
  controllers: [SynthesisController],
  providers: [SynthesisService, CrisisService],
  exports: [CrisisService],
})
export class SynthesisModule {}
