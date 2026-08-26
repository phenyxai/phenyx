import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";
import { BillingService } from "../stripe/billing.service";
import {
  ObservationCandidate,
  ObservationRow,
  ServedObservation,
  TimelineGroup,
  PILLAR_ORDER,
  isValidPillar,
  collapseOverlappingCandidates,
  normalizeDateSpan,
  formatObservationSpan,
  buildInsertRows,
  applyReadGate,
  groupTimelineByPillar,
} from "./gating";
import {
  buildEvidence,
  buildUnderneath,
  pickPreviewEntries,
  pickUnderneathOfDay,
  stubEvidence,
  utcDayNumber,
  type SourceRecordPreview,
} from "./evidence";
import {
  applyFeedbackRanking,
  attachFeedback,
  parseFeedbackBody,
  type FeedbackSignal,
  type ObservationFeedbackState,
} from "./feedback";

/**
 * PHE-37 — Observation Generation Engine (Lane 6 foundation).
 *
 * Generates append-only "what your data revealed" observations from a user's
 * constellation + traits + Onairos snapshots, deduped by `signal_hash`, gated by
 * tier at generation time, and served through a tier read-gate. The `observations`
 * table already exists (phe31 migration) — this module never recreates it.
 *
 * Wave 2 seams (do not rename without updating PHE-41/PHE-42):
 *   • {@link generate} — internal idempotent entrypoint PHE-34's `enqueueSynthesis`
 *     will call once Lane 5 lands. Today it is driven by `POST /observations/generate`.
 *   • {@link getDailyFeed} / {@link getTimeline} apply {@link applyReadGate} /
 *     {@link groupTimelineByPillar} — PHE-41 refines the read gate here.
 *   • {@link selectActiveUserIds} — PHE-42 adds the `frozen`-user skip here.
 */

export interface GenerateOptions {
  /** Enqueue event id for best-effort idempotency (durable dedup is signal_hash). */
  eventId?: string;
  /** Origin of the call, for logging: "signal" (PHE-34 seam) or "cron". */
  trigger?: "signal" | "cron";
}

export interface GenerateResult {
  status: "generated" | "skipped_duplicate" | "no_context";
  /** Rows actually inserted (existing signal_hashes are silently absorbed). */
  generated: number;
  /** Candidates emitted by Claude before dedup/insert. */
  candidates: number;
  /** cache_read_input_tokens from the Claude call, for cache verification. */
  cacheReadTokens?: number;
}

export interface DailyFeedResponse {
  mantra: string | null;
  observations: ServedObservation[];
}

export interface TimelineResponse {
  pillars: TimelineGroup[];
}

const CLAUDE_MODEL = "claude-opus-4-8";

@Injectable()
export class ObservationsService {
  private readonly logger = new Logger(ObservationsService.name);

  /**
   * Best-effort in-process guard against a duplicate enqueue firing the same
   * generation twice in quick succession. This is NOT the durable idempotency
   * guarantee — that is the `UNIQUE(user_id, signal_hash)` dedup, which makes a
   * re-run produce zero new rows regardless of this set. Bounded to avoid growth.
   */
  private readonly processedEventIds = new Set<string>();
  private static readonly EVENT_ID_CAP = 5000;

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly voiceStandard: VoiceStandardService,
    private readonly billing: BillingService
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** Daily feed — the envelope `frontend/app/dashboard/daily/page.tsx` consumes. */
  async getDailyFeed(userId: string): Promise<DailyFeedResponse> {
    const supabase = this.supabaseService.getClient();
    const capabilities = this.billing.capabilitiesFor(await this.getUserTier(userId));

    const [{ data: rows }, { data: state }, { data: feedbackRows }] = await Promise.all([
      supabase
        .from("observations")
        .select(
          "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at,points,evidence_span,span_start,span_end,signal_type,evidence_n,record_count,sources"
        )
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false }),
      supabase
        .from("constellation_state")
        .select("mantra")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("observation_feedback")
        .select("observation_id,verdict,opened")
        .eq("user_id", userId),
    ]);

    const withEvidence = await this.attachEvidenceHierarchy(
      userId,
      (rows ?? []) as ObservationRow[],
      capabilities.evidenceTracesPerDay
    );

    return {
      mantra: (state?.mantra as string | null) ?? null,
      observations: attachFeedback(
        applyReadGate(withEvidence, capabilities),
        (feedbackRows ?? []) as {
          observation_id: string;
          verdict: string | null;
          opened: boolean;
        }[]
      ),
    };
  }

  /** Constellation timeline — grouped by pillar, freshest-first within a group. */
  async getTimeline(userId: string): Promise<TimelineResponse> {
    const supabase = this.supabaseService.getClient();
    const capabilities = this.billing.capabilitiesFor(await this.getUserTier(userId));

    const { data: rows } = await supabase
      .from("observations")
      .select(
        "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at"
      )
      .eq("user_id", userId)
      .order("surfaced_at", { ascending: false });

    return { pillars: groupTimelineByPillar((rows ?? []) as ObservationRow[], capabilities) };
  }

  /**
   * Load v66 hierarchy rows (signals, preview source records, underneath readings)
   * and stamp them onto each observation before the read gate redacts.
   *
   * Chain payloads are only fetched for the first `traceBudget` rows — locked
   * free traces keep `{ sig, recs }` from the observation columns alone.
   */
  private async attachEvidenceHierarchy(
    userId: string,
    rows: ObservationRow[],
    traceBudget: number
  ): Promise<ObservationRow[]> {
    if (rows.length === 0) return rows;
    const supabase = this.supabaseService.getClient();
    const ids = rows.map((r) => r.id);

    const { data: readingRows } = await supabase
      .from("underneath_readings")
      .select(
        "id,observation_id,headline,belief,gap,mechanism,tell,basis,hedge"
      )
      .eq("user_id", userId)
      .in("observation_id", ids);

    const readings = (readingRows ?? []) as UnderneathRow[];
    const readingByObs = new Map<string, UnderneathRow>();
    for (const r of readings) {
      if (!readingByObs.has(r.observation_id)) readingByObs.set(r.observation_id, r);
    }
    const ofDayId = pickUnderneathOfDay(
      readings.map((r) => r.observation_id).filter((id) => ids.includes(id)),
      utcDayNumber()
    );

    const unlocked = rows.filter((_, i) => i < traceBudget && !!normalizeSig(rows[i]));
    const unlockedIds = unlocked.map((r) => r.id);
    const signalByObs = await this.loadSignalsForObservations(userId, unlockedIds);
    const signalIds = [...new Set([...signalByObs.values()].map((s) => s.id))];
    const entriesBySignal = await this.loadPreviewEntries(signalIds);

    return rows.map((row, index) => {
      const sig = normalizeSig(row);
      const recs = Number(row.record_count ?? row.evidence_n ?? 0);
      const sources = (row.sources?.length ? row.sources : row.source_platforms) ?? [];
      const span = formatObservationSpan(row);
      const n = Number(row.evidence_n ?? row.record_count ?? 0);
      const traceUnlocked = index < traceBudget;

      let assembled_evidence = sig ? stubEvidence(sig, recs) : null;
      if (sig && traceUnlocked) {
        const signal = signalByObs.get(row.id);
        const metric =
          signal?.metric_value && typeof signal.metric_value === "object"
            ? (signal.metric_value as Record<string, unknown>)
            : null;
        assembled_evidence = buildEvidence({
          sig,
          recs: Number(signal?.record_count ?? recs),
          n: Number(signal?.evidence_n ?? n),
          sources: (signal?.sources?.length ? signal.sources : sources) as string[],
          span: signal?.canonical_span
            ? normalizeDateSpan(signal.canonical_span)
            : span,
          metric,
          entries: signal ? entriesBySignal.get(signal.id) ?? [] : [],
        });
      }

      const reading = readingByObs.get(row.id);
      const assembled_underneath = reading
        ? buildUnderneath({
            ...reading,
            recs,
            sources,
          })
        : null;

      return {
        ...row,
        assembled_evidence,
        assembled_underneath,
        underneath_of_day: ofDayId != null && row.id === ofDayId,
      };
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

  /**
   * At most three dated entries per signal (earliest, most recent, defining).
   * Two ordered lookups per signal so a 1,847-row chain never lands in the feed.
   */
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

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  /**
   * Idempotent generation entrypoint. Reads the user's grounding context, asks
   * Claude for novel observations via the `emit_observations` structured tool,
   * gates by tier, and inserts with `ON CONFLICT (user_id, signal_hash) DO NOTHING`
   * so confirming signals are silently absorbed.
   *
   * PHE-34 seam: once `enqueueSynthesis` exists, it calls this directly with an
   * `eventId`; today `POST /observations/generate` drives it per authenticated user.
   */
  async generate(userId: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    if (options.eventId && this.processedEventIds.has(options.eventId)) {
      return { status: "skipped_duplicate", generated: 0, candidates: 0 };
    }

    const supabase = this.supabaseService.getClient();
    const [tier, context] = await Promise.all([
      this.getUserTier(userId),
      this.loadGenerationContext(userId),
    ]);

    // Nothing to reason over yet — no connected platforms and no synthesis.
    if (!context.hasSignal) {
      this.markEventProcessed(options.eventId);
      return { status: "no_context", generated: 0, candidates: 0 };
    }

    const hasFullAccess = this.billing.hasFullAccess(tier);
    const { candidates, cacheReadTokens } = await this.emitObservations(context);

    const valid = candidates.filter(
      (c) => isValidPillar(c.pillar) && c.body.trim().length > 0 && c.signal_key.trim().length > 0
    );
    // PHE-72: skip `reading` hashes (overreach) and deprioritize `known` pillars.
    const ordered = applyFeedbackRanking(userId, valid, context.feedbackSignals);
    const deduped = collapseOverlappingCandidates(ordered);
    const rows = buildInsertRows(userId, deduped, hasFullAccess);

    let generated = 0;
    if (rows.length > 0) {
      // ignoreDuplicates → `ON CONFLICT DO NOTHING`. Required: the append-only
      // trigger on `observations` rejects any UPDATE, so DO UPDATE would throw.
      const { data: inserted, error } = await supabase
        .from("observations")
        .upsert(rows, { onConflict: "user_id,signal_hash", ignoreDuplicates: true })
        .select("id");
      if (error) {
        this.logger.error(`observation insert failed for ${userId}: ${error.message}`);
        throw error;
      }
      generated = inserted?.length ?? 0;
    }

    this.markEventProcessed(options.eventId);
    this.logger.log(
      `generate(${options.trigger ?? "signal"}) user=${userId} candidates=${candidates.length} inserted=${generated} cacheRead=${cacheReadTokens ?? 0}`
    );
    return { status: "generated", generated, candidates: candidates.length, cacheReadTokens };
  }

  /**
   * PHE-72 — persist a verdict and/or `opened`. `verdict: null` (`change it`)
   * deletes the row. Missing/unowned observations are 404; bad bodies 400.
   */
  async upsertFeedback(
    userId: string,
    observationId: string,
    body: unknown
  ): Promise<ObservationFeedbackState> {
    const parsed = parseFeedbackBody(body);
    if (!parsed.ok) {
      throw new HttpException({ error: parsed.error }, 400);
    }
    if (!observationId) {
      throw new HttpException({ error: "observation not found" }, 404);
    }

    const supabase = this.supabaseService.getClient();
    const { data: observation } = await supabase
      .from("observations")
      .select("id")
      .eq("id", observationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!observation) {
      throw new HttpException({ error: "observation not found" }, 404);
    }

    const patch = parsed.value;
    const clearingVerdict = patch.verdict === null;
    const markingOpened = patch.opened === true;

    // `change it` deletes the row so the three buttons return.
    if (clearingVerdict && !markingOpened) {
      const { error } = await supabase
        .from("observation_feedback")
        .delete()
        .eq("user_id", userId)
        .eq("observation_id", observationId);
      if (error) {
        this.logger.error(`feedback delete failed for ${observationId}: ${error.message}`);
        throw new HttpException({ error: "feedback failed" }, 500);
      }
      return { verdict: null, opened: false };
    }

    const { data: existing } = await supabase
      .from("observation_feedback")
      .select("verdict,opened")
      .eq("user_id", userId)
      .eq("observation_id", observationId)
      .maybeSingle();

    const nextVerdict =
      patch.verdict !== undefined
        ? patch.verdict
        : ((existing?.verdict as ObservationFeedbackState["verdict"]) ?? null);
    const nextOpened = markingOpened ? true : existing?.opened === true;

    const { data: upserted, error } = await supabase
      .from("observation_feedback")
      .upsert(
        {
          user_id: userId,
          observation_id: observationId,
          verdict: nextVerdict,
          opened: nextOpened,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,observation_id" }
      )
      .select("verdict,opened")
      .maybeSingle();
    if (error) {
      this.logger.error(`feedback upsert failed for ${observationId}: ${error.message}`);
      throw new HttpException({ error: "feedback failed" }, 500);
    }

    return {
      verdict:
        (upserted?.verdict as ObservationFeedbackState["verdict"]) ?? nextVerdict,
      opened: upserted?.opened === true || nextOpened,
    };
  }

  /**
   * Weekly cron: regenerate for each active, non-frozen user. Per-user failures
   * are swallowed so one bad user never blocks the batch (stale feed is served
   * on failure — generation never blocks the dashboard).
   */
  async runWeeklyGeneration(): Promise<{
    processed: number;
    generated: number;
    skipped: number;
    errored: number;
  }> {
    const userIds = await this.selectActiveUserIds();
    let generated = 0;
    let skipped = 0;
    let errored = 0;

    for (const userId of userIds) {
      try {
        const res = await this.generate(userId, { trigger: "cron" });
        if (res.status === "generated") generated += res.generated;
        else skipped += 1;
      } catch (e) {
        errored += 1;
        this.logger.error(
          `weekly generation failed for ${userId}: ${(e as Error).message}`
        );
      }
    }

    return { processed: userIds.length, generated, skipped, errored };
  }

  // -------------------------------------------------------------------------
  // Context + Claude
  // -------------------------------------------------------------------------

  private async loadGenerationContext(userId: string): Promise<GenerationContext> {
    const supabase = this.supabaseService.getClient();

    const [stateRes, traitsRes, connectionsRes, recentRes, feedbackSignals] = await Promise.all([
      supabase
        .from("constellation_state")
        .select(
          "archetype, portrait, foresight, mantra, origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis, becoming_synthesis, recognition_synthesis, transcendence_synthesis"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_traits")
        .select("keyword_tags, insight, derived_from")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("onairos_connections")
        .select("platform, redacted_snapshot")
        .eq("user_id", userId)
        .eq("status", "connected"),
      // Already-surfaced observations — passed so the model avoids restating.
      // Genuine novelty is still enforced at insert by signal_hash dedup.
      supabase
        .from("observations")
        .select("pillar, body, meta_label")
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false })
        .limit(50),
      this.loadFeedbackSignals(userId),
    ]);

    const connections = (connectionsRes.data ?? []) as {
      platform: string;
      redacted_snapshot: Record<string, unknown> | null;
    }[];

    return {
      userId,
      state: stateRes.data ?? null,
      traits: (traitsRes.data ?? []) as GenerationContext["traits"],
      connections,
      recent: (recentRes.data ?? []) as GenerationContext["recent"],
      feedbackSignals,
      hasSignal: connections.length > 0 || stateRes.data != null,
    };
  }

  /** Call Claude with the strict `emit_observations` tool; return the candidates. */
  private async emitObservations(
    context: GenerationContext
  ): Promise<{ candidates: ObservationCandidate[]; cacheReadTokens?: number }> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      this.logger.warn("ANTHROPIC_API_KEY missing — skipping observation generation");
      return { candidates: [] };
    }

    // [Voice Standard] (cached prefix) + [task instructions]; per-user volatile
    // grounding stays in the user message, after the cached prefix (PHE-20).
    const system = await this.voiceStandard.buildSystemBlocks(this.taskInstructions());
    const userMessage = this.buildUserMessage(context);

    // NOTE: adaptive thinking is incompatible with a forced tool_choice, so the
    // tool is offered with tool_choice:auto and the task prompt instructs the
    // model to always call emit_observations. We read the tool_use block back.
    let claude: any;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system,
          tools: [this.emitObservationsTool()],
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      claude = await res.json();
    } catch (e) {
      this.logger.error(`Claude call failed: ${(e as Error).message}`);
      return { candidates: [] };
    }

    const cacheReadTokens: number | undefined = claude?.usage?.cache_read_input_tokens;
    const candidates = this.parseToolResult(claude);
    return { candidates, cacheReadTokens };
  }

  /** Extract the `emit_observations` tool input from a Claude response. */
  private parseToolResult(claude: any): ObservationCandidate[] {
    const blocks: any[] = Array.isArray(claude?.content) ? claude.content : [];
    const toolUse = blocks.find(
      (b) => b?.type === "tool_use" && b?.name === "emit_observations"
    );
    const emitted = toolUse?.input?.observations;
    if (!Array.isArray(emitted)) {
      this.logger.warn("Claude returned no emit_observations tool call");
      return [];
    }
    return emitted
      .map((o: any): ObservationCandidate | null => {
        if (!o || typeof o.pillar !== "string" || typeof o.body !== "string") return null;
        return {
          pillar: o.pillar,
          body: this.voiceStandard.sanitizeProse(o.body),
          source_platforms: Array.isArray(o.source_platforms)
            ? o.source_platforms.filter((p: unknown) => typeof p === "string")
            : [],
          meta_label: typeof o.meta_label === "string" ? o.meta_label : null,
          signal_key: typeof o.signal_key === "string" ? o.signal_key : "",
          confidence: typeof o.confidence === "number" ? o.confidence : 0,
          supporting_points: Array.isArray(o.supporting_points)
            ? o.supporting_points.filter((point: unknown) => typeof point === "string")
            : [],
          source_record_keys: Array.isArray(o.source_record_keys)
            ? o.source_record_keys.filter((key: unknown) => typeof key === "string")
            : [],
          window_start:
            typeof o.window_start === "string" && o.window_start.trim()
              ? o.window_start
              : null,
          window_end:
            typeof o.window_end === "string" && o.window_end.trim()
              ? o.window_end
              : null,
        };
      })
      .filter((c): c is ObservationCandidate => c !== null);
  }

  private emitObservationsTool() {
    return {
      name: "emit_observations",
      description:
        "Emit the novel observations that genuinely surfaced from the user's cross-platform data. Only emit patterns that are new — do NOT restate anything already surfaced. Emit an empty array if nothing genuinely novel surfaced.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          observations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                pillar: { type: "string", enum: [...PILLAR_ORDER] },
                body: {
                  type: "string",
                  description:
                    "1-3 sentences of Voice-Standard prose naming what surfaced. A recognition, not a summary.",
                },
                source_platforms: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Platforms this pattern drew from, e.g. [\"linkedin\",\"spotify\"]. Cross-platform (>=2) reads are the strongest signals.",
                },
                meta_label: {
                  type: "string",
                  description:
                    "Short provenance label, e.g. 'cross-platform pattern / 6 months'. Empty string if none.",
                },
                signal_key: {
                  type: "string",
                  description:
                    "Stable machine key of the UNDERLYING pattern (e.g. 'linkedin+spotify:consistency-over-6mo'), NOT the prose. Same pattern must yield the same key across runs so paraphrases dedup.",
                },
                confidence: {
                  type: "number",
                  description: "0..1 confidence in this observation; used for ranking.",
                },
                supporting_points: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Concrete record-backed points supporting this observation. More points means the observation is better supported.",
                },
                source_record_keys: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Exact stable record or derived_from keys from the grounding context. Never copy a bare platform name from source_platforms; use an empty array when no stable key is available.",
                },
                window_start: {
                  type: "string",
                  description:
                    "Inclusive ISO-8601 start of the supporting record window, or an empty string when unknown.",
                },
                window_end: {
                  type: "string",
                  description:
                    "Inclusive ISO-8601 end of the supporting record window, or an empty string when unknown.",
                },
              },
              required: [
                "pillar",
                "body",
                "source_platforms",
                "meta_label",
                "signal_key",
                "confidence",
                "supporting_points",
                "source_record_keys",
                "window_start",
                "window_end",
              ],
            },
          },
        },
        required: ["observations"],
      },
    };
  }

  private taskInstructions(): string {
    // Task-only instructions; voice/tone come from the cached Voice Standard block.
    return `you are the observation engine for PHENYX COLLECTIVE — the identity observatory.

your task: read the user's synthesized constellation, grounded trait keywords, and redacted per-platform behavioral snapshots, then surface OBSERVATIONS — short statements of "what your data revealed". each observation is tied to one pillar, cites its source_platforms, and carries a meta_label describing the pattern (e.g. "cross-platform pattern / 6 months").

new-signal diffing is the core rule: ONLY surface genuinely novel patterns. you will be shown the observations already surfaced to this user — do not restate them, rephrase them, or emit near-duplicates. if a pattern only confirms something already surfaced, omit it. if nothing genuinely new surfaced, emit an empty observations array.

for each observation choose a stable signal_key that identifies the underlying pattern (not the prose), so the same pattern always produces the same key. prefer cross-platform reads (source_platforms with 2+ platforms) — they are the strongest signals.

also return the concrete supporting_points, exact source_record_keys copied from the grounding, and the inclusive ISO-8601 window_start/window_end. a bare platform name is not a source record key. do not emit two angles on the same pillar that share a source record or overlap the same time window; keep the one with more supporting points.

you MUST return your result by calling the emit_observations tool. do not answer in plain text.

strict prohibitions — never break these:
- no diagnostic or clinical language
- never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology
- no therapeutic advice; these are recognitions of identity, not guidance`;
  }

  private buildUserMessage(context: GenerationContext): string {
    const state = context.state;
    const syntheses = state
      ? [
          state.origin_synthesis,
          state.emergence_synthesis,
          state.self_creation_synthesis,
          state.convergence_synthesis,
          state.becoming_synthesis,
          state.recognition_synthesis,
          state.transcendence_synthesis,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const traits = context.traits
      .map((t) => {
        const tags = (t.keyword_tags ?? []).join(", ");
        const recordKeys = (t.derived_from ?? []).join(", ");
        return `- ${tags}${t.insight ? ` — ${t.insight}` : ""}${
          recordKeys ? ` [grounding keys: ${recordKeys}]` : ""
        }`;
      })
      .join("\n");

    const connections = context.connections
      .map(
        (c) =>
          `- ${c.platform}: ${
            c.redacted_snapshot ? JSON.stringify(c.redacted_snapshot) : "connected (no snapshot)"
          }`
      )
      .join("\n");

    const alreadySurfaced = context.recent
      .map((r) => `- [${r.pillar}] ${r.body}${r.meta_label ? ` (${r.meta_label})` : ""}`)
      .join("\n");

    const readingClaims = context.feedbackSignals
      .filter((f) => f.verdict === "reading" && f.body)
      .map((f) => `- [${f.pillar}] ${f.body}`)
      .join("\n");

    return `USER CONSTELLATION
archetype: ${state?.archetype ?? "unknown"}
foresight: ${state?.foresight ?? "none"}
syntheses:
${syntheses || "none yet"}

GROUNDED TRAITS
${traits || "none"}

CONNECTED PLATFORMS (redacted snapshots)
${connections || "none connected"}

ALREADY SURFACED OBSERVATIONS (do NOT restate any of these)
${alreadySurfaced || "none yet — this is the first pass"}

CLAIMS FLAGGED AS A BAD READING (do NOT regenerate these patterns)
${readingClaims || "none"}

Surface only genuinely novel observations via emit_observations.`;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async getUserTier(userId: string): Promise<string> {
    // user_profiles is keyed by `id` (= auth.users.id), not user_id.
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    return (data?.tier as string) ?? "free";
  }

  /**
   * Active users eligible for the weekly cron: those with at least one connected
   * Onairos platform, minus frozen accounts. PHE-42: a frozen user retains and can
   * still read their data, but the cron must not generate new observations for
   * them — so the frozen ids among the active set are subtracted in one batched
   * `user_profiles` lookup (keyed by `id` = auth.users.id).
   */
  private async selectActiveUserIds(): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("onairos_connections")
      .select("user_id")
      .eq("status", "connected");
    const ids = new Set<string>();
    for (const row of (data ?? []) as { user_id: string }[]) ids.add(row.user_id);
    if (ids.size === 0) return [];

    const { data: frozenRows } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("frozen", true)
      .in("id", [...ids]);
    for (const row of (frozenRows ?? []) as { id: string }[]) ids.delete(row.id);

    return [...ids];
  }

  private markEventProcessed(eventId?: string): void {
    if (!eventId) return;
    if (this.processedEventIds.size >= ObservationsService.EVENT_ID_CAP) {
      this.processedEventIds.clear();
    }
    this.processedEventIds.add(eventId);
  }

  /**
   * PHE-72 writer input: known/reading verdicts joined to signal_hash + pillar.
   * Body is loaded only so the generator can skip regenerating a flagged claim;
   * it is never returned on the daily feed's feedback object.
   */
  private async loadFeedbackSignals(userId: string): Promise<FeedbackSignal[]> {
    const supabase = this.supabaseService.getClient();
    const { data: fb } = await supabase
      .from("observation_feedback")
      .select("observation_id, verdict")
      .eq("user_id", userId)
      .in("verdict", ["known", "reading"]);
    const rows = (fb ?? []) as { observation_id: string; verdict: string | null }[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.observation_id);
    const { data: obs } = await supabase
      .from("observations")
      .select("id, signal_hash, pillar, body")
      .eq("user_id", userId)
      .in("id", ids);
    const byId = new Map(
      ((obs ?? []) as { id: string; signal_hash: string; pillar: string; body: string }[]).map(
        (o) => [o.id, o]
      )
    );

    const out: FeedbackSignal[] = [];
    for (const row of rows) {
      const o = byId.get(row.observation_id);
      if (!o) continue;
      if (row.verdict !== "known" && row.verdict !== "reading") continue;
      out.push({
        signal_hash: o.signal_hash,
        pillar: o.pillar,
        verdict: row.verdict,
        body: o.body,
      });
    }
    return out;
  }
}

interface GenerationContext {
  userId: string;
  state:
    | {
        archetype: string | null;
        portrait: Record<string, unknown> | null;
        foresight: string | null;
        mantra: string | null;
        origin_synthesis: string | null;
        emergence_synthesis: string | null;
        self_creation_synthesis: string | null;
        convergence_synthesis: string | null;
        becoming_synthesis: string | null;
        recognition_synthesis: string | null;
        transcendence_synthesis: string | null;
      }
    | null;
  traits: { keyword_tags: string[] | null; insight: string | null; derived_from: string[] | null }[];
  connections: { platform: string; redacted_snapshot: Record<string, unknown> | null }[];
  recent: { pillar: string; body: string; meta_label: string | null }[];
  feedbackSignals: FeedbackSignal[];
  hasSignal: boolean;
}

interface UnderneathRow {
  id: string;
  observation_id: string;
  headline: string;
  belief: unknown;
  gap: string;
  mechanism: string;
  tell: string;
  basis: string;
  hedge: string;
}

interface LinkedSignal {
  id: string;
  signal_type?: string | null;
  metric_value?: Record<string, unknown> | null;
  record_count?: number | null;
  sources?: string[] | null;
  evidence_n?: number | null;
  canonical_span?: string | null;
}

interface ObservationSignalLink {
  observation_id: string;
  signal_id: string;
  signals: LinkedSignal | LinkedSignal[] | null;
}

function normalizeSig(row: ObservationRow): string | null {
  const sig = row.signal_type?.trim().toLowerCase();
  return sig || null;
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
