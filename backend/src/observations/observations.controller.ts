import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
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

  /** Daily feed — `{ mantra, observations }` with v67 card fields (sentence, points, span, explore_prompt). */
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

  /**
   * PHE-72 — persist a `does this land?` verdict and/or evidence-opened flag.
   * Body: `{ verdict: 'new'|'known'|'reading'|null, opened?: boolean }`.
   * `verdict: null` is `change it` and deletes the row.
   */
  @Post(":id/feedback")
  @UseGuards(SupabaseAuthGuard)
  async feedback(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { verdict?: "new" | "known" | "reading" | null; opened?: boolean }
  ) {
    const user = (req as any).user as { id: string };
    return this.observations.upsertFeedback(user.id, id, body);
  }
}
