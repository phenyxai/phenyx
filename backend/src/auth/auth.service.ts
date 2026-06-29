import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { OtpService } from "./otp.service";
import { PassphraseService } from "./passphrase.service";
import { LoginThrottleService } from "./login-throttle.service";
import { SignupStartDto } from "./dto/signup-start.dto";

/** Pending signups live ~15 minutes; an expired draft sends the user back to s1. */
const DRAFT_TTL_MINUTES = 15;

/**
 * Upper bound on candidate accounts loaded for one name. Names are not unique,
 * but a single name resolving to many accounts is pathological; cap the work so
 * verification time (and Argon2 cost) stays bounded regardless of input.
 */
const MAX_NAME_CANDIDATES = 25;

export interface SignupStartResult {
  draft_id: string;
  maskedEmail: string;
}

/** Returned to the (future) signin route on a successful name+passphrase match. */
export interface VerifiedCredential {
  userId: string;
  displayName: string | null;
}

/** Optional request context for the verify path (per-IP throttling). */
export interface VerifyContext {
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * A real Argon2id hash of a throwaway value, verified against on a name miss
   * so a non-existent account costs the same wall-clock time as an existing one
   * (resists username enumeration via response timing). Computed lazily once.
   */
  private decoyHash: string | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly passphrase: PassphraseService,
    private readonly otp: OtpService,
    private readonly throttle: LoginThrottleService
  ) {}

  /**
   * Stage a pending signup. Does NOT create auth.users / user_profiles — those are
   * written only on successful OTP verify (PHE-9), copying passphrase_hash from the
   * draft. Returns a generic shape regardless of whether the email already has an
   * account (enumeration resistance — resolved at verify time).
   */
  async signupStart(dto: SignupStartDto): Promise<SignupStartResult> {
    // Hash immediately; the raw passphrase is never persisted, logged, or echoed.
    const passphraseHash = await this.passphrase.hash(dto.passphrase);

    const expiresAt = new Date(
      Date.now() + DRAFT_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from("signup_drafts")
      .insert({
        name: dto.name,
        email: dto.email,
        passphrase_hash: passphraseHash,
        expires_at: expiresAt,
      })
      .select("draft_id")
      .single();

    if (error || !data) {
      // Note: never include the passphrase in any log line.
      this.logger.error(`signup draft insert failed: ${error?.message}`);
      throw new InternalServerErrorException("could not start signup");
    }

    // Fire the OTP send path (purpose=signup). PHE-9 replaces the stub with Resend.
    await this.otp.sendCode({ email: dto.email, purpose: "signup" });

    return { draft_id: data.draft_id as string, maskedEmail: maskEmail(dto.email) };
  }

  /**
   * Resolve an account by case-insensitive display name and verify the supplied
   * passphrase against the stored Argon2id hash. Used by the signin route
   * (PHE-12 wires `POST /auth/signin`); this method is route-agnostic.
   *
   * Duplicate-name handling (known constraint): display_name is NOT unique. We
   * verify the passphrase against every candidate sharing the name and succeed
   * ONLY on a single unique match. Zero matches OR more than one match both fail
   * closed and return null — an ambiguous match is never authenticated. (PHE-12
   * may promote email-code sign-in for users who hit this ambiguity.)
   *
   * Returns the matched account on success, or null on any failure (unknown
   * name, wrong passphrase, ambiguous match). The caller maps null to a single
   * generic error — no hint, no enumeration. Throws 429 only when the
   * account/IP is locked out by repeated failures.
   *
   * The raw passphrase is never logged, echoed, or persisted.
   */
  async verifyCredentials(
    name: string,
    passphrase: string,
    ctx: VerifyContext = {}
  ): Promise<VerifiedCredential | null> {
    // Brute-force gate first: locked account or IP short-circuits with a 429.
    this.throttle.assertNotLocked(name, ctx.ip);

    const candidates = await this.loadCandidates(name);

    // No account with this name: burn equivalent Argon2 time, then fail closed.
    if (candidates.length === 0) {
      await this.passphrase.verify(await this.getDecoyHash(), passphrase);
      this.throttle.recordFailure(name, ctx.ip);
      return null;
    }

    // Verify against EVERY candidate — no short-circuit. This keeps the work
    // constant w.r.t. which candidate matches and lets us detect ambiguity.
    let matched: VerifiedCredential | null = null;
    let matchCount = 0;
    for (const row of candidates) {
      if (!row.passphrase_hash) continue;
      const ok = await this.passphrase.verify(row.passphrase_hash, passphrase);
      if (ok) {
        matchCount += 1;
        matched = {
          userId: row.id,
          displayName: row.display_name ?? null,
        };
      }
    }

    // Exactly one match authenticates; 0 or >1 (ambiguous) fail closed.
    if (matchCount === 1 && matched) {
      this.throttle.reset(name, ctx.ip);
      return matched;
    }

    this.throttle.recordFailure(name, ctx.ip);
    return null;
  }

  /** Case-insensitive exact match on display_name (LIKE metachars escaped). */
  private async loadCandidates(name: string): Promise<
    Array<{
      id: string;
      display_name: string | null;
      passphrase_hash: string | null;
    }>
  > {
    const normalized = name.trim();
    if (!normalized) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from("user_profiles")
      .select("id, display_name, passphrase_hash")
      .ilike("display_name", escapeLikePattern(normalized))
      .limit(MAX_NAME_CANDIDATES);

    if (error) {
      // Never include the passphrase or its hash in a log line.
      this.logger.error(`name resolution lookup failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as Array<{
      id: string;
      display_name: string | null;
      passphrase_hash: string | null;
    }>;
  }

  private async getDecoyHash(): Promise<string> {
    if (!this.decoyHash) {
      this.decoyHash = await this.passphrase.hash(
        randomBytes(32).toString("hex")
      );
    }
    return this.decoyHash;
  }
}

/**
 * Escape PostgreSQL LIKE/ILIKE metacharacters so a value matches literally and
 * fully (no implicit wildcards). PostgREST's `.ilike` uses the default backslash
 * escape, so `\`, `%`, and `_` must be backslash-escaped. Without this, a name
 * like "a_b" or "50%" would over-match other accounts.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** ash***@headline.com — enough to recognize, not enough to leak. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  const masked = "*".repeat(Math.max(1, local.length - visible.length));
  return `${visible}${masked}@${domain}`;
}
