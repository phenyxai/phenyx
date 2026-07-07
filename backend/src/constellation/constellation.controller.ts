import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ConstellationService } from "./constellation.service";

/**
 * PHE-31 — read-only constellation surface. Owner-guarded via SupabaseAuthGuard,
 * which populates `req.user` with the authenticated user id.
 */
@Controller("constellation")
export class ConstellationController {
  constructor(private readonly constellation: ConstellationService) {}

  /**
   * The authed user's constellation: active pillar scores + syntheses, the locked
   * pillars, portrait, mantra, foresight, version, and the tier-gated observations
   * timeline grouped per pillar. Free/paid gating reuses BillingService +
   * applyReadGate, so it matches the daily feed and timeline routes exactly.
   */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  async get(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.constellation.getConstellation(user.id);
  }
}
