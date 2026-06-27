import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomInt } from "crypto";
import * as argon2 from "argon2";
import { Resend } from "resend";
import { SupabaseService } from "../supabase/supabase.service";

export type OtpPurpose = "signup" | "signin" | "reset";

export interface SendCodeParams {
  email: string;
  purpose: OtpPurpose;
}

export interface VerifyCodeParams {
  email: string;
  purpose: OtpPurpose;
  code: string;
}

/**
 * Verify outcome. `expired` deliberately also covers the attempt-cap burnout: in
 * both cases the active code is gone and the user must request a new one, which
 * is exactly what the "that code has expired. request a new one below." copy says.
 */
export type OtpVerifyOutcome = "ok" | "invalid" | "expired";

/** Codes live 10 minutes. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Small grace on the expiry check so minor clock skew doesn't reject a fresh code. */
const EXPIRY_SKEW_MS = 5 * 1000;
/** Wrong guesses allowed against one code before it is burned and a resend forced. */
const MAX_ATTEMPTS = 5;
/** Server-side floor under the client's 30s resend cooldown (anti-spam). */
const MIN_RESEND_INTERVAL_MS = 20 * 1000;
/** Hard cap on sends per (email, purpose) within the rolling window. */
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

/**
 * OTP send/verify. PHE-7 shipped a STUB `sendCode`; PHE-9 owns the real thing:
 * a 6-digit code generated, HASHED (Argon2id — the search space is only 10^6, so a
 * fast hash would be trivially reversible if the table leaked), stored per
 * (email, purpose) with a 10-min expiry and an attempt counter, dispatched via
 * Resend. Issuing a new code overwrites the prior row (composite PK), invalidating
 * it. `verifyCode` checks the hash + expiry + attempt cap and consumes on success.
 *
 * Enumeration resistance: `sendCode` behaves identically whether or not an account
 * exists for the email — it never reads auth.users; account resolution happens at
 * verify time in AuthService.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private resendClient: Resend | null = null;

  // In-memory send-rate ledger keyed by `${purpose}:${email}` → send timestamps.
  // Single-instance MVP store (same constraint documented on LoginThrottleService);
  // a multi-instance deploy must back this with a shared store.
  private readonly sendLog = new Map<string, number[]>();

  // OWASP-aligned Argon2id params, matching PassphraseService.
  private readonly hashOptions: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {}

  /**
   * Generate, hash, persist (invalidating any prior code for this email+purpose),
   * and dispatch a 6-digit code. No-ops silently when the send-rate ledger trips,
   * so spam is throttled without leaking anything to the caller.
   */
  async sendCode({ email, purpose }: SendCodeParams): Promise<void> {
    if (!this.allowSend(email, purpose)) {
      // Silent: the caller still returns a generic 200 (no enumeration signal).
      this.logger.warn(`[otp] send throttled purpose=${purpose}`);
      return;
    }

    const code = this.generateCode();
    const codeHash = await argon2.hash(code, this.hashOptions);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    // Upsert on the composite PK: a new code replaces the old hash + expiry and
    // resets attempts, which is what "issuing a new code invalidates the prior" means.
    const { error } = await this.supabase
      .getClient()
      .from("otp_codes")
      .upsert(
        {
          email,
          purpose,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          created_at: nowIso,
        },
        { onConflict: "email,purpose" }
      );

    if (error) {
      this.logger.error(`[otp] failed to persist code: ${error.message}`);
      throw new InternalServerErrorException("could not send code");
    }

    await this.dispatch(email, code, purpose);
  }

  /**
   * Verify a submitted code against the stored hash. Returns:
   *   ok      — code matched and was consumed (deleted);
   *   expired — no time left, or the attempt cap was reached (code burned);
   *   invalid — wrong code (attempts incremented), or no active code on file.
   */
  async verifyCode({ email, purpose, code }: VerifyCodeParams): Promise<OtpVerifyOutcome> {
    const admin = this.supabase.getClient();

    const { data, error } = await admin
      .from("otp_codes")
      .select("code_hash, expires_at, attempts")
      .eq("email", email)
      .eq("purpose", purpose)
      .maybeSingle();

    if (error) {
      this.logger.error(`[otp] verify lookup failed: ${error.message}`);
      return "invalid";
    }
    // No active code: indistinguishable from a wrong code (generic).
    if (!data) return "invalid";

    const now = Date.now();
    const expiresMs = new Date(data.expires_at as string).getTime();
    if (now > expiresMs + EXPIRY_SKEW_MS) {
      await this.deleteCode(email, purpose);
      return "expired";
    }

    const attempts = (data.attempts as number) ?? 0;
    // Defensive: a row already at the cap is treated as burned.
    if (attempts >= MAX_ATTEMPTS) {
      await this.deleteCode(email, purpose);
      return "expired";
    }

    const matched = await argon2
      .verify(data.code_hash as string, code)
      .catch(() => false);
    if (matched) {
      await this.deleteCode(email, purpose); // consume on success
      return "ok";
    }

    // Wrong code: count it. If this crosses the cap, burn the code and force a resend.
    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await this.deleteCode(email, purpose);
      return "expired";
    }
    const { error: updateErr } = await admin
      .from("otp_codes")
      .update({ attempts: nextAttempts })
      .eq("email", email)
      .eq("purpose", purpose);
    if (updateErr) {
      this.logger.error(`[otp] attempt increment failed: ${updateErr.message}`);
    }
    return "invalid";
  }

  // --- internals -----------------------------------------------------------

  /** Cryptographically-secure 6-digit code, zero-padded ("000000".."999999"). */
  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  /** Delete the active code for an email+purpose (consume / burn). */
  private async deleteCode(email: string, purpose: OtpPurpose): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from("otp_codes")
      .delete()
      .eq("email", email)
      .eq("purpose", purpose);
    if (error) this.logger.error(`[otp] code delete failed: ${error.message}`);
  }

  /**
   * Send-rate gate: enforces both a minimum interval between sends and a hard cap
   * per rolling window, per (email, purpose). Returns false when the send should
   * be suppressed.
   */
  private allowSend(email: string, purpose: OtpPurpose): boolean {
    const key = `${purpose}:${email.toLowerCase()}`;
    const now = Date.now();
    const recent = (this.sendLog.get(key) ?? []).filter(
      (t) => now - t < SEND_WINDOW_MS
    );

    const lastSent = recent[recent.length - 1];
    if (lastSent !== undefined && now - lastSent < MIN_RESEND_INTERVAL_MS) {
      this.sendLog.set(key, recent);
      return false;
    }
    if (recent.length >= MAX_SENDS_PER_WINDOW) {
      this.sendLog.set(key, recent);
      return false;
    }

    recent.push(now);
    this.sendLog.set(key, recent);
    return true;
  }

  /**
   * Dispatch the code via Resend. When RESEND_API_KEY is absent (local dev), fall
   * back to logging the code instead of throwing, so the flow works end-to-end
   * without a provider. Provider errors are logged, never surfaced (no enumeration
   * leak, no 500) — the user can simply resend.
   */
  private async dispatch(email: string, code: string, purpose: OtpPurpose): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      this.logger.log(
        `[otp:dev] no RESEND_API_KEY — purpose=${purpose} email=${email} code=${code} ` +
          `(set RESEND_API_KEY to send real email)`
      );
      return;
    }

    const from =
      this.config.get<string>("RESEND_FROM") ?? "phenyx <noreply@phenyx.app>";
    try {
      if (!this.resendClient) this.resendClient = new Resend(apiKey);
      await this.resendClient.emails.send({
        from,
        to: email,
        subject: "your phenyx code",
        text:
          `your 6-digit code is ${code}\n\n` +
          `it expires in 10 minutes. if you didn't request this, you can ignore this email.`,
      });
    } catch (err) {
      this.logger.error(
        `[otp] resend dispatch failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
