import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import {
  SystemBlock,
  VoiceStandardService,
} from "../voice-standard/voice-standard.service";
import {
  guardInsight,
  rankTraitMatches,
  TraitInsightMatch,
  TraitRow,
} from "./trait-profile.matching";

// Re-exported so cross-module consumers (Polaris / PHE-22, wired in P3) can import
// the accessor's return type from the service they inject.
export type { TraitInsightMatch, TraitRow } from "./trait-profile.matching";

// Model IDs are exact — do not append date suffixes or downgrade. Trait generation
// is a bounded pattern -> keyword+sentence task; Sonnet at low effort matches the
// mantra/foresight prose path rather than the heavier Opus constellation synthesis.
const TRAIT_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Bound a single generation run so a pathological trait object can't spawn an
// unbounded number of rows.
const MAX_TRAITS_PER_RUN = 12;

/** One trait-grounding row emitted by the generation tool. */
interface TraitProfileItem {
  keyword_tags: string[];
  insight: string;
  derived_from: string[];
}

/** Structured output of the `emit_trait_profile` tool. */
interface EmitTraitProfile {
  traits: TraitProfileItem[];
}

const EMIT_TRAIT_PROFILE_TOOL = {
  name: "emit_trait_profile",
  description:
    "Emit the internal trait-grounding rows derived from the Onairos cross-platform analysis: for each salient behavioral pattern, a small internal keyword set and one Voice-Standard insight sentence.",
  strict: true as const,
  input_schema: {
    type: "object",
    properties: {
      traits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyword_tags: { type: "array", items: { type: "string" } },
            insight: { type: "string" },
            derived_from: { type: "array", items: { type: "string" } },
          },
          required: ["keyword_tags", "insight", "derived_from"],
          additionalProperties: false,
        },
      },
    },
    required: ["traits"],
    additionalProperties: false,
  },
};

const TRAIT_PROFILE_INSTRUCTIONS = `you generate the internal trait-level grounding for a person in PHENYX COLLECTIVE from their onairos cross-platform analysis.

your input is a redacted onairos trait object. read it for salient BEHAVIORAL patterns — cadence, medium-mixing, timing, social posture, cross-platform through-lines — not surface facts. turn each distinct salient pattern into one grounding row:
- keyword_tags: a small set (2 to 6) of short, lowercase, normalized keywords a person's future question might literally contain when it touches this pattern. internal routing metadata only, never shown. prefer plain everyday words over jargon.
- insight: ONE resonant sentence (at most 2 to 3 short sentences), written to the person as "you", in the voice standard. grounded in the specific pattern, never generic. this is the ONLY part ever shown to the person, so it must stand alone with no reference to keywords, scores, or that this layer exists.
- derived_from: the source platforms or trait keys the pattern rests on.

rules:
- only emit rows for patterns the data genuinely supports. thin data (few platforms or weak signal) -> emit FEWER rows, or an empty array. never fabricate a pattern to fill a quota.
- plain text only in every string: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language; never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology.

you MUST return the result by calling the emit_trait_profile tool. do not answer in plain text.`;

/**
 * PHE-24 — trait-level grounding data.
 *
 * Generates internal trait-grounding rows (a small keyword set + one Voice-Standard
 * insight sentence per salient behavioral pattern) from a user's Onairos analysis,
 * and exposes the `inferTraitInsight` accessor that the Polaris answer engine
 * (PHE-22, wired in the P3 reconciliation) uses to assemble its grounding block.
 *
 * The keyword sets and the existence of this layer are internal: only `insight`
 * text is ever rendered, and no client-facing endpoint serializes `keyword_tags`.
 * Rows live in the append-only `user_traits` table (PHE-31).
 */
@Injectable()
export class TraitProfileService {
  private readonly logger = new Logger(TraitProfileService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly voiceStandard: VoiceStandardService
  ) {}

  /**
   * Generation job. Runs after an Onairos cross-platform analysis completes or
   * refreshes: turns each salient behavioral pattern in the trait object into a
   * guard-passing `user_traits` row. Only insights that pass the plain-text +
   * 2-3-sentence guard are stored, rows with no keyword tags are dropped (they
   * could never be matched), and an insight already stored for this user is skipped
   * so a refresh does not re-store the constellation's own grounding.
   *
   * Fire-and-forget safe: returns the number of rows written and never throws — it
   * logs and returns 0 on any failure so a background enqueue can ignore the result.
   */
  async generateTraitProfile(
    userId: string,
    onairosSnapshot: unknown,
    synthesisVersion: number | null = null
  ): Promise<number> {
    if (onairosSnapshot === undefined || onairosSnapshot === null) return 0;

    let emit: EmitTraitProfile;
    try {
      emit = await this.callTraitTool(onairosSnapshot);
    } catch (e) {
      this.logger.error(
        `trait-profile generation failed for ${userId}`,
        e as Error
      );
      return 0;
    }

    const items = Array.isArray(emit?.traits)
      ? emit.traits.slice(0, MAX_TRAITS_PER_RUN)
      : [];
    if (items.length === 0) {
      // Sparse / thin Onairos data — no fabricated rows. PHE-22 flags sparse itself.
      this.logger.log(
        `trait-profile: no rows generated for ${userId} (sparse or empty analysis)`
      );
      return 0;
    }

    // Existing insights guard against re-storing on refresh (the table is
    // append-only, and the constellation RPC already wrote its own grounding).
    const seen = await this.loadExistingInsights(userId);

    const rows: Array<{
      user_id: string;
      keyword_tags: string[];
      insight: string;
      derived_from: string[];
      synthesis_version: number | null;
    }> = [];

    for (const item of items) {
      const insight = guardInsight(item?.insight ?? "");
      if (!insight) continue; // failed plain-text / sentence guard — rejected pre-storage
      const dedupKey = insight.toLowerCase();
      if (seen.has(dedupKey)) continue;

      const tags = Array.isArray(item.keyword_tags)
        ? item.keyword_tags
            .map((t) => String(t).toLowerCase().trim())
            .filter(Boolean)
        : [];
      if (tags.length === 0) continue; // unaddressable row — could never be matched

      seen.add(dedupKey);
      rows.push({
        user_id: userId,
        keyword_tags: tags,
        insight,
        derived_from: Array.isArray(item.derived_from)
          ? item.derived_from.map((d) => String(d))
          : [],
        synthesis_version: synthesisVersion,
      });
    }

    if (rows.length === 0) return 0;

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from("user_traits").insert(rows);
    if (error) {
      this.logger.error(
        `trait-profile persist failed for ${userId}: ${error.message}`
      );
      return 0;
    }

    this.logger.log(
      `trait-profile: wrote ${rows.length} row(s) for ${userId} v${synthesisVersion ?? "-"}`
    );
    return rows.length;
  }

  /**
   * Accessor for the Polaris grounding cascade (PHE-22 step b) and for
   * observation/synthesis grounding. Lowercases the question and returns the user's
   * trait insights whose `keyword_tags` substring-hit the question, ranked most
   * relevant first (distinct hits, then newest synthesis version). Returns [] on no
   * hit — the caller falls back to the top pillar's synthesis rather than forcing an
   * irrelevant insight.
   *
   * Only the `insight` field of each match is renderable; `keywordTags`/`score` are
   * internal and must never be serialized to a client.
   */
  async inferTraitInsight(
    question: string,
    userId: string
  ): Promise<TraitInsightMatch[]> {
    if (!question || !question.trim()) return [];
    const rows = await this.loadTraitRows(userId);
    if (rows.length === 0) return [];
    return rankTraitMatches(question, rows);
  }

  /**
   * Grounding helper for observation/synthesis prompts: the user's stored trait
   * insights as a plain newline-joined block (newest first, capped), or "" when the
   * user has none. Only insight text is emitted — keywords and structure are
   * intentionally omitted so they can never leak into a prompt or an answer.
   */
  async buildGroundingBlock(userId: string, limit = 8): Promise<string> {
    const rows = await this.loadTraitRows(userId);
    if (rows.length === 0) return "";
    return rows
      .slice(0, limit)
      .map((r) => r.insight)
      .filter(Boolean)
      .join("\n");
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  /** Read a user's trait rows, newest grounding first (version desc, then time). */
  private async loadTraitRows(userId: string): Promise<TraitRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("user_traits")
      .select("keyword_tags, insight, synthesis_version, created_at")
      .eq("user_id", userId)
      .order("synthesis_version", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      this.logger.error(
        `trait rows read failed for ${userId}: ${error.message}`
      );
      return [];
    }
    return (data ?? []) as TraitRow[];
  }

  /** Lowercased set of the user's existing insights, for dedup on generation. */
  private async loadExistingInsights(userId: string): Promise<Set<string>> {
    const rows = await this.loadTraitRows(userId);
    return new Set(
      rows.map((r) => (r.insight ?? "").toLowerCase()).filter(Boolean)
    );
  }

  /**
   * One structured Claude tool-use call over raw fetch — matches the transport and
   * caching convention already used by synthesis.service / crisis.service. The
   * system array is [Voice Standard, task instructions] with a cache breakpoint on
   * the last block so the whole stable prefix is prompt-cached; the volatile trait
   * object stays in the user message. Forces the tool so the model answers in one
   * structured turn. Returns the parsed tool input.
   */
  private async callTraitTool(
    onairosSnapshot: unknown
  ): Promise<EmitTraitProfile> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const system: SystemBlock[] = await this.voiceStandard.buildSystemBlocks(
      TRAIT_PROFILE_INSTRUCTIONS
    );
    const lastBlock = system[system.length - 1];
    lastBlock.cache_control = { type: "ephemeral" };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: TRAIT_MODEL,
        max_tokens: 2000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system,
        tools: [EMIT_TRAIT_PROFILE_TOOL],
        tool_choice: { type: "tool", name: EMIT_TRAIT_PROFILE_TOOL.name },
        messages: [
          {
            role: "user",
            content: `onairos trait object:\n${JSON.stringify(onairosSnapshot)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    }

    const claude: any = await res.json();
    if (claude?.usage) {
      this.logger.debug(
        `[emit_trait_profile] cache_read=${claude.usage.cache_read_input_tokens ?? 0} input=${claude.usage.input_tokens ?? 0}`
      );
    }

    const toolUse = Array.isArray(claude?.content)
      ? claude.content.find(
          (b: any) =>
            b?.type === "tool_use" && b?.name === EMIT_TRAIT_PROFILE_TOOL.name
        )
      : undefined;
    if (!toolUse?.input) {
      throw new Error("no emit_trait_profile tool_use block in response");
    }
    return toolUse.input as EmitTraitProfile;
  }
}
