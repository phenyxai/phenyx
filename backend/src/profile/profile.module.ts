import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 / PHE-75 — Profile overview + identity/notification writes.
 * Depends on AuthModule (owner guard + PassphraseService); SupabaseModule is
 * global. No tier gate. Gifted is never returned as product copy.
 */
@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
