import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignupStartDto } from "./dto/signup-start.dto";
import { OtpSendDto } from "./dto/otp-send.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";

/**
 * Pre-auth account flow. Routes are unprefixed (no global `/api` prefix in this
 * backend), so this maps to POST /auth/signup/start, /auth/otp/send, and
 * /auth/otp/verify. PHE-12 (signin, reset) adds sibling routes here.
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
}
