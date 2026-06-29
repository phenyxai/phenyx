import { Global, Module } from "@nestjs/common";
import { VoiceStandardService } from "./voice-standard.service";

/**
 * Global so both the synthesis and persona generators (and future Polaris /
 * observations / foresight / mantra generators) can inject the single
 * VoiceStandardService without re-importing the module.
 */
@Global()
@Module({
  providers: [VoiceStandardService],
  exports: [VoiceStandardService],
})
export class VoiceStandardModule {}
