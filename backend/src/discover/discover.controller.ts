import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { DiscoverService } from "./discover.service";

/** PHE-103: the discover tab's read, and PHE-129's save. Owner-guarded like the observation feed. */
@Controller("discover")
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  /** `{ discoveries, saved }`: the latest set of up to seven, generated on first visit, and the saved cards. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  async set(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.discover.getSet(user.id);
  }

  /** The ★: `{ saved: true }` keeps the card past its set, `false` lets it go. */
  @Post(":id/save")
  @UseGuards(SupabaseAuthGuard)
  async save(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string, @Body() body: { saved?: unknown }) {
    const user = (req as any).user as { id: string };
    const found = await this.discover.setSaved(user.id, id, body?.saved === true);
    if (!found) throw new NotFoundException();
    return { ok: true };
  }
}
