import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { OtpService, OtpPurpose, OtpVerifyOutcome } from "./otp.service";
import { PassphraseService, PASSPHRASE_ALGO } from "./passphrase.service";
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

/** Tokens the browser adopts via supabase.auth.setSession after a verified OTP. */
export interface OtpSession {
  access_token: string;
  refresh_token: string;
}

/** Request for POST /auth/otp/send (email OR draft_id resolves the recipient). */
export interface OtpSendRequest {
  email?: string;
  draftId?: string;
  purpose: OtpPurpose;
}

/** Request for POST /auth/otp/verify. */
export interface OtpVerifyRequest {
  email?: string;
  draftId?: string;
  code: string;
  /** Defaulted by the caller: signup when a draft_id is present, else signin. */
  purpose?: OtpPurpose;
}

/**
 * Verify result. `status` mirrors OtpVerifyOutcome so the client can render the
 * verbatim wrong/expired copy; `session` is present only on `ok`.
 */
export interface OtpVerifyResult {
  status: OtpVerifyOutcome;
  session?: OtpSession;
}

/** A staged signup row loaded for the verify path. */
interface SignupDraftRow {
  draft_id: string;
  name: string;
  email: string;
  passphrase_hash: string;
  expires_at: string;
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
   * Send (or resend) an OTP for an email or staged draft. Always returns a generic
   * `{ maskedEmail }` regardless of whether an account exists (enumeration
   * resistance); the OtpService dispatches identically. signup resolves the email
   * from the draft so a stale draft sends the user back to s1 rather than emailing.
   */
  async otpSend(req: OtpSendRequest): Promise<{ maskedEmail: string }> {
    const email = await this.resolveEmail(req.purpose, req.email, req.draftId);
    await this.otp.sendCode({ email, purpose: req.purpose });
    return { maskedEmail: maskEmail(email) };
  }

  /**
   * Verify a submitted OTP. On success: signup → materialize the account from the
   * draft and mint a session; signin → mint a session for the existing account.
   * Any non-`ok` code outcome (wrong / expired / attempt-cap) is passed straight
   * through so the client shows the matching verbatim copy. Account resolution
   * failures map to a generic `invalid` (no enumeration).
   */
  async otpVerify(req: OtpVerifyRequest): Promise<OtpVerifyResult> {
    const purpose: OtpPurpose = req.purpose ?? (req.draftId ? "signup" : "signin");

    if (purpose === "signup") {
      const draft = await this.loadDraft(req.draftId);
      // No / expired draft: treat as expired so the UI prompts a fresh start.
      if (!draft) return { status: "expired" };

      const outcome = await this.otp.verifyCode({
        email: draft.email,
        purpose: "signup",
        code: req.code,
      });
      if (outcome !== "ok") return { status: outcome };

      const session = await this.completeSignup(draft);
      return { status: "ok", session };
    }

    if (purpose === "signin") {
      if (!req.email) throw new BadRequestException("email is required");

      const outcome = await this.otp.verifyCode({
        email: req.email,
        purpose: "signin",
        code: req.code,
      });
      if (outcome !== "ok") return { status: outcome };

      // Existing-account-only: mintSession returns null for an unknown email,
      // which we surface as a generic failure (no account-existence leak).
      const session = await this.mintSession(req.email, { requireExisting: true });
      if (!session) return { status: "invalid" };
      return { status: "ok", session };
    }

    return { status: "invalid" };
  }

  /**
   * Resolve the recipient email. signup uses the draft (the email lives there);
   * signin takes the supplied email. Throws a generic error when neither yields one
   * (the staged signup expired, or a malformed signin body).
   */
  private async resolveEmail(
    purpose: OtpPurpose,
    email?: string,
    draftId?: string
  ): Promise<string> {
    if (purpose === "signup") {
      const draft = await this.loadDraft(draftId);
      if (!draft) {
        throw new BadRequestException("this signup session has expired. start over.");
      }
      return draft.email;
    }
    if (!email) throw new BadRequestException("email is required");
    return email;
  }

  /** Load a non-expired signup draft by id, or null. */
  private async loadDraft(draftId?: string): Promise<SignupDraftRow | null> {
    if (!draftId) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from("signup_drafts")
      .select("draft_id, name, email, passphrase_hash, expires_at")
      .eq("draft_id", draftId)
      .maybeSingle();

    if (error) {
      this.logger.error(`draft lookup failed: ${error.message}`);
      return null;
    }
    if (!data) return null;
    const row = data as SignupDraftRow;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  }

  /**
   * Materialize an account from a verified draft: create auth.users (email
   * pre-confirmed — ownership was just proven), insert user_profiles copying the
   * draft's passphrase_hash + tagging passphrase_algo, with display_name = the
   * draft name. stellar_color is LEFT NULL deliberately — PHE-13 assigns it. The
   * draft is consumed and a session minted. Rolls back the orphaned auth user if
   * the profile insert fails so a retry is clean.
   */
  private async completeSignup(draft: SignupDraftRow): Promise<OtpSession> {
    const admin = this.supabase.getClient();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: draft.email,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      this.logger.error(`account creation failed: ${createErr?.message}`);
      throw new InternalServerErrorException("could not complete signup");
    }
    const userId = created.user.id;

    const { error: profileErr } = await admin.from("user_profiles").insert({
      id: userId,
      display_name: draft.name,
      passphrase_hash: draft.passphrase_hash,
      passphrase_algo: PASSPHRASE_ALGO,
      // stellar_color intentionally omitted (NULL) — assigned by PHE-13.
    });
    if (profileErr) {
      this.logger.error(`profile insert failed: ${profileErr.message}`);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new InternalServerErrorException("could not complete signup");
    }

    // Consume the draft (best-effort; it also TTLs out on its own).
    const { error: delErr } = await admin
      .from("signup_drafts")
      .delete()
      .eq("draft_id", draft.draft_id);
    if (delErr) this.logger.warn(`draft cleanup failed: ${delErr.message}`);

    const session = await this.mintSession(draft.email, { requireExisting: false });
    if (!session) {
      throw new InternalServerErrorException("could not establish a session");
    }
    return session;
  }

  /**
   * Mint a real GoTrue session (access + refresh tokens) for an email. The
   * service-role client cannot issue a session, so we admin-generate a one-time
   * link and immediately exchange its hashed token via the anon client.
   *
   * requireExisting=true (signin) uses a `recovery` link, which errors for an
   * unknown email — returning null lets the caller fail generically WITHOUT
   * creating an account. requireExisting=false (post-signup, user just created)
   * uses a `magiclink` and treats failure as a real 500.
   */
  private async mintSession(
    email: string,
    opts: { requireExisting: boolean }
  ): Promise<OtpSession | null> {
    const linkType = opts.requireExisting ? "recovery" : "magiclink";
    const admin = this.supabase.getClient();

    // Branch the call so each literal narrows the discriminated GenerateLinkParams.
    const { data: linkData, error: linkErr } = opts.requireExisting
      ? await admin.auth.admin.generateLink({ type: "recovery", email })
      : await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkErr || !hashedToken) {
      if (opts.requireExisting) return null;
      this.logger.error(`session link generation failed: ${linkErr?.message}`);
      throw new InternalServerErrorException("could not establish a session");
    }

    const anon = this.supabase.getAnonClient();
    const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
      token_hash: hashedToken,
      type: linkType,
    });
    if (verifyErr || !verifyData?.session) {
      if (opts.requireExisting) return null;
      this.logger.error(`session exchange failed: ${verifyErr?.message}`);
      throw new InternalServerErrorException("could not establish a session");
    }

    return {
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
    };
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
