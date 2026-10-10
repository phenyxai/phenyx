import { createHash } from "crypto";

/**
 * PHE-13 — the curated stellar palette and the deterministic color mapping.
 *
 * This array is the SERVER source of truth and MUST stay byte-identical to the
 * frontend `STELLAR` constant (`frontend/lib/stellar.ts`) and to the SQL array in
 * `stellar_color_for` (redefined by the PHE-98 remap migration,
 * 20261009120000_phe98_stellar_palette_remap.sql). A divergence would make a
 * freshly created account's displayed color differ from a backfilled one for the
 * same inputs. Order is significant — the hash maps onto these indices.
 * frontend/lib/stellar.test.ts fails if the three drift apart.
 *
 * PHE-98: the demo's 24 non-blue colors; brand blue is never assignable.
 */
export const STELLAR = [
  // rose
  "#DE9AAE",
  "#E4B4C4",
  "#D77C99",
  "#CB7085",
  // violet
  "#B59BE3",
  "#C6B2EB",
  "#AC87D5",
  "#CD95D8",
  // verdant
  "#77C5A5",
  "#9ABC8F",
  "#B3C0A0",
  "#9FAB68",
  // tide
  "#8CD1C2",
  "#68BEB0",
  "#65ADB1",
  "#9CC9C2",
  // gold
  "#DCC697",
  "#D9B36D",
  "#E9A65B",
  "#E2DBC6",
  // ember
  "#E5B391",
  "#D89677",
  "#E59894",
  "#D88475",
] as const;

/**
 * Deterministically map an account onto the palette.
 *
 * Input is the immutable pair `id + created_at` (the account's `id` column value
 * concatenated with the ISO-8601 `created_at`). We take SHA-256 of that string,
 * read the first 7 hex digits as a 28-bit unsigned integer, and index the palette
 * by `n mod 24` (the palette length). The same `(id, createdAtIso)` always
 * yields the same hex, so the color is stable for the life of the account.
 *
 * The SQL function `public.stellar_color_for` (PHE-98 migration) mirrors this
 * exactly: same SHA-256, same 7-hex-digit (28-bit) slice, same `mod 24`, same
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
