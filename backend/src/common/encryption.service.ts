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
}
