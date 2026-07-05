import { Injectable, Logger } from "@nestjs/common";
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
  orderCandidates,
  buildInsertRows,
  applyReadGate,
  groupTimelineByPillar,
} from "./gating";

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
    const hasFullAccess = this.billing.hasFullAccess(await this.getUserTier(userId));

    const [{ data: rows }, { data: state }] = await Promise.all([
      supabase
        .from("observations")
        .select(
          "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at"
        )
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false }),
      supabase
        .from("constellation_state")
        .select("mantra")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    return {
      mantra: (state?.mantra as string | null) ?? null,
      observations: applyReadGate((rows ?? []) as ObservationRow[], hasFullAccess),
    };
  }

  /** Constellation timeline — grouped by pillar, freshest-first within a group. */
  async getTimeline(userId: string): Promise<TimelineResponse> {
    const supabase = this.supabaseService.getClient();
    const hasFullAccess = this.billing.hasFullAccess(await this.getUserTier(userId));

    const { data: rows } = await supabase
      .from("observations")
      .select(
        "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at"
      )
      .eq("user_id", userId)
      .order("surfaced_at", { ascending: false });

    return { pillars: groupTimelineByPillar((rows ?? []) as ObservationRow[], hasFullAccess) };
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
    const ordered = orderCandidates(valid);
    const rows = buildInsertRows(userId, ordered, hasFullAccess);

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

    const [stateRes, traitsRes, connectionsRes, recentRes] = await Promise.all([
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
              },
              required: [
                "pillar",
                "body",
                "source_platforms",
                "meta_label",
                "signal_key",
                "confidence",
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
        return `- ${tags}${t.insight ? ` — ${t.insight}` : ""}`;
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
   * Onairos platform. PHE-42 SEAM: add a `frozen`-flag filter here so frozen
   * accounts are skipped (the column does not exist yet on this branch).
   */
  private async selectActiveUserIds(): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("onairos_connections")
      .select("user_id")
      .eq("status", "connected");
    const ids = new Set<string>();
    for (const row of (data ?? []) as { user_id: string }[]) ids.add(row.user_id);
    return [...ids];
  }

  private markEventProcessed(eventId?: string): void {
    if (!eventId) return;
    if (this.processedEventIds.size >= ObservationsService.EVENT_ID_CAP) {
      this.processedEventIds.clear();
    }
    this.processedEventIds.add(eventId);
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
  hasSignal: boolean;
}
