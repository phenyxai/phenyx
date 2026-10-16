import { HttpException, Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OtpService } from "./otp.service";

/**
 * PHE-97 — "confirm it is you" for a signed-in person, now that there is no
 * passphrase. Sensitive settings actions (close the account, change name or
 * email) send a one-time code to the email on the account and accept it in
 * place of the old passphrase. Codes use the OTP machinery under the `confirm`
 * purpose, so they never satisfy a sign-in and a sign-in code never satisfies
 * them.
 *
 * The recipient is always the auth user's own email, resolved from the id the
 * guard took from the bearer; it is never read from the request body.
 */
@Injectable()
export class ConfirmCodeService {
  private readonly logger = new Logger(ConfirmCodeService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly otp: OtpService
  ) {}

  /** Email a confirm code to the account's own address. */
  async send(userId: string): Promise<{ sent: true }> {
    const email = await this.emailFor(userId);
    if (!email) {
      throw new HttpException({ error: "could not send a code. please try again." }, 400);
    }
    await this.otp.sendCode({ email, purpose: "confirm" });
    return { sent: true };
  }

  /**
   * Throws a 400 with the person-facing copy unless `code` is the live confirm
   * code for this account. A matching code is consumed.
   */
  async assertValid(userId: string, code: unknown): Promise<void> {
    const digits = readCode(code);
    if (!digits) {
      throw new HttpException({ error: CONFIRM_CODE_MISSING }, 400);
    }
    const email = await this.emailFor(userId);
    if (!email) {
      throw new HttpException({ error: CONFIRM_CODE_INVALID }, 400);
    }
    const outcome = await this.otp.verifyCode({ email, purpose: "confirm", code: digits });
    if (outcome === "expired") {
      throw new HttpException({ error: CONFIRM_CODE_EXPIRED }, 400);
    }
    if (outcome !== "ok") {
      throw new HttpException({ error: CONFIRM_CODE_INVALID }, 400);
    }
  }

  private async emailFor(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.getClient().auth.admin.getUserById(userId);
    if (error) {
      this.logger.error(`confirm code: user lookup failed: ${error.message}`);
      return null;
    }
    const email = data?.user?.email?.trim().toLowerCase();
    return email || null;
  }
}

export const CONFIRM_CODE_MISSING = "enter the code we sent to your email.";
export const CONFIRM_CODE_INVALID = "that code didn’t work. check it and try again.";
export const CONFIRM_CODE_EXPIRED = "that code has expired. send a new one.";

/** Digits only, capped at 6; anything else reads as no code. */
export function readCode(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : "";
}
