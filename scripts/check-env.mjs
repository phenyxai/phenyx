#!/usr/bin/env node
/**
 * Validates .env.local for local dev and lists gaps for full features.
 * Run: pnpm check:env
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(path.join(root, ".env.local"));
const env = { ...fileEnv, ...process.env };

const requiredForApp = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const requiredForOnairosConnect = ["NEXT_PUBLIC_ONAIROS_API_KEY"];

const serverFeatures = [
  ["SUPABASE_SERVICE_ROLE_KEY", "API routes using service role (synthesize, etc.)"],
  ["ANTHROPIC_API_KEY", "Constellation synthesis & generate-prompts"],
  ["STRIPE_SECRET_KEY", "Stripe checkout API"],
  ["STRIPE_WEBHOOK_SECRET", "Stripe webhooks"],
  ["STRIPE_PRO_MONTHLY_PRICE_ID", "Pro subscription (monthly)"],
  ["STRIPE_PRO_YEARLY_PRICE_ID", "Pro prepay one-time (year slot in UI)"],
  ["STRIPE_GIFT_PRICE_ID", "Gifted constellation one-time"],
  ["ENCRYPTION_KEY", "Encrypted onairos fields in prompts"],
];

function missing(keys) {
  return keys.filter((k) => !env[k] || String(env[k]).trim() === "");
}

const bad = missing(requiredForApp);
const badOnairos = missing(requiredForOnairosConnect);

console.log("Env check (merged: .env.local + process.env)\n");

if (bad.length) {
  console.error("Missing (needed for most pages / auth):\n ", bad.join(", "));
  process.exitCode = 1;
} else {
  console.log("OK: Supabase public vars set.");
}

if (badOnairos.length) {
  console.warn(
    "\nWarning: Onairos connect button will fail until you set:\n ",
    badOnairos.join(", ")
  );
}

const missingServer = serverFeatures.filter(([k]) => missing([k]).length);
if (missingServer.length) {
  console.log("\nOptional / server (fill when you use that feature):");
  for (const [k, desc] of missingServer) {
    console.log(`  - ${k}: ${desc}`);
  }
}

if (process.exitCode) {
  console.error("\nCreate .env.local from .env.example and fill required keys.");
}
