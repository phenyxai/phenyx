// PHE-20 — unit tests for the Voice Standard plain-text guard.
// Run after `npm run build`:  node --test test/sanitize-prose.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeProse } = require("../dist/voice-standard/sanitize-prose");

test("strips HTML / <b> tags", () => {
  assert.equal(
    sanitizeProse("you reach for them <b>right before</b> your best decisions."),
    "you reach for them right before your best decisions."
  );
});

test("strips markdown bold asterisks", () => {
  assert.equal(
    sanitizeProse("that's **a different ending** than you expected."),
    "that's a different ending than you expected."
  );
});

test("strips underscores (markdown emphasis)", () => {
  assert.equal(
    sanitizeProse("you were the _last_ one to notice."),
    "you were the last one to notice."
  );
});

test("strips stray angle brackets", () => {
  assert.equal(sanitizeProse("a > b, c < d"), "a b, c d");
});

test("leaves clean plain-text prose untouched", () => {
  const clean =
    "those songs were never comfort. they're a reset button. you reach for them before your best decisions.";
  assert.equal(sanitizeProse(clean), clean);
});

test("collapses spaces left behind by removals and trims", () => {
  assert.equal(sanitizeProse("  hello <br>  world  "), "hello world");
});

test("handles empty / falsy input", () => {
  assert.equal(sanitizeProse(""), "");
});
