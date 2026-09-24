import assert from "node:assert/strict";
import { test } from "node:test";
import {
  constellationMap,
  constellationStages,
  ctaCopy,
  discoverFinds,
  footerCopy,
  heroCopy,
  howItWorksCopy,
  insightPatterns,
  navCopy,
  polarisExample,
  promiseCopy,
  SECTION_IDS,
  SECTION_ORDER,
} from "./landing-copy.ts";

// These assert the contracts the landing components rely on at render time —
// the ones where bad copy data produces a broken page rather than a type error.

test("hero description is two deliberate lines", () => {
  assert.equal(heroCopy.descriptionLines.length, 2);
  assert.ok(heroCopy.descriptionLines.every((line) => line.trim().length > 0));
});

test("nav links point at sections that exist", () => {
  const ids = new Set(Object.values(SECTION_IDS));
  for (const link of navCopy.links) assert.ok(ids.has(link.targetId), `unknown target ${link.targetId}`);
});

test("the section order covers every section exactly once", () => {
  assert.deepEqual([...SECTION_ORDER].sort(), Object.values(SECTION_IDS).sort());
});

test("the nav names the three chapters, in page order", () => {
  assert.deepEqual(
    navCopy.links.map((link) => link.targetId),
    [SECTION_IDS.about, SECTION_IDS.how, SECTION_IDS.promise],
  );
});

test("the orbit carries the four parts of PHENYX, in orbit order", () => {
  // The orbit places slide i at 12, 3, 6 and 9 o'clock in turn; the trail
  // assumes exactly four quarter turns.
  assert.deepEqual(
    howItWorksCopy.slides.map((slide) => slide.kicker),
    ["constellation", "insights", "discover", "polaris"],
  );
  for (const slide of howItWorksCopy.slides) {
    assert.ok(slide.title.trim().length > 0, `${slide.kicker} has no title`);
    assert.ok(slide.line.trim().length > 0, `${slide.kicker} has no line`);
  }
});

test("there are exactly seven constellation stages, in stage order", () => {
  assert.deepEqual(
    constellationStages.map((stage) => stage.name),
    ["origin", "emergence", "self-creation", "convergence", "becoming", "recognition", "transcendence"],
  );
});

test("every constellation stage shows two sourced moments", () => {
  // The stage viewer lays the rows out as two columns and keys them by source.
  for (const stage of constellationStages) {
    assert.equal(stage.rows.length, 2, `${stage.name} should show two moments`);
    assert.ok(stage.question.trim().length > 0, `${stage.name} has no question`);
    const sources = stage.rows.map(([source]) => source);
    assert.equal(new Set(sources).size, sources.length, `${stage.name} repeats a source`);
    for (const [source, moment] of stage.rows) {
      assert.ok(source.trim().length > 0, `${stage.name} row has no source`);
      assert.ok(moment.trim().length > 0, `${stage.name} row has no moment`);
    }
  }
});

test("the constellation map has one star per stage and its lines join real stars", () => {
  // Stars pair with stages positionally; a missing star leaves a stage unreachable.
  assert.equal(constellationMap.stars.length, constellationStages.length);
  for (const [from, to] of constellationMap.lines) {
    assert.ok(constellationMap.stars[from], `line starts at missing star ${from}`);
    assert.ok(constellationMap.stars[to], `line ends at missing star ${to}`);
  }
});

test("insight patterns are fully populated and cite unique sources", () => {
  assert.equal(insightPatterns.length, 2);
  for (const pattern of insightPatterns) {
    assert.ok(pattern.claim.trim().length > 0);
    assert.ok(pattern.proof.trim().length > 0);
    assert.ok(pattern.span.trim().length > 0);
    assert.equal(new Set(pattern.sources).size, pattern.sources.length, `"${pattern.claim}" repeats a source`);
  }
});

test("the early-start chart shows what its claim says", () => {
  // "14 of your last 17 finished projects were started before 9am."
  const bars = insightPatterns.find((pattern) => pattern.visual.kind === "bars")?.visual;
  assert.ok(bars && bars.kind === "bars");
  assert.match(bars.pattern, /^[01]+$/);
  assert.equal(bars.pattern.length, 17);
  assert.equal(bars.pattern.replaceAll("0", "").length, 14);
});

test("the returning-pattern timeline stays on its axis", () => {
  for (const pattern of insightPatterns) {
    if (pattern.visual.kind !== "return") continue;
    for (const point of pattern.visual.points) {
      assert.ok(point.at >= 0 && point.at <= 100, `${point.label} sits off the axis`);
    }
  }
});

test("discover finds are uniquely named and each says why", () => {
  assert.equal(discoverFinds.length, 3);
  assert.equal(new Set(discoverFinds.map((find) => find.name)).size, discoverFinds.length);
  for (const find of discoverFinds) assert.ok(find.why.startsWith("because "), `${find.name} has no reason`);
});

test("the polaris example can show its evidence and its plan", () => {
  assert.ok(polarisExample.ask.trim().length > 0);
  assert.ok(polarisExample.answer.trim().length > 0);
  assert.equal(new Set(polarisExample.sources).size, polarisExample.sources.length);
  assert.ok(polarisExample.evidence.rows.length > 0);
  assert.ok(polarisExample.plan.steps.length > 0);
  assert.equal(new Set(polarisExample.plan.steps).size, polarisExample.plan.steps.length);
});

test("our vision walks five stations, from connecting to leaving", () => {
  assert.deepEqual(
    promiseCopy.stations.map((station) => station.visual.kind),
    ["choose", "protect", "show", "decide", "leave"],
  );
  const titles = promiseCopy.stations.map((station) => station.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("copy is lowercase-first except for the brand and proper nouns", () => {
  // House voice: sentences start lowercase. Uppercase display is CSS's job.
  const sentences = [
    ...navCopy.links.map((link) => link.label),
    ...howItWorksCopy.slides.flatMap((slide) => [slide.kicker, slide.title, slide.line]),
    ...constellationStages.map((stage) => stage.question),
    ...discoverFinds.map((find) => find.kind),
    ...promiseCopy.stations.map((station) => station.title),
    promiseCopy.headline,
    ctaCopy.headline,
    ctaCopy.subline,
  ];
  for (const sentence of sentences) {
    assert.equal(sentence[0], sentence[0].toLowerCase(), `"${sentence}" should start lowercase`);
  }
});

test("footer exposes the brand wordmark", () => {
  assert.equal(footerCopy.brand, "PHENYX");
});
