import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ConstellationService } from "./constellation.service";

/**
 * PHE-74 — constellation surface. Owner-guarded via SupabaseAuthGuard.
 * Payload: points, portrait, pillars (with clusters), timeline, moved, tenure.
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
}
