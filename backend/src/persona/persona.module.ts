import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PersonaController } from "./persona.controller";
import { PersonaService } from "./persona.service";
import { OnairosSnapshotService } from "./onairos-snapshot.service";

@Module({
  imports: [AuthModule],
  controllers: [PersonaController],
  providers: [PersonaService, OnairosSnapshotService],
})
export class PersonaModule {}
