import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_COUNT,
  dailyCycleSeed,
  selectDailyObservations,
  shuffleDeck,
} from "./select-daily.ts";

const PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
];

interface Obs {
  id: string;
  pillar_tag: string;
  is_new?: boolean;
}

/** `n` observations cycling through the seven pillars, none of them new. */
function pool(n: number, opts: { newIds?: string[]; pillars?: string[] } = {}): Obs[] {
  const pillars = opts.pillars ?? PILLARS;
  return Array.from({ length: n }, (_, i) => ({
    id: `o${i}`,
    pillar_tag: pillars[i % pillars.length],
    is_new: opts.newIds?.includes(`o${i}`) ?? false,
  }));
}

const pillarsOf = (list: Obs[]) => list.map((o) => o.pillar_tag);
const idsOf = (list: Obs[]) => list.map((o) => o.id);

test("an empty pool is an empty day", () => {
  assert.deepEqual(selectDailyObservations([], 100, ""), []);
});

test("a pool of four or fewer is the whole day, in order", () => {
  const three = pool(3);
  assert.deepEqual(idsOf(selectDailyObservations(three, 7, "")), ["o0", "o1", "o2"]);
  const four = pool(4);
  assert.deepEqual(idsOf(selectDailyObservations(four, 7, "")), ["o0", "o1", "o2", "o3"]);
});

test("a large pool yields exactly four, all distinct", () => {
  const src = pool(40);
  for (let day = 20_000; day < 20_030; day++) {
    const day4 = selectDailyObservations(src, day, "");
    assert.equal(day4.length, DAILY_COUNT, `day ${day}`);
    assert.equal(new Set(idsOf(day4)).size, DAILY_COUNT, `day ${day} repeats an id`);
  }
});

test("the same day is the same four every time", () => {
  const src = pool(23);
  const a = selectDailyObservations(src, 20_123, "");
  const b = selectDailyObservations(src, 20_123, "");
  assert.deepEqual(idsOf(a), idsOf(b));
});

test("at most one observation per pillar", () => {
  const src = pool(40);
  for (let day = 20_000; day < 20_060; day++) {
    const pillars = pillarsOf(selectDailyObservations(src, day, ""));
    assert.equal(new Set(pillars).size, pillars.length, `day ${day} doubled a pillar`);
  }
});

test("one per pillar even when the headline already holds that pillar", () => {
  // Every row shares one pillar, one of them is new: the day is that one line.
  const src = pool(9, { pillars: ["becoming"], newIds: ["o4"] });
  for (let day = 20_000; day < 20_010; day++) {
    const picked = selectDailyObservations(src, day, "");
    assert.deepEqual(idsOf(picked), ["o4"], `day ${day}`);
  }
});

test("a thin pool yields a short day rather than a repeat", () => {
  // Six rows over two pillars: the day can never be longer than two.
  const src = pool(6, { pillars: ["origin", "emergence"] });
  for (let day = 20_000; day < 20_012; day++) {
    const picked = selectDailyObservations(src, day, "");
    assert.equal(picked.length, 2, `day ${day}`);
    assert.equal(new Set(pillarsOf(picked)).size, 2);
    assert.equal(new Set(idsOf(picked)).size, 2);
  }
});

test("a headline leads when the pool is larger than four", () => {
  const src = pool(12, { newIds: ["o2", "o9"] });
  for (let day = 20_000; day < 20_010; day++) {
    const picked = selectDailyObservations(src, day, "");
    assert.equal(picked[0].is_new, true, `day ${day}`);
    // Rotates through the headlines by day number.
    assert.equal(picked[0].id, day % 2 === 0 ? "o2" : "o9");
  }
});

test("days within a cycle do not overlap: the deck is dealt through before it repeats", () => {
  // 28 rows, every one its own pillar, no headline: the deck is 28 and the
  // cycle is 7 days. Days that share a cycle slice the same shuffled deck at
  // different offsets, so a line read on monday is not back on tuesday, and
  // by the end of the cycle every line has surfaced exactly once.
  const src = pool(28, { pillars: Array.from({ length: 28 }, (_, i) => `p${i}`) });
  const cycleLen = Math.ceil(src.length / DAILY_COUNT);
  const cycleStart = 20_000 - (20_000 % cycleLen);
  const seen = new Set<string>();
  for (let day = cycleStart; day < cycleStart + cycleLen; day++) {
    const ids = idsOf(selectDailyObservations(src, day, ""));
    assert.equal(ids.length, DAILY_COUNT);
    for (const id of ids) {
      assert.ok(!seen.has(id), `day ${day} repeats ${id} within the cycle`);
      seen.add(id);
    }
  }
  assert.equal(seen.size, src.length);
});

test("a pillar collision walks forward in the deck rather than doubling the pillar", () => {
  // With seven pillars over 28 rows a day's slice of four can hold two of the
  // same pillar. The day still reads four distinct pillars: the loop skips the
  // double and takes the next line in the deck, which may borrow from the day
  // after. That borrowing is the one way two days in a cycle can share a line.
  const src = pool(28);
  const cycleLen = Math.ceil(src.length / DAILY_COUNT);
  const cycleStart = 20_000 - (20_000 % cycleLen);
  const deck = shuffleDeck(src, dailyCycleSeed(cycleStart, cycleLen));
  for (let day = cycleStart; day < cycleStart + cycleLen; day++) {
    const picked = selectDailyObservations(src, day, "");
    assert.equal(picked.length, DAILY_COUNT);
    assert.equal(new Set(pillarsOf(picked)).size, DAILY_COUNT);
    // Every pick sits at or after this day's slice start, in deck order.
    const start = (day - cycleStart) * DAILY_COUNT;
    const positions = picked.map((o) => deck.indexOf(o));
    assert.ok(positions.every((p) => p >= start), `day ${day} reached back before its slice`);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  }
});

test("a new cycle reshuffles the deck", () => {
  const src = pool(28);
  const cycleLen = Math.ceil(src.length / DAILY_COUNT);
  const first = shuffleDeck(src, dailyCycleSeed(0, cycleLen)).map((o) => o.id);
  const second = shuffleDeck(src, dailyCycleSeed(cycleLen, cycleLen)).map((o) => o.id);
  assert.notDeepEqual(first, second);
  assert.deepEqual([...first].sort(), [...second].sort());
});

test("the seed is the spec's constant mix, never zero", () => {
  assert.equal(dailyCycleSeed(0, 7), (1 * 2654435761) % 2147483647);
  assert.equal(dailyCycleSeed(13, 7), (2 * 2654435761) % 2147483647);
  assert.ok(dailyCycleSeed(0, 1) > 0);
});

test("the shuffle is a seeded fisher-yates: deterministic and a permutation", () => {
  const src = pool(10);
  const a = shuffleDeck(src, 12345);
  const b = shuffleDeck(src, 12345);
  assert.deepEqual(idsOf(a), idsOf(b));
  assert.deepEqual([...idsOf(a)].sort(), [...idsOf(src)].sort());
  assert.notDeepEqual(idsOf(a), idsOf(src));
});

test("focus floats a present pillar to the top without changing the set", () => {
  const src = pool(28);
  const day = 20_004;
  const plain = selectDailyObservations(src, day, "");
  const focusPillar = plain[2].pillar_tag;
  const focused = selectDailyObservations(src, day, focusPillar);
  assert.equal(focused.length, plain.length);
  assert.equal(focused[0].pillar_tag, focusPillar);
  assert.deepEqual([...idsOf(focused)].sort(), [...idsOf(plain)].sort());
  // The rest keep their dealt order.
  assert.deepEqual(
    idsOf(focused.slice(1)),
    idsOf(plain.filter((o) => o.pillar_tag !== focusPillar)),
  );
});

test("focus on an absent pillar drops the last pick and leads with that pillar", () => {
  const src = pool(28);
  const day = 20_004;
  const plain = selectDailyObservations(src, day, "");
  const absent = PILLARS.find((p) => !pillarsOf(plain).includes(p));
  assert.ok(absent, "seven pillars, four picks: one is always absent");
  const focused = selectDailyObservations(src, day, absent!);
  assert.equal(focused.length, DAILY_COUNT);
  assert.equal(focused[0].pillar_tag, absent);
  assert.equal(focused[0].id, src.find((o) => o.pillar_tag === absent)!.id);
  assert.deepEqual(idsOf(focused.slice(1)), idsOf(plain.slice(0, -1)));
});

test("focus accepts the hyphenated slug the focus control stores", () => {
  const src = pool(28);
  const focused = selectDailyObservations(src, 20_004, "self-creation");
  assert.equal(focused[0].pillar_tag, "self_creation");
});

test("focus on a pillar the pool lacks entirely leaves the day alone", () => {
  const src = pool(12, { pillars: ["origin", "emergence", "convergence"] });
  const plain = selectDailyObservations(src, 20_004, "");
  const focused = selectDailyObservations(src, 20_004, "transcendence");
  assert.deepEqual(idsOf(focused), idsOf(plain));
});

test("`everything` and empty focus are the default day", () => {
  const src = pool(28);
  const plain = selectDailyObservations(src, 20_004, "");
  assert.deepEqual(idsOf(selectDailyObservations(src, 20_004, "everything")), idsOf(plain));
});
