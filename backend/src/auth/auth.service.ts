import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OtpService } from "./otp.service";
import { PassphraseService } from "./passphrase.service";
import { SignupStartDto } from "./dto/signup-start.dto";

/** Pending signups live ~15 minutes; an expired draft sends the user back to s1. */
const DRAFT_TTL_MINUTES = 15;

export interface SignupStartResult {
  draft_id: string;
  maskedEmail: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly passphrase: PassphraseService,
    private readonly otp: OtpService
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
}

/** ash***@headline.com — enough to recognize, not enough to leak. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  const masked = "*".repeat(Math.max(1, local.length - visible.length));
  return `${visible}${masked}@${domain}`;
}
