import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeDiscoveries,
  discoveryWeek,
  safeTimeZone,
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
      { platform: "youtube", date: "2016-03", title: "a board", detail: "saved a film score playlist" },
      { platform: "spotify", date: "2024-09", title: "a board", detail: "the same scores in morning plays" },
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
        { platform: "spotify", date: "2024-09", title: "a board", detail: "morning plays" },
        { platform: "linkedin", date: "2020", title: "a board", detail: "not connected" },
        { platform: "youtube", date: "sometime", title: "a board", detail: "no date" },
        { platform: "youtube", date: "2018-13", title: "a board", detail: "no such month" },
      ],
    }),
    CONNECTED,
  );
  assert.ok(valid);
  assert.deepEqual(valid.trail.map((entry) => entry.platform), ["spotify"]);

  const none = candidate({ trail: [{ platform: "linkedin", date: "2020", title: "a board", detail: "not connected" }] });
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
      { platform: "youtube", date: "2016-03", title: "a board", detail: "a" },
      { platform: "spotify", date: "2024-09", title: "a board", detail: "b" },
    ],
    confidence: 0.6,
  });
  const weaker = card({
    pillar: "becoming",
    headline: "weaker",
    trail: [{ platform: "spotify", date: "2024-09", title: "a board", detail: "b" }],
    confidence: 0.95,
  });
  assert.deepEqual(dedupeDiscoveries([weaker, stronger]).map((c) => c.headline), ["stronger"]);
});

test("merge rule: two cards naming the same public thing keep the stronger", () => {
  const eno = { label: "Brian Eno", title: "music for a place", detail: "ambient records." };
  const stronger = card({ headline: "stronger", story: eno, trail: [{ platform: "spotify", date: "2024", title: "a board", detail: "a" }, { platform: "youtube", date: "2016", title: "a board", detail: "b" }] });
  const weaker = card({ headline: "weaker", story: { ...eno, label: "brian eno" }, trail: [{ platform: "pinterest", date: "2019", title: "a board", detail: "c" }] });
  assert.deepEqual(dedupeDiscoveries([weaker, stronger]).map((c) => c.headline), ["stronger"]);
});

test("merge rule: two sources on one platform and day stay apart when their titles differ", () => {
  const board = card({ headline: "a", story: null, trail: [{ platform: "youtube", date: "2026-10-23", title: "a board", detail: "a" }] });
  const likes = card({ headline: "b", story: null, trail: [{ platform: "youtube", date: "2026-10-23", title: "liked videos", detail: "b" }] });
  const again = card({ headline: "c", story: null, trail: [{ platform: "youtube", date: "2026-10-23", title: "A Board", detail: "c" }] });
  assert.deepEqual(dedupeDiscoveries([board, likes, again]).map((c) => c.headline).sort(), ["a", "b"]);
});

test("merge rule: picks on one point over the same years both stay", () => {
  const place = card({ pillar: "origin", headline: "a", story: null, trail: [{ platform: "youtube", date: "2012", title: "a board", detail: "a" }] });
  const person = card({ pillar: "origin", headline: "b", story: null, trail: [{ platform: "spotify", date: "2012-05", title: "a board", detail: "b" }] });
  assert.equal(dedupeDiscoveries([place, person]).length, 2);
});

test("selectSet takes the strongest of each kind first, then the strongest of the rest, seven at most", () => {
  const types = ["place", "place", "person", "try", "detail", "medium", "field", "place"];
  const cards = types.map((type, i) => card({ type: type as Discovery["type"], headline: `${type} ${i}`, confidence: i / 10 }));
  const set = selectSet(cards);
  assert.equal(set.length, 7);
  assert.deepEqual(set.slice(0, 6).map((c) => c.headline), ["place 7", "person 2", "try 3", "detail 4", "medium 5", "field 6"]);
  assert.ok(new Set(set.map((c) => c.type)).size >= 5);

  const many = Array.from({ length: 10 }, (_, i) => card({ headline: `o${i}`, confidence: i / 10 }));
  assert.equal(selectSet(many).length, 7);
});

test("validateDiscovery keeps each source’s title", () => {
  const valid = validateDiscovery(candidate(), CONNECTED);
  assert.equal(valid?.trail[0].title, "a board");
});

test("discoveryWeek opens monday at 9am in the person’s time zone", () => {
  // Monday oct 19 2026, 8:30am in new york is still the week of oct 12.
  assert.deepEqual(discoveryWeek(new Date("2026-10-19T12:30:00Z"), "America/New_York"), {
    week: "2026-10-12",
    opened: "2026-10-12T13:00:00.000Z",
    resets: "2026-10-19T13:00:00.000Z",
  });
  // At 9am it opens.
  assert.equal(discoveryWeek(new Date("2026-10-19T13:00:00Z"), "America/New_York").week, "2026-10-19");
  // Sunday night in los angeles is already monday in tokyo.
  assert.equal(discoveryWeek(new Date("2026-10-19T03:00:00Z"), "Asia/Tokyo").week, "2026-10-19");
  assert.equal(discoveryWeek(new Date("2026-10-19T03:00:00Z"), "America/Los_Angeles").week, "2026-10-12");
  // The week after clocks change (nov 1 2026 in new york) still opens at 9am local.
  assert.equal(discoveryWeek(new Date("2026-10-28T12:00:00Z"), "America/New_York").resets, "2026-11-02T14:00:00.000Z");
});

test("safeTimeZone falls back to utc", () => {
  assert.equal(safeTimeZone("Europe/London"), "Europe/London");
  assert.equal(safeTimeZone("Mars/Olympus"), "UTC");
  assert.equal(safeTimeZone(undefined), "UTC");
});
