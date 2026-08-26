// Credential-bearing keys stripped at every depth (case-insensitive), so a
// schema-loose Onairos trait-shape change cannot smuggle a token through under a
// differently-cased or nested key. Mirrors the backend
// OnairosSnapshotService.redactOnairosForProfile.
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

function deepRedact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepRedact(v));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue;
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
