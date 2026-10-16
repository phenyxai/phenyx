import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { AccountService } from "./account.service";
import { ConfirmCodeService } from "../auth/confirm-code.service";
import type { AccountCloseDto } from "./account.dto";

/**
 * PHE-42 / PHE-75 — owner-authed account lifecycle. The guard resolves
 * `req.user.id` from the bearer, so every operation is scoped to the caller: a
 * non-owner is rejected (401/403) and `user_id` is NEVER read from the body.
 *
 * Freeze/pause is gone (PHE-75): disconnecting through Onairos is the only stop.
 */
@Controller("account")
@UseGuards(SupabaseAuthGuard)
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly confirmCode: ConfirmCodeService
  ) {}

  /** Portable JSON dump of everything observed about the owner. Never any token. */
  @Get("export")
  async export(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.accountService.exportAccount(user.id);
  }

  /** PHE-75: freeze is gone. Disconnect platforms through Onairos. */
  @Post("freeze")
  freeze() {
    throw goneFreeze();
  }

  @Post("unfreeze")
  unfreeze() {
    throw goneFreeze();
  }

  /**
   * PHE-97: email a one-time code to the account's own address. Close account
   * and the name/email edit take it in place of the old passphrase.
   */
  @Post("confirm-code")
  async sendConfirmCode(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.confirmCode.send(user.id);
  }

  /**
   * Two-gate close: the emailed confirm code + typed `delete my account`.
   * Body: `{ code, confirmation }`.
   */
  @Post("close")
  async close(@Req() req: Request, @Body() body: AccountCloseDto) {
    const user = (req as any).user as { id: string };
    return this.accountService.closeAccount(user.id, body);
  }

  /** Same two-gate close as POST /account/close, kept for older clients. */
  @Delete()
  async remove(@Req() req: Request, @Body() body: AccountCloseDto) {
    const user = (req as any).user as { id: string };
    return this.accountService.closeAccount(user.id, body);
  }

  /**
   * Remove constellation content while keeping the account. CORS is POST-only,
   * so this is POST rather than DELETE.
   */
  @Post("constellation")
  async clearConstellation(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.accountService.clearConstellation(user.id);
  }
}

function goneFreeze(): HttpException {
  return new HttpException(
    { error: "gone. disconnect platforms through onairos." },
    410
  );
}
