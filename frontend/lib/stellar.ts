// PHE-13 — the curated stellar palette and its display names.
//
// The stellar color is the user's permanent identity accent. It is assigned
// DETERMINISTICALLY by the server at account creation (hash of id + created_at →
// palette index) and persisted to user_profiles.stellar_color — never chosen
// randomly on the client. The frontend only ever READS the persisted value; this
// module exposes the palette + names so the UI can render and label that color.
//
// STELLAR must stay byte-identical to the backend constant
// (backend/src/common/stellar.util.ts) and the SQL palette in the
// stellar_color_for backfill migration, so a freshly-created account's color
// matches a backfilled one for the same inputs.
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

export type StellarColor = (typeof STELLAR)[number];

// Every palette hex maps to a human name so the welcome copy
// ("the {colorName} represents you.") never falls back to the generic word.
export const STELLAR_NAMES: Record<string, string> = {
  "#CC3300": "deep red",
  "#E84422": "vermilion",
  "#E87722": "burnt orange",
  "#E8B822": "amber",
  "#D4C87A": "pale gold",
  "#C8C8C8": "silver",
  "#CCDDFF": "sky blue",
  "#88AAEE": "periwinkle blue",
  "#77BBFF": "light blue",
  "#5599FF": "cornflower blue",
  "#4488EE": "cornflower blue",
  "#3366DD": "cobalt",
  "#2255CC": "indigo",
  "#1144BB": "midnight blue",
};

// Ambient accent for surfaces with no signed-in identity yet (pre-auth screens,
// anonymous landing). Deterministic, NOT random — also the globals.css default.
export const STELLAR_DEFAULT = "#5599FF";

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
