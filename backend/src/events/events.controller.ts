import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { EventsService } from "./events.service";

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Batch-ingest analytics events. Owner-authenticated: `SupabaseAuthGuard`
   * verifies the bearer token and the resolved user id is the ONLY source of
   * each row's `user_id` — a client cannot post events as another user.
   *
   * Returns a 207-style summary: HTTP 207 when any row was rejected (valid rows
   * still inserted), otherwise 200.
   */
  @Post("events")
  @UseGuards(SupabaseAuthGuard)
  async ingest(
    @Req() req: Request,
    @Body() body: { events?: unknown },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as any).user as { id: string; email?: string };
    const summary = await this.eventsService.ingest(user.id, body?.events);
    // 207 Multi-Status when any row was rejected (valid rows still inserted); else 200.
    res.status(summary.partial ? 207 : 200);
    return summary;
  }
}
