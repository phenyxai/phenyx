/**
 * PHE-105: run the voice check over generated prose already saved in Supabase.
 *
 * Every saved string goes through sanitizeProse (the fixes generation applies),
 * then voiceViolations reports whatever is left, grouped by surface. Exits 1 when
 * anything fails, so "every surface passes" is one command.
 *
 * From backend/:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… [ENCRYPTION_KEY=…] \
 *   NODE_OPTIONS='--require ts-node/register' node scripts/voice-check.ts \
 *     [--user <uuid>] [--since <iso date>] [--limit <rows per table, default 50>]
 *
 * ENCRYPTION_KEY adds polaris replies, which are saved encrypted; without it they are skipped.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { EncryptionService } from "../src/common/encryption.service";
import {
  sanitizeProse,
  voiceViolations,
  type VoiceSurface,
} from "../src/voice-standard/sanitize-prose";

const { values: args } = parseArgs({
  options: {
    user: { type: "string" },
    since: { type: "string" },
    limit: { type: "string", default: "50" },
  },
});

const PILLAR_COLUMNS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
].map((p) => `${p}_synthesis`);

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Newest rows first, narrowed by --user / --since.
  const load = async (table: string, columns: string, timeColumn = "created_at") => {
    let q = supabase
      .from(table)
      .select(columns)
      .order(timeColumn, { ascending: false })
      .limit(Number(args.limit));
    if (args.user) q = q.eq("user_id", args.user);
    if (args.since) q = q.gte(timeColumn, args.since);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as unknown as Record<string, any>[];
  };

  const samples: Array<[VoiceSurface, string | null | undefined]> = [];
  for (const row of await load(
    "constellation_state",
    [...PILLAR_COLUMNS, "portrait", "mantra", "foresight"].join(", "),
    "generated_at"
  )) {
    for (const c of PILLAR_COLUMNS) samples.push(["pillar", row[c]]);
    samples.push(["portrait", row.portrait?.prose]);
    samples.push(["mantra", row.mantra]);
    samples.push(["foresight", row.foresight]);
  }
  for (const row of await load("observations", "body")) samples.push(["observation", row.body]);
  for (const row of await load("user_traits", "insight")) samples.push(["trait", row.insight]);

  if (ENCRYPTION_KEY) {
    const encryption = new EncryptionService({ get: () => ENCRYPTION_KEY } as any);
    for (const row of await load("polaris_messages", "body, role")) {
      if (row.role === "assistant") samples.push(["polaris", encryption.decrypt(row.body)]);
    }
  } else {
    console.log("ENCRYPTION_KEY not set, skipping polaris replies");
  }

  const tally = new Map<VoiceSurface, { checked: number; failed: number }>();
  for (const [surface, raw] of samples) {
    if (!raw) continue;
    const t = tally.get(surface) ?? { checked: 0, failed: 0 };
    tally.set(surface, t);
    t.checked++;
    const violations = voiceViolations(sanitizeProse(raw), surface);
    if (violations.length === 0) continue;
    t.failed++;
    for (const v of violations) console.log(`${surface}  ${v.rule}  "${v.excerpt}"`);
  }

  console.log("\nsurface      checked  failed");
  for (const [surface, t] of tally) {
    console.log(`${surface.padEnd(12)} ${String(t.checked).padStart(7)}  ${String(t.failed).padStart(6)}`);
  }
  if ([...tally.values()].some((t) => t.failed > 0)) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
