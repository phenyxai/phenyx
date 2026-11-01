import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ACCENT, hexToRgb } from "./stellar.ts";

const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
const token = (name: string) => new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m").exec(css)?.[1].trim();

test("ACCENT is brand blue, the same hex as --ph-brand", () => {
  assert.equal(ACCENT, "#B4CCF4");
  assert.equal(token("--ph-brand"), ACCENT);
  assert.equal(token("--ph-brand-rgb"), hexToRgb(ACCENT));
});

test("--ph-accent follows brand blue for everyone", () => {
  assert.equal(token("--ph-accent"), "var(--ph-brand)");
  assert.equal(token("--ph-accent-rgb"), "var(--ph-brand-rgb)");
});

test("hexToRgb splits channels and falls back to the accent", () => {
  assert.equal(hexToRgb("#E9A65B"), "233, 166, 91");
  assert.equal(hexToRgb("e9a65b"), "233, 166, 91");
  assert.equal(hexToRgb(" #DE9AAE "), "222, 154, 174");
  assert.equal(hexToRgb("not a color"), "180, 204, 244");
});
