import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountService } from "./account.service";
import {
  scrubCredentials,
  findCredentialLeak,
  isCredentialKey,
} from "./account.redaction";
import { isDeleteConfirmed } from "./account.dto";

// A distinctive credential string asserted to never survive into the bundle.
const TOKEN = "eyJ.SECRET-SESSION-JWT.value";

// ---------------------------------------------------------------------------
// Credential scrub / scan (pure helpers)
// ---------------------------------------------------------------------------

test("isCredentialKey matches token/jwt-shaped keys case-insensitively", () => {
  for (const k of ["token", "JWT", "Access_Token", "apiKey", "authorization", "bearer", "password"]) {
    assert.ok(isCredentialKey(k), `${k} should be treated as a credential key`);
  }
  for (const k of ["body", "pillar", "user_id", "archetype"]) {
    assert.ok(!isCredentialKey(k), `${k} should NOT be treated as a credential key`);
  }
});

test("scrubCredentials deep-strips credential keys at every depth, keeps the rest", () => {
  const scrubbed = scrubCredentials({
    token: TOKEN,
    profile: { display_name: "Ada", access_token: TOKEN },
    history: [{ jwt: TOKEN, keep: "value" }, { bearer: TOKEN }],
  });
  const serialized = JSON.stringify(scrubbed);
  assert.ok(!serialized.includes(TOKEN), "no credential value survives the scrub");
  assert.equal((scrubbed as any).profile.display_name, "Ada", "non-secret fields retained");
  assert.equal((scrubbed as any).history[0].keep, "value", "array items retained");
  assert.equal(findCredentialLeak(scrubbed), null, "scrubbed bundle scans clean");
});

test("findCredentialLeak pinpoints a surviving credential key", () => {
  assert.equal(findCredentialLeak({ a: { b: [{ token: "x" }] } }), "$.a.b[0].token");
  assert.equal(findCredentialLeak({ a: 1, b: [2, 3] }), null);
});

// ---------------------------------------------------------------------------
// Export — assembles the bundle, decrypts Polaris owner-side, never leaks a token
// ---------------------------------------------------------------------------

/** Table-scoped fake Supabase. Single-row reads terminate in .maybeSingle(). */
function makeExportSupabase() {
  const tableData: Record<string, unknown> = {
    user_profiles: { id: "user-1", display_name: "Ada", frozen: false, tier: "pro" },
    user_persona: { user_id: "user-1", archetype: "the-architect" },
    // onairos_snapshot is the verbatim trait object the synthesize endpoint stored
    // — it can carry a raw token, so the bundle-wide scrub must catch it here too.
    constellation_state: {
      user_id: "user-1",
      archetype: "the-architect",
      version: 3,
      onairos_snapshot: { openness: 0.8, token: TOKEN },
    },
    constellation_points: [{ id: "p1", user_id: "user-1", pillar: "origin" }],
    observations: [{ id: "o1", user_id: "user-1", pillar: "origin", body: "surfaced" }],
    user_traits: [{ id: "t1", user_id: "user-1", keyword_tags: ["builder"] }],
    // Onairos snapshot deliberately carries a token — the export must strip it.
    onairos_connections: [
      { id: "c1", user_id: "user-1", platform: "spotify", redacted_snapshot: { token: TOKEN, openness: 0.9 } },
    ],
    polaris_conversations: [{ id: "conv1", user_id: "user-1", title: "thread" }],
    polaris_messages: [
      { id: "m1", user_id: "user-1", conversation_id: "conv1", role: "user", body: "ENCRYPTED::hello" },
    ],
    events: [{ id: "e1", user_id: "user-1", event_type: "login" }],
  };

  return {
    getClient() {
      return {
        from(table: string) {
          const value = tableData[table];
          const result = { data: value ?? null, error: null };
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            order: () => chain,
            maybeSingle: () => Promise.resolve(result),
            then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
          };
          return chain;
        },
      };
    },
  };
}

// Fake EncryptionService: strips the "ENCRYPTED::" prefix to prove owner-side
// decryption happens (and that we never ship the ciphertext).
const fakeEncryption = {
  decrypt: (payload: string) => payload.replace(/^ENCRYPTED::/, ""),
} as any;

test("exportAccount returns a single bundle with all sections and never a token", async () => {
  const service = new AccountService(makeExportSupabase() as any, fakeEncryption);
  const bundle = await service.exportAccount("user-1");

  // All documented sections present.
  for (const key of [
    "export_metadata",
    "profile",
    "constellation",
    "observations",
    "traits",
    "onairos_connections",
    "polaris_messages",
    "events",
  ]) {
    assert.ok(key in bundle, `bundle contains ${key}`);
  }

  // Hard invariant: the whole bundle carries no token/JWT-shaped key OR value.
  const leak = findCredentialLeak(bundle);
  assert.equal(leak, null, `no credential key survived (offender: ${leak})`);
  assert.ok(!JSON.stringify(bundle).includes(TOKEN), "token value stripped from the onairos snapshot");

  // Polaris body decrypted owner-side (ciphertext prefix gone).
  const messages = bundle.polaris_messages as Array<Record<string, unknown>>;
  assert.equal(messages[0].body, "hello", "polaris body decrypted for the owner");
});

// ---------------------------------------------------------------------------
// Delete — confirmation gate
// ---------------------------------------------------------------------------

test("isDeleteConfirmed requires the exact typed phrase", () => {
  assert.ok(isDeleteConfirmed({ confirmation: "DELETE" }));
  assert.ok(!isDeleteConfirmed({ confirmation: "delete" }));
  assert.ok(!isDeleteConfirmed({ confirmation: "" }));
  assert.ok(!isDeleteConfirmed({}));
  assert.ok(!isDeleteConfirmed(undefined));
});

test("deleteAccount rejects without confirmation and never calls admin.deleteUser", async () => {
  let deleteCalled = false;
  const supabase = {
    getClient: () => ({
      auth: { admin: { deleteUser: async () => { deleteCalled = true; return { error: null }; } } },
    }),
  } as any;
  const service = new AccountService(supabase, fakeEncryption);

  await assert.rejects(
    () => service.deleteAccount("user-1", {}),
    (err: any) => err?.getStatus?.() === 400,
    "missing confirmation is a 400"
  );
  assert.equal(deleteCalled, false, "no deletion attempted without confirmation");
});

test("deleteAccount with confirmation deletes the auth user (cascade path)", async () => {
  const deletedIds: string[] = [];
  const supabase = {
    getClient: () => ({
      auth: {
        admin: {
          deleteUser: async (id: string) => { deletedIds.push(id); return { error: null }; },
        },
      },
    }),
  } as any;
  const service = new AccountService(supabase, fakeEncryption);

  const res = await service.deleteAccount("user-1", { confirmation: "DELETE" });
  assert.deepEqual(res, { deleted: true });
  assert.deepEqual(deletedIds, ["user-1"], "service-role delete targets the token user id");
});

// ---------------------------------------------------------------------------
// Freeze / unfreeze — idempotency
// ---------------------------------------------------------------------------

/** Fake profile store: reads current frozen, records any update. */
function makeFreezeSupabase(initialFrozen: boolean) {
  const updates: Array<{ frozen: boolean }> = [];
  const client = {
    from(_table: string) {
      const chain: any = {
        _op: "read" as "read" | "update",
        _patch: null as { frozen: boolean } | null,
        select() { chain._op = "read"; return chain; },
        update(patch: { frozen: boolean }) {
          chain._op = "update";
          chain._patch = patch;
          updates.push(patch);
          return chain;
        },
        eq() { return chain; },
        maybeSingle: () => Promise.resolve({ data: { frozen: initialFrozen }, error: null }),
        then: (onF: any, onR: any) => Promise.resolve({ error: null }).then(onF, onR),
      };
      return chain;
    },
  };
  return { supabase: { getClient: () => client }, updates };
}

test("setFrozen(true) on an active account flips frozen and reports changed", async () => {
  const { supabase, updates } = makeFreezeSupabase(false);
  const service = new AccountService(supabase as any, fakeEncryption);
  const res = await service.setFrozen("user-1", true);
  assert.deepEqual(res, { frozen: true, changed: true });
  assert.deepEqual(updates, [{ frozen: true }], "an update was issued");
});

test("setFrozen(true) on an already-frozen account is an idempotent no-op", async () => {
  const { supabase, updates } = makeFreezeSupabase(true);
  const service = new AccountService(supabase as any, fakeEncryption);
  const res = await service.setFrozen("user-1", true);
  assert.deepEqual(res, { frozen: true, changed: false });
  assert.equal(updates.length, 0, "no update issued when already in the requested state");
});

test("setFrozen(false) on an already-active account is an idempotent no-op", async () => {
  const { supabase, updates } = makeFreezeSupabase(false);
  const service = new AccountService(supabase as any, fakeEncryption);
  const res = await service.setFrozen("user-1", false);
  assert.deepEqual(res, { frozen: false, changed: false });
  assert.equal(updates.length, 0);
});
