import { IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/signin.
 * Both fields are required and trimmed exactly as signup trimmed them (PHE-7) so
 * the passphrase the user typed at signup hashes to the same value here. Kept
 * deliberately lenient beyond non-empty: a wrong name or passphrase must flow
 * through to verifyCredentials and surface the single generic failure — never a
 * field-level 400 that would hint which half was wrong (enumeration resistance).
 */
export class SigninDto {
  // How the world knows them; case-insensitive match happens server-side.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: "enter your name and passphrase to continue." })
  name!: string;

  // It is a phrase: only edge whitespace trimmed (mirrors signup), internal kept.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: "enter your name and passphrase to continue." })
  passphrase!: string;
}
