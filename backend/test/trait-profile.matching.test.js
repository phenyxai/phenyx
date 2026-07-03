// PHE-24 — unit tests for the pure trait-grounding helpers.
// Run after `pnpm build`:  node --test test/trait-profile.matching.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  guardInsight,
  countSentences,
  rankTraitMatches,
} = require("../dist/synthesis/trait-profile.matching");

// ---------------------------------------------------------------------------
// guardInsight — plain-text + 2-3-sentence guard
// ---------------------------------------------------------------------------

test("guardInsight strips markup and keeps a clean single sentence", () => {
  assert.equal(
    guardInsight("you reach for them <b>right before</b> your best **decisions**."),
    "you reach for them right before your best decisions."
  );
});

test("guardInsight allows up to three sentences", () => {
  const three =
    "you move in bursts. the quiet stretches are not stalls. they are where the next thing gathers.";
  assert.equal(guardInsight(three), three);
});

test("guardInsight rejects insights longer than three sentences", () => {
  const four = "one. two. three. four.";
  assert.equal(guardInsight(four), null);
});

test("guardInsight rejects empty / markup-only input", () => {
  assert.equal(guardInsight(""), null);
  assert.equal(guardInsight("<br>"), null);
  assert.equal(guardInsight(null), null);
});

test("countSentences collapses terminator runs", () => {
  assert.equal(countSentences("really?!"), 1);
  assert.equal(countSentences("wait... then this."), 2);
  assert.equal(countSentences("no terminator here"), 1);
  assert.equal(countSentences("   "), 0);
});

// ---------------------------------------------------------------------------
// rankTraitMatches — substring keyword matching + relevance ranking
// ---------------------------------------------------------------------------

const rows = [
  {
    keyword_tags: ["music", "focus", "reset"],
    insight: "those songs are a reset button before your best decisions.",
    synthesis_version: 2,
    created_at: "2026-07-01T00:00:00Z",
  },
  {
    keyword_tags: ["night", "late", "creating"],
    insight: "your clearest making happens after midnight.",
    synthesis_version: 2,
    created_at: "2026-07-02T00:00:00Z",
  },
  {
    keyword_tags: ["music"],
    insight: "an older read on the same thread — sound as a lever.",
    synthesis_version: 1,
    created_at: "2026-06-01T00:00:00Z",
  },
];

test("returns only rows whose keyword is a substring of the question", () => {
  const out = rankTraitMatches("why does music help me focus", rows);
  const insights = out.map((m) => m.insight);
  assert.equal(out.length, 2); // the two music rows hit; the night row does not
  assert.ok(insights.every((i) => i.includes("reset button") || i.includes("lever")));
});

test("ranks more keyword hits first", () => {
  // "music" + "focus" both hit row 0 (score 2); row 2 hits only "music" (score 1).
  const out = rankTraitMatches("music and focus", rows);
  assert.equal(out[0].score, 2);
  assert.equal(out[0].insight, "those songs are a reset button before your best decisions.");
  assert.equal(out[1].score, 1);
});

test("breaks score ties by newest synthesis version", () => {
  // A question hitting only "music" hits row 0 (v2) and row 2 (v1), both score 1.
  const out = rankTraitMatches("i love music", rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].synthesis_version === undefined, true); // version not surfaced
  assert.equal(out[0].insight, "those songs are a reset button before your best decisions.");
});

test("returns empty array on no keyword hit (honest limit)", () => {
  assert.deepEqual(rankTraitMatches("tell me about my career", rows), []);
});

test("returns empty array on blank question", () => {
  assert.deepEqual(rankTraitMatches("   ", rows), []);
});

test("match objects only carry renderable insight plus internal metadata", () => {
  const [match] = rankTraitMatches("music", rows);
  assert.deepEqual(Object.keys(match).sort(), ["insight", "keywordTags", "score"]);
});
