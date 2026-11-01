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
  constructor(private readonly accountService: AccountService) {}

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

  /** Close, confirmed by the typed `delete my account`. Body: `{ confirmation }`. */
  @Post("close")
  async close(@Req() req: Request, @Body() body: AccountCloseDto) {
    const user = (req as any).user as { id: string };
    return this.accountService.closeAccount(user.id, body);
  }

  /** Same close as POST /account/close, kept for older clients. */
  @Delete()
  async remove(@Req() req: Request, @Body() body: AccountCloseDto) {
    const user = (req as any).user as { id: string };
    return this.accountService.closeAccount(user.id, body);
  }
}

function goneFreeze(): HttpException {
  return new HttpException(
    { error: "gone. disconnect platforms through onairos." },
    410
  );
}
