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
    type: "place",
    pillar: "origin",
    headline: "japan’s jazz kissa are rooms built for listening",
    detail: "small cafés with one great sound system and walls of records. bars inspired by them have opened across the us. some serve food.",
    reason: "you keep saving rooms and replaying albums, and a kissa is both at once. it fits.",
    question: "why might a listening room feel so natural to me",
    story: { label: "jazz kissa", title: "rooms for listening", detail: "japanese cafés built around a record collection." },
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

test("validateDiscovery trims the detail to two sentences, the reason to one, and closes the lines", () => {
  const valid = validateDiscovery(candidate(), CONNECTED);
  assert.ok(valid);
  assert.equal(valid.headline, "japan’s jazz kissa are rooms built for listening.");
  assert.equal(
    valid.detail,
    "small cafés with one great sound system and walls of records. bars inspired by them have opened across the us.",
  );
  assert.equal(valid.reason, "you keep saving rooms and replaying albums, and a kissa is both at once.");
  assert.equal(valid.question, "why might a listening room feel so natural to me?");
  assert.equal(valid.story?.label, "jazz kissa");
});

test("validateDiscovery keeps no public story for the person’s own history or a partial one", () => {
  assert.equal(validateDiscovery(candidate({ type: "history" }), CONNECTED)?.story, null);
  const partial = candidate({ story: { label: "brian eno", title: "", detail: "ambient records." } });
  assert.equal(validateDiscovery(partial, CONNECTED)?.story, null);
});

test("validateDiscovery rejects a card with no reason or question", () => {
  assert.equal(validateDiscovery(candidate({ reason: " " }), CONNECTED), null);
  assert.equal(validateDiscovery(candidate({ question: "" }), CONNECTED), null);
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
  assert.equal(validateDiscovery(candidate({ type: "resurfaced" }), CONNECTED), null);
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

test("merge rule: two cards naming the same public thing keep the stronger", () => {
  const eno = { label: "Brian Eno", title: "music for a place", detail: "ambient records." };
  const stronger = card({ headline: "stronger", story: eno, trail: [{ platform: "spotify", date: "2024", detail: "a" }, { platform: "youtube", date: "2016", detail: "b" }] });
  const weaker = card({ headline: "weaker", story: { ...eno, label: "brian eno" }, trail: [{ platform: "pinterest", date: "2019", detail: "c" }] });
  assert.deepEqual(dedupeDiscoveries([weaker, stronger]).map((c) => c.headline), ["stronger"]);
});

test("merge rule: picks on one point over the same years both stay", () => {
  const place = card({ pillar: "origin", headline: "a", story: null, trail: [{ platform: "youtube", date: "2012", detail: "a" }] });
  const person = card({ pillar: "origin", headline: "b", story: null, trail: [{ platform: "spotify", date: "2012-05", detail: "b" }] });
  assert.equal(dedupeDiscoveries([place, person]).length, 2);
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
