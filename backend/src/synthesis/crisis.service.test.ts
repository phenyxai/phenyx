import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { Logger } from "@nestjs/common";
import { CRISIS_RESPONSE, CrisisService } from "./crisis.service";

Logger.overrideLogger(false);

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Stub fetch with one reply per call; returns the request bodies it saw. */
function stubFetch(...replies: Array<() => Response | Promise<Response>>) {
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const reply = replies[bodies.length - 1];
    assert.ok(reply, "unexpected extra fetch call");
    return reply();
  }) as typeof fetch;
  return bodies;
}

const verdict = (triggered: boolean, category = "none") => () =>
  Response.json({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", name: "flag_crisis", input: { triggered, category } }],
  });
const status = (code: number) => () =>
  Response.json({ type: "error", error: { type: "api_error", message: "x" } }, { status: code });
const timeout = () => {
  throw Object.assign(new Error("aborted"), { name: "AbortError" });
};

const gate = (key: string | undefined = "test-key") =>
  new CrisisService({ get: () => key } as any, {} as any);

test("a harmless question gets a normal verdict from the current haiku", async () => {
  const bodies = stubFetch(verdict(false));
  const result = await gate().detectCrisis("what is one next step that fits how i’m changing?");
  assert.deepEqual(result, { triggered: false });
  assert.equal(bodies[0].model, "claude-haiku-5-5");
});

test("crisis text triggers, by regex without a call or by the model with its category", async () => {
  stubFetch();
  assert.deepEqual(await gate().detectCrisis("i want to die"), { triggered: true });
  stubFetch(verdict(true, "immediate_danger"));
  assert.deepEqual(await gate().detectCrisis("someone is outside my door with a knife"), {
    triggered: true,
    category: "immediate_danger",
  });
});

test("a timeout or 5xx is retried once and the retry's verdict stands", async () => {
  const bodies = stubFetch(timeout, verdict(false));
  assert.deepEqual(await gate().detectCrisis("hello"), { triggered: false });
  assert.equal(bodies.length, 2);
  stubFetch(status(529), verdict(false));
  assert.deepEqual(await gate().detectCrisis("hello"), { triggered: false });
});

test("fails closed when both attempts fail, a 4xx (no retry), a refusal or a missing key", async () => {
  stubFetch(timeout, timeout);
  assert.deepEqual(await gate().detectCrisis("hello"), { triggered: true });
  const bodies = stubFetch(status(404));
  assert.deepEqual(await gate().detectCrisis("hello"), { triggered: true });
  assert.equal(bodies.length, 1);
  stubFetch(() => Response.json({ stop_reason: "refusal", content: [] }));
  assert.deepEqual(await gate().detectCrisis("hello"), { triggered: true });
  stubFetch();
  assert.deepEqual(await gate(undefined).detectCrisis("hello"), { triggered: true });
});

test("crisis resources carry no em dash", () => {
  for (const line of Object.values(CRISIS_RESPONSE.resources)) assert.ok(!line.includes("—"), line);
});
