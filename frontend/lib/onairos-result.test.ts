/**
 * Onairos completion-payload normalizer tests.
 *
 * Dependency-free: runs on Node's built-in test runner with native TypeScript
 * type-stripping (no vitest/jest install required):
 *
 *   node --experimental-strip-types --test lib/onairos-result.test.ts
 *
 * `onairos-result.ts` has no runtime imports (the `onairos` import is type-only,
 * so type-stripping erases it), which keeps this runnable outside a browser.
 *
 * The fixture below is a REAL captured completion — the network-tab body a
 * successful YouTube connect returns — reproduced verbatim in shape (prose
 * abridged). It is the payload that used to trip the "connect at least one
 * platform to continue." notice.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeOnairosResult,
  getConnectedPlatforms,
  buildOnairosTraitObject,
} from "./onairos-result.ts";

const SUMMARY = "You are someone who moves through life with intense curiosity...";
const EXPLANATION = "Your strongest trait as a Tech-Curious Builder emerges from...";

const TRAIT_BLOCK = {
  positive_traits: {
    "Tech-Curious Builder": 96,
    "Piano & Music Enthusiast": 94,
    "AI & Agentic Systems Explorer": 92,
  },
  traits_to_improve: {
    "Financial & Expense Management": 45,
    "Work-Life Boundary Setting": 42,
  },
  user_summary: SUMMARY,
  top_traits_explanation: EXPLANATION,
  archetype: "Ambitious Builder-Musician",
  nudges: [
    { text: "You're great at starting projects—try finishing one piano cover..." },
    { text: "Your AI agent experiments are impressive; document one project..." },
  ],
};

/** The body seen in the network tab; `autoFetch` merges it in as `apiResponse`. */
const API_RESPONSE = {
  success: true,
  userProfile: {
    user_summary: SUMMARY,
    top_traits_explanation: EXPLANATION,
    archetype: "Ambitious Builder-Musician",
    nudges: TRAIT_BLOCK.nudges,
  },
  trainingResults: {
    traits: TRAIT_BLOCK,
    userTraits: {
      DataAnalysis: { personality_traits: TRAIT_BLOCK },
      metadata: {
        region: "eu-west-2",
        total_items_analyzed: 1125,
        distinct_items: 1098,
        coverage: "100.0%",
      },
    },
    trainingCompleted: true,
    lastTrainingDate: "2026-08-01T09:11:46.842Z",
  },
  inferenceResults: {
    hasInferenceResults: false,
    latestResults: null,
    allResults: [],
    preferences: { scope: "preferences", preferenceModelReady: true },
  },
  user: {
    userId: "e20f628b-88bc-49ba-bb3b-0c88814850dd",
    username: "ashwinshan2001",
    email: "ashwinshan2001@gmail.com",
    hasModel: true,
  },
  connectedPlatforms: ["youtube"],
  metadata: {
    retrievedAt: "2026-08-01T09:11:54.691Z",
    traitsSource: "personality_traits",
    platformCount: 1,
    combinedDataAvailable: { traits: true, inference: false },
  },
};

/** The full `onComplete(result)` object the SDK hands us. */
const COMPLETION = {
  token: "eyJhbGciOi.THIS-IS-A-JWT.signature",
  apiUrl: "https://api2.onairos.uk/combinedInference",
  approved: ["personality"],
  authorizedData: { traits: true, personality: true, rawMemories: false },
  training: { ready: true },
  apiResponse: API_RESPONSE,
};

// ---------------------------------------------------------------------------
// The regression this module exists for.
// ---------------------------------------------------------------------------

test("reads connected platforms out of apiResponse (the reported bug)", () => {
  // The old code read `result.connectedSources`, which the SDK only attaches for
  // Ascend white-label apps — undefined here, so the gate wrongly failed.
  assert.equal((COMPLETION as Record<string, unknown>).connectedSources, undefined);
  assert.deepEqual(getConnectedPlatforms(COMPLETION), ["youtube"]);

  const normalized = normalizeOnairosResult(COMPLETION);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.platforms, ["youtube"]);
  // The >= 1 platform gate in the onboarding callback now passes.
  assert.ok(normalized.platforms.length >= 1);
});

test("extracts the full trait block, archetype and training metadata", () => {
  const n = normalizeOnairosResult(COMPLETION);

  assert.equal(n.hasTraits, true);
  assert.equal(n.archetype, "Ambitious Builder-Musician");
  assert.equal(n.traits?.user_summary, SUMMARY);
  assert.equal(n.traits?.top_traits_explanation, EXPLANATION);
  assert.equal(n.traits?.positive_traits["Tech-Curious Builder"], 96);
  assert.equal(n.traits?.traits_to_improve["Work-Life Boundary Setting"], 42);
  assert.equal(n.traits?.nudges.length, 2);

  assert.equal(n.training.completed, true);
  assert.equal(n.training.lastTrainingDate, "2026-08-01T09:11:46.842Z");
  assert.equal(n.metadata.traitsSource, "personality_traits");
  assert.equal(n.metadata.platformCount, 1);
  assert.equal(n.metadata.totalItemsAnalyzed, 1125);
  assert.equal(n.metadata.coverage, "100.0%");
});

// ---------------------------------------------------------------------------
// Shape tolerance — the point of probing instead of hard-coding one path.
// ---------------------------------------------------------------------------

test("handles the documented flat shape (traits merged onto the result root)", () => {
  const flat = {
    token: "t",
    traits: TRAIT_BLOCK,
    userProfile: API_RESPONSE.userProfile,
    connectedPlatforms: ["linkedin", "youtube"],
  };
  const n = normalizeOnairosResult(flat);
  assert.deepEqual(n.platforms, ["linkedin", "youtube"]);
  assert.equal(n.archetype, "Ambitious Builder-Musician");
  assert.equal(n.hasTraits, true);
});

test("handles the Ascend shape (connectedSources) and account-object lists", () => {
  const ascend = { connectedSources: ["YouTube", " Reddit "], apiResponse: {} };
  assert.deepEqual(getConnectedPlatforms(ascend), ["youtube", "reddit"]);

  const accounts = {
    apiResponse: { connectedAccounts: [{ platform: "ChatGPT" }, { name: "LinkedIn" }] },
  };
  assert.deepEqual(getConnectedPlatforms(accounts), ["chatgpt", "linkedin"]);
});

test("unions platform names across roots and aliases, deduped and lowercased", () => {
  const mixed = {
    connectedPlatforms: ["YouTube"],
    apiResponse: {
      connectedPlatforms: ["youtube", "Reddit"],
      accountStatus: { connectedPlatforms: ["linkedin"] },
    },
  };
  assert.deepEqual(getConnectedPlatforms(mixed), ["youtube", "reddit", "linkedin"]);
});

test("backfills prose from userProfile when the trait block is score-only", () => {
  const scoreOnly = {
    apiResponse: {
      trainingResults: {
        traits: {
          positive_traits: { Curious: 92 },
          traits_to_improve: { Patience: 45 },
        },
      },
      userProfile: {
        user_summary: SUMMARY,
        archetype: "Strategic Thinker",
        nudges: ["a bare string nudge"],
      },
      connectedPlatforms: ["reddit"],
    },
  };
  const n = normalizeOnairosResult(scoreOnly);
  assert.equal(n.traits?.positive_traits.Curious, 92);
  assert.equal(n.traits?.user_summary, SUMMARY);
  assert.equal(n.archetype, "Strategic Thinker");
  assert.deepEqual(n.traits?.nudges, [{ text: "a bare string nudge" }]);
});

// ---------------------------------------------------------------------------
// Failure paths must still block.
// ---------------------------------------------------------------------------

test("cancel / explicit failure / error are reported as not ok", () => {
  assert.equal(normalizeOnairosResult({ cancelled: true }).ok, false);
  assert.equal(normalizeOnairosResult({ success: false }).ok, false);
  assert.equal(normalizeOnairosResult({ error: "denied" }).ok, false);
  assert.equal(normalizeOnairosResult({ apiResponse: { success: false } }).ok, false);
  assert.equal(normalizeOnairosResult(null).ok, false);
});

test("a genuinely empty completion yields no platforms and no traits", () => {
  const n = normalizeOnairosResult({ token: "t", apiUrl: "u", apiResponse: null });
  assert.deepEqual(n.platforms, []);
  assert.equal(n.hasTraits, false);
  // ok stays true (nothing failed) — the onboarding gate blocks on the empty
  // platforms + no-traits combination, not on `ok` alone.
  assert.equal(n.ok, true);
});

// ---------------------------------------------------------------------------
// The persisted trait object.
// ---------------------------------------------------------------------------

test("trait object carries no credentials and no PII", () => {
  const built = buildOnairosTraitObject(normalizeOnairosResult(COMPLETION));
  const serialized = JSON.stringify(built);

  assert.ok(!serialized.includes(COMPLETION.token), "JWT leaked into the snapshot");
  assert.ok(!serialized.includes("ashwinshan2001@gmail.com"), "email leaked");
  assert.ok(!serialized.includes("ashwinshan2001"), "username leaked");
  for (const key of ["token", "jwt", "apiUrl", "user", "email"]) {
    assert.ok(!(key in built), `snapshot must not carry a "${key}" field`);
  }
});

test("trait object keeps traits.archetype where the backend reads it", () => {
  const built = buildOnairosTraitObject(normalizeOnairosResult(COMPLETION)) as {
    traits: { archetype: string };
  };
  // backend/src/persona/persona.service.ts → `onairosData?.traits?.archetype`
  assert.equal(built.traits.archetype, "Ambitious Builder-Musician");
});

test("trait object is deterministic — the synthesis event_id hash stays stable", () => {
  // The backend derives its dedup event_id from sha256(stableStringify(snapshot)).
  // Any time-varying field would defeat that and let one connect synthesize twice.
  const a = JSON.stringify(buildOnairosTraitObject(normalizeOnairosResult(COMPLETION)));
  const b = JSON.stringify(buildOnairosTraitObject(normalizeOnairosResult(COMPLETION)));
  assert.equal(a, b);
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(a.replace(
    "2026-08-01T09:11:46.842Z", "")), "only the payload's own training date may appear");
});

test("trait object collapses the payload's triplicated prose to one copy", () => {
  const raw = JSON.stringify(COMPLETION);
  const built = JSON.stringify(buildOnairosTraitObject(normalizeOnairosResult(COMPLETION)));

  const count = (haystack: string) => haystack.split(SUMMARY).length - 1;
  // userProfile + trainingResults.traits + userTraits.DataAnalysis.personality_traits
  assert.equal(count(raw), 3, "fixture reproduces the payload's duplication");
  assert.equal(count(built), 1, "snapshot must keep exactly one copy");
  assert.ok(built.length < raw.length);
});
