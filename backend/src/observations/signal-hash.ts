import { createHash } from "crypto";

/**
 * Novelty / dedup key for the observation engine (PHE-37).
 *
 * `signal_hash = sha256(user_id || pillar || normalized(signal_key))`.
 *
 * The hash is derived from the underlying PATTERN (`signal_key`, e.g.
 * "linkedin+spotify:consistency-over-6mo"), never the generated prose — so a
 * paraphrase of the same insight collapses to the same hash and is absorbed
 * silently via `ON CONFLICT (user_id, signal_hash) DO NOTHING`. The `pillar` and
 * `user_id` are folded in so the same pattern under a different pillar (or a
 * different user) is a distinct signal.
 */

/**
 * Normalize a signal key so cosmetic differences (case, surrounding or repeated
 * whitespace) never produce a different hash. This is deliberately conservative:
 * it does NOT touch the internal token structure of the key, so genuinely
 * different patterns stay distinct.
 */
export function normalizeSignalKey(signalKey: string): string {
  return signalKey.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalize a pillar label to its `pillar_enum` form (lowercase, trimmed). */
export function normalizePillar(pillar: string): string {
  return pillar.trim().toLowerCase();
}

export function computeSignalHash(
  userId: string,
  pillar: string,
  signalKey: string
): string {
  const material = `${userId}||${normalizePillar(pillar)}||${normalizeSignalKey(
    signalKey
  )}`;
  return createHash("sha256").update(material).digest("hex");
}
