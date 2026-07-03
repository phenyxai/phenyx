import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { CrisisService } from "./crisis.service";
import { TraitProfileService } from "./trait-profile.service";
import {
  SystemBlock,
  VoiceStandardService,
} from "../voice-standard/voice-standard.service";

// Model IDs are exact — do not append date suffixes or downgrade.
const SYNTHESIS_MODEL = "claude-opus-4-8"; // PHE-34 core synthesis (tool use, high effort)
const PROSE_MODEL = "claude-sonnet-4-6"; // PHE-36 mantra + PHE-38 foresight (low effort)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** The four active pillars at onboarding. The other three stay locked (null). */
const ACTIVE_PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
] as const;
type ActivePillar = (typeof ACTIVE_PILLARS)[number];

interface SynthesizeBody {
  trait_object?: unknown;
  archetype?: string;
  intention?: string;
  trigger_event_id?: string;
}

interface PillarOutput {
  score: number;
  synthesis: string;
}

interface TraitGrounding {
  keyword_tags: string[];
  insight: string;
  derived_from: string[];
}

/** Structured output of the `emit_constellation` tool (PHE-34). */
interface EmitConstellation {
  archetype: string;
  pillars: Record<ActivePillar, PillarOutput>;
  portrait: string;
  trait_grounding: TraitGrounding[];
}

/** One tool definition for a strict-schema Claude tool-use call. */
interface ClaudeTool {
  name: string;
  description: string;
  strict: true;
  input_schema: Record<string, unknown>;
}

const PILLAR_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    synthesis: { type: "string" },
  },
  required: ["score", "synthesis"],
  additionalProperties: false,
};

const EMIT_CONSTELLATION_TOOL: ClaudeTool = {
  name: "emit_constellation",
  description:
    "Emit the synthesized constellation: the archetype, the four active pillar scores and syntheses, the identity portrait, and the trait grounding that justifies it.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      archetype: { type: "string" },
      pillars: {
        type: "object",
        properties: {
          origin: PILLAR_SCHEMA,
          emergence: PILLAR_SCHEMA,
          self_creation: PILLAR_SCHEMA,
          convergence: PILLAR_SCHEMA,
        },
        required: ["origin", "emergence", "self_creation", "convergence"],
        additionalProperties: false,
      },
      portrait: { type: "string" },
      trait_grounding: {
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
    required: ["archetype", "pillars", "portrait", "trait_grounding"],
    additionalProperties: false,
  },
};

const EMIT_MANTRA_TOOL: ClaudeTool = {
  name: "emit_mantra",
  description:
    "Emit the daily mantra: exactly two short present-tense lines separated by a single newline.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { mantra: { type: "string" } },
    required: ["mantra"],
    additionalProperties: false,
  },
};

const EMIT_FORESIGHT_TOOL: ClaudeTool = {
  name: "emit_foresight",
  description:
    "Emit a single forward-looking, present-continuous line — evocative, never prescriptive, never an instruction.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { foresight: { type: "string" } },
    required: ["foresight"],
    additionalProperties: false,
  },
};

const SYNTHESIS_INSTRUCTIONS = `you are the synthesis engine for PHENYX COLLECTIVE — the first identity observatory.

your input is a redacted onairos trait object plus an optional archetype label and an optional free-text intention. read the whole trait object as evidence about who this person already is, then produce their constellation.

the four active pillars:
- origin: the foundational self — what was always true before it was named. maps to consistency signals and the earliest, most stable recurring patterns.
- emergence: how identity became externally legible — the first time something internal was visible to others. the archetype label informs this pillar most directly.
- self_creation: the identity actively being built — deliberate choices, creative output, disciplines pursued.
- convergence: where the threads meet — the through-line across seemingly unrelated traits and interests.

for each of the four pillars return:
- score: an integer 0 to 100 for how strongly the trait data supports this pillar. a trait-to-improve is not a deficit; read a low consistency signal as a pattern of how this person moves, not a flaw.
- synthesis: one paragraph written directly to the person as "you". specific to their data, never generic. no therapeutic language. no "journey", "authentic", "growth". make it feel like the constellation already knows them.

also return:
- archetype: the single archetype label that best fits (prefer the provided label when present).
- portrait: a longer, reflective identity portrait — one to two paragraphs written for this person, not a type. this is the "your identity portrait" prose.
- trait_grounding: an array of the concrete traits the synthesis rests on. each item has keyword_tags (normalized trait keywords), insight (one grounded line), and derived_from (the source platform or trait keys).

strict prohibitions — never break these:
- no diagnostic or clinical language; never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology.
- no therapeutic advice.
- plain text only in every string: no markdown, asterisks, underscores, angle brackets, or html.

you MUST return the result by calling the emit_constellation tool. do not answer in plain text.`;

const MANTRA_INSTRUCTIONS = `you write the daily mantra for a person in PHENYX COLLECTIVE, grounded in their constellation.

rules:
- exactly two lines, separated by a single newline.
- present tense, anchoring, written to the person as "you" or in the first person.
- never imperative — no "you should", no commands, no instructions.
- plain text only: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language.

you MUST return the mantra by calling the emit_mantra tool.`;

const FORESIGHT_INSTRUCTIONS = `you write the single "what phenyx foresees" line shown in a person's profile sidebar, grounded in their constellation.

rules:
- one line only.
- future-oriented and present-continuous, evocative, lowercase.
- never prescriptive — no imperative phrasing, no "you should", no instruction.
- plain text only: no markdown, asterisks, underscores, angle brackets, or html.
- no diagnostic or therapeutic language.

tone exemplar (match this register, do not copy it):
"you are at the edge of a convergence you have been moving toward for a long time. something in you is about to have enough room to be fully what it is. you will recognise it when it arrives."

you MUST return the line by calling the emit_foresight tool.`;

@Injectable()
export class SynthesisService {
  private readonly logger = new Logger(SynthesisService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly crisis: CrisisService,
    private readonly voiceStandard: VoiceStandardService,
    private readonly traitProfile: TraitProfileService
  ) {}

  /**
   * PHE-34 — trait-object → constellation synthesis.
   *
   * Crisis pre-flight on the free-text intention runs FIRST: if it fires, no
   * Claude call is made and no constellation_state is written (fail-closed).
   * Otherwise a single Opus tool-use call produces the 4 active pillar scores +
   * syntheses, the portrait, and the trait grounding; the result is applied
   * atomically (advisory-locked, version-bumped, idempotent on trigger_event_id)
   * via the apply_constellation_synthesis RPC, which also appends user_traits
   * rows. Downstream mantra (PHE-36), foresight (PHE-38), and observation
   * (PHE-37) generation are then enqueued.
   */
  async synthesize(userId: string, body: SynthesizeBody) {
    const { trait_object, archetype, intention, trigger_event_id } = body;

    if (trait_object === undefined || trait_object === null) {
      throw new HttpException({ error: "trait_object required" }, 400);
    }

    // Crisis pre-flight — fail closed. PHE-39: regex fast-path + Haiku semantic
    // gate; any timeout/error inside detectCrisis is treated as triggered. On a
    // trigger no Claude synthesis runs and no constellation_state is written; a
    // hashed crisis_events row is persisted best-effort (never the raw text).
    if (intention) {
      const crisis = await this.crisis.detectCrisis(intention);
      if (crisis.triggered) {
        await this.crisis.recordCrisisEvent(userId, intention, crisis.category);
        return {
          isCrisis: true,
          insight: this.crisis.response.insight,
          resources: this.crisis.response.resources,
        };
      }
    }

    const userMessage = `onairos trait object:
${JSON.stringify(trait_object)}

archetype label: ${archetype ?? "not provided — infer from the trait object"}
intention: ${intention?.trim() ? intention.trim() : "not provided"}`;

    let emit: EmitConstellation;
    try {
      emit = await this.callClaudeTool<EmitConstellation>({
        model: SYNTHESIS_MODEL,
        effort: "high",
        maxTokens: 8000,
        taskInstructions: SYNTHESIS_INSTRUCTIONS,
        userMessage,
        tool: EMIT_CONSTELLATION_TOOL,
      });
    } catch (e) {
      this.logger.error(`synthesis claude call failed for ${userId}`, e as Error);
      throw new HttpException({ error: "synthesis failed" }, 500);
    }

    // Structured outputs do not enforce numeric bounds — clamp server-side.
    const pillars = {} as Record<ActivePillar, PillarOutput>;
    for (const p of ACTIVE_PILLARS) {
      const raw = emit.pillars?.[p];
      if (!raw || typeof raw.synthesis !== "string") {
        this.logger.error(`synthesis missing pillar ${p} for ${userId}`);
        throw new HttpException({ error: "synthesis failed" }, 500);
      }
      pillars[p] = {
        score: this.clampScore(raw.score),
        synthesis: this.voiceStandard.sanitizeProse(raw.synthesis),
      };
    }

    const portraitProse = this.voiceStandard.sanitizeProse(emit.portrait ?? "");
    const traitGrounding = Array.isArray(emit.trait_grounding)
      ? emit.trait_grounding.map((t) => ({
          keyword_tags: Array.isArray(t.keyword_tags) ? t.keyword_tags : [],
          insight: this.voiceStandard.sanitizeProse(t.insight ?? ""),
          derived_from: Array.isArray(t.derived_from) ? t.derived_from : [],
        }))
      : [];

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc("apply_constellation_synthesis", {
      p_user_id: userId,
      p_trigger_event_id: trigger_event_id ?? null,
      p_archetype: emit.archetype ?? archetype ?? null,
      // Verbatim trait object — round-trips as the onairos_snapshot value.
      p_onairos_snapshot: trait_object,
      p_origin_score: pillars.origin.score,
      p_origin_synthesis: pillars.origin.synthesis,
      p_emergence_score: pillars.emergence.score,
      p_emergence_synthesis: pillars.emergence.synthesis,
      p_self_creation_score: pillars.self_creation.score,
      p_self_creation_synthesis: pillars.self_creation.synthesis,
      p_convergence_score: pillars.convergence.score,
      p_convergence_synthesis: pillars.convergence.synthesis,
      p_portrait_prose: portraitProse,
      p_traits: traitGrounding,
    });

    if (error) {
      this.logger.error(`apply_constellation_synthesis failed for ${userId}`, error);
      throw new HttpException({ error: "synthesis persist failed" }, 500);
    }

    const row = Array.isArray(data) ? data[0] : data;
    const version: number = row?.out_version;
    const idempotent: boolean = row?.out_idempotent ?? false;

    // A replay of the same trigger already produced this version — do not
    // regenerate downstream prose or re-enqueue jobs.
    if (!idempotent) {
      this.enqueue("mantra", () => this.generateMantra(userId, version));
      this.enqueue("foresight", () => this.generateForesight(userId, version));
      // PHE-24 — this synthesize() call IS the Onairos-analysis-complete seam (the
      // Onairos trait object arrives here). Generate the trait-level grounding rows
      // from the same snapshot, tagged with the new version. Runs as its own pass
      // and dedups against existing insights, so it never re-stores the trait
      // grounding the apply RPC already wrote for this constellation.
      this.enqueue("trait-profile", () =>
        this.traitProfile.generateTraitProfile(userId, trait_object, version)
      );
      // PHE-37 observation generation is built separately; this is the enqueue
      // seam it will consume. PHE-24 attaches the trait-grounding block here so the
      // observation generator has it ready as grounding once it lands.
      this.enqueue("observation", async () => {
        const grounding = await this.traitProfile.buildGroundingBlock(userId);
        this.logger.log(
          `observation generation enqueued for ${userId} v${version} (trait grounding: ${grounding ? "attached" : "none"})`
        );
      });
    }

    return {
      isCrisis: false,
      version,
      idempotent,
      archetype: emit.archetype ?? archetype ?? null,
      pillars,
      portrait: portraitProse,
    };
  }

  /**
   * PHE-36 — generate the 2-line daily mantra for the given version and store it
   * on constellation_state.mantra. Stale-guarded: the write only lands while the
   * row is still at `version`, so a mantra for an old version can never overwrite
   * a newer one. Returns the mantra (or null if the version moved on).
   */
  async generateMantra(userId: string, version: number): Promise<string | null> {
    const summary = await this.loadConstellationSummary(userId, version);
    if (!summary) return null;

    let mantra: string;
    try {
      const out = await this.callClaudeTool<{ mantra: string }>({
        model: PROSE_MODEL,
        effort: "low",
        maxTokens: 200,
        taskInstructions: MANTRA_INSTRUCTIONS,
        userMessage: summary,
        tool: EMIT_MANTRA_TOOL,
      });
      // Enforce the 2-line contract defensively (the schema can't).
      mantra = this.voiceStandard
        .sanitizeProse(out.mantra ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join("\n");
    } catch (e) {
      this.logger.error(`mantra generation failed for ${userId}`, e as Error);
      return null;
    }

    if (!mantra) return null;

    const supabase = this.supabaseService.getClient();
    // Stale-write guard: only write if the row is still at this version.
    const { error } = await supabase
      .from("constellation_state")
      .update({ mantra })
      .eq("user_id", userId)
      .eq("version", version);
    if (error) {
      this.logger.error(`mantra persist failed for ${userId}`, error);
      return null;
    }
    return mantra;
  }

  /**
   * PHE-38 — generate the single "what phenyx foresees" line for the given
   * version and store it on constellation_state.foresight. Stale-guarded like
   * the mantra: skips the write if the version has advanced.
   */
  async generateForesight(
    userId: string,
    version: number
  ): Promise<string | null> {
    const summary = await this.loadConstellationSummary(userId, version);
    if (!summary) return null;

    let foresight: string;
    try {
      const out = await this.callClaudeTool<{ foresight: string }>({
        model: PROSE_MODEL,
        effort: "low",
        maxTokens: 200,
        taskInstructions: FORESIGHT_INSTRUCTIONS,
        userMessage: summary,
        tool: EMIT_FORESIGHT_TOOL,
      });
      foresight = this.voiceStandard
        .sanitizeProse(out.foresight ?? "")
        .replace(/\s*\n\s*/g, " ") // one line
        .trim();
    } catch (e) {
      this.logger.error(`foresight generation failed for ${userId}`, e as Error);
      return null;
    }

    if (!foresight) return null;

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from("constellation_state")
      .update({ foresight })
      .eq("user_id", userId)
      .eq("version", version);
    if (error) {
      this.logger.error(`foresight persist failed for ${userId}`, error);
      return null;
    }
    return foresight;
  }

  /**
   * PHE-36 — Daily-tab mantra read. Returns the cached mantra for the current
   * version without a Claude call when present; lazily regenerates only when it
   * is null for the current version (the RPC nulls it on every re-synthesis, so
   * null unambiguously means "needs regeneration").
   */
  async getDailyMantra(
    userId: string
  ): Promise<{ mantra: string | null; version: number | null }> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("constellation_state")
      .select("version, mantra")
      .eq("user_id", userId)
      .single();

    if (!data) return { mantra: null, version: null };
    if (data.mantra) return { mantra: data.mantra, version: data.version };

    const mantra = await this.generateMantra(userId, data.version);
    return { mantra, version: data.version };
  }

  /**
   * PHE-38 — manual foresight refresh keyed to the current version. Regenerates
   * and overwrites the line for whatever version is current now.
   */
  async refreshForesight(
    userId: string
  ): Promise<{ foresight: string | null; version: number | null }> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("constellation_state")
      .select("version")
      .eq("user_id", userId)
      .single();

    if (!data) return { foresight: null, version: null };
    const foresight = await this.generateForesight(userId, data.version);
    return { foresight, version: data.version };
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  /**
   * Build the volatile constellation summary that grounds the mantra/foresight
   * prompts. Reads the row at `version`; returns null if the version has moved on
   * (the caller's work is stale and must be skipped).
   */
  private async loadConstellationSummary(
    userId: string,
    version: number
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("constellation_state")
      .select(
        "version, archetype, origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis, portrait"
      )
      .eq("user_id", userId)
      .single();

    if (!data || data.version !== version) return null;

    const portraitProse =
      data.portrait && typeof data.portrait === "object"
        ? (data.portrait as { prose?: string }).prose ?? ""
        : "";

    return `archetype: ${data.archetype ?? "unnamed"}

origin: ${data.origin_synthesis ?? ""}
emergence: ${data.emergence_synthesis ?? ""}
self-creation: ${data.self_creation_synthesis ?? ""}
convergence: ${data.convergence_synthesis ?? ""}

identity portrait: ${portraitProse}`;
  }

  /**
   * One structured Claude tool-use call over raw fetch (the transport already in
   * use in this service). The system array is [Voice Standard, task instructions]
   * with a cache breakpoint on the last block, so tools + the whole system prefix
   * are prompt-cached and shared across users; the volatile per-user grounding
   * stays in the user message, after the cached prefix. Returns the parsed input
   * of the forced tool.
   */
  private async callClaudeTool<T>(opts: {
    model: string;
    effort: "low" | "medium" | "high" | "max";
    maxTokens: number;
    taskInstructions: string;
    userMessage: string;
    tool: ClaudeTool;
  }): Promise<T> {
    const system = await this.voiceStandard.buildSystemBlocks(
      opts.taskInstructions
    );
    // Extend the cache breakpoint to cover the task instructions too, so the
    // entire stable prefix (Voice Standard + instructions + tools) is one cache
    // read. Verify with usage.cache_read_input_tokens on repeat calls.
    const lastBlock: SystemBlock = system[system.length - 1];
    lastBlock.cache_control = { type: "ephemeral" };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.get<string>("ANTHROPIC_API_KEY") as string,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        thinking: { type: "adaptive" },
        output_config: { effort: opts.effort },
        system,
        tools: [opts.tool],
        messages: [{ role: "user", content: opts.userMessage }],
      }),
    });

    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    }

    const claude: any = await res.json();
    if (claude?.usage) {
      this.logger.debug(
        `[${opts.tool.name}] cache_read=${claude.usage.cache_read_input_tokens ?? 0} cache_write=${claude.usage.cache_creation_input_tokens ?? 0} input=${claude.usage.input_tokens ?? 0}`
      );
    }

    const toolUse = Array.isArray(claude?.content)
      ? claude.content.find(
          (b: any) => b?.type === "tool_use" && b?.name === opts.tool.name
        )
      : undefined;
    if (!toolUse?.input) {
      throw new Error(`no ${opts.tool.name} tool_use block in response`);
    }
    return toolUse.input as T;
  }

  private clampScore(n: unknown): number {
    const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  /**
   * Fire-and-forget background job. Synthesis is a background process — a failed
   * downstream generation must never block the caller or the dashboard, so we log
   * loudly and move on. This is the "enqueue" seam; a real queue can replace it
   * without touching call sites.
   */
  private enqueue(label: string, fn: () => Promise<unknown>): void {
    void Promise.resolve()
      .then(fn)
      .catch((e) =>
        this.logger.error(`enqueued job "${label}" failed`, e as Error)
      );
  }
}
