import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { DiscoverService, REVEAL_MAX } from "./discover.service";

/** PHE-103: the discover tab's read; PHE-129's save and reveal. Owner-guarded like the observation feed. */
@Controller("discover")
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  /** `{ deck, saved, allowance }`. `tz` is the browser's time zone: the week opens monday 9am there. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  async deck(@Req() req: Request, @Query("tz") tz?: string) {
    const user = (req as any).user as { id: string };
    return this.discover.getDeck(user.id, tz);
  }

  /** "use discoveries": `{ count, tz }` adds that many to the deck from the week's allowance, then bought ones. */
  @Post("reveal")
  @UseGuards(SupabaseAuthGuard)
  async reveal(@Req() req: Request, @Body() body: { count?: unknown; tz?: unknown }) {
    const user = (req as any).user as { id: string };
    const count = Number(body?.count);
    if (!Number.isInteger(count) || count < 1 || count > REVEAL_MAX) throw new BadRequestException();
    return this.discover.reveal(user.id, count, body?.tz);
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
