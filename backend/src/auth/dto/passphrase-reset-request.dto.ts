import { IsEmail } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/passphrase/reset/request.
 * Only a well-formed email is accepted; the route then ALWAYS answers 200
 * regardless of whether that email maps to an account (enumeration resistance).
 * Lowercased + trimmed so the same address resolves to one identity (matches
 * how signup stored it).
 */
export class PassphraseResetRequestDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsEmail({}, { message: "enter a valid email to continue." })
  email!: string;
}
