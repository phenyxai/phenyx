import { IsEmail, IsIn, IsOptional, IsUUID } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/otp/send.
 * Supply `draft_id` (signup) OR `email` (signin) — the service resolves the
 * recipient and rejects a body that yields neither. `whitelist: true` strips
 * any extra fields.
 */
export class OtpSendDto {
  // signup path: the staged draft holds the (already-validated) email.
  @IsOptional()
  @IsUUID(undefined, { message: "invalid draft" })
  draft_id?: string;

  // signin path: email supplied directly. Lowercased + trimmed to match storage.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsEmail({}, { message: "a valid email is required" })
  email?: string;

  @IsIn(["signup", "signin"], { message: "unsupported purpose" })
  purpose!: "signup" | "signin";
}
