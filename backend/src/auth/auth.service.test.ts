import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "./auth.service";
import { displayNameFromMetadata } from "./oauth-profile";
import { SignupStartDto } from "./dto/signup-start.dto";
import { stellarColorFor } from "../common/stellar.util";

// Run with: NODE_OPTIONS='--require ts-node/register' node --test src/auth/auth.service.test.ts

// ---------------------------------------------------------------------------
// displayNameFromMetadata: what a first-time Google user is called
// ---------------------------------------------------------------------------

test("displayNameFromMetadata prefers full_name, then name, then given + family", () => {
  assert.equal(displayNameFromMetadata({ full_name: "Mara Sola", name: "M S" }), "Mara Sola");
  assert.equal(displayNameFromMetadata({ name: "Mara Sola" }), "Mara Sola");
  assert.equal(
    displayNameFromMetadata({ given_name: "Mara", family_name: "Sola" }),
    "Mara Sola"
  );
  assert.equal(displayNameFromMetadata({ given_name: "Mara" }), "Mara");
});

test("displayNameFromMetadata trims, collapses whitespace and ignores non-strings", () => {
  assert.equal(displayNameFromMetadata({ full_name: "  Mara   Sola \n" }), "Mara Sola");
  assert.equal(displayNameFromMetadata({ full_name: 42, name: "Mara" }), "Mara");
  assert.equal(displayNameFromMetadata({ full_name: "   ", name: "" }), null);
  assert.equal(displayNameFromMetadata({}), null);
  assert.equal(displayNameFromMetadata(null), null);
  assert.equal(displayNameFromMetadata(undefined), null);
});

test("displayNameFromMetadata caps a pathological name at 80 characters", () => {
  const long = "a".repeat(200);
  assert.equal(displayNameFromMetadata({ full_name: long })?.length, 80);
});

// ---------------------------------------------------------------------------
// SignupStartDto: name + email only
// ---------------------------------------------------------------------------

test("SignupStartDto accepts name + email with no passphrase", async () => {
  const dto = plainToInstance(SignupStartDto, { name: "Mara", email: " Mara@Example.com " });
  const errors = await validate(dto, { whitelist: true });
  assert.deepEqual(errors, []);
  assert.equal(dto.email, "mara@example.com");
});

test("SignupStartDto strips a passphrase an old client still sends", async () => {
  const dto = plainToInstance(SignupStartDto, {
    name: "Mara",
    email: "mara@example.com",
    passphrase: "an old secret phrase",
  });
  const errors = await validate(dto, { whitelist: true });
  assert.deepEqual(errors, []);
  assert.equal((dto as any).passphrase, undefined);
});

test("SignupStartDto still rejects a short name and a bad email", async () => {
  const dto = plainToInstance(SignupStartDto, { name: "M", email: "nope" });
  const errors = await validate(dto, { whitelist: true });
  assert.deepEqual(errors.map((e) => e.property).sort(), ["email", "name"]);
});

// ---------------------------------------------------------------------------
// AuthService with an in-memory Supabase fake
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

interface FakeOptions {
  /** Emails that already have an auth.users row, mapped to their id. */
  users?: Record<string, string>;
  profiles?: Row[];
  drafts?: Row[];
  /** user_metadata returned by admin.getUserById. */
  metadata?: Record<string, Record<string, unknown>>;
  /** Force the next user_profiles insert to fail with this error. */
  profileInsertError?: { code?: string; message: string };
}

function makeFake(opts: FakeOptions = {}) {
  const users: Record<string, string> = { ...(opts.users ?? {}) };
  const tables: Record<string, Row[]> = {
    user_profiles: [...(opts.profiles ?? [])],
    signup_drafts: [...(opts.drafts ?? [])],
  };
  const inserts: Record<string, Row[]> = { user_profiles: [], signup_drafts: [] };
  const created: string[] = [];
  const deleted: string[] = [];
  const links: Array<{ type: string; email: string }> = [];
  let profileInsertError = opts.profileInsertError ?? null;
  let nextId = 1;

  function from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const rows = () =>
      (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    let pendingInsert: Row | null = null;
    let insertError: { code?: string; message: string } | null = null;

    const chain: any = {
      select: () => chain,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return chain;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () =>
        insertError
          ? { data: null, error: insertError }
          : { data: pendingInsert ?? rows()[0] ?? null, error: null },
      insert: (row: Row) => {
        if (table === "user_profiles" && profileInsertError) {
          insertError = profileInsertError;
          profileInsertError = null;
        } else if (
          table === "user_profiles" &&
          tables.user_profiles.some((r) => r.id === row.id)
        ) {
          insertError = { code: "23505", message: "duplicate key" };
        } else {
          pendingInsert = table === "signup_drafts" ? { draft_id: `draft-${nextId++}`, ...row } : row;
          tables[table].push(pendingInsert);
          inserts[table].push(pendingInsert);
        }
        return chain;
      },
      delete: () => {
        chain.__delete = true;
        return chain;
      },
      then: (resolve: (v: unknown) => void) => {
        if (chain.__delete) {
          tables[table] = (tables[table] ?? []).filter(
            (r) => !filters.every(([k, v]) => r[k] === v)
          );
        }
        resolve({ data: null, error: insertError });
      },
    };
    return chain;
  }

  const admin = {
    from,
    auth: {
      admin: {
        createUser: async ({ email }: { email: string }) => {
          if (users[email]) {
            return { data: { user: null }, error: { code: "email_exists", message: "exists" } };
          }
          const id = `user-${nextId++}`;
          users[email] = id;
          created.push(email);
          return { data: { user: { id } }, error: null };
        },
        deleteUser: async (id: string) => {
          deleted.push(id);
          return { error: null };
        },
        generateLink: async ({ type, email }: { type: string; email: string }) => {
          links.push({ type, email });
          if (!users[email]) return { data: null, error: { message: "user not found" } };
          return { data: { properties: { hashed_token: `hash:${email}` } }, error: null };
        },
        getUserById: async (id: string) => ({
          data: { user: { id, user_metadata: opts.metadata?.[id] ?? {} } },
          error: null,
        }),
      },
    },
  };

  const anon = {
    auth: {
      verifyOtp: async ({ token_hash }: { token_hash: string }) => {
        const email = token_hash.replace("hash:", "");
        return {
          data: {
            session: {
              access_token: `at:${email}`,
              refresh_token: `rt:${email}`,
              user: { id: users[email] },
            },
          },
          error: null,
        };
      },
    },
  };

  const supabase = { getClient: () => admin, getAnonClient: () => anon };
  return { supabase, tables, inserts, created, deleted, links };
}

function makeOtp(outcome: "ok" | "invalid" | "expired" = "ok") {
  const sent: Array<{ email: string; purpose: string }> = [];
  return {
    sent,
    sendCode: async (p: { email: string; purpose: string }) => {
      sent.push(p);
    },
    verifyCode: async () => outcome,
  };
}

function makeService(fake: ReturnType<typeof makeFake>, otp = makeOtp()) {
  return new AuthService(fake.supabase as any, otp as any);
}

const FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString();

test("signupStart stages name + email with no passphrase and sends a signup code", async () => {
  const fake = makeFake();
  const otp = makeOtp();
  const result = await makeService(fake, otp).signupStart({
    name: "Mara",
    email: "mara@example.com",
  } as SignupStartDto);

  assert.equal(result.draft_id, "draft-1");
  assert.equal(result.maskedEmail, "ma**@example.com");
  const draft = fake.inserts.signup_drafts[0];
  assert.equal(draft.name, "Mara");
  assert.equal(draft.email, "mara@example.com");
  assert.ok(!("passphrase_hash" in draft), "no passphrase is staged");
  assert.deepEqual(otp.sent, [{ email: "mara@example.com", purpose: "signup" }]);
});

test("ensureProfile creates a missing profile with the deterministic stellar color", async () => {
  const fake = makeFake();
  const result = await makeService(fake).ensureProfile("user-9", "Mara Sola");

  assert.deepEqual(result, { created: true });
  const row = fake.inserts.user_profiles[0];
  assert.equal(row.id, "user-9");
  assert.equal(row.display_name, "Mara Sola");
  assert.equal(row.stellar_color, stellarColorFor("user-9", row.created_at));
  assert.ok(!("passphrase_hash" in row), "no passphrase on new profiles");
});

test("ensureProfile leaves an existing profile untouched", async () => {
  const fake = makeFake({
    profiles: [{ id: "user-9", display_name: "Mara", stellar_color: "#E87722" }],
  });
  const result = await makeService(fake).ensureProfile("user-9", "Someone Else");

  assert.deepEqual(result, { created: false });
  assert.equal(fake.inserts.user_profiles.length, 0);
  assert.equal(fake.tables.user_profiles[0].display_name, "Mara");
  assert.equal(fake.tables.user_profiles[0].stellar_color, "#E87722");
});

test("ensureProfile treats a concurrent insert (unique violation) as already complete", async () => {
  const fake = makeFake({ profileInsertError: { code: "23505", message: "duplicate key" } });
  const result = await makeService(fake).ensureProfile("user-9", "Mara");
  assert.deepEqual(result, { created: false });
});

test("ensureProfile throws on any other insert failure", async () => {
  const fake = makeFake({ profileInsertError: { message: "connection reset" } });
  await assert.rejects(makeService(fake).ensureProfile("user-9", "Mara"));
});

test("completeOAuthProfile names a first-time Google user from their profile, once", async () => {
  const fake = makeFake({
    metadata: { "user-g": { full_name: "Mara Sola", email: "mara@gmail.com" } },
  });
  const service = makeService(fake);

  assert.deepEqual(await service.completeOAuthProfile("user-g"), { is_new: true });
  assert.equal(fake.inserts.user_profiles[0].display_name, "Mara Sola");

  assert.deepEqual(await service.completeOAuthProfile("user-g"), { is_new: false });
  assert.equal(fake.inserts.user_profiles.length, 1, "second call does not insert again");
});

test("otpVerify signup creates the account and reports a new user", async () => {
  const fake = makeFake({
    drafts: [{ draft_id: "d1", name: "Mara", email: "mara@example.com", expires_at: FUTURE }],
  });
  const result = await makeService(fake).otpVerify({ draftId: "d1", code: "123456" });

  assert.equal(result.status, "ok");
  assert.equal(result.is_new, true);
  assert.deepEqual(result.session, {
    access_token: "at:mara@example.com",
    refresh_token: "rt:mara@example.com",
  });
  assert.deepEqual(fake.created, ["mara@example.com"]);
  assert.equal(fake.inserts.user_profiles[0].display_name, "Mara");
  assert.equal(fake.tables.signup_drafts.length, 0, "draft consumed");
});

test("otpVerify signup for an email that already has an account signs them in instead", async () => {
  const fake = makeFake({
    users: { "mara@example.com": "user-old" },
    profiles: [{ id: "user-old", display_name: "Mara", stellar_color: "#E87722" }],
    drafts: [{ draft_id: "d1", name: "New Name", email: "mara@example.com", expires_at: FUTURE }],
  });
  const result = await makeService(fake).otpVerify({ draftId: "d1", code: "123456" });

  assert.equal(result.status, "ok");
  assert.equal(result.is_new, false);
  assert.equal(result.session?.access_token, "at:mara@example.com");
  assert.equal(fake.inserts.user_profiles.length, 0, "existing profile kept");
  assert.equal(fake.tables.user_profiles[0].display_name, "Mara");
});

test("otpVerify signup rolls back the auth user when the profile insert fails", async () => {
  const fake = makeFake({
    drafts: [{ draft_id: "d1", name: "Mara", email: "mara@example.com", expires_at: FUTURE }],
    profileInsertError: { message: "connection reset" },
  });
  await assert.rejects(makeService(fake).otpVerify({ draftId: "d1", code: "123456" }));
  assert.equal(fake.deleted.length, 1);
});

test("otpVerify signin lets an existing passphrase account in by email code", async () => {
  const fake = makeFake({
    users: { "mara@example.com": "user-old" },
    profiles: [{ id: "user-old", display_name: "Mara", passphrase_hash: "$argon2id$old" }],
  });
  const result = await makeService(fake).otpVerify({
    email: "mara@example.com",
    code: "123456",
    purpose: "signin",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.is_new, false);
  assert.equal(result.session?.access_token, "at:mara@example.com");
  assert.deepEqual(fake.links, [{ type: "recovery", email: "mara@example.com" }]);
});

test("otpVerify signin completes a profile that is missing (an unfinished Google account)", async () => {
  const fake = makeFake({ users: { "mara@gmail.com": "user-g" } });
  const result = await makeService(fake).otpVerify({
    email: "mara@gmail.com",
    code: "123456",
    purpose: "signin",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.is_new, true);
  assert.equal(fake.inserts.user_profiles[0].id, "user-g");
});

test("otpVerify signin with a correct code but no account says so, without creating one", async () => {
  const fake = makeFake();
  const result = await makeService(fake).otpVerify({
    email: "new@example.com",
    code: "123456",
    purpose: "signin",
  });

  assert.deepEqual(result, { status: "no_account" });
  assert.equal(fake.created.length, 0);
});

test("otpVerify signin passes a wrong code straight through and mints nothing", async () => {
  const fake = makeFake({ users: { "mara@example.com": "user-old" } });
  const result = await makeService(fake, makeOtp("invalid")).otpVerify({
    email: "mara@example.com",
    code: "000000",
    purpose: "signin",
  });

  assert.deepEqual(result, { status: "invalid" });
  assert.equal(fake.links.length, 0);
});
