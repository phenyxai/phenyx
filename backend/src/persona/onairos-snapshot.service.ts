import { Injectable } from "@nestjs/common";

// Credential-bearing keys stripped at every depth. Matched case-insensitively so
// a schema-loose trait-shape change cannot smuggle a token through under a
// differently-cased key.
const SENSITIVE_KEYS = new Set([
  "token",
  "jwt",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "idtoken",
  "id_token",
  "authorization",
  "bearer",
  "secret",
  "apisecret",
  "api_secret",
  "password",
]);

@Injectable()
export class OnairosSnapshotService {
  /**
   * Redacts secrets from Onairos completion payloads before storing in Supabase.
   * Deep-strips every credential-bearing key (see SENSITIVE_KEYS) at any depth so
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
        if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
        result[key] = this.deepRedact(val);
      }
      return result;
    }
    return value;
  }
}
