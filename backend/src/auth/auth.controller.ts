import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { SignupStartDto } from "./dto/signup-start.dto";
import { OtpSendDto } from "./dto/otp-send.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";

/**
 * Account flow. Routes are unprefixed (no global `/api` prefix in this backend),
 * so this maps to POST /auth/signup/start, /auth/otp/send, /auth/otp/verify and
 * /auth/profile/complete.
 *
 * PHE-97: sign-in is Google (Supabase OAuth, handled by the frontend) or an email
 * code. The name + passphrase sign-in and the passphrase reset routes are gone;
 * passphrase-era accounts sign in with the email code.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup/start")
  @HttpCode(200)
  async signupStart(@Body() dto: SignupStartDto) {
    return this.authService.signupStart(dto);
  }

  /**
   * Send (or resend) an email OTP. Always 200 on well-formed input — the response
   * is a generic `{ maskedEmail }` and never reveals whether an account exists.
   */
  @Post("otp/send")
  @HttpCode(200)
  async otpSend(@Body() dto: OtpSendDto) {
    return this.authService.otpSend({
      email: dto.email,
      draftId: dto.draft_id,
      purpose: dto.purpose,
    });
  }

  /**
   * Verify a submitted OTP. Returns 200 with `{ status, session?, is_new? }`; the
   * status discriminator (`ok` / `invalid` / `expired` / `no_account`) drives the
   * verbatim client copy and avoids leaking outcome via HTTP status codes.
   */
  @Post("otp/verify")
  @HttpCode(200)
  async otpVerify(@Body() dto: OtpVerifyDto) {
    return this.authService.otpVerify({
      email: dto.email,
      draftId: dto.draft_id,
      code: dto.code,
      purpose: dto.purpose,
    });
  }

  /**
   * Complete the caller's profile after an OAuth (Google) sign-in. Bearer-authed:
   * the account is whoever the token belongs to. Idempotent, so the callback runs
   * it on every sign-in; `is_new` is true only the first time (route to welcome).
   */
  @Post("profile/complete")
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  async completeProfile(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.authService.completeOAuthProfile(user.id);
  }
}
