import { Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ConstellationService } from "./constellation.service";

/**
 * PHE-74 — constellation surface. Owner-guarded via SupabaseAuthGuard.
 * Payload: portrait, pillars (with clusters), timeline, moved, tenure. No
 * positions: the client lays the points out itself.
 */
@Controller("constellation")
export class ConstellationController {
  constructor(private readonly constellation: ConstellationService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async get(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.constellation.getConstellation(user.id);
  }

  /** PHE-102 — the new-signal banner was opened; it never shows as new again. */
  @Post("signal/seen")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  async signalSeen(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.constellation.markSignalSeen(user.id);
  }
}
