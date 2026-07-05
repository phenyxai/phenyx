import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AccountService } from "./account.service";
import type { AccountDeleteDto } from "./account.dto";

/**
 * PHE-42 — owner-authed account lifecycle endpoints. The guard resolves
 * `req.user.id` from the bearer, so every operation is scoped to the caller: a
 * non-owner is rejected (401/403) and `user_id` is NEVER read from the body.
 */
@Controller("account")
@UseGuards(SupabaseAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Portable JSON dump of everything observed about the owner. Never any token. */
  @Get("export")
  async export(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.accountService.exportAccount(user.id);
  }

  /** Pause Onairos pulls + observation cron + synthesis; data stays readable. */
  @Post("freeze")
  async freeze(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.accountService.setFrozen(user.id, true);
  }

  /** Restore normal operation. */
  @Post("unfreeze")
  async unfreeze(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.accountService.setFrozen(user.id, false);
  }

  /** Permanent, cascading delete — requires the typed confirmation in the body. */
  @Delete()
  async remove(@Req() req: Request, @Body() body: AccountDeleteDto) {
    const user = (req as any).user as { id: string };
    return this.accountService.deleteAccount(user.id, body);
  }
}
