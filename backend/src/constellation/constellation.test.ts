import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../stripe/billing.service";
import { buildClustersForPillar, type ClusterObservationInput } from "./clusters";
import { tenureYears } from "./layout";
import { buildMoved, buildRecordTimeline, buildYearlyRecap } from "./record";

const billing = new BillingService();
const FREE = billing.capabilitiesFor("free").clusterEntries;
const PRO = billing.capabilitiesFor("pro").clusterEntries;

function obs(
  id: string,
  area_id: string | null,
  extras: Partial<ClusterObservationInput> = {}
): ClusterObservationInput {
  return {
    id,
    pillar: "origin",
    area_id,
    body: `observation ${id}.`,
    source_platforms: ["spotify"],
    surfaced_at: "2026-08-01T00:00:00Z",
    is_new: false,
    signal_type: "timing",
    record_count: 4,
    assembled_evidence: { sig: "timing", recs: 4, entries: [{ t: "1", s: "spotify", w: "play", l: "earliest" }] },
    ...extras,
  };
}

const areas = [
  { id: "area-a", pillar: "origin", label: "the private catalog", ordinal: 1 },
  { id: "area-b", pillar: "origin", label: "the late window", ordinal: 2 },
];

test("free clusterEntries is 2 and pro is Infinity", () => {
  assert.equal(FREE, 2);
  assert.equal(PRO, Infinity);
});

test("free: each cluster keeps at most 2 observations and omits the rest", () => {
  const rows = [
    obs("a1", "area-a"),
    obs("a2", "area-a"),
    obs("a3", "area-a"),
    obs("b1", "area-b"),
    obs("b2", "area-b"),
    obs("b3", "area-b"),
    obs("c1", null),
    obs("c2", null),
    obs("c3", null),
  ];
  const clusters = buildClustersForPillar(
    "origin",
    rows,
    areas,
    new Map(),
    FREE,
    false
  );
  assert.equal(clusters.length, 3);
  for (const cluster of clusters) {
    assert.ok(cluster.observations.length <= 2, cluster.label);
    assert.equal(cluster.observation_count, cluster.observations.length);
  }
  const catalog = clusters.find((c) => c.label === "the private catalog");
  assert.deepEqual(catalog?.observations.map((o) => o.id), ["a1", "a2"]);
  assert.equal(catalog?.observations.some((o) => o.id === "a3"), false);
});

test("pro: every observation in a cluster is served", () => {
  const rows = [obs("a1", "area-a"), obs("a2", "area-a"), obs("a3", "area-a")];
  const clusters = buildClustersForPillar(
    "origin",
    rows,
    areas,
    new Map([["area-a", "your private catalog stayed private."]]),
    PRO,
    true
  );
  const catalog = clusters.find((c) => c.label === "the private catalog");
  assert.equal(catalog?.observations.length, 3);
  assert.equal(catalog?.preview, "your private catalog stayed private.");
  assert.equal(catalog?.observations.every((o) => o.locked === false), true);
  assert.ok(catalog?.observations[0].evidence?.entries);
});

test("free cluster rows keep bodies and stub traces (no chain fields)", () => {
  const rows = [obs("a1", "area-a"), obs("a2", "area-a")];
  const clusters = buildClustersForPillar(
    "origin",
    rows,
    areas,
    new Map(),
    FREE,
    false
  );
  const row = clusters[0].observations[0];
  assert.equal(row.body, "observation a1.");
  assert.equal(row.locked, true);
  assert.equal(row.evidence?.sig, "timing");
  assert.equal(row.evidence?.entries, undefined);
  assert.equal(row.sources, undefined);
  assert.deepEqual(clusters[0].source_platforms, []);
});

test("unassigned observations land in core signals", () => {
  const clusters = buildClustersForPillar(
    "origin",
    [obs("x1", null)],
    areas,
    new Map(),
    FREE,
    false
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].label, "core signals");
  assert.equal(clusters[0].observations[0].id, "x1");
});

test("tenure is account age, independent of timeline emptiness", () => {
  const now = Date.parse("2026-08-16T00:00:00Z");
  const fresh = tenureYears("2026-07-16T00:00:00Z", now);
  const yearPlus = tenureYears("2025-01-01T00:00:00Z", now);
  assert.ok(fresh < 1);
  assert.ok(yearPlus >= 1);
});

test("timeline without eras is empty and does not invent names", () => {
  const tl = buildRecordTimeline(
    "2019-03-01T00:00:00Z",
    "2026-08-01T00:00:00Z",
    null
  );
  assert.equal(tl.empty, true);
  assert.deepEqual(tl.eras, []);
  assert.deepEqual(tl.breaks, []);
  assert.deepEqual(tl.span, ["2019", "2026"]);
  assert.ok(tl.note?.includes("accounts already held"));
});

test("timeline eras only appear when the engine supplied them", () => {
  const tl = buildRecordTimeline("2014-01-01T00:00:00Z", "2026-01-01T00:00:00Z", {
    eras: [[2, 28, "taking after others"]],
    breaks: [[32, "march 2019"]],
    ret: "a record came back",
  });
  assert.equal(tl.empty, false);
  assert.equal(tl.eras[0].name, "taking after others");
  assert.equal(tl.breaks[0].label, "march 2019");
  assert.equal(tl.return_line, "a record came back");
});

test("moved pairs parse then→now without inventing extras", () => {
  const moved = buildMoved({
    moved: [["how long a finished thing waits", "eleven months", "three weeks"]],
  });
  assert.equal(moved.length, 1);
  assert.equal(moved[0].then, "eleven months");
  assert.equal(moved[0].now, "three weeks");
  assert.deepEqual(buildMoved(null), []);
});

test("yearly recap is null when not eligible, empty when eligible without engine content", () => {
  assert.equal(buildYearlyRecap(false, { yearly: [["july", "month 12", "text"]] }), null);
  assert.deepEqual(buildYearlyRecap(true, null), []);
  const entries = buildYearlyRecap(true, {
    yearly: [["july", "self-creation brightened the most."]],
  });
  assert.equal(entries?.[0].when, "july");
});
