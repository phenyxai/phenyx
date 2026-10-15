import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ConfirmCodeService,
  CONFIRM_CODE_EXPIRED,
  CONFIRM_CODE_INVALID,
  CONFIRM_CODE_MISSING,
  readCode,
} from "./confirm-code.service";

function makeSupabase(email: string | null) {
  const lookups: string[] = [];
  const supabase = {
    getClient: () => ({
      auth: {
        admin: {
          getUserById: async (id: string) => {
            lookups.push(id);
            return { data: { user: email ? { email } : null }, error: null };
          },
        },
      },
    }),
  } as any;
  return { supabase, lookups };
}

function makeOtp(outcome: "ok" | "invalid" | "expired" = "ok") {
  const sent: unknown[] = [];
  const verified: unknown[] = [];
  const otp = {
    sendCode: async (params: unknown) => {
      sent.push(params);
    },
    verifyCode: async (params: unknown) => {
      verified.push(params);
      return outcome;
    },
  } as any;
  return { otp, sent, verified };
}

async function rejectsWith(promise: Promise<unknown>, message: string) {
  await assert.rejects(promise, (err: any) => {
    assert.equal(err?.getStatus?.(), 400);
    assert.equal(err?.getResponse?.().error, message);
    return true;
  });
}

test("readCode keeps digits only, capped at 6", () => {
  assert.equal(readCode(" 12-34 56 "), "123456");
  assert.equal(readCode("1234567"), "123456");
  assert.equal(readCode(123456), "");
  assert.equal(readCode(undefined), "");
});

test("send emails a confirm code to the account's own address", async () => {
  const { supabase, lookups } = makeSupabase(" Person@Example.com ");
  const { otp, sent } = makeOtp();
  const res = await new ConfirmCodeService(supabase, otp).send("user-1");
  assert.deepEqual(res, { sent: true });
  assert.deepEqual(lookups, ["user-1"]);
  assert.deepEqual(sent, [{ email: "person@example.com", purpose: "confirm" }]);
});

test("send refuses when the account has no email", async () => {
  const { supabase } = makeSupabase(null);
  const { otp, sent } = makeOtp();
  await assert.rejects(new ConfirmCodeService(supabase, otp).send("user-1"));
  assert.deepEqual(sent, []);
});

test("assertValid asks for a code before looking anything up", async () => {
  const { supabase, lookups } = makeSupabase("p@example.com");
  const { otp, verified } = makeOtp();
  await rejectsWith(new ConfirmCodeService(supabase, otp).assertValid("user-1", ""), CONFIRM_CODE_MISSING);
  assert.deepEqual(lookups, []);
  assert.deepEqual(verified, []);
});

test("assertValid verifies against the confirm purpose for the account's email", async () => {
  const { supabase } = makeSupabase("p@example.com");
  const { otp, verified } = makeOtp("ok");
  await new ConfirmCodeService(supabase, otp).assertValid("user-1", "123456");
  assert.deepEqual(verified, [{ email: "p@example.com", purpose: "confirm", code: "123456" }]);
});

test("assertValid maps wrong and expired codes to their copy", async () => {
  const { supabase } = makeSupabase("p@example.com");
  await rejectsWith(
    new ConfirmCodeService(supabase, makeOtp("invalid").otp).assertValid("user-1", "000000"),
    CONFIRM_CODE_INVALID
  );
  await rejectsWith(
    new ConfirmCodeService(supabase, makeOtp("expired").otp).assertValid("user-1", "000000"),
    CONFIRM_CODE_EXPIRED
  );
});
