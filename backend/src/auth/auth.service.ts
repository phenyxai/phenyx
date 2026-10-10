import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OtpService, OtpPurpose, OtpVerifyOutcome } from "./otp.service";
import { SignupStartDto } from "./dto/signup-start.dto";
import { displayNameFromMetadata } from "./oauth-profile";
import { stellarColorFor } from "../common/stellar.util";

/** Pending signups live ~15 minutes; an expired draft sends the user back to s1. */
const DRAFT_TTL_MINUTES = 15;

/** Postgres unique_violation: a concurrent request already inserted the row. */
const UNIQUE_VIOLATION = "23505";

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
 * verbatim wrong/expired copy; `session` and `is_new` are present only on `ok`.
 * `no_account` is returned only AFTER the code verified, so it tells nothing to
 * anyone who does not already control the inbox (no enumeration).
 */
export interface OtpVerifyResult {
  status: OtpVerifyOutcome | "no_account";
  session?: OtpSession;
  /** True when this verify created the profile: the client routes to welcome. */
  is_new?: boolean;
}

/** A staged signup row loaded for the verify path. */
interface SignupDraftRow {
  draft_id: string;
  name: string;
  email: string;
  expires_at: string;
}

/** A minted session plus the account it belongs to. */
interface MintedSession {
  session: OtpSession;
  userId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly otp: OtpService
  ) {}

  /**
   * Stage a pending signup (name + email). Does NOT create auth.users /
   * user_profiles — those are written only on successful OTP verify (PHE-9).
   * Returns a generic shape regardless of whether the email already has an
   * account (enumeration resistance — resolved at verify time).
   */
  async signupStart(dto: SignupStartDto): Promise<SignupStartResult> {
    const expiresAt = new Date(
      Date.now() + DRAFT_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from("signup_drafts")
      .insert({
        name: dto.name,
        email: dto.email,
        expires_at: expiresAt,
      })
      .select("draft_id")
      .single();

    if (error || !data) {
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
   * Either way the profile is ensured, and `is_new` says whether this verify
   * created it (new → welcome, returning → constellation). Any non-`ok` code
   * outcome (wrong / expired / attempt-cap) is passed straight through so the
   * client shows the matching verbatim copy.
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

      return { status: "ok", ...(await this.completeSignup(draft)) };
    }

    if (purpose === "signin") {
      if (!req.email) throw new BadRequestException("email is required");

      const outcome = await this.otp.verifyCode({
        email: req.email,
        purpose: "signin",
        code: req.code,
      });
      if (outcome !== "ok") return { status: outcome };

      // Existing-account-only: mintSession returns null for an unknown email. The
      // code already proved the caller owns the inbox, so saying so leaks nothing.
      const minted = await this.mintSession(req.email, { requireExisting: true });
      if (!minted) return { status: "no_account" };

      // Every passphrase-era account has a profile; this only fills one for an
      // account whose first (Google) sign-in never finished completing it.
      const { created } = await this.ensureProfile(minted.userId, null);
      return { status: "ok", session: minted.session, is_new: created };
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
      .select("draft_id, name, email, expires_at")
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
   * pre-confirmed — ownership was just proven) and its user_profiles row with
   * display_name = the draft name. The draft is consumed and a session minted.
   * Rolls back the orphaned auth user if the profile insert fails so a retry is
   * clean.
   *
   * An email that already has an account (an earlier signup, or a Google sign-in
   * with the same address) is signed in instead: its profile and color are kept
   * and `is_new` is false, so the person lands on their constellation.
   */
  private async completeSignup(
    draft: SignupDraftRow
  ): Promise<{ session: OtpSession; is_new: boolean }> {
    const admin = this.supabase.getClient();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: draft.email,
      email_confirm: true,
    });

    if (createErr?.code === "email_exists") {
      const minted = await this.mintSession(draft.email, { requireExisting: true });
      if (!minted) {
        throw new InternalServerErrorException("could not establish a session");
      }
      const { created: profileCreated } = await this.ensureProfile(
        minted.userId,
        draft.name
      );
      await this.consumeDraft(draft.draft_id);
      return { session: minted.session, is_new: profileCreated };
    }

    if (createErr || !created?.user) {
      this.logger.error(`account creation failed: ${createErr?.message}`);
      throw new InternalServerErrorException("could not complete signup");
    }
    const userId = created.user.id;

    try {
      await this.ensureProfile(userId, draft.name);
    } catch {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new InternalServerErrorException("could not complete signup");
    }

    await this.consumeDraft(draft.draft_id);

    const minted = await this.mintSession(draft.email, { requireExisting: false });
    if (!minted) {
      throw new InternalServerErrorException("could not establish a session");
    }
    return { session: minted.session, is_new: true };
  }

  /** Consume a draft (best-effort; it also TTLs out on its own). */
  private async consumeDraft(draftId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from("signup_drafts")
      .delete()
      .eq("draft_id", draftId);
    if (error) this.logger.warn(`draft cleanup failed: ${error.message}`);
  }

  /**
   * Idempotently give an account its user_profiles row. An existing row is never
   * touched (its name and color stay exactly as they are); a missing one is
   * inserted with `displayName` and the account's permanent stellar color.
   * Returns `created: true` only when this call wrote the row.
   *
   * PHE-13: the color is computed from the immutable pair `id + created_at` and
   * persisted once. We pin `created_at` explicitly (rather than relying on the DB
   * `now()` default) so the value we hash is exactly the value stored — the
   * backfill migration's `stellar_color_for(id, created_at)` then resolves any
   * row to the identical hex (see stellar.util.ts).
   */
  async ensureProfile(
    userId: string,
    displayName: string | null
  ): Promise<{ created: boolean }> {
    const admin = this.supabase.getClient();

    const { data: existing, error: readErr } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) {
      this.logger.error(`profile lookup failed: ${readErr.message}`);
      throw new InternalServerErrorException("could not complete your profile");
    }
    if (existing) return { created: false };

    // Pin created_at so it is byte-for-byte the string fed into the color hash.
    const createdAt = new Date().toISOString();
    const { error: insertErr } = await admin.from("user_profiles").insert({
      id: userId,
      display_name: displayName,
      created_at: createdAt,
      stellar_color: stellarColorFor(userId, createdAt),
    });
    if (insertErr) {
      // Two first sign-ins racing: the other request wrote the row. Same result.
      if (insertErr.code === UNIQUE_VIOLATION) return { created: false };
      this.logger.error(`profile insert failed: ${insertErr.message}`);
      throw new InternalServerErrorException("could not complete your profile");
    }
    return { created: true };
  }

  /**
   * PHE-97: complete the profile for an account that signed in through OAuth
   * (Google). The name comes from the provider's user_metadata as GoTrue stored
   * it, read server-side by id (never from the request body). Idempotent: every
   * sign-in calls this, and only the first one creates anything.
   */
  async completeOAuthProfile(userId: string): Promise<{ is_new: boolean }> {
    const { data, error } = await this.supabase
      .getClient()
      .auth.admin.getUserById(userId);
    if (error) this.logger.warn(`oauth profile lookup failed: ${error.message}`);

    const displayName = displayNameFromMetadata(data?.user?.user_metadata);
    const { created } = await this.ensureProfile(userId, displayName);
    return { is_new: created };
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
  ): Promise<MintedSession | null> {
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
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      },
      userId: verifyData.session.user.id,
    };
  }
}

/** ash***@headline.com — enough to recognize, not enough to leak. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  const masked = "*".repeat(Math.max(1, local.length - visible.length));
  return `${visible}${masked}@${domain}`;
}
