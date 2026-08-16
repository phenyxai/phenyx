/**
 * PHE-75 — "what has held" is identity, so it lives on Profile. Daily's
 * "still true today" (PHE-70) is a rotating one-item slice of the same list.
 * When there are more than four constants, skip today's still-true index so
 * the two surfaces do not show the same card.
 */
export interface HeldConstant {
  title: string;
  body: string;
}

const DAY_MS = 86_400_000;
const HELD_LIMIT = 4;

export function todaysStillTrueIndex(length: number, nowMs: number = Date.now()): number {
  if (length <= 0) return -1;
  return Math.floor(nowMs / DAY_MS) % length;
}

export function pickHeldConstants(
  items: HeldConstant[],
  nowMs: number = Date.now()
): HeldConstant[] {
  if (items.length === 0) return [];
  if (items.length <= HELD_LIMIT) return items.slice(0, HELD_LIMIT);
  const skip = todaysStillTrueIndex(items.length, nowMs);
  return items.filter((_, i) => i !== skip).slice(0, HELD_LIMIT);
}
