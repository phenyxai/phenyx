import assert from "node:assert/strict";
import { test } from "node:test";
import {
  constellationAge,
  firstSentence,
  newObservationCount,
  storyLine,
  synthesisLine,
} from "./constellation-text.ts";
import type {
  Cluster,
  ClusterObservation,
  ConstellationData,
  Pillar,
  PillarDetail,
} from "./constellation";

function observation(over: Partial<ClusterObservation> = {}): ClusterObservation {
  return {
    id: over.id ?? "o",
    body: over.body ?? null,
    span: over.span ?? null,
    surfaced_at: over.surfaced_at ?? "",
    is_new: over.is_new ?? false,
  };
}

function cluster(label: string, observations: ClusterObservation[], over: Partial<Cluster> = {}): Cluster {
  return {
    id: over.id ?? label,
    label,
    preview: over.preview ?? null,
    observation_count: over.observation_count ?? observations.length,
    has_new: observations.some((o) => o.is_new),
    source_platforms: [],
    observations,
  };
}

function detail(pillar: Pillar, clusters: Cluster[]): PillarDetail {
  return {
    pillar,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    score: null,
    synthesis: null,
    observation_count: clusters.reduce((n, c) => n + c.observation_count, 0),
    has_new: clusters.some((c) => c.has_new),
    source_platforms: [],
    source_insight: null,
    clusters,
  };
}

function data(span: string[], since: string | null): ConstellationData {
  return {
    timeline: { span, note: null, eras: [], breaks: [], return_line: null, card: null, empty: true },
    tenure: { years: 0, since },
  } as unknown as ConstellationData;
}

const sept2026 = new Date(2026, 8, 7);

test("constellationAge reads the first year in the timeline span and counts from january", () => {
  assert.deepEqual(constellationAge(data(["2014", "2026"], null), sept2026), {
    from: 2014,
    label: "12 years, 9 months",
  });
});

test("constellationAge skips span entries without a year", () => {
  assert.deepEqual(constellationAge(data(["now", "since 2020"], null), sept2026), {
    from: 2020,
    label: "6 years, 9 months",
  });
});

test("constellationAge falls back to the tenure year and uses the singular", () => {
  assert.deepEqual(constellationAge(data([], "2025-09-01T00:00:00Z"), sept2026), {
    from: 2025,
    label: "1 year, 9 months",
  });
  assert.deepEqual(constellationAge(data([], "2026-05-20T00:00:00Z"), new Date(2026, 0, 15)), {
    from: 2026,
    label: "1 month",
  });
});

test("constellationAge omits the months part when it is zero", () => {
  assert.deepEqual(constellationAge(data(["2025"], null), new Date(2025, 11, 31)), {
    from: 2025,
    label: "1 year",
  });
});

test("constellationAge is null when neither source carries a year", () => {
  assert.equal(constellationAge(data([], null), sept2026), null);
  assert.equal(constellationAge(data(["soon"], "not a date"), sept2026), null);
});

test("synthesisLine needs two named areas; core signals do not count as named", () => {
  const one = detail("origin", [
    cluster("listening", [observation({ span: "2016" })]),
    cluster("core signals", [observation({ span: "2020" })]),
  ]);
  assert.equal(synthesisLine(one, true), null);
  assert.equal(synthesisLine(one, false), null);
  assert.equal(synthesisLine(detail("origin", []), true), null);
});

test("synthesisLine on free says a full reading exists, whatever the observations carry", () => {
  const d = detail("origin", [
    cluster("listening", [observation({ locked: true })]),
    cluster("making", [observation({ locked: true })]),
  ]);
  assert.deepEqual(synthesisLine(d, false), {
    text: "these 2 areas are read together with full ✦",
    locked: true,
  });
});

test("synthesisLine on full composes the list, the year span and the count", () => {
  const d = detail("origin", [
    cluster("listening", [observation({ span: "2016–17" }), observation({ span: "2019" })]),
    cluster("making", [observation({ span: "2024" })]),
  ]);
  assert.deepEqual(synthesisLine(d, true), {
    text: "listening and making all sit under origin, and they hold together across 8 years of your life, on 3 things you did rather than anything you said about yourself.",
    locked: false,
  });
});

test("synthesisLine lists three areas with commas and reads the pillar label with a space", () => {
  const d = detail("self_creation", [
    cluster("a", [observation({ span: "2020" })]),
    cluster("b", [observation({ span: "2020" })]),
    cluster("c", [observation({ span: "2020" })]),
  ]);
  assert.equal(
    synthesisLine(d, true)?.text,
    "a, b and c all sit under self creation, and they hold together, on 3 things you did rather than anything you said about yourself.",
  );
});

test("synthesisLine drops the span when there are no years and uses the singular for one thing", () => {
  const d = detail("emergence", [
    cluster("a", [observation({ span: "then" })]),
    cluster("b", [], { observation_count: 0 }),
  ]);
  assert.equal(
    synthesisLine(d, true)?.text,
    "a and b all sit under emergence, and they hold together, on 1 thing you did rather than anything you said about yourself.",
  );
});

test("synthesisLine counts core signals toward the span and the count without naming them", () => {
  const d = detail("convergence", [
    cluster("a", [observation({ span: "2022" })]),
    cluster("b", [observation({ span: "2023" })]),
    cluster("core signals", [observation({ span: "2018" }), observation({ span: "2018" })]),
  ]);
  assert.equal(
    synthesisLine(d, true)?.text,
    "a and b all sit under convergence, and they hold together across 5 years of your life, on 4 things you did rather than anything you said about yourself.",
  );
});

test("synthesisLine falls back to surfaced_at and never reads sub-second digits as a year", () => {
  const d = detail("origin", [
    cluster("a", [observation({ surfaced_at: "2020-01-01T00:00:00.123456Z" })]),
    cluster("b", [observation({ span: "2026", surfaced_at: "1999-01-01T00:00:00Z" })]),
  ]);
  assert.equal(
    synthesisLine(d, true)?.text,
    "a and b all sit under origin, and they hold together across 6 years of your life, on 2 things you did rather than anything you said about yourself.",
  );
});

test("firstSentence strips tags and stops at the first terminator", () => {
  assert.equal(
    firstSentence("there is <b>music</b> you keep for yourself. most of it stays private."),
    "there is music you keep for yourself.",
  );
  assert.equal(firstSentence("  no terminator here  "), "no terminator here");
  assert.equal(firstSentence("does it hold? yes."), "does it hold?");
  assert.equal(firstSentence(null), "");
});

test("storyLine prefers the lead observation, then the preview, then the lens", () => {
  const withBody = detail("origin", [
    cluster("a", [observation({ body: "your hours begin where most days end. and more." })], {
      preview: "preview text.",
    }),
  ]);
  assert.equal(storyLine(withBody), "your hours begin where most days end.");

  const withPreview = detail("origin", [
    cluster("a", [observation({ body: null })], { preview: "most of what you make stays with you. really." }),
  ]);
  assert.equal(storyLine(withPreview), "most of what you make stays with you.");

  assert.equal(storyLine(detail("transcendence", [])), "the question you have not answered yet");
  assert.equal(storyLine(detail("origin", [])), "what has been with you the longest");
});

test("newObservationCount counts is_new across every area under the point", () => {
  const d = detail("origin", [
    cluster("a", [observation({ is_new: true }), observation()]),
    cluster("core signals", [observation({ is_new: true })]),
  ]);
  assert.equal(newObservationCount(d), 2);
  assert.equal(newObservationCount(detail("origin", [])), 0);
});
