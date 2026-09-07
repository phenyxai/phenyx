// ============================================================================
// Daily selection: which observations make up today (v244 / PHE-92)
// ----------------------------------------------------------------------------
// The daily feed surfaces a few observations, not the whole constellation. Four
// each day, the same four on free and full: what differs between the plans is
// how far into an observation you can go, never how many you may see.
//
// Rules, in order:
//   1. a pool of four or fewer is the whole day;
//   2. otherwise one headline (`is_new`) leads, chosen by day number, so every
//      day opens on a pillar's strongest line;
//   3. the rest fill from a deck of the remaining observations shuffled with a
//      seeded LCG. The seed is the cycle number, so the day is the same for
//      everyone who opens it and the deck is dealt through before it repeats;
//   4. at most one observation per pillar. A thin pool yields a short day,
//      never a padded repeat;
//   5. focus (full only): if the focused pillar is absent, the last pick gives
//      way to the first pool observation of that pillar; the focused pillar
//      then floats to the top.
//
// Pure and dependency free so it runs under `node --test` without the React
// tree. Keep it that way.
// ============================================================================

export const DAILY_COUNT = 4;

/** The slice of an observation the selection reads. */
export interface DailyCandidate {
  id: string;
  pillar_tag: string;
  is_new?: boolean;
}

/** Normalize a pillar tag to its lookup key: "SELF CREATION" → "self_creation". */
function pillarKeyOf(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const LCG_MOD = 2147483647;
const LCG_MULT = 16807;
const SEED_MIX = 2654435761;

/** Seed for the shuffle: one per cycle, never zero. */
export function dailyCycleSeed(dayNum: number, cycleLen: number): number {
  return ((Math.floor(dayNum / cycleLen) + 1) * SEED_MIX) % LCG_MOD;
}

/** Fisher-Yates over a copy, driven by the seeded LCG. */
export function shuffleDeck<T>(src: readonly T[], seed: number): T[] {
  let state = seed;
  const rnd = () => {
    state = (state * LCG_MULT) % LCG_MOD;
    return state / LCG_MOD;
  };
  const deck = src.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  return deck;
}

export function selectDailyObservations<T extends DailyCandidate>(
  observations: readonly T[],
  dayNum: number,
  focus: string,
): T[] {
  if (observations.length === 0) return [];

  let ordered: T[] = [];

  if (observations.length <= DAILY_COUNT) {
    ordered = [...observations];
  } else {
    const headlines = observations.filter((o) => o.is_new);
    const rest = observations.filter((o) => !o.is_new);

    if (headlines.length) {
      ordered.push(headlines[dayNum % headlines.length]);
    }

    const taken = new Set(ordered.map((o) => pillarKeyOf(o.pillar_tag)));
    const src = rest.length ? rest : observations;
    const per = DAILY_COUNT;
    const cycleLen = Math.max(1, Math.ceil(src.length / per));
    const deck = shuffleDeck(src, dailyCycleSeed(dayNum, cycleLen));
    const start = (dayNum % cycleLen) * per;

    for (let i = 0; ordered.length < DAILY_COUNT && i < deck.length; i++) {
      const o = deck[(start + i) % deck.length];
      const key = pillarKeyOf(o.pillar_tag);
      if (ordered.includes(o) || taken.has(key)) continue;
      taken.add(key);
      ordered.push(o);
    }
  }

  if (focus && focus !== "everything") {
    const focusKey = pillarKeyOf(focus);
    const isFocused = (o: T) => pillarKeyOf(o.pillar_tag) === focusKey;
    if (!ordered.some(isFocused)) {
      const f = observations.find(isFocused);
      if (f) {
        ordered.pop();
        ordered.unshift(f);
      }
    }
    // Stable: the focused pillar first, everything else in its dealt order.
    ordered = [...ordered.filter(isFocused), ...ordered.filter((o) => !isFocused(o))];
  }

  return ordered;
}
