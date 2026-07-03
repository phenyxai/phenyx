// Credential-bearing keys stripped at every depth (case-insensitive), so a
// schema-loose Onairos trait-shape change cannot smuggle a token through under a
// differently-cased or nested key. Mirrors the backend
// OnairosSnapshotService.redactOnairosForProfile.
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

function deepRedact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepRedact(v));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      result[key] = deepRedact(val);
    }
    return result;
  }
  return value;
}

export function redactOnairosForProfile(input: unknown): Record<string, unknown> {
  const out = deepRedact(input);
  return out && typeof out === "object" && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : {};
}
