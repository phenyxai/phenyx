import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import { PassphraseService, PASSPHRASE_ALGO } from "./passphrase.service";

/** Reset links live 45 minutes — inside the ticket's 30–60 min window. */
const TOKEN_TTL_MS = 45 * 60 * 1000;
/** Raw token entropy: 32 bytes → 256 bits, not brute-forceable. */
const TOKEN_BYTES = 32;

/** Per (email|ip) request-rate limiting, mirroring OtpService's send ledger. */
const MIN_REQUEST_INTERVAL_MS = 30 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

/** Optional request context for per-IP rate limiting. */
export interface ResetRequestContext {
  ip?: string;
}

/**
 * Passphrase reset (PHE-12). The request path is enumeration-resistant — the
 * controller always answers 200 and this service silently no-ops for an unknown
 * email or a tripped rate limit, emailing a link only when the email maps to a
 * real account.
 *
 * Token scheme: a high-entropy random token is generated and emailed in the link;
 * only its keyed HMAC (EncryptionService.sign) is stored in
 * passphrase_reset_tokens.token_hash. The HMAC is both the integrity check
 * ("signing") and the non-reversible at-rest form. Single-use is enforced by
 * used_at; confirming a reset also burns every other outstanding token for the
 * user and rotates the (app-unused) GoTrue password to revoke existing sessions.
 */
@Injectable()
export class PassphraseResetService {
  private readonly logger = new Logger(PassphraseResetService.name);
  private resendClient: Resend | null = null;

  // In-memory request ledger keyed by `email:<addr>` / `ip:<addr>` → timestamps.
  // Single-instance MVP store (same constraint as OtpService.sendLog).
  private readonly requestLog = new Map<string, number[]>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly passphrase: PassphraseService
  ) {}

  /**
   * Issue a reset link for an email. Always resolves (the caller returns 200
   * regardless). Silently no-ops when the rate limit trips or the email maps to
   * no account, so nothing about account existence leaks.
   */
  async requestReset(email: string, ctx: ResetRequestContext = {}): Promise<void> {
    if (!this.allowRequest(email, ctx.ip)) {
      this.logger.warn(`[reset] request throttled`);
      return;
    }

    const userId = await this.resolveUserId(email);
    if (!userId) {
      // Unknown email: no row, no email — indistinguishable from a hit.
      return;
    }

    const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
    const tokenHash = this.encryption.sign(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error } = await this.supabase
      .getClient()
      .from("passphrase_reset_tokens")
      .insert({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt });

    if (error) {
      // Never echo the token; log only the failure so the user can retry.
      this.logger.error(`[reset] token insert failed: ${error.message}`);
      return;
    }

    await this.dispatchResetEmail(email, rawToken);
  }

  /**
   * Consume a reset token and set a new passphrase. Returns true only when the
   * token validated (correct signature, unexpired, unused) and the new Argon2id
   * hash was written. Any failure returns false — the caller surfaces one
   * generic "invalid or expired" message (no distinction, no hint).
   *
   * On success: the new hash overwrites user_profiles.passphrase_hash (by `id`),
   * this token AND every other outstanding token for the user are marked used,
   * and existing sessions are invalidated (force re-login).
   */
  async confirmReset(token: string, newPassphrase: string): Promise<boolean> {
    const admin = this.supabase.getClient();
    const tokenHash = this.encryption.sign(token);

    const { data, error } = await admin
      .from("passphrase_reset_tokens")
      .select("token_hash, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      this.logger.error(`[reset] token lookup failed: ${error.message}`);
      return false;
    }
    // Unknown / tampered token, already used, or expired all fail closed.
    if (!data) return false;
    if (data.used_at) return false;
    if (new Date(data.expires_at as string).getTime() < Date.now()) return false;

    const userId = data.user_id as string;
    const newHash = await this.passphrase.hash(newPassphrase);

    // Overwrite the credential. user_profiles is keyed by `id` (= auth.users.id).
    const { error: updateErr } = await admin
      .from("user_profiles")
      .update({ passphrase_hash: newHash, passphrase_algo: PASSPHRASE_ALGO })
      .eq("id", userId);
    if (updateErr) {
      this.logger.error(`[reset] passphrase overwrite failed: ${updateErr.message}`);
      return false;
    }

    // Burn this token and every other outstanding (unused) token for the user.
    const { error: burnErr } = await admin
      .from("passphrase_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("used_at", null);
    if (burnErr) {
      // Non-fatal: the passphrase is already changed; log so it can be swept.
      this.logger.error(`[reset] token burn failed: ${burnErr.message}`);
    }

    await this.invalidateSessions(userId);
    return true;
  }

  // --- internals -----------------------------------------------------------

  /**
   * Resolve an account id from an email without leaking existence to the caller.
   * generateLink(recovery) errors for an unknown email (returning null here) and
   * otherwise hands back the user — the same admin primitive AuthService.mintSession
   * relies on. The recovery token it mints is never emailed or stored, so it is
   * inert: only this server ever sees it.
   */
  private async resolveUserId(email: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.user) return null;
    return data.user.id;
  }

  /**
   * Revoke the user's existing sessions by rotating their GoTrue password to a
   * fresh random value. The app never signs in with the GoTrue password (sessions
   * are minted via magiclink/recovery exchange), so rotating it is invisible to
   * the name+passphrase flow — its only effect is GoTrue revoking the user's
   * refresh tokens, forcing a re-login. The short-lived access JWT lives out its
   * remaining TTL (inherent to stateless JWTs); refresh-token revocation is the
   * meaningful control. Best-effort: a failure is logged, not surfaced.
   */
  private async invalidateSessions(userId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .auth.admin.updateUserById(userId, {
        password: randomBytes(32).toString("hex"),
      });
    if (error) {
      this.logger.error(`[reset] session invalidation failed: ${error.message}`);
    }
  }

  /**
   * Request-rate gate per (email, ip): a minimum interval between requests and a
   * hard cap per rolling window on each key. Returns false when either key trips
   * so the send is suppressed (the caller still returns a generic 200).
   */
  private allowRequest(email: string, ip?: string): boolean {
    const keys = [`email:${email.toLowerCase()}`];
    if (ip) keys.push(`ip:${ip}`);
    const now = Date.now();

    // Evaluate all keys first; only record the send if every key permits it.
    const pruned: Array<{ key: string; recent: number[] }> = [];
    for (const key of keys) {
      const recent = (this.requestLog.get(key) ?? []).filter(
        (t) => now - t < REQUEST_WINDOW_MS
      );
      const lastSent = recent[recent.length - 1];
      if (lastSent !== undefined && now - lastSent < MIN_REQUEST_INTERVAL_MS) {
        this.requestLog.set(key, recent);
        return false;
      }
      if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
        this.requestLog.set(key, recent);
        return false;
      }
      pruned.push({ key, recent });
    }

    for (const { key, recent } of pruned) {
      recent.push(now);
      this.requestLog.set(key, recent);
    }
    return true;
  }

  /**
   * Email the reset link via Resend. When RESEND_API_KEY is absent (local dev),
   * log the link instead of throwing so the flow works end-to-end without a
   * provider (the pattern OtpService established). Provider errors are logged,
   * never surfaced — the user can simply request another link.
   */
  private async dispatchResetEmail(email: string, rawToken: string): Promise<void> {
    // FRONTEND_ORIGIN may be a comma-separated list (see main.ts CORS setup).
    // The reset link needs a single canonical origin — use the first entry.
    const origin = (this.config.get<string>("FRONTEND_ORIGIN") ?? "")
      .split(",")[0]
      .trim();
    const link = `${origin}/reset?token=${encodeURIComponent(rawToken)}`;

    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      this.logger.log(
        `[reset:dev] no RESEND_API_KEY — email=${email} link=${link} ` +
          `(set RESEND_API_KEY to send real email)`
      );
      return;
    }

    const from =
      this.config.get<string>("RESEND_FROM") ?? "phenyx <noreply@phenyx.app>";
    try {
      if (!this.resendClient) this.resendClient = new Resend(apiKey);
      // Resend returns API-level failures in `{ error }` (it does NOT throw),
      // so check it explicitly — otherwise a bad key / unverified-domain /
      // test-recipient rejection drops the email silently with no log.
      const { error } = await this.resendClient.emails.send({
        from,
        to: email,
        subject: "reset your phenyx passphrase",
        text:
          `someone asked to reset the passphrase for your phenyx account.\n\n` +
          `set a new one here (the link expires in 45 minutes):\n${link}\n\n` +
          `if this wasn't you, you can ignore this email — nothing has changed.`,
      });
      if (error) {
        this.logger.error(
          `[reset] resend rejected the send: ${
            error.message ?? JSON.stringify(error)
          }`
        );
      }
    } catch (err) {
      this.logger.error(
        `[reset] resend dispatch failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
