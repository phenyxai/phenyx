import assert from "node:assert/strict";
import { test } from "node:test";
import {
  constellationPoints,
  footerCopy,
  heroCopy,
  howItWorksCopy,
  navCopy,
  polarisCopy,
  SECTION_IDS,
} from "./landing-copy.ts";

// These assert the contracts the landing components rely on at render time —
// the ones where bad copy data produces a broken page rather than a type error.

test("every signal has a matching SIGNAL_Y position", () => {
  // HowItWorksSection pairs signals with SIGNAL_Y positionally; a seventh signal
  // would render with `--signal-y: undefined` and collapse onto the baseline.
  assert.equal(howItWorksCopy.signals.length, 6);
});

test("how-it-works cards are keyed by a unique title", () => {
  // The card list uses `key={card.title}`; duplicates would break reconciliation.
  const titles = howItWorksCopy.cards.map((card) => card.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("how-it-works covers all four product surfaces", () => {
  assert.deepEqual(
    howItWorksCopy.cards.map((card) => card.title),
    ["constellation", "discover", "polaris", "you"],
  );
});

test("hero description is two deliberate lines", () => {
  assert.equal(heroCopy.descriptionLines.length, 2);
  assert.ok(heroCopy.descriptionLines.every((line) => line.trim().length > 0));
});

test("nav links point at sections that exist", () => {
  const ids = new Set(Object.values(SECTION_IDS));
  for (const link of navCopy.links) assert.ok(ids.has(link.targetId), `unknown target ${link.targetId}`);
});

test("there are exactly seven constellation points, in stage order", () => {
  assert.deepEqual(
    constellationPoints.map((point) => point.name),
    ["origin", "emergence", "self-creation", "convergence", "becoming", "recognition", "transcendence"],
  );
});

test("every constellation point carries evidence rows and an observation", () => {
  for (const point of constellationPoints) {
    assert.ok(point.rows.length > 0, `${point.name} has no rows`);
    assert.ok(point.observation.trim().length > 0, `${point.name} has no observation`);
    for (const [label, source, evidence] of point.rows) {
      assert.ok(label.trim().length > 0, `${point.name} row has no label`);
      assert.ok(source.trim().length > 0, `${point.name} row has no source`);
      assert.ok(evidence.trim().length > 0, `${point.name} row has no evidence`);
    }
  }
});

test("constellation evidence rows are uniquely keyed within a point", () => {
  // ConstellationExample keys rows by `${label}-${source}`.
  for (const point of constellationPoints) {
    const keys = point.rows.map(([label, source]) => `${label}-${source}`);
    assert.equal(new Set(keys).size, keys.length, `${point.name} has duplicate row keys`);
  }
});

test("polaris examples are uniquely keyed and fully populated", () => {
  // AskPolarisWidget keys the dots by `example.question`.
  const questions = polarisCopy.examples.map((example) => example.question);
  assert.equal(new Set(questions).size, questions.length);
  for (const example of polarisCopy.examples) {
    assert.ok(example.mode.trim().length > 0);
    assert.ok(example.answer.trim().length > 0);
    assert.ok(example.sources.length > 0);
    assert.ok(example.span.trim().length > 0);
  }
});

test("polaris example sources are unique within an example", () => {
  // The meta row keys source chips by name.
  for (const example of polarisCopy.examples) {
    assert.equal(new Set(example.sources).size, example.sources.length, `${example.mode} repeats a source`);
  }
});

test("copy is lowercase-first except for the brand and proper nouns", () => {
  // House voice: sentences start lowercase. Uppercase display is CSS's job.
  const sentences = [
    ...howItWorksCopy.cards.map((card) => card.kicker),
    ...howItWorksCopy.signals,
    ...howItWorksCopy.staysYoursItems.map((item) => item.title),
    ...polarisCopy.examples.map((example) => example.mode),
  ];
  for (const sentence of sentences) {
    assert.equal(sentence[0], sentence[0].toLowerCase(), `"${sentence}" should start lowercase`);
  }
});

test("footer exposes the brand wordmark", () => {
  assert.equal(footerCopy.brand, "PHENYX");
});
