import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeDiscoveries,
  selectSet,
  validateDiscovery,
  type Discovery,
  type DiscoveryCandidate,
} from "./discover.rules";

const CONNECTED = new Set(["spotify", "youtube", "pinterest"]);

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    type: "resurfaced",
    pillar: "origin",
    time_context: "8 years apart",
    headline: "the film scores you saved at twelve are back",
    what_surfaced: "you saved film scores on youtube in 2016 and they returned to spotify in 2024.",
    why_now: "three of them reached your spotify mornings this month.",
    trail: [
      { platform: "youtube", date: "2016-03", detail: "saved a film score playlist" },
      { platform: "spotify", date: "2024-09", detail: "the same scores in morning plays" },
    ],
    confidence: 0.8,
    ...overrides,
  };
}

function card(overrides: Partial<Discovery> = {}): Discovery {
  const valid = validateDiscovery(candidate(), CONNECTED);
  assert.ok(valid);
  return { ...valid, ...overrides };
}

test("validateDiscovery keeps a card that meets every limit", () => {
  const valid = validateDiscovery(candidate(), CONNECTED);
  assert.ok(valid);
  assert.deepEqual(valid.sources, ["youtube", "spotify"]);
  assert.equal(valid.trail[0].date, "2016-03");
});

test("validateDiscovery trims the sentence fields to one sentence", () => {
  const valid = validateDiscovery(
    candidate({
      what_surfaced: "you saved 2.5 hours of film scores in 2016. they came back in 2024.",
      why_now: "they returned this month. you played them twice.",
    }),
    CONNECTED,
  );
  assert.ok(valid);
  assert.equal(valid.what_surfaced, "you saved 2.5 hours of film scores in 2016.");
  assert.equal(valid.why_now, "they returned this month.");
});

test("validateDiscovery rejects a headline past the limit or holding two ideas", () => {
  const long = "a".repeat(61);
  assert.equal(validateDiscovery(candidate({ headline: long }), CONNECTED), null);
  assert.equal(
    validateDiscovery(candidate({ headline: "scores return. mornings change" }), CONNECTED),
    null,
  );
  assert.ok(validateDiscovery(candidate({ headline: "a".repeat(60) }), CONNECTED));
});

test("validateDiscovery drops undated or unconnected sources and rejects a card left with none", () => {
  const valid = validateDiscovery(
    candidate({
      trail: [
        { platform: "spotify", date: "2024-09", detail: "morning plays" },
        { platform: "linkedin", date: "2020", detail: "not connected" },
        { platform: "youtube", date: "sometime", detail: "no date" },
        { platform: "youtube", date: "2018-13", detail: "no such month" },
      ],
    }),
    CONNECTED,
  );
  assert.ok(valid);
  assert.deepEqual(valid.trail.map((entry) => entry.platform), ["spotify"]);

  const none = candidate({ trail: [{ platform: "linkedin", date: "2020", detail: "not connected" }] });
  assert.equal(validateDiscovery(none, CONNECTED), null);
});

test("validateDiscovery rejects an unknown type or point", () => {
  assert.equal(validateDiscovery(candidate({ type: "identity" }), CONNECTED), null);
  assert.equal(validateDiscovery(candidate({ pillar: "childhood" }), CONNECTED), null);
});

test("merge rule: two cards on the same dated source keep the better supported one", () => {
  const stronger = card({
    pillar: "origin",
    headline: "stronger",
    trail: [
      { platform: "youtube", date: "2016-03", detail: "a" },
      { platform: "spotify", date: "2024-09", detail: "b" },
    ],
    confidence: 0.6,
  });
  const weaker = card({
    pillar: "becoming",
    headline: "weaker",
    trail: [{ platform: "spotify", date: "2024-09", detail: "b" }],
    confidence: 0.95,
  });
  assert.deepEqual(dedupeDiscoveries([weaker, stronger]).map((c) => c.headline), ["stronger"]);
});

test("merge rule: same point over overlapping time drops the weaker; a bare year covers its months", () => {
  const stronger = card({
    pillar: "convergence",
    headline: "stronger",
    trail: [
      { platform: "pinterest", date: "2015", detail: "a" },
      { platform: "pinterest", date: "2018", detail: "b" },
    ],
  });
  const weaker = card({
    pillar: "convergence",
    headline: "weaker",
    trail: [{ platform: "spotify", date: "2018-06", detail: "c" }],
  });
  assert.deepEqual(
    dedupeDiscoveries([weaker, stronger]).map((c) => c.headline),
    ["stronger"],
  );
});

test("merge rule: different points or separate time both stay", () => {
  const a = card({ pillar: "origin", headline: "a", trail: [{ platform: "youtube", date: "2012", detail: "a" }] });
  const otherPoint = card({ pillar: "becoming", headline: "b", trail: [{ platform: "spotify", date: "2012-05", detail: "b" }] });
  const laterSamePoint = card({ pillar: "origin", headline: "c", trail: [{ platform: "spotify", date: "2020", detail: "c" }] });
  assert.equal(dedupeDiscoveries([a, otherPoint, laterSamePoint]).length, 3);
});

test("merge rule: a weak card overlapping two strong ones can't knock both out", () => {
  const left = card({
    pillar: "origin",
    headline: "left",
    trail: [
      { platform: "youtube", date: "2014", detail: "a" },
      { platform: "youtube", date: "2015", detail: "b" },
    ],
  });
  const right = card({
    pillar: "origin",
    headline: "right",
    trail: [
      { platform: "spotify", date: "2019", detail: "c" },
      { platform: "spotify", date: "2020", detail: "d" },
    ],
  });
  const bridge = card({
    pillar: "origin",
    headline: "bridge",
    trail: [{ platform: "pinterest", date: "2015", detail: "e" }],
  });
  assert.deepEqual(
    dedupeDiscoveries([bridge, left, right]).map((c) => c.headline).sort(),
    ["left", "right"],
  );
});

test("selectSet takes one per point in point order, then the strongest of the rest, seven at most", () => {
  const pillars = ["becoming", "origin", "origin", "convergence"];
  const cards = pillars.map((pillar, i) =>
    card({ pillar, headline: `${pillar} ${i}`, confidence: i / 10 }),
  );
  assert.deepEqual(
    selectSet(cards).map((c) => c.headline),
    ["origin 2", "convergence 3", "becoming 0", "origin 1"],
  );

  const many = Array.from({ length: 10 }, (_, i) =>
    card({ pillar: "origin", headline: `o${i}`, confidence: i / 10 }),
  );
  assert.equal(selectSet(many).length, 7);
});
