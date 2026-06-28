import { IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Validation for POST /auth/passphrase/reset/confirm.
 * `token` is the raw single-use reset token from the emailed link; it is kept as
 * an opaque string and validated (signature + expiry + single-use) server-side.
 * `newPassphrase` mirrors signup's rule (trimmed edges, min length 8) so the
 * floor is identical on both paths.
 */
export class PassphraseResetConfirmDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: "this reset link is invalid or has expired." })
  token!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(8, { message: "passphrase must be at least 8 characters" })
  newPassphrase!: string;
}
