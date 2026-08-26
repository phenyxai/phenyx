import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { PersonaService } from "./persona.service";

const TOKEN = "eyJ.legacy-engine-secret.signature";

test("legacy synthesis strips token keys before model use and constellation persist", async () => {
  const writes: Array<{ table: string; payload: unknown }> = [];
  let modelBody = "";
  const originalFetch = global.fetch;
  global.fetch = (async (_url: string, init?: RequestInit) => {
    modelBody = String(init?.body ?? "");
    return {
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              origin: { score: 70, synthesis: "origin" },
              emergence: { score: 71, synthesis: "emergence" },
              self_creation: { score: 72, synthesis: "self creation" },
              convergence: { score: 73, synthesis: "convergence" },
            }),
          },
        ],
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
    await service.generatePrompts({
      userId: "user-1",
      onairosData: {
        token: TOKEN,
        authToken: TOKEN,
        traits: { archetype: "builder", openness: 0.9 },
        nested: { session_token: TOKEN, credentials: { bearer: TOKEN } },
      },
    });
  } finally {
    global.fetch = originalFetch;
  }

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
