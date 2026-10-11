import { Module } from "@nestjs/common";
import { PersonaService } from "./persona.service";
import { OnairosSnapshotService } from "./onairos-snapshot.service";

@Module({
  providers: [PersonaService, OnairosSnapshotService],
  // Exported so PHE-40's OnairosModule reuses the same redaction + synthesis.
  exports: [PersonaService, OnairosSnapshotService],
})
export class PersonaModule {}
