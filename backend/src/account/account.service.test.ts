import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountService } from "./account.service";
import {
  scrubCredentials,
  findCredentialLeak,
  isCredentialKey,
} from "./account.redaction";
import {
  closeAccountError,
  isDeleteConfirmed,
  passphraseChangeError,
} from "./account.dto";

const TOKEN = "eyJ.SECRET-SESSION-JWT.value";

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

function makeExportSupabase() {
  const tableData: Record<string, unknown> = {
    user_profiles: { id: "user-1", display_name: "Ada", frozen: false, tier: "pro" },
    user_persona: { user_id: "user-1", archetype: "the-architect" },
    constellation_state: {
      user_id: "user-1",
      archetype: "the-architect",
      version: 3,
      onairos_snapshot: { openness: 0.8, token: TOKEN },
    },
    constellation_points: [{ id: "p1", user_id: "user-1", pillar: "origin" }],
    observations: [{ id: "o1", user_id: "user-1", pillar: "origin", body: "surfaced" }],
    user_traits: [{ id: "t1", user_id: "user-1", keyword_tags: ["builder"] }],
    onairos_connections: [
      { id: "c1", user_id: "user-1", platform: "spotify", redacted_snapshot: { token: TOKEN, openness: 0.9 } },
    ],
    polaris_conversations: [{ id: "conv1", user_id: "user-1", title: "thread" }],
    polaris_messages: [
      { id: "m1", user_id: "user-1", conversation_id: "conv1", role: "user", body: "ENCRYPTED::hello" },
    ],
    events: [{ id: "e1", user_id: "user-1", event_type: "login" }],
    source_records: [{ id: "sr1", user_id: "user-1" }],
    signals: [{ id: "sig1", user_id: "user-1" }],
    underneath_readings: [{ id: "u1", user_id: "user-1" }],
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

const fakeEncryption = {
  decrypt: (payload: string) => payload.replace(/^ENCRYPTED::/, ""),
} as any;

const fakePassphrase = {
  verify: async (_hash: string, passphrase: string) => passphrase === "correct-phrase",
  hash: async (value: string) => `hashed:${value}`,
} as any;

function makeService(supabase: any, passphrase: any = fakePassphrase) {
  return new AccountService(supabase, fakeEncryption, passphrase);
}

test("exportAccount returns a single bundle with all sections and never a token", async () => {
  const bundle = await makeService(makeExportSupabase()).exportAccount("user-1");

  for (const key of [
    "export_metadata",
    "profile",
    "constellation",
    "observations",
    "traits",
    "onairos_connections",
    "polaris_messages",
    "events",
    "source_records",
  ]) {
    assert.ok(key in bundle, `bundle contains ${key}`);
  }

  const leak = findCredentialLeak(bundle);
  assert.equal(leak, null, `no credential key survived (offender: ${leak})`);
  assert.ok(!JSON.stringify(bundle).includes(TOKEN), "token value stripped from the onairos snapshot");

  const messages = bundle.polaris_messages as Array<Record<string, unknown>>;
  assert.equal(messages[0].body, "hello", "polaris body decrypted for the owner");
});

test("isDeleteConfirmed requires the typed phrase, lowercased and trimmed", () => {
  assert.ok(isDeleteConfirmed({ confirmation: "delete my account" }));
  assert.ok(isDeleteConfirmed({ confirmation: "  DELETE MY ACCOUNT  " }));
  assert.ok(!isDeleteConfirmed({ confirmation: "DELETE" }));
  assert.ok(!isDeleteConfirmed({ confirmation: "" }));
  assert.ok(!isDeleteConfirmed({}));
  assert.ok(!isDeleteConfirmed(undefined));
});

test("closeAccountError runs in fill order: passphrase then phrase", () => {
  assert.equal(
    closeAccountError("", ""),
    "enter your passphrase to confirm it is you."
  );
  assert.equal(
    closeAccountError("secret", ""),
    "type delete my account exactly, to confirm."
  );
  assert.equal(
    closeAccountError("secret", "delete my account"),
    null
  );
});

test("passphraseChangeError covers the four invalid cases", () => {
  assert.equal(
    passphraseChangeError("", "new", "new"),
    "enter your current passphrase to confirm it is you."
  );
  assert.equal(
    passphraseChangeError("old", "", ""),
    "enter a new passphrase."
  );
  assert.equal(
    passphraseChangeError("old", "new", "other"),
    "the two new passphrases do not match."
  );
  assert.equal(
    passphraseChangeError("same", "same", "same"),
    "that is your current passphrase. choose a different one."
  );
  assert.equal(passphraseChangeError("old", "new", "new"), null);
});

test("closeAccount rejects without passphrase and never calls admin.deleteUser", async () => {
  let deleteCalled = false;
  const supabase = {
    getClient: () => ({
      from() {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { passphrase_hash: "h" }, error: null }),
            }),
          }),
        };
      },
      auth: { admin: { deleteUser: async () => { deleteCalled = true; return { error: null }; } } },
    }),
  } as any;

  await assert.rejects(
    () => makeService(supabase).closeAccount("user-1", { confirmation: "delete my account" }),
    (err: any) => err?.getStatus?.() === 400,
    "missing passphrase is a 400"
  );
  assert.equal(deleteCalled, false, "no deletion attempted without passphrase");
});

test("closeAccount rejects a wrong phrase even when the passphrase is present", async () => {
  let deleteCalled = false;
  const supabase = {
    getClient: () => ({
      from() {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { passphrase_hash: "h" }, error: null }),
            }),
          }),
        };
      },
      auth: { admin: { deleteUser: async () => { deleteCalled = true; return { error: null }; } } },
    }),
  } as any;

  await assert.rejects(
    () =>
      makeService(supabase).closeAccount("user-1", {
        passphrase: "correct-phrase",
        confirmation: "please delete",
      }),
    (err: any) => err?.getStatus?.() === 400
  );
  assert.equal(deleteCalled, false);
});

test("closeAccount with both gates deletes the auth user", async () => {
  const deletedIds: string[] = [];
  const supabase = {
    getClient: () => ({
      from() {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { passphrase_hash: "h" }, error: null }),
            }),
          }),
        };
      },
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            deletedIds.push(id);
            return { error: null };
          },
        },
      },
    }),
  } as any;

  const res = await makeService(supabase).closeAccount("user-1", {
    passphrase: "correct-phrase",
    confirmation: "delete my account",
  });
  assert.deepEqual(res, { deleted: true });
  assert.deepEqual(deletedIds, ["user-1"]);
});

test("changePassphrase rejects new-equals-current before writing", async () => {
  let updated = false;
  const supabase = {
    getClient: () => ({
      from() {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { passphrase_hash: "h" }, error: null }),
            }),
          }),
          update: () => {
            updated = true;
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    }),
  } as any;

  await assert.rejects(
    () =>
      makeService(supabase).changePassphrase("user-1", {
        currentPassphrase: "same",
        newPassphrase: "same",
      }),
    (err: any) => err?.getStatus?.() === 400
  );
  assert.equal(updated, false);
});
