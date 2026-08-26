import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OnairosSnapshotService } from "../persona/onairos-snapshot.service";
import { SynthesisService } from "./synthesis.service";

const TOKEN = "eyJ.engine-secret.signature";

test("synthesis strips every token key before model use and durable persist", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const modelMessages: string[] = [];
  const logs: string[] = [];
  const service = new SynthesisService(
    { get: () => "test-key" } as any,
    {
      getClient: () => ({
        rpc: async (name: string, args: Record<string, unknown>) => {
          rpcCalls.push({ name, args });
          return { data: { out_version: 1, out_idempotent: true }, error: null };
        },
      }),
    } as any,
    {} as any,
    { sanitizeProse: (value: string) => value } as any,
    {} as any,
    new OnairosSnapshotService()
  );

  (service as any).isAccountFrozen = async () => false;
  (service as any).callClaudeTool = async ({ userMessage }: { userMessage: string }) => {
    modelMessages.push(userMessage);
    return {
      archetype: "builder",
      pillars: {
        origin: { score: 70, synthesis: "origin" },
        emergence: { score: 71, synthesis: "emergence" },
        self_creation: { score: 72, synthesis: "self creation" },
        convergence: { score: 73, synthesis: "convergence" },
      },
      portrait: "portrait",
      trait_grounding: [],
    };
  };
  (service as any).logger = {
    log: (message: string) => logs.push(message),
    error: (message: string) => logs.push(message),
  };

  await service.synthesize("user-1", {
    trait_object: {
      token: TOKEN,
      authToken: TOKEN,
      nested: {
        session_token: TOKEN,
        credentials: { bearer: TOKEN },
        openness: 0.88,
      },
    },
    trigger_event_id: "event-1",
  });

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "apply_constellation_synthesis");
  const captured = JSON.stringify({ rpcCalls, modelMessages, logs });
  assert.ok(!captured.includes(TOKEN), "token value leaked to model, persist, or logs");

  const snapshot = rpcCalls[0].args.p_onairos_snapshot;
  const keys: string[] = [];
  JSON.stringify(snapshot, (key, value) => {
    if (key) keys.push(key);
    return value;
  });
  assert.deepEqual(
    keys.filter((key) => /token|jwt|secret|credential|authorization|bearer|password/i.test(key)),
    [],
    "no credential-bearing key survives the engine boundary"
  );
});
