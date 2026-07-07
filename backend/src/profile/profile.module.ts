import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 — Profile overview read surface. Depends on AuthModule (owner
 * guard); SupabaseModule is global. No tier gate: the profile header, snapshot,
 * and foresight are shown to every owner (the tier itself is returned in-band).
 */
@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
