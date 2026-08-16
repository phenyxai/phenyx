import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { BillingService } from "../stripe/billing.service";
import {
  buildEvidence,
  pickPreviewEntries,
  stubEvidence,
  type Evidence,
  type SourceRecordPreview,
} from "../observations/evidence";
import { normalizePillar } from "../observations/signal-hash";
import {
  buildClustersForPillar,
  type AreaRow,
  type Cluster,
  type ClusterObservationInput,
} from "./clusters";
import {
  ACTIVE_PILLARS,
  NODE_LAYOUT,
  PILLARS,
  tenureYears,
  type Pillar,
} from "./layout";
import {
  buildMoved,
  buildRecordTimeline,
  buildYearlyRecap,
  type MovedPair,
  type RecordTimeline,
  type YearlyRecapEntry,
} from "./record";

/**
 * PHE-74 — read model behind `GET /constellation`.
 *
 * Returns the seven canvas points, portrait, per-pillar clusters (free: at most
 * two observation entries per cluster, remainder omitted), below-fold timeline
 * from account history, what-moved pairs, and PHENYX tenure. Yearly recap is
 * Pro + tenure ≥ 1 year only.
 */

export interface ConstellationPoint {
  pillar: Pillar;
  x: number;
  y: number;
  z: number;
  active: boolean;
  has_new: boolean;
}

export interface ConstellationPillar {
  pillar: Pillar;
  active: boolean;
  score: number | null;
  synthesis: string | null;
  observation_count: number;
  has_new: boolean;
  source_platforms: string[];
  source_insight: string | null;
  clusters: Cluster[];
}

export interface ConstellationTenure {
  years: number;
  since: string | null;
}

export interface ConstellationResponse {
  stellar_color: string | null;
  archetype: string | null;
  version: number | null;
  generated_at: string | null;
  portrait: unknown;
  mantra: string | null;
  foresight: string | null;
  points: ConstellationPoint[];
  pillars: ConstellationPillar[];
  timeline: RecordTimeline;
  moved: MovedPair[];
  tenure: ConstellationTenure;
  yearly_recap: YearlyRecapEntry[] | null;
}

interface LinkedSignal {
  id: string;
  signal_type: string | null;
  metric_value: unknown;
  record_count: number | null;
  sources: string[] | null;
  evidence_n: number | null;
  canonical_span: string | null;
}

interface ObservationSignalLink {
  observation_id: string;
  signal_id: string;
  signals: LinkedSignal | LinkedSignal[] | null;
}

@Injectable()
export class ConstellationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billing: BillingService
  ) {}

  async getConstellation(userId: string): Promise<ConstellationResponse> {
    const supabase = this.supabaseService.getClient();

    const [
      profileRes,
      stateRes,
      obsRes,
      areasRes,
      artifactsRes,
      spanRes,
      latestRes,
    ] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("stellar_color, tier, created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("constellation_state")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("observations")
        .select(
          "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at,area_id,points,signal_type,evidence_n,evidence_span,span_start,span_end,record_count,sources"
        )
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false }),
      supabase
        .from("areas")
        .select("id,pillar,label,ordinal")
        .eq("user_id", userId)
        .order("ordinal", { ascending: true }),
      supabase
        .from("generated_artifacts")
        .select("artifact_type,area_id,output")
        .eq("user_id", userId)
        .eq("artifact_type", "area_synthesis"),
      supabase
        .from("source_records")
        .select("occurred_at")
        .eq("user_id", userId)
        .not("occurred_at", "is", null)
        .order("occurred_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("source_records")
        .select("occurred_at")
        .eq("user_id", userId)
        .not("occurred_at", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const tier = (profileRes.data?.tier as string | null) ?? "free";
    const capabilities = this.billing.capabilitiesFor(tier);
    const tracesUnlocked = capabilities.clusterEntries === Infinity;
    const state = (stateRes.data ?? null) as Record<string, unknown> | null;
    const createdAt = (profileRes.data?.created_at as string | null) ?? null;
    const years = tenureYears(createdAt);
    const yearlyEligible = capabilities.yearlyRecap && years >= 1;

    const rows = ((obsRes.data ?? []) as ClusterObservationInput[]).map((row) => ({
      ...row,
      pillar: normalizePillar(row.pillar),
    }));

    const withEvidence = await this.attachClusterEvidence(
      userId,
      rows,
      tracesUnlocked
    );

    const areas = ((areasRes.data ?? []) as AreaRow[]).map((a) => ({
      ...a,
      pillar: normalizePillar(a.pillar),
    }));

    const syntheses = new Map<string, string>();
    for (const art of artifactsRes.data ?? []) {
      const areaId = (art as { area_id?: string | null }).area_id;
      const output = (art as { output?: unknown }).output;
      const prose =
        output && typeof output === "object"
          ? ((output as Record<string, unknown>).synthesis as string | undefined) ??
            ((output as Record<string, unknown>).prose as string | undefined)
          : null;
      if (areaId && prose?.trim()) syntheses.set(areaId, prose.trim());
    }

    const pillars = this.buildPillars(
      state,
      withEvidence,
      areas,
      syntheses,
      capabilities.clusterEntries,
      tracesUnlocked
    );

    const engineRecord = this.readEngineRecord(state);

    return {
      stellar_color: (profileRes.data?.stellar_color as string | null) ?? null,
      archetype: (state?.archetype as string | null) ?? null,
      version: (state?.version as number | null) ?? null,
      generated_at: (state?.generated_at as string | null) ?? null,
      portrait: state?.portrait ?? null,
      mantra: (state?.mantra as string | null) ?? null,
      foresight: (state?.foresight as string | null) ?? null,
      points: pillars.map((p) => ({
        pillar: p.pillar,
        ...NODE_LAYOUT[p.pillar],
        active: p.active,
        has_new: p.has_new,
      })),
      pillars,
      timeline: buildRecordTimeline(
        (spanRes.data?.occurred_at as string | null) ?? null,
        (latestRes.data?.occurred_at as string | null) ?? null,
        engineRecord
      ),
      moved: buildMoved(engineRecord),
      tenure: { years, since: createdAt },
      yearly_recap: buildYearlyRecap(yearlyEligible, engineRecord),
    };
  }

  private buildPillars(
    state: Record<string, unknown> | null,
    rows: ClusterObservationInput[],
    areas: AreaRow[],
    syntheses: Map<string, string>,
    clusterEntries: number,
    tracesUnlocked: boolean
  ): ConstellationPillar[] {
    return PILLARS.map((pillar) => {
      const clusters = buildClustersForPillar(
        pillar,
        rows,
        areas,
        syntheses,
        clusterEntries,
        tracesUnlocked
      );
      const observationCount = clusters.reduce(
        (n, c) => n + c.observation_count,
        0
      );
      const sourcePlatforms: string[] = [];
      for (const cluster of clusters) {
        for (const p of cluster.source_platforms) {
          if (!sourcePlatforms.includes(p)) sourcePlatforms.push(p);
        }
      }
      return {
        pillar,
        active: ACTIVE_PILLARS.has(pillar),
        score: this.readScore(state, pillar),
        synthesis: this.readSynthesis(state, pillar),
        observation_count: observationCount,
        has_new: clusters.some((c) => c.has_new),
        source_platforms: sourcePlatforms,
        source_insight: clusters[0]?.preview ?? null,
        clusters,
      };
    });
  }

  /**
   * Stamp stub (and, for Pro, full-chain) evidence onto observations that will
   * be served. Free never loads the chain — the client keys off payload presence.
   */
  private async attachClusterEvidence(
    userId: string,
    rows: ClusterObservationInput[],
    tracesUnlocked: boolean
  ): Promise<ClusterObservationInput[]> {
    if (rows.length === 0) return rows;

    const stubbed = rows.map((row) => {
      const sig = row.signal_type?.trim().toLowerCase() || null;
      const recs = Number(row.record_count ?? row.evidence_n ?? 0);
      return {
        ...row,
        assembled_evidence: sig ? stubEvidence(sig, recs) : null,
      };
    });

    if (!tracesUnlocked) return stubbed;

    const supabase = this.supabaseService.getClient();
    const ids = stubbed.filter((r) => r.assembled_evidence).map((r) => r.id);
    if (ids.length === 0) return stubbed;

    const signalByObs = await this.loadSignalsForObservations(userId, ids);
    const signalIds = [...new Set([...signalByObs.values()].map((s) => s.id))];
    const entriesBySignal = await this.loadPreviewEntries(signalIds);

    return stubbed.map((row) => {
      const sig = row.signal_type?.trim().toLowerCase() || null;
      if (!sig) return row;
      const recs = Number(row.record_count ?? row.evidence_n ?? 0);
      const sources = (row.sources?.length ? row.sources : row.source_platforms) ?? [];
      const span = row.evidence_span?.trim() || null;
      const n = Number(row.evidence_n ?? row.record_count ?? 0);
      const signal = signalByObs.get(row.id);
      const metric =
        signal?.metric_value && typeof signal.metric_value === "object"
          ? (signal.metric_value as Record<string, unknown>)
          : null;
      const assembled_evidence: Evidence = buildEvidence({
        sig,
        recs: Number(signal?.record_count ?? recs),
        n: Number(signal?.evidence_n ?? n),
        sources: (signal?.sources?.length ? signal.sources : sources) as string[],
        span: signal?.canonical_span || span,
        metric,
        entries: signal ? entriesBySignal.get(signal.id) ?? [] : [],
      });
      return { ...row, assembled_evidence };
    });
  }

  private async loadSignalsForObservations(
    userId: string,
    observationIds: string[]
  ): Promise<Map<string, LinkedSignal>> {
    const out = new Map<string, LinkedSignal>();
    if (observationIds.length === 0) return out;
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("observation_signals")
      .select(
        "observation_id, signal_id, signals(id, signal_type, metric_value, record_count, sources, evidence_n, canonical_span)"
      )
      .eq("user_id", userId)
      .in("observation_id", observationIds);

    for (const link of (data ?? []) as ObservationSignalLink[]) {
      const signal = Array.isArray(link.signals) ? link.signals[0] : link.signals;
      if (!signal || out.has(link.observation_id)) continue;
      out.set(link.observation_id, { ...signal, id: signal.id ?? link.signal_id });
    }
    return out;
  }

  private async loadPreviewEntries(
    signalIds: string[]
  ): Promise<Map<string, ReturnType<typeof pickPreviewEntries>>> {
    const out = new Map<string, ReturnType<typeof pickPreviewEntries>>();
    if (signalIds.length === 0) return out;
    const supabase = this.supabaseService.getClient();

    await Promise.all(
      signalIds.map(async (signalId) => {
        const [earliestRes, latestRes] = await Promise.all([
          supabase
            .from("signal_source_records")
            .select("source_records(platform, record_type, occurred_at)")
            .eq("signal_id", signalId)
            .order("occurred_at", { referencedTable: "source_records", ascending: true })
            .limit(2),
          supabase
            .from("signal_source_records")
            .select("source_records(platform, record_type, occurred_at)")
            .eq("signal_id", signalId)
            .order("occurred_at", { referencedTable: "source_records", ascending: false })
            .limit(1),
        ]);

        const previews: SourceRecordPreview[] = [];
        const push = (row: unknown) => {
          const rec = unwrapSourceRecord(row);
          if (rec) previews.push(rec);
        };
        for (const row of earliestRes.data ?? []) push(row);
        for (const row of latestRes.data ?? []) push(row);
        out.set(signalId, pickPreviewEntries(previews));
      })
    );

    return out;
  }

  private readEngineRecord(state: Record<string, unknown> | null): unknown {
    if (!state) return null;
    const snapshot = state.onairos_snapshot;
    if (snapshot && typeof snapshot === "object") {
      const rec = snapshot as Record<string, unknown>;
      if (rec.record || rec.timeline || rec.moved || rec.yearly) return rec;
    }
    return null;
  }

  private readScore(
    state: Record<string, unknown> | null,
    pillar: Pillar
  ): number | null {
    const v = state?.[`${pillar}_score`];
    return typeof v === "number" ? v : null;
  }

  private readSynthesis(
    state: Record<string, unknown> | null,
    pillar: Pillar
  ): string | null {
    const v = state?.[`${pillar}_synthesis`];
    return typeof v === "string" ? v : null;
  }
}

function unwrapSourceRecord(row: unknown): SourceRecordPreview | null {
  if (!row || typeof row !== "object") return null;
  const nested = (row as { source_records?: unknown }).source_records;
  const rec = Array.isArray(nested) ? nested[0] : nested;
  if (!rec || typeof rec !== "object") return null;
  const r = rec as {
    platform?: unknown;
    record_type?: unknown;
    occurred_at?: unknown;
  };
  if (typeof r.platform !== "string") return null;
  return {
    platform: r.platform,
    record_type: typeof r.record_type === "string" ? r.record_type : "",
    occurred_at: typeof r.occurred_at === "string" ? r.occurred_at : null,
  };
}
