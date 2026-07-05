/**
 * PHE-42 export credential scrub (defense in depth).
 *
 * The export bundle is assembled from tables that already never store a
 * token/JWT (Onairos snapshots are redacted at write time by
 * OnairosSnapshotService; no other per-user table holds a credential). This pass
 * is belt-and-suspenders: it deep-strips any credential-bearing key at every
 * depth so a future schema drift cannot smuggle a secret into a data export, and
 * gives the export a single, testable "no token ever leaves" guarantee.
 *
 * The key set mirrors OnairosSnapshotService.SENSITIVE_KEYS; kept local so the
 * account module stays self-contained and unit-testable without Nest DI.
 */

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
  "passphrase",
  "private_key",
  "privatekey",
]);

/** True if `key` names a credential-bearing field (case-insensitive). */
export function isCredentialKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

/**
 * Deep-clone `value`, dropping every credential-bearing key at any depth. Arrays
 * and nested objects are preserved; primitives pass through untouched.
 */
export function scrubCredentials<T>(value: T): T {
  return deepScrub(value) as T;
}

function deepScrub(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepScrub(v));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isCredentialKey(key)) continue;
      result[key] = deepScrub(val);
    }
    return result;
  }
  return value;
}

/**
 * Recursively scan `value` for any surviving credential-bearing KEY. Returns the
 * dotted path of the first offender, or null if the structure is clean. Used by
 * the export test to prove the bundle carries no token/JWT-shaped field.
 */
export function findCredentialLeak(value: unknown, path = "$"): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findCredentialLeak(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isCredentialKey(key)) return `${path}.${key}`;
      const hit = findCredentialLeak(val, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}
