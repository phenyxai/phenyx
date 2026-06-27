import { IsEmail, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/signup/start.
 * `whitelist: true` (global ValidationPipe) strips any extra fields, so there is
 * no birthday / confirm-passphrase surface even if a client sends one.
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

  // It is a phrase: only edge whitespace is trimmed, internal spaces preserved.
  // No strength scoring, no confirm field — just a minimum length.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(8, { message: "passphrase must be at least 8 characters" })
  passphrase!: string;
}
