import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  STELLAR,
  STELLAR_DEFAULT,
  STELLAR_NAMES,
  accentVars,
  colorName,
  hexToRgb,
  resolveAccent,
} from "./stellar.ts";

// PHE-98: the palette lives in three places (this module, the backend util and
// the SQL stellar_color_for). These tests read the other two from disk so a
// change to one that misses the others fails here instead of in production.

const REPO = join(import.meta.dirname, "..", "..");

const hexes = (source: string) => (source.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toUpperCase());

function backendPalette(): string[] {
  const src = readFileSync(join(REPO, "backend/src/common/stellar.util.ts"), "utf8");
  const body = /export const STELLAR = \[([\s\S]*?)\] as const/.exec(src);
  assert.ok(body, "backend STELLAR array not found");
  return hexes(body[1]);
}

// The newest migration that (re)defines stellar_color_for is the live definition.
function latestSqlDefinition(): { file: string; palette: string[]; modulus: number } {
  const dir = join(REPO, "supabase/migrations");
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => /create or replace function public\.stellar_color_for/i.test(readFileSync(join(dir, f), "utf8")))
    .pop();
  assert.ok(file, "no migration defines stellar_color_for");
  const src = readFileSync(join(dir, file), "utf8");
  const fn = /create or replace function public\.stellar_color_for[\s\S]*?\$\$([\s\S]*?)\$\$/i.exec(src);
  assert.ok(fn, `stellar_color_for body not found in ${file}`);
  const arr = /array\[([\s\S]*?)\]/i.exec(fn[1]);
  assert.ok(arr, `palette array not found in ${file}`);
  const mod = /::bit\(28\)::int\s*%\s*(\d+)/.exec(fn[1]);
  assert.ok(mod, `modulus not found in ${file}`);
  return { file, palette: hexes(arr[1]), modulus: Number(mod[1]) };
}

// The demo's palette (PHENYX_demo.html, window.PHENYX_STELLAR_PALETTE), in order.
const DEMO: [string, string][] = [
  ["#DE9AAE", "rose veil"], ["#E4B4C4", "rose quartz"], ["#D77C99", "nova rose"], ["#CB7085", "carmine star"],
  ["#B59BE3", "iris halo"], ["#C6B2EB", "lilac dusk"], ["#AC87D5", "amethyst star"], ["#CD95D8", "orchid nebula"],
  ["#77C5A5", "jade aurora"], ["#9ABC8F", "fern light"], ["#B3C0A0", "sage moon"], ["#9FAB68", "moss gold"],
  ["#8CD1C2", "opal tide"], ["#68BEB0", "aurora teal"], ["#65ADB1", "lagoon star"], ["#9CC9C2", "sea glass"],
  ["#DCC697", "champagne star"], ["#D9B36D", "honey halo"], ["#E9A65B", "solar amber"], ["#E2DBC6", "ivory moon"],
  ["#E5B391", "apricot dawn"], ["#D89677", "copper star"], ["#E59894", "coral nova"], ["#D88475", "ember glow"],
];

test("STELLAR is the demo's 24 colors, in the demo's order", () => {
  assert.deepEqual([...STELLAR], DEMO.map(([hex]) => hex));
});

test("backend STELLAR is byte-identical to the frontend palette", () => {
  assert.deepEqual(backendPalette(), [...STELLAR]);
});

test("the live SQL stellar_color_for uses the same palette and mods by its length", () => {
  const { file, palette, modulus } = latestSqlDefinition();
  assert.deepEqual(palette, [...STELLAR], file);
  assert.equal(modulus, STELLAR.length, file);
});

test("every palette hex has its demo name, and colorName reads it case-insensitively", () => {
  assert.deepEqual(Object.keys(STELLAR_NAMES).sort(), [...STELLAR].sort());
  for (const [hex, name] of DEMO) {
    assert.equal(STELLAR_NAMES[hex], name);
    assert.equal(colorName(hex), name);
    assert.equal(colorName(hex.toLowerCase()), name);
  }
  assert.equal(colorName("#123456"), "stellar");
});

// Brand blue belongs to PHENYX alone (doc 7). The shades below are the demo's
// --ph-brand, --ph-brand-strong and --ph-brand-soft.
const BRAND = ["#B9D5FF", "#D7E7FF", "#89A8E3"];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// CIE76 distance in Lab: about 2.3 is a just-noticeable difference.
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

test("no assignable color is brand blue or reads as it", () => {
  for (const hex of STELLAR) {
    assert.ok(!BRAND.includes(hex), `${hex} is a brand shade`);
    const h = hue(hex);
    assert.ok(h < 190 || h > 250, `${hex} sits in the blue band (hue ${h.toFixed(0)})`);
    for (const brand of BRAND) {
      assert.ok(deltaE(hex, brand) > 15, `${hex} is within ΔE 15 of ${brand}`);
    }
  }
});

test("the default accent is neutral: not a palette color and not blue", () => {
  assert.ok(!(STELLAR as readonly string[]).includes(STELLAR_DEFAULT));
  assert.equal(STELLAR_DEFAULT, "#FFFDFD");
});

test("hexToRgb splits channels and falls back to the default accent", () => {
  assert.equal(hexToRgb("#E9A65B"), "233, 166, 91");
  assert.equal(hexToRgb("e9a65b"), "233, 166, 91");
  assert.equal(hexToRgb(" #DE9AAE "), "222, 154, 174");
  assert.equal(hexToRgb("not a color"), "255, 253, 253");
});

test("resolveAccent keeps palette colors and neutralizes anything else", () => {
  assert.equal(resolveAccent("#E9A65B"), "#E9A65B");
  assert.equal(resolveAccent("#e9a65b"), "#E9A65B");
  // a stale value from the old palette (or brand blue) never paints as the accent
  assert.equal(resolveAccent("#5599FF"), STELLAR_DEFAULT);
  assert.equal(resolveAccent("#B9D5FF"), STELLAR_DEFAULT);
  assert.equal(resolveAccent(null), STELLAR_DEFAULT);
  assert.equal(resolveAccent(""), STELLAR_DEFAULT);
});

test("accentVars publishes --ph-accent and its rgb companion", () => {
  assert.deepEqual(accentVars("#D88475"), { "--ph-accent": "#D88475", "--ph-accent-rgb": "216, 132, 117" });
  assert.deepEqual(accentVars("#5599FF"), { "--ph-accent": "#FFFDFD", "--ph-accent-rgb": "255, 253, 253" });
});
