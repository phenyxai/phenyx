import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 — read-only Profile-tab surface. Owner-guarded via
 * SupabaseAuthGuard, which populates `req.user` with the authenticated user id.
 */
@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /**
   * Profile-tab overview: display name, connected-platform badges, the 3-item
   * "what we have seen" snapshot, the foresight line, and the tier.
   */
  @Get("overview")
  @UseGuards(SupabaseAuthGuard)
  async overview(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.profile.getOverview(user.id);
  }
}
