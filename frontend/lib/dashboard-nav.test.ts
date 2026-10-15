/**
 * PHE-96 — dashboard navigation: tab order, home route, legacy redirects, and
 * the guarantee that no route, label or link still says daily or you.
 *
 *   node --test lib/dashboard-nav.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DASHBOARD_HOME,
  DASHBOARD_TABS,
  LEGACY_REDIRECTS,
  SETTINGS_HREF,
  segmentTab,
  tabTransition,
} from "./dashboard-nav.ts";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");

test("tabs run constellation, discover, polaris, insights", () => {
  assert.deepEqual(
    DASHBOARD_TABS.map((t) => t.id),
    ["constellation", "discover", "polaris", "insights"],
  );
  assert.deepEqual(
    DASHBOARD_TABS.map((t) => t.label),
    ["constellation", "discover", "polaris", "insights"],
  );
  for (const tab of DASHBOARD_TABS) {
    assert.equal(tab.href, `/dashboard/${tab.id}`);
  }
});

test("every tab has a route under app/dashboard", () => {
  for (const tab of DASHBOARD_TABS) {
    assert.ok(
      existsSync(join(FRONTEND, "app", "dashboard", tab.id, "page.tsx")),
      `missing app/dashboard/${tab.id}/page.tsx`,
    );
  }
  assert.ok(existsSync(join(FRONTEND, "app", "dashboard", "settings", "page.tsx")));
  assert.equal(SETTINGS_HREF, "/dashboard/settings");
});

test("constellation is home, and /dashboard redirects there", () => {
  assert.equal(DASHBOARD_HOME, "/dashboard/constellation");
  assert.equal(DASHBOARD_TABS[0].href, DASHBOARD_HOME);
  const index = readFileSync(join(FRONTEND, "app", "dashboard", "page.tsx"), "utf8");
  assert.match(index, /redirect\(DASHBOARD_HOME\)/);
});

test("segmentTab maps the route segment to the active tab", () => {
  assert.equal(segmentTab(null), "constellation");
  assert.equal(segmentTab("constellation"), "constellation");
  assert.equal(segmentTab("discover"), "discover");
  assert.equal(segmentTab("polaris"), "polaris");
  assert.equal(segmentTab("insights"), "insights");
  assert.equal(segmentTab("settings"), "settings");
  assert.equal(segmentTab("daily"), null);
  assert.equal(segmentTab("you"), null);
});

test("tabTransition: landing sends a visit with no previous tab and no duration", () => {
  const t = tabTransition({ tab: null, enteredAt: 0 }, null, 1_000);
  assert.deepEqual(t.visit, { tab: "constellation", previous: null });
  assert.equal(t.duration, null);
  assert.deepEqual(t.clock, { tab: "constellation", enteredAt: 1_000 });
});

test("tabTransition: moving tabs closes the old tab's time and visits the new one", () => {
  const t = tabTransition({ tab: "constellation", enteredAt: 1_000 }, "insights", 13_400);
  assert.deepEqual(t.duration, { tab: "constellation", seconds: 12 });
  assert.deepEqual(t.visit, { tab: "insights", previous: "constellation" });
  assert.deepEqual(t.clock, { tab: "insights", enteredAt: 13_400 });
});

test("tabTransition: staying on the same tab sends nothing", () => {
  const clock = { tab: "polaris" as const, enteredAt: 5 };
  const t = tabTransition(clock, "polaris", 99_000);
  assert.equal(t.duration, null);
  assert.equal(t.visit, null);
  assert.deepEqual(t.clock, clock);
});

test("tabTransition: an unknown segment closes the old tab and resets the clock", () => {
  const t = tabTransition({ tab: "discover", enteredAt: 0 }, "foo", 30_000);
  assert.deepEqual(t.duration, { tab: "discover", seconds: 30 });
  assert.equal(t.visit, null);
  assert.deepEqual(t.clock, { tab: null, enteredAt: 30_000 });

  // Time spent on the unknown segment is not charged to anyone.
  const back = tabTransition(t.clock, "discover", 90_000);
  assert.equal(back.duration, null);
  assert.deepEqual(back.visit, { tab: "discover", previous: null });
});

test("tabTransition: a clock running backwards never yields negative seconds", () => {
  const t = tabTransition({ tab: "insights", enteredAt: 10_000 }, "polaris", 9_000);
  assert.deepEqual(t.duration, { tab: "insights", seconds: 0 });
});

test("legacy routes redirect: daily to constellation, you and profile to insights", () => {
  const map = Object.fromEntries(LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));
  assert.deepEqual(map, {
    "/dashboard/daily": "/dashboard/constellation",
    "/dashboard/you": "/dashboard/insights",
    "/dashboard/profile": "/dashboard/insights",
    "/daily": "/dashboard/constellation",
  });
});

test("the old daily, you and profile route folders are gone", () => {
  for (const dir of ["app/dashboard/daily", "app/dashboard/you", "app/dashboard/profile", "app/daily"]) {
    assert.ok(!existsSync(join(FRONTEND, dir)), `${dir} should not exist`);
  }
});

// Source sweep. LEGACY_REDIRECTS names the old paths on purpose, so its module is
// skipped; tests are skipped too. Everything else under app/, components/ and lib/,
// plus proxy.ts, must not route, label or link to daily or you.
const SKIP = new Set(["lib/dashboard-nav.ts"]);
const FORBIDDEN: readonly [RegExp, string][] = [
  [/["'`]\/(?:dashboard\/)?(?:daily|you)\b/, "a link or route to daily/you"],
  [/\b(?:tab|id|label|eyebrow|page)\s*[=:]\s*\{?\s*["'`](?:daily|you)["'`]/, "a tab id or label of daily/you"],
  [/^\s*(?:daily|you)\s*:/m, "a daily/you key in a tab map"],
  [/["'`](?:daily|you)["'`]\s*\|(?!\|)/, "daily/you in a tab union"],
  [/(?<!\|)\|\s*["'`](?:daily|you)["'`]/, "daily/you in a tab union"],
  [/\bsegment\s*\?\?\s*["'`]daily["'`]/, "daily as the default segment"],
  // UI copy, e.g. plan feature bullets that still sell the removed daily feed.
  [/["'`][^"'`\n]*\bdaily\b[^"'`\n]*["'`]/i, "copy that mentions daily"],
];

/** Source with comments blanked, so the sweep checks code and copy only. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test("no route, label or link still says daily or you", () => {
  const offenders: string[] = [];
  const files = [
    ...["app", "components", "lib"].flatMap((root) => sourceFiles(join(FRONTEND, root))),
    join(FRONTEND, "proxy.ts"),
  ];
  for (const file of files) {
    const rel = relative(FRONTEND, file);
    if (SKIP.has(rel)) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    for (const [pattern, what] of FORBIDDEN) {
      const m = src.match(pattern);
      if (m) offenders.push(`${rel}: ${what} (${m[0].trim()})`);
    }
  }
  assert.deepEqual(offenders, []);
});
