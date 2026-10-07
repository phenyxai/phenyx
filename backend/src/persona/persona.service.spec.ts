import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { PersonaService } from "./persona.service";
import { PILLARS } from "../constellation/layout";

const TOKEN = "eyJ.legacy-engine-secret.signature";

/** A raw model reply (text as sent, optional stop reason) instead of a JSON object. */
type RawReply = { raw: string; stop_reason?: string };

/** All seven pillars, each with a valid score and synthesis. */
const SEVEN = Object.fromEntries(
  PILLARS.map((p, i) => [p, { score: 60 + i, synthesis: `${p} text` }])
);

/**
 * Run one generatePrompts call against stubbed model replies (served in order,
 * the last one repeating) and a fake Supabase client. `existingVersion` is the
 * constellation_state row already there (null on a first run). Returns what
 * reached the model, every durable write, the number of model calls and the
 * error the run ended with, if any.
 */
async function runSynthesis(
  replies: unknown | unknown[],
  onairosData: unknown,
  existingVersion: number | null = null
) {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  const writes: Array<{ table: string; payload: unknown }> = [];
  let modelBody = "";
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = (async (_url: string, init?: RequestInit) => {
    modelBody = String(init?.body ?? "");
    calls += 1;
    const reply = queue.length > 1 ? queue.shift() : queue[0];
    const raw = reply && typeof reply === "object" && "raw" in reply ? (reply as RawReply) : null;
    return {
      json: async () => ({
        content: [{ text: raw ? raw.raw : JSON.stringify(reply) }],
        stop_reason: raw?.stop_reason ?? "end_turn",
      }),
    };
  }) as typeof fetch;

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                single: async () => ({
                  data: existingVersion === null ? null : { version: existingVersion },
                  error: null,
                }),
              };
            },
          };
        },
        upsert: async (payload: unknown) => {
          writes.push({ table, payload });
          return { error: null };
        },
        update(payload: unknown) {
          writes.push({ table, payload });
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  };

  const service = new PersonaService(
    { get: () => "test-key" } as any,
    { getClient: () => client } as any,
    new OnairosSnapshotService(),
    {
      buildSystemBlocks: async () => [],
      sanitizeProse: (value: string) => value,
    } as any
  );

  let error: unknown = null;
  try {
    await service.generatePrompts({ userId: "user-1", onairosData });
  } catch (e) {
    error = e;
  } finally {
    global.fetch = originalFetch;
  }
  return { modelBody, writes, calls, error };
}

const constellationWrite = (writes: Array<{ table: string; payload: unknown }>) =>
  writes.find((write) => write.table === "constellation_state")?.payload as
    | Record<string, unknown>
    | undefined;

test("legacy synthesis strips token keys before model use and constellation persist", async () => {
  const { modelBody, writes } = await runSynthesis(
    {
      origin: { score: 70, synthesis: "origin" },
      emergence: { score: 71, synthesis: "emergence" },
      self_creation: { score: 72, synthesis: "self creation" },
      convergence: { score: 73, synthesis: "convergence" },
    },
    {
      token: TOKEN,
      authToken: TOKEN,
      traits: { archetype: "builder", openness: 0.9 },
      nested: { session_token: TOKEN, credentials: { bearer: TOKEN } },
    }
  );

  const captured = JSON.stringify({ modelBody, writes });
  assert.ok(!captured.includes(TOKEN), "token leaked to model or durable write");
  const constellation = writes.find((write) => write.table === "constellation_state");
  assert.ok(constellation, "constellation snapshot was persisted");
  assert.equal(
    (constellation.payload as { onairos_snapshot: { traits: { openness: number } } })
      .onairos_snapshot.traits.openness,
    0.9,
    "non-credential traits survive"
  );
});

test("PHE-100: a partial first run persists the usable pillars", async () => {
  const { writes } = await runSynthesis(
    {
      origin: { score: 70, synthesis: "origin" },
      emergence: { score: "high", synthesis: "malformed score" },
      becoming: { score: 140, synthesis: "becoming" },
      transcendence: { score: -3, synthesis: "transcendence" },
    },
    { traits: { archetype: "builder" } }
  );

  const payload = writes.find((write) => write.table === "constellation_state")
    ?.payload as Record<string, unknown>;
  assert.ok(payload, "constellation state was persisted");
  assert.equal(payload.origin_score, 70);
  assert.equal(payload.becoming_score, 100, "scores clamp to the 0..100 check");
  assert.equal(payload.transcendence_score, 0);
  assert.equal(payload.transcendence_synthesis, "transcendence");
  // Missing or malformed pillars are left out (null on a first run, drawn thin).
  for (const pillar of ["emergence", "self_creation", "convergence", "recognition"]) {
    assert.ok(!(`${pillar}_score` in payload), `${pillar} should not be written`);
    assert.ok(!(`${pillar}_synthesis` in payload), `${pillar} should not be written`);
  }
});

test("PHE-100: a reply with no usable pillar fails after one retry", async () => {
  const { error, calls, writes } = await runSynthesis(
    { origin: { synthesis: "no score" } },
    { traits: {} }
  );
  assert.ok(error, "the run fails");
  assert.equal(calls, 2, "one retry");
  assert.equal(constellationWrite(writes), undefined, "nothing written");
});

test("PHE-100: a reply wrapped in a ```json fence still reads", async () => {
  const { error, writes } = await runSynthesis(
    { raw: "```json\n" + JSON.stringify(SEVEN) + "\n```" },
    { traits: {} }
  );
  assert.equal(error, null);
  assert.equal(constellationWrite(writes)?.transcendence_synthesis, "transcendence text");
});

test("PHE-100: a reply cut off at max_tokens is retried once", async () => {
  const { error, calls, writes } = await runSynthesis(
    [{ raw: '{"origin": {"score": 7', stop_reason: "max_tokens" }, SEVEN],
    { traits: {} }
  );
  assert.equal(error, null);
  assert.equal(calls, 2);
  assert.equal(constellationWrite(writes)?.origin_score, 60);
});

test("PHE-100: a refresh missing any part keeps the previous snapshot", async () => {
  const { origin, emergence, self_creation, convergence } = SEVEN;
  const { error, writes } = await runSynthesis(
    { origin, emergence, self_creation, convergence },
    { traits: {} },
    3
  );
  assert.ok(error, "the run fails for the caller to log");
  assert.equal(writes.length, 0, "no constellation or profile write, version stays 3");
});

test("PHE-100: a full refresh replaces the snapshot and bumps the version", async () => {
  const { error, writes } = await runSynthesis(SEVEN, { traits: {} }, 3);
  assert.equal(error, null);
  const payload = constellationWrite(writes);
  assert.equal(payload?.version, 4);
  for (const p of PILLARS) assert.ok(`${p}_synthesis` in (payload ?? {}), `${p} written`);
});
