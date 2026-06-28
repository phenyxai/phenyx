import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { PassphraseResetService } from "./passphrase-reset.service";
import { SignupStartDto } from "./dto/signup-start.dto";
import { OtpSendDto } from "./dto/otp-send.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";
import { SigninDto } from "./dto/signin.dto";
import { PassphraseResetRequestDto } from "./dto/passphrase-reset-request.dto";
import { PassphraseResetConfirmDto } from "./dto/passphrase-reset-confirm.dto";

/**
 * Pre-auth account flow. Routes are unprefixed (no global `/api` prefix in this
 * backend), so this maps to POST /auth/signup/start, /auth/otp/send,
 * /auth/otp/verify, /auth/signin, and /auth/passphrase/reset/{request,confirm}.
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passphraseReset: PassphraseResetService
  ) {}

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
   * Verify a submitted OTP. Returns 200 with `{ status, session? }`; the status
   * discriminator (`ok` / `invalid` / `expired`) drives the verbatim client copy
   * and avoids leaking outcome via HTTP status codes.
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
   * Returning-user sign-in (name + passphrase). Returns 200 with `{ ok, session? }`:
   * `ok: true` carries the session, `ok: false` is the single generic failure for
   * an unknown name OR a wrong passphrase (no enumeration via body or status).
   * A tighter per-IP throttle than the global guard guards this brute-force-
   * sensitive route; LoginThrottleService adds per-account/per-IP failure lockout
   * (it throws 429 when locked).
   */
  @Post("signin")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signin(@Body() dto: SigninDto, @Req() req: Request) {
    const result = await this.authService.signin(dto.name, dto.passphrase, {
      ip: req.ip,
    });
    if (!result) return { ok: false };
    return { ok: true, session: result.session };
  }

  /**
   * Request a passphrase reset link. ALWAYS 200 with `{ ok: true }` regardless of
   * whether the email maps to an account (enumeration resistance); a link is sent
   * only when it does. Per-email/IP rate limiting lives in the service.
   */
  @Post("passphrase/reset/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async passphraseResetRequest(
    @Body() dto: PassphraseResetRequestDto,
    @Req() req: Request
  ) {
    await this.passphraseReset.requestReset(dto.email, { ip: req.ip });
    return { ok: true };
  }

  /**
   * Confirm a passphrase reset: set the new passphrase using a single-use token.
   * Returns 200 with `{ ok }` — `false` covers an invalid, expired, or already-used
   * token with one generic outcome.
   */
  @Post("passphrase/reset/confirm")
  @HttpCode(200)
  async passphraseResetConfirm(@Body() dto: PassphraseResetConfirmDto) {
    const ok = await this.passphraseReset.confirmReset(
      dto.token,
      dto.newPassphrase
    );
    return { ok };
  }
}
