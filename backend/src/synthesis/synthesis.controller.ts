import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SynthesisService } from "./synthesis.service";

interface SynthesizeBody {
  trait_object?: unknown;
  archetype?: string;
  intention?: string;
  trigger_event_id?: string;
}

@Controller()
export class SynthesisController {
  constructor(private readonly synthesisService: SynthesisService) {}

  /** PHE-34 — trait-object → constellation synthesis. */
  @Post("synthesize-constellation")
  @UseGuards(SupabaseAuthGuard)
  async synthesize(
    @Req() req: Request,
    @Body() body: SynthesizeBody
  ): Promise<unknown> {
    const user = (req as any).user as { id: string; email?: string };
    return this.synthesisService.synthesize(user.id, body);
  }

  /**
   * PHE-36 — Daily-tab mantra. Returns the cached mantra for the current version
   * without a Claude call when present; regenerates only when it is null.
   */
  @Get("daily/mantra")
  @UseGuards(SupabaseAuthGuard)
  async dailyMantra(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.synthesisService.getDailyMantra(user.id);
  }

  /** PHE-38 — manual foresight refresh keyed to the current version. */
  @Post("foresight/refresh")
  @UseGuards(SupabaseAuthGuard)
  async refreshForesight(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.synthesisService.refreshForesight(user.id);
  }
}
