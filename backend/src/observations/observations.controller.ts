import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ObservationsService } from "./observations.service";

/**
 * Observation engine HTTP surface (PHE-37). All routes are owner-guarded via
 * SupabaseAuthGuard, which populates `req.user` with the authenticated user id.
 */
@Controller("observations")
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  /** Daily feed — `{ mantra, observations }` the dashboard consumes. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  async feed(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.observations.getDailyFeed(user.id);
  }

  /** Constellation timeline — observations grouped by pillar. */
  @Get("timeline")
  @UseGuards(SupabaseAuthGuard)
  async timeline(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.observations.getTimeline(user.id);
  }

  /**
   * Internal idempotent generation entrypoint. PHE-34's `enqueueSynthesis` will
   * call `ObservationsService.generate(userId, { eventId })` directly once Lane 5
   * lands; until then this owner-guarded route triggers generation for the
   * authenticated user. `eventId` (optional) provides best-effort idempotency;
   * durable dedup is the `signal_hash` unique index.
   */
  @Post("generate")
  @UseGuards(SupabaseAuthGuard)
  async generate(@Req() req: Request, @Body() body: { eventId?: string }) {
    const user = (req as any).user as { id: string };
    return this.observations.generate(user.id, {
      eventId: body?.eventId,
      trigger: "signal",
    });
  }
}
