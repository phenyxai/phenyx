import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DiscoverController } from "./discover.controller";
import { DiscoverService } from "./discover.service";

/** PHE-103 discover tab. Supabase and the Voice Standard are global modules. */
@Module({
  imports: [AuthModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
})
export class DiscoverModule {}
