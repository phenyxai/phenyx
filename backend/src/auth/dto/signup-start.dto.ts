import { IsEmail, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/signup/start.
 * Name + email only (PHE-97: there is no passphrase). `whitelist: true` (global
 * ValidationPipe) strips any extra fields, so a passphrase an older client still
 * sends is dropped before it reaches the service.
 */
export class SignupStartDto {
  // Trimmed; how the world knows them.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: "name must be at least 2 characters" })
  name!: string;

  // RFC-compliant + lowercased so the same address always maps to one identity.
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  @IsEmail({}, { message: "a valid email is required" })
  email!: string;
}
