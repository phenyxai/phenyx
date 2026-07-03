import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

/**
 * POST /onairos/connect body.
 *
 * Either `platform` (single) or `platforms` (the SDK connects several in one
 * completion) identifies what was connected. `trait_object` is the schema-loose
 * Onairos payload — it is redacted before any persist, so nested fields are left
 * intact by validation (no @ValidateNested). `token` is the Onairos JWT: it is
 * verified server-side then DISCARDED — never stored, never logged, never echoed.
 */
export class OnairosConnectDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsObject()
  trait_object?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsIn(["onboarding", "platform_refresh"])
  trigger?: "onboarding" | "platform_refresh";
}

/** POST /onairos/disconnect body. */
export class OnairosDisconnectDto {
  @IsString()
  @MinLength(1)
  platform!: string;
}
