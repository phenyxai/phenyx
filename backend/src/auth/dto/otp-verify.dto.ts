import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/otp/verify.
 * `code` is kept deliberately lenient (digits stripped, length-capped, never
 * format-rejected) so a wrong or malformed code flows through to the verify
 * logic and surfaces the verbatim "that code didn't work." copy rather than a
 * 400. `purpose` is optional — the service defaults it (signup when a draft_id
 * is present, else signin).
 */
export class OtpVerifyDto {
  @IsOptional()
  @IsUUID(undefined, { message: "invalid draft" })
  draft_id?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsString()
  email?: string;

  // Strip non-digits and cap at 6 — a mismatch is handled as a wrong code.
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : value
  )
  @IsString()
  @MaxLength(6)
  code!: string;

  @IsOptional()
  @IsIn(["signup", "signin"], { message: "unsupported purpose" })
  purpose?: "signup" | "signin";
}
