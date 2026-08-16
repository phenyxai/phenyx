/**
 * PHE-74 — cluster grouping + freeLimit=2 (clusterEntries) for constellation.
 *
 * Pure so the free/pro slice can be unit-tested without a live DB. Named areas
 * come from `areas`; observations with no area_id fall into `core signals`.
 * The API must omit observations past the cluster cap — never send teasers.
 */

import { firstSentence } from "../observations/gating";
import type { Evidence } from "../observations/evidence";
import { CORE_CLUSTER_LABEL, type Pillar } from "./layout";

export interface AreaRow {
  id: string;
  pillar: string;
  label: string;
  ordinal: number;
}

export interface ClusterObservationInput {
  id: string;
  pillar: string;
  area_id: string | null;
  body: string;
  source_platforms: string[] | null;
  points?: unknown;
  surfaced_at: string;
  is_new: boolean;
  signal_type?: string | null;
  record_count?: number | null;
  evidence_n?: number | null;
  evidence_span?: string | null;
  span_start?: string | null;
  span_end?: string | null;
  sources?: string[] | null;
  assembled_evidence?: Evidence | null;
}

export interface ClusterObservation {
  id: string;
  body: string;
  points?: string[];
  sources?: string[];
  span?: string | null;
  surfaced_at: string;
  is_new: boolean;
  /** True when the evidence chain is withheld (free). Body still ships. */
  locked: boolean;
  evidence: Evidence | null;
}

export interface Cluster {
  id: string;
  label: string;
  preview: string | null;
  observation_count: number;
  has_new: boolean;
  source_platforms: string[];
  observations: ClusterObservation[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function formatSpan(row: ClusterObservationInput): string | null {
  if (row.evidence_span && row.evidence_span.trim()) return row.evidence_span.trim();
  const start = row.span_start ? new Date(row.span_start) : null;
  const end = row.span_end ? new Date(row.span_end) : null;
  const year = (d: Date) =>
    Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
  const a = start ? year(start) : null;
  const b = end ? year(end) : null;
  if (a && b) return a === b ? a : `${a} - ${b}`;
  return null;
}

function clusterPreview(
  synthesis: string | null | undefined,
  observations: ClusterObservationInput[]
): string | null {
  const synth = synthesis?.trim();
  if (synth) return synth;
  const first = observations[0]?.body;
  if (!first) return null;
  const sentence = firstSentence(first);
  const second = observations[1] ? firstSentence(observations[1].body) : "";
  if (sentence && second) return `${sentence.replace(/\.+$/, "")}. alongside it, ${second.replace(/\.+$/, "")}.`;
  return sentence || null;
}

function serveObservation(
  row: ClusterObservationInput,
  tracesUnlocked: boolean
): ClusterObservation {
  const points = asStringArray(row.points);
  const sources = (row.sources?.length ? row.sources : row.source_platforms) ?? [];
  const evidence = tracesUnlocked
    ? row.assembled_evidence ?? null
    : row.assembled_evidence
      ? { sig: row.assembled_evidence.sig, recs: row.assembled_evidence.recs }
      : null;
  return {
    id: row.id,
    body: row.body,
    points: points.length ? points : undefined,
    sources: tracesUnlocked && sources.length ? sources : undefined,
    span: tracesUnlocked ? formatSpan(row) : undefined,
    surfaced_at: row.surfaced_at,
    is_new: row.is_new,
    locked: !tracesUnlocked,
    evidence,
  };
}

function collectSources(rows: ClusterObservationInput[]): string[] {
  const seen: string[] = [];
  for (const row of rows) {
    const platforms = (row.sources?.length ? row.sources : row.source_platforms) ?? [];
    for (const p of platforms) {
      if (p && !seen.includes(p)) seen.push(p);
    }
  }
  return seen;
}

/**
 * Group a pillar's observations into clusters, then slice each cluster to
 * `clusterEntries`. Infinity means keep all. Traces unlock on served rows
 * when `tracesUnlocked` is true (Pro); free keeps `{ sig, recs }` stubs.
 */
export function buildClustersForPillar(
  pillar: Pillar,
  observations: ClusterObservationInput[],
  areas: AreaRow[],
  syntheses: Map<string, string>,
  clusterEntries: number,
  tracesUnlocked: boolean
): Cluster[] {
  const pillarObs = observations.filter((o) => o.pillar === pillar);
  const pillarAreas = areas
    .filter((a) => a.pillar === pillar)
    .sort((a, b) => a.ordinal - b.ordinal);

  const byArea = new Map<string, ClusterObservationInput[]>();
  const core: ClusterObservationInput[] = [];
  for (const obs of pillarObs) {
    if (obs.area_id) {
      const bucket = byArea.get(obs.area_id);
      if (bucket) bucket.push(obs);
      else byArea.set(obs.area_id, [obs]);
    } else {
      core.push(obs);
    }
  }

  const clusters: Cluster[] = [];

  const pushCluster = (
    id: string,
    label: string,
    rows: ClusterObservationInput[],
    synthesis: string | null
  ) => {
    if (rows.length === 0) return;
    const cap = Number.isFinite(clusterEntries) ? clusterEntries : rows.length;
    const servedRows = rows.slice(0, Math.max(0, cap));
    const served = servedRows.map((row) => serveObservation(row, tracesUnlocked));
    clusters.push({
      id,
      label,
      preview: clusterPreview(synthesis, servedRows),
      observation_count: served.length,
      has_new: servedRows.some((r) => r.is_new),
      source_platforms: tracesUnlocked ? collectSources(servedRows) : [],
      observations: served,
    });
  };

  for (const area of pillarAreas) {
    pushCluster(
      area.id,
      area.label.trim() || CORE_CLUSTER_LABEL,
      byArea.get(area.id) ?? [],
      syntheses.get(area.id) ?? null
    );
  }

  pushCluster(`${pillar}:${CORE_CLUSTER_LABEL}`, CORE_CLUSTER_LABEL, core, null);

  return clusters;
}
