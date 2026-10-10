// PHE-13 — the curated stellar palette and its display names.
//
// The stellar color is the user's permanent identity accent. It is assigned
// DETERMINISTICALLY by the server at account creation (hash of id + created_at →
// palette index) and persisted to user_profiles.stellar_color — never chosen
// randomly on the client. The frontend only ever READS the persisted value; this
// module exposes the palette + names so the UI can render and label that color.
//
// STELLAR must stay byte-identical to the backend constant
// (backend/src/common/stellar.util.ts) and the SQL palette in
// stellar_color_for (latest definition: the PHE-98 remap migration), so a
// freshly-created account's color matches a backfilled one for the same inputs.
// lib/stellar.test.ts reads the other two and fails if they drift.
// PHE-98: the demo's 24 colors (PHENYX_demo.html, PHENYX_STELLAR_PALETTE), four
// per family. None is blue: brand blue belongs to PHENYX alone and is never
// assigned to a person (doc 7). Order is significant, the hash maps onto it.
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

export type StellarColor = (typeof STELLAR)[number];

// Every palette hex maps to a human name so the welcome copy
// ("your color is {colorName}.") never falls back to the generic word.
export const STELLAR_NAMES: Record<string, string> = {
  "#DE9AAE": "rose veil",
  "#E4B4C4": "rose quartz",
  "#D77C99": "nova rose",
  "#CB7085": "carmine star",
  "#B59BE3": "iris halo",
  "#C6B2EB": "lilac dusk",
  "#AC87D5": "amethyst star",
  "#CD95D8": "orchid nebula",
  "#77C5A5": "jade aurora",
  "#9ABC8F": "fern light",
  "#B3C0A0": "sage moon",
  "#9FAB68": "moss gold",
  "#8CD1C2": "opal tide",
  "#68BEB0": "aurora teal",
  "#65ADB1": "lagoon star",
  "#9CC9C2": "sea glass",
  "#DCC697": "champagne star",
  "#D9B36D": "honey halo",
  "#E9A65B": "solar amber",
  "#E2DBC6": "ivory moon",
  "#E5B391": "apricot dawn",
  "#D89677": "copper star",
  "#E59894": "coral nova",
  "#D88475": "ember glow",
};

// Ambient accent for surfaces with no signed-in identity yet (pre-auth screens,
// anonymous visitors). PHE-98: neutral white, off the palette, so nothing reads
// as a person's color before there is a person; brand blue stays PHENYX's own.
// Deterministic, NOT random — also the --ph-accent default in globals.css.
export const STELLAR_DEFAULT = "#FFFDFD";

/**
 * Resolve a palette hex to its display name. Every STELLAR hex has an entry, so
 * the generic "stellar" fallback is only ever hit for an off-palette value.
 */
export function colorName(hex: string): string {
  return STELLAR_NAMES[hex.toUpperCase()] || "stellar";
}

/**
 * "#RRGGBB" → "r, g, b" for use in `--s-rgb` (consumed by rgba()/color-mix glows).
 * Falls back to the default accent's channels for a malformed input.
 */
export function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = m ? m[1] : STELLAR_DEFAULT.slice(1);
  const n = parseInt(value, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
