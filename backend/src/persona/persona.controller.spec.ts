import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PersonaController } from "./persona.controller";

test("generate-prompts always uses the signed-in user's id, never the body's", async () => {
  const calls: Array<{ userId?: string; onairosData?: unknown }> = [];
  const controller = new PersonaController({
    generatePrompts: async (body: { userId?: string; onairosData?: unknown }) => {
      calls.push(body);
      return { success: true };
    },
  } as any);

  await controller.generate(
    { user: { id: "caller" } } as any,
    { userId: "victim", onairosData: { traits: { archetype: "builder" } } }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, "caller");
  assert.deepEqual(calls[0].onairosData, { traits: { archetype: "builder" } });
});
