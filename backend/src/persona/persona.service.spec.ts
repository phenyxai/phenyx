import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { PersonaService } from "./persona.service";

const TOKEN = "eyJ.legacy-engine-secret.signature";

/**
 * Run one generatePrompts call against a stubbed model reply and a fake
 * Supabase client; returns what reached the model and every durable write.
 */
async function runSynthesis(modelReply: unknown, onairosData: unknown) {
  const writes: Array<{ table: string; payload: unknown }> = [];
  let modelBody = "";
  const originalFetch = global.fetch;
  global.fetch = (async (_url: string, init?: RequestInit) => {
    modelBody = String(init?.body ?? "");
    return {
      json: async () => ({ content: [{ text: JSON.stringify(modelReply) }] }),
    };
  }) as typeof fetch;

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                single: async () => ({ data: null, error: null }),
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

  try {
    await service.generatePrompts({ userId: "user-1", onairosData });
  } finally {
    global.fetch = originalFetch;
  }
  return { modelBody, writes };
}

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

test("PHE-100: a partial reply persists the usable pillars and never fails the run", async () => {
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
  // Missing or malformed pillars are left out so a refresh keeps the last value.
  for (const pillar of ["emergence", "self_creation", "convergence", "recognition"]) {
    assert.ok(!(`${pillar}_score` in payload), `${pillar} should not be written`);
    assert.ok(!(`${pillar}_synthesis` in payload), `${pillar} should not be written`);
  }
});

test("PHE-100: a reply with no usable pillar fails the run", async () => {
  await assert.rejects(
    runSynthesis({ origin: { synthesis: "no score" } }, { traits: {} })
  );
});
