import { Injectable } from "@nestjs/common";

// Credential-bearing keys stripped at every depth. Matched case-insensitively so
// a schema-loose trait-shape change cannot smuggle a token through under a
// differently-cased key.
function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [
    "token",
    "jwt",
    "apikey",
    "authorization",
    "bearer",
    "secret",
    "password",
    "credential",
  ].some((fragment) => normalized.includes(fragment));
}

@Injectable()
export class OnairosSnapshotService {
  /**
   * Redacts secrets from Onairos completion payloads before storing in Supabase.
   * Deep-strips every credential-bearing key at any depth so
   * the session JWT (`token`) — or any nested credential — is never persisted.
   */
  redactOnairosForProfile(input: unknown): Record<string, unknown> {
    const out = this.deepRedact(input);
    return out && typeof out === "object" && !Array.isArray(out)
      ? (out as Record<string, unknown>)
      : {};
  }

  private deepRedact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.deepRedact(v));
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (isSensitiveKey(key)) continue;
        result[key] = this.deepRedact(val);
      }
      return result;
    }
    return value;
  }
}
