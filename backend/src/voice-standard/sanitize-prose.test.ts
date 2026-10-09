import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeProse, voiceViolations, type VoiceSurface } from "./sanitize-prose";

const rules = (text: string, surface?: VoiceSurface) =>
  voiceViolations(sanitizeProse(text), surface).map((v) => v.rule);

test("fixes casing, apostrophes and dashes", () => {
  assert.equal(sanitizeProse("Phenyx sees You've Changed"), "PHENYX sees you’ve changed");
  assert.equal(sanitizeProse("you return — again and again — to it."), "you return, again and again, to it.");
  assert.equal(sanitizeProse("you return to it —."), "you return to it.");
  assert.equal(sanitizeProse("you return - again - to it"), "you return, again, to it");
  assert.equal(sanitizeProse("since 2019 – the year you moved"), "since 2019, the year you moved");
});

test("keeps number ranges, year spans and hyphenated words", () => {
  assert.equal(sanitizeProse("visible 2016—2026"), "visible 2016 – 2026");
  assert.equal(sanitizeProse("visible 2016 – 2026"), "visible 2016 – 2026");
  assert.equal(sanitizeProse("3—5 times a week"), "3–5 times a week");
  assert.equal(sanitizeProse("a cross-platform pattern"), "a cross-platform pattern");
});

test("still strips markup", () => {
  assert.equal(sanitizeProse("**you** <b>keep</b> _going_"), "you keep going");
});

// One sample per surface, written the way Claude tends to write before the fixes.
const GOOD: Array<[VoiceSurface, string]> = [
  ["pillar", "You keep returning to long runs on Strava before sunrise, a habit visible since 2019. This suggests early hours are where you think most clearly — and you've protected them through every move."],
  ["portrait", "Your platforms tell a story that started in Los Angeles, where your first YouTube saves were all about drawing.\n\nSince then the drawing has turned into design work on LinkedIn, and this suggests the thread was there the whole time."],
  ["trait", "You tend to save music on Spotify late at night, and it's been that way since 2020."],
  ["mantra", "you keep showing up for the quiet work.\nit keeps showing up for you."],
  ["foresight", "you keep moving toward the place where your separate interests meet, and it seems close now."],
  ["observation", "Your Pinterest saves and YouTube history both turned toward ceramics in the spring of 2025. This suggests a pull toward making things with your hands that has been building for a while."],
  ["polaris", "You've been circling this since 2023 on LinkedIn, where your posts kept drifting toward teaching. This suggests the idea has been ready for a while, and a first small class could be the next step."],
];

for (const [surface, text] of GOOD) {
  test(`${surface} sample passes the check after fixes`, () => {
    assert.deepEqual(rules(text, surface), []);
  });
}

test("flags what it can't fix", () => {
  assert.deepEqual(rules("you’re not just a runner, but someone who builds things."), ["not-x-but-y"]);
  assert.deepEqual(rules("it’s not about the job, it’s about the people."), ["not-x-but-y"]);
  assert.deepEqual(rules("you chose curiosity, not ambition but curiosity."), ["not-x-but-y"]);
  assert.deepEqual(rules("you connected three accounts this year."), ["accounts"]);
  assert.deepEqual(rules("your record shows a pattern."), ["record"]);
  assert.deepEqual(rules("since you moved to LA in 2021, you write more."), ["place-abbreviation"]);
  assert.deepEqual(rules("you’re a natural builder."), ["declares"]);
  assert.deepEqual(rules("you build. you ship. you move on. it shows in your work."), ["choppy"]);
  assert.deepEqual(rules("you build. you ship. you rest. and then you start all over again.", "polaris"), ["choppy", "length"]);
});

test("leaves ordinary phrasing alone", () => {
  assert.deepEqual(rules("you’re not sure yet, but you keep going back to it."), []);
  assert.deepEqual(rules("if you are in a difficult moment, reach out to someone."), []);
  assert.deepEqual(rules("lately the plan has been to move to los angeles."), []);
});
