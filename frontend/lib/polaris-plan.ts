// PHE-129 — polaris plan cards and the points reset line. Dependency free so it
// runs under `node --test`.

export interface PlanStep {
  /** When it happens, e.g. "week one"; empty when the step has none. */
  meta: string;
  text: string;
}

export interface ParsedPlan {
  /** The reply's words before the plan, its named intro line taken out. */
  before: string;
  title: string;
  steps: PlanStep[];
  /** The words after the plan, usually the question back to the person. */
  after: string;
}

const STEP = /^\d+[.)]\s+/;

/**
 * A reply with two or more numbered lines reads as a plan. The line just
 * before the steps names it when it ends in a colon ("a four-week shape:");
 * otherwise it is "your next steps". A step that opens with a short label and a
 * colon ("week one: …") keeps the label as its meta.
 */
export function parsePlan(body: string): ParsedPlan | null {
  const lines = body.split("\n").map((line) => line.trim());
  const first = lines.findIndex((line) => STEP.test(line));
  if (first < 0) return null;
  let last = first;
  while (last + 1 < lines.length && (STEP.test(lines[last + 1]) || !lines[last + 1])) last += 1;
  const steps = lines
    .slice(first, last + 1)
    .filter((line) => STEP.test(line))
    .map((line) => {
      const text = line.replace(STEP, "");
      const colon = text.indexOf(":");
      return colon > 0 && colon < 32
        ? { meta: text.slice(0, colon).trim(), text: text.slice(colon + 1).trim() }
        : { meta: "", text };
    });
  if (steps.length < 2) return null;

  const head = lines.slice(0, first);
  while (head.length && !head[head.length - 1]) head.pop();
  const named = head.length > 0 && head[head.length - 1].endsWith(":");
  const title = named ? head.pop()!.replace(/:$/, "") : "your next steps";
  return {
    before: head.join("\n").trim(),
    title,
    steps,
    after: lines.slice(last + 1).join("\n").trim(),
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "2026-11-01" → "nov 1". With no date yet, the first of next month (UTC), when monthly points come back. */
export function resetLabel(date: string | null | undefined, now: Date = new Date()): string {
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null;
  const d =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
