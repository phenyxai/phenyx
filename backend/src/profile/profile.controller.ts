import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { ProfileService } from "./profile.service";

/**
 * PHE-30 / PHE-38 / PHE-75 — Profile-tab surface. Owner-guarded via
 * SupabaseAuthGuard, which populates `req.user` with the authenticated user id.
 */
@Controller("profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /**
   * Profile-tab overview: identity, platforms, stellar colour, held constants,
   * and notification prefs. Tier is returned as `free` | `pro` only.
   */
  @Get("overview")
  @UseGuards(SupabaseAuthGuard)
  async overview(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.profile.getOverview(user.id);
  }

  /** Name/email edits require the current passphrase. */
  @Post("identity")
  @UseGuards(SupabaseAuthGuard)
  async identity(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const user = (req as any).user as { id: string };
    return this.profile.updateIdentity(user.id, body);
  }

  @Get("notifications")
  @UseGuards(SupabaseAuthGuard)
  async getNotifications(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return { notification_prefs: await this.profile.getNotifications(user.id) };
  }

  @Post("notifications")
  @UseGuards(SupabaseAuthGuard)
  async saveNotifications(
    @Req() req: Request,
    @Body() body: { notification_prefs?: Record<string, boolean> }
  ) {
    const user = (req as any).user as { id: string };
    return this.profile.saveNotifications(user.id, body?.notification_prefs);
  }
}
