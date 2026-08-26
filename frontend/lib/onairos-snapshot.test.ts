import test from "node:test";
import assert from "node:assert/strict";

import { redactOnairosForProfile } from "./onairos-snapshot.ts";

const SECRET = "eyJ.onairos-secret.signature";

test("no token or credential key survives client-side snapshot redaction", () => {
  const redacted = redactOnairosForProfile({
    token: SECRET,
    authToken: SECRET,
    tokenExpiry: "2099-01-01",
    session_token: SECRET,
    nested: {
      oauthToken: SECRET,
      clientSecret: SECRET,
      credentials: { authorization: SECRET },
      openness: 0.91,
    },
    history: [{ refresh_token: SECRET, keep: "visible" }],
  });

  const keys: string[] = [];
  const serialized = JSON.stringify(redacted, (key, value) => {
    if (key) keys.push(key);
    return value;
  });

  assert.ok(!serialized.includes(SECRET), "credential value must not survive");
  assert.deepEqual(
    keys.filter((key) => /token|jwt|secret|credential|authorization|bearer|password/i.test(key)),
    [],
    "no credential-bearing key survives"
  );
  assert.equal((redacted.nested as Record<string, unknown>).openness, 0.91);
  assert.equal((redacted.history as Array<Record<string, unknown>>)[0].keep, "visible");
});
