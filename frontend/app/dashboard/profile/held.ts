/**
 * PHE-75 — Profile's "what has held" is a different slice than Daily's
 * "still true today" (PHE-70). Daily rotates one item by day-of-epoch; when
 * the shared list is longer than four, Profile skips that day's item.
 */
export interface HeldConstant {
  title: string
  body: string
}

const DAY_MS = 86_400_000
const HELD_LIMIT = 4

export function todaysStillTrueIndex(length: number, nowMs: number = Date.now()): number {
  if (length <= 0) return -1
  return Math.floor(nowMs / DAY_MS) % length
}

export function pickHeldConstants(
  items: HeldConstant[],
  nowMs: number = Date.now(),
): HeldConstant[] {
  if (items.length === 0) return []
  if (items.length <= HELD_LIMIT) return items.slice(0, HELD_LIMIT)
  const skip = todaysStillTrueIndex(items.length, nowMs)
  return items.filter((_, i) => i !== skip).slice(0, HELD_LIMIT)
}
