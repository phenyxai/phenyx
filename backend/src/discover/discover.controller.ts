import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { DiscoverService } from "./discover.service";

/** PHE-103: the discover tab's one read. Owner-guarded like the observation feed. */
@Controller("discover")
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  /** `{ discoveries }`: the latest set of up to seven, generated on first visit. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  async set(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.discover.getSet(user.id);
  }
}
