import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OnairosSnapshotService } from "../persona/onairos-snapshot.service";
import { OnairosService } from "./onairos.service";

// A distinctive token/credential string we assert never appears in any captured
// DB payload, synthesis input, or audit log line.
const TOKEN = "eyJ.SECRET-ONAIROS-JWT.value";
const NESTED_SECRET = "AK-nested-apikey-should-vanish";

// ---------------------------------------------------------------------------
// Capturing fakes — no Nest DI, no network. Every DB write and audit line is
// recorded so the security invariants can be asserted against the raw payloads.
// ---------------------------------------------------------------------------
function makeThenable(result: unknown) {
  const chain: any = {
    eq: () => chain,
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
  };
  return chain;
}

function makeHarness() {
  const dbWrites: unknown[] = [];
  const logs: string[] = [];
  const synthesisCalls: Array<{ userId?: string; onairosData?: unknown }> = [];

  const fakeClient = {
    from(table: string) {
      return {
        upsert(rows: unknown, opts: unknown) {
          dbWrites.push({ table, op: "upsert", rows, opts });
          return Promise.resolve({ error: null });
        },
        update(patch: unknown) {
          dbWrites.push({ table, op: "update", patch });
          return makeThenable({ error: null });
        },
        select() {
          return makeThenable({ data: [], error: null });
        },
      };
    },
  };

  const service = new OnairosService(
    { get: () => undefined } as any,
    { getClient: () => fakeClient } as any,
    new OnairosSnapshotService(),
    {
      generatePrompts(input: { userId?: string; onairosData?: unknown }) {
        synthesisCalls.push(input);
        return Promise.resolve({});
      },
    } as any
  );

  // Capture audit output without touching real stdout.
  (service as any).logger = {
    log: (m: string) => logs.push(m),
    error: (m: string) => logs.push(m),
  };

  return { service, dbWrites, logs, synthesisCalls };
}

// ---------------------------------------------------------------------------
// Redaction — deep strip at any depth, in objects and arrays.
// ---------------------------------------------------------------------------
test("redaction deep-strips credential keys at every depth", () => {
  const snap = new OnairosSnapshotService();
  const out = snap.redactOnairosForProfile({
    token: TOKEN,
    personality: { openness: 0.8, apiKey: NESTED_SECRET },
    history: [{ jwt: TOKEN, keep: "value" }, { access_token: TOKEN }],
  });
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes(TOKEN), "token must not survive redaction");
  assert.ok(!serialized.includes(NESTED_SECRET), "nested apiKey must not survive");
  assert.equal((out as any).personality.openness, 0.8, "non-secret fields retained");
  assert.equal((out as any).history[0].keep, "value", "array items retained");
});

test("redaction returns {} for non-object input", () => {
  const snap = new OnairosSnapshotService();
  assert.deepEqual(snap.redactOnairosForProfile("nope"), {});
  assert.deepEqual(snap.redactOnairosForProfile(null), {});
});

// ---------------------------------------------------------------------------
// connect — token verified then discarded; redacted snapshot persisted; synthesis
// enqueued exactly once; nothing leaks the token to DB, synthesis, or logs.
// ---------------------------------------------------------------------------
test("connect persists a redacted snapshot and never leaks the token", async () => {
  const { service, dbWrites, logs, synthesisCalls } = makeHarness();

  const result = await service.connect("user-1", {
    platforms: ["Spotify"],
    trait_object: { token: TOKEN, personality: { apiKey: NESTED_SECRET, openness: 0.9 } },
    token: TOKEN,
    trigger: "onboarding",
  });

  assert.equal(result.status, "connected");
  assert.deepEqual(result.platforms, ["spotify"], "platform normalized to lowercase");
  assert.equal(result.synthesisEnqueued, true);

  const connectionWrite: any = dbWrites.find(
    (w: any) => w.table === "onairos_connections" && w.op === "upsert"
  );
  assert.ok(connectionWrite, "onairos_connections upsert happened");
  assert.equal(connectionWrite.rows[0].status, "connected");
  assert.ok(connectionWrite.rows[0].redacted_snapshot, "snapshot stored");

  // Hard invariant: the token appears in NO db write, NO synthesis input, NO log.
  const everythingPersisted = JSON.stringify({ dbWrites, synthesisCalls, logs });
  assert.ok(!everythingPersisted.includes(TOKEN), "token leaked to DB/synthesis/logs");
  assert.ok(!everythingPersisted.includes(NESTED_SECRET), "nested secret leaked");

  // Synthesis enqueued exactly once, driven by the redacted snapshot.
  assert.equal(synthesisCalls.length, 1, "synthesis enqueued exactly once");
  assert.equal(synthesisCalls[0].userId, "user-1");

  // Audit is structural only.
  const auditLine = logs.find((l) => l.includes("onairos_connect"));
  assert.ok(auditLine, "structural audit emitted");
  const audit = JSON.parse(auditLine as string);
  assert.deepEqual(audit.platforms, ["spotify"]);
  assert.equal(typeof audit.traitCount, "number");
});

test("connect is idempotent on event_id — synthesis fires once for identical payloads", async () => {
  const { service, synthesisCalls } = makeHarness();
  const payload = {
    platforms: ["spotify"],
    trait_object: { personality: { openness: 0.5 } },
    token: TOKEN,
  } as const;

  const first = await service.connect("user-1", { ...payload });
  const second = await service.connect("user-1", { ...payload });

  assert.equal(first.synthesisEnqueued, true);
  assert.equal(second.synthesisEnqueued, false, "duplicate connect does not re-enqueue");
  assert.equal(synthesisCalls.length, 1, "synthesis triggered exactly once");
});

test("connect with a novel trait shape does not throw (schema-loose)", async () => {
  const { service } = makeHarness();
  const result = await service.connect("user-2", {
    platform: "linkedin",
    // Shape Onairos has never sent before — must persist without breaking.
    trait_object: { v9: { newField: [1, 2, { deep: true }] }, token: TOKEN },
    token: TOKEN,
  });
  assert.equal(result.status, "connected");
});

test("connect with no token still records the connection (bare reconnect)", async () => {
  const { service, dbWrites, synthesisCalls } = makeHarness();
  const result = await service.connect("user-3", { platform: "reddit" });
  assert.equal(result.status, "connected");
  assert.equal(result.synthesisEnqueued, false, "no trait data => no synthesis");
  const write: any = dbWrites.find((w: any) => w.table === "onairos_connections");
  assert.ok(write, "connection row written");
  assert.equal(write.rows[0].redacted_snapshot, undefined, "no snapshot overwrite on bare reconnect");
  assert.equal(synthesisCalls.length, 0);
});

// ---------------------------------------------------------------------------
// disconnect — status flip + timestamp, no synthesis, no deletion.
// ---------------------------------------------------------------------------
test("disconnect flips status and sets disconnected_at, without synthesis", async () => {
  const { service, dbWrites, synthesisCalls } = makeHarness();
  const result = await service.disconnect("user-1", "Spotify");

  assert.equal(result.status, "disconnected");
  assert.equal(result.platform, "spotify");

  const update: any = dbWrites.find(
    (w: any) => w.table === "onairos_connections" && w.op === "update"
  );
  assert.ok(update, "status update issued");
  assert.equal(update.patch.status, "disconnected");
  assert.ok(update.patch.disconnected_at, "disconnected_at set");
  assert.equal(synthesisCalls.length, 0, "disconnect never re-runs synthesis");
});
