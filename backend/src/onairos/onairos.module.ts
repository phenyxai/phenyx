import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PersonaModule } from "../persona/persona.module";
import { OnairosController } from "./onairos.controller";
import { OnairosService } from "./onairos.service";

/**
 * PHE-40 Onairos server loop. Imports AuthModule for the SupabaseAuthGuard and
 * PersonaModule to reuse OnairosSnapshotService (redaction) + PersonaService
 * (the existing synthesis the connect flow enqueues).
 */
@Module({
  imports: [AuthModule, PersonaModule],
  controllers: [OnairosController],
  providers: [OnairosService],
})
export class OnairosModule {}
