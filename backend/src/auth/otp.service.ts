import { Injectable, Logger } from "@nestjs/common";

export type OtpPurpose = "signup" | "signin" | "reset";

export interface SendCodeParams {
  email: string;
  purpose: OtpPurpose;
}

/**
 * OTP send/verify seam.
 *
 * PHE-7 ships a STUB so signup/start has something to call. PHE-9 owns the real
 * implementation (code generation + hashed storage + expiry + Resend dispatch,
 * plus a verify path) and should replace the body of `sendCode` rather than the
 * shape — callers (AuthService.signupStart) stay unchanged.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  async sendCode({ email, purpose }: SendCodeParams): Promise<void> {
    // STUB: generate a 6-digit code and log it. No email is sent yet (PHE-9).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.logger.log(
      `[otp:stub] purpose=${purpose} email=${email} code=${code} ` +
        `(no email dispatched — PHE-9 will wire Resend + verification)`
    );
  }
}
