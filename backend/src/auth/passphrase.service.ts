import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/**
 * Algorithm identifier persisted alongside the hash (user_profiles.passphrase_algo).
 * Lets future migrations re-hash transparently if params change.
 */
export const PASSPHRASE_ALGO = "argon2id";

/**
 * One-way passphrase hashing. Distinct from EncryptionService (reversible AES-GCM):
 * passphrases must NEVER be recoverable. PHE-11 builds verification on top of this.
 */
@Injectable()
export class PassphraseService {
  // OWASP-aligned Argon2id params: memory >= 19 MiB, iterations >= 2, parallelism 1.
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  /** Returns the full encoded hash string (salt + params embedded). */
  async hash(passphrase: string): Promise<string> {
    return argon2.hash(passphrase, this.options);
  }

  /** Constant-time verify against an encoded hash. Never throws on bad input. */
  async verify(encodedHash: string, passphrase: string): Promise<boolean> {
    try {
      return await argon2.verify(encodedHash, passphrase);
    } catch {
      return false;
    }
  }
}
