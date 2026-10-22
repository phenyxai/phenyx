import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlan, resetLabel } from "./polaris-plan.ts";

test("parsePlan reads a named plan with timed steps and the question after it", () => {
  const plan = parsePlan(
    "let us build it around the time that already works for you.\n\na four-week shape:\n1. week one: choose one room and one sound.\n2. weeks two and three: two protected evenings a week.\n3. finish a rough version.\n\nwhich evening feels easiest to protect?",
  );
  assert.ok(plan);
  assert.equal(plan.before, "let us build it around the time that already works for you.");
  assert.equal(plan.title, "a four-week shape");
  assert.deepEqual(plan.steps[0], { meta: "week one", text: "choose one room and one sound." });
  assert.deepEqual(plan.steps[2], { meta: "", text: "finish a rough version." });
  assert.equal(plan.after, "which evening feels easiest to protect?");
});

test("parsePlan needs two numbered lines, and names an unnamed plan", () => {
  assert.equal(parsePlan("you kept returning to film.\n\nwhat part do you miss?"), null);
  assert.equal(parsePlan("1. one step only."), null);
  const plan = parsePlan("1) start small\n2) keep going");
  assert.equal(plan?.title, "your next steps");
  assert.equal(plan?.before, "");
});

test("resetLabel reads the reset date, else the first of next month", () => {
  assert.equal(resetLabel("2026-11-01"), "nov 1");
  assert.equal(resetLabel(null, new Date("2026-12-21T15:00:00Z")), "jan 1");
  assert.equal(resetLabel("garbage", new Date("2026-10-21T15:00:00Z")), "nov 1");
});
