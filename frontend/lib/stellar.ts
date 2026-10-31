// PHE-162: the accent the site paints with, brand blue for every person.
//
// The backend still assigns each account a stellar color and stores it in
// user_profiles.stellar_color (backend/src/common/stellar.util.ts), but the site
// never reads or shows it. CSS takes the accent from --ph-accent (globals.css,
// an alias of --ph-brand); canvas code that needs a real hex uses ACCENT.
// lib/stellar.test.ts fails if the two drift apart.
export const ACCENT = "#B9D5FF";

/**
 * "#RRGGBB" → "r, g, b" for use in rgba() glows.
 * Falls back to the accent's channels for a malformed input.
 */
export function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = m ? m[1] : ACCENT.slice(1);
  const n = parseInt(value, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
