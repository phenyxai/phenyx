import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

@Injectable()
export class EncryptionService {
  constructor(private readonly config: ConfigService) {}

  private getKey(): Buffer {
    const key = this.config.get<string>("ENCRYPTION_KEY");
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is not set");
    }
    return Buffer.from(key, "hex");
  }

  encrypt(text: string): string {
    const KEY = this.getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString("hex"),
      encrypted: encrypted.toString("hex"),
      authTag: authTag.toString("hex"),
    });
  }

  decrypt(payload: string): string {
    const KEY = this.getKey();
    const { iv, encrypted, authTag } = JSON.parse(payload);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }

  /**
   * Keyed HMAC-SHA256 fingerprint (hex) of a value, using ENCRYPTION_KEY.
   *
   * Used by PHE-12 to both SIGN and store the passphrase-reset token: the raw
   * token (high-entropy random) is emailed, and only its HMAC is persisted in
   * passphrase_reset_tokens.token_hash. The keying means a leaked tokens table
   * cannot be verified against guessed tokens without the server key, and
   * recomputing the HMAC at confirm time is the signature check. Deterministic,
   * so the same token always maps to the same lookup key.
   */
  sign(value: string): string {
    return crypto.createHmac("sha256", this.getKey()).update(value).digest("hex");
  }
}
