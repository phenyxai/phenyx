import { Module } from "@nestjs/common";
import { PersonaService } from "./persona.service";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { SynthesisModule } from "../synthesis/synthesis.module";
import { ObservationsModule } from "../observations/observations.module";

@Module({
  // A new constellation version queues moments, then the insights reading.
  imports: [SynthesisModule, ObservationsModule],
  providers: [PersonaService, OnairosSnapshotService],
  // Exported so PHE-40's OnairosModule reuses the same redaction + synthesis.
  exports: [PersonaService, OnairosSnapshotService],
})
export class PersonaModule {}
