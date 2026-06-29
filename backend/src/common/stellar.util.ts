import { createHash } from "crypto";

/**
 * PHE-13 — the curated stellar palette and the deterministic color mapping.
 *
 * This array is the SERVER source of truth and MUST stay byte-identical to the
 * frontend `STELLAR` constant (`frontend/lib/stellar.ts`) and to the SQL array in
 * the backfill migration (`stellar_color_for`). A divergence would make a freshly
 * created account's displayed color differ from a backfilled one for the same
 * inputs. Order is significant — the hash maps onto these indices.
 */
export const STELLAR = [
  "#CC3300",
  "#E84422",
  "#E87722",
  "#E8B822",
  "#D4C87A",
  "#C8C8C8",
  "#CCDDFF",
  "#88AAEE",
  "#77BBFF",
  "#5599FF",
  "#4488EE",
  "#3366DD",
  "#2255CC",
  "#1144BB",
] as const;

/**
 * Deterministically map an account onto the palette.
 *
 * Input is the immutable pair `id + created_at` (the account's `id` column value
 * concatenated with the ISO-8601 `created_at`). We take SHA-256 of that string,
 * read the first 7 hex digits as a 28-bit unsigned integer, and index the palette
 * by `n mod 14`. The same `(id, createdAtIso)` always yields the same hex, so the
 * color is stable and immutable for the life of the account.
 *
 * The SQL function `public.stellar_color_for` (backfill migration) mirrors this
 * exactly: same SHA-256, same 7-hex-digit (28-bit) slice, same `mod 14`, same
 * palette — so a backfilled row and a row created here resolve to the identical
 * hex for identical inputs.
 *
 * `createdAtIso` MUST be the exact string persisted alongside the row (the
 * caller fixes `created_at` at insert time to a `Date#toISOString()` value), so
 * the hash input is reproducible.
 */
export function stellarColorFor(id: string, createdAtIso: string): string {
  const digest = createHash("sha256")
    .update(`${id}${createdAtIso}`)
    .digest("hex");
  // First 7 hex digits → 28-bit unsigned int (always < 2^31, so non-negative in
  // both JS and Postgres `bit(28)::int`); mod the palette length.
  const bucket = parseInt(digest.slice(0, 7), 16) % STELLAR.length;
  return STELLAR[bucket];
}
