import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";
import { CrisisService } from "../synthesis/crisis.service";
import { TraitProfileService } from "../synthesis/trait-profile.service";
import type { Pillar } from "../types/database";
import { inferPillarFromKeywords } from "./pillar-keyword.map";
import {
  AT_LIMIT_MESSAGE,
  TokenBudgetService,
  type WeeklyAllowance,
} from "./token-budget.service";
import { HONEST_LIMITS_OPENER, SPARSE_NUDGE } from "./polaris-copy";

// Sonnet-tier for chat latency (reality check: claude-sonnet-4-6, NOT an older id).
const POLARIS_MODEL = "claude-sonnet-4-6";
// A few plain-text sentences in voice (decide may add a three-step plan); a
// small ceiling keeps first-token latency low.
const MAX_TOKENS = 600;
/** Longest opening context (a moment or a discovery) kept on a conversation. */
const CONTEXT_LIMIT = 1200;

/** PHE-123: every conversation runs in one of three modes (spec doc 4). */
export const POLARIS_MODES = ["clarify", "understand", "decide"] as const;
export type PolarisMode = (typeof POLARIS_MODES)[number];

/** A known mode, or clarify when the client sent none (or something else). */
export function parseMode(value: unknown): PolarisMode {
  return POLARIS_MODES.includes(value as PolarisMode) ? (value as PolarisMode) : "clarify";
}


const CONSTELLATION_SYNTHESIS_COLUMNS: Record<Pillar, string> = {
  origin: "origin_synthesis",
  emergence: "emergence_synthesis",
  self_creation: "self_creation_synthesis",
  convergence: "convergence_synthesis",
  becoming: "becoming_synthesis",
  recognition: "recognition_synthesis",
  transcendence: "transcendence_synthesis",
};

const CONSTELLATION_SCORE_COLUMNS: Record<Pillar, string> = {
  origin: "origin_score",
  emergence: "emergence_score",
  self_creation: "self_creation_score",
  convergence: "convergence_score",
  becoming: "becoming_score",
  recognition: "recognition_score",
  transcendence: "transcendence_score",
};

const ALL_PILLARS: Pillar[] = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
];

interface AskBody {
  thread_id?: string;
  question?: string;
  /** Mode for a new conversation; an existing one keeps its own. */
  mode?: string;
  /** What the conversation was opened from (a moment or a discovery). */
  context?: string;
}

/** The conversation an ask belongs to, with the mode and context it was opened with. */
interface Conversation {
  id: string;
  mode: PolarisMode;
  context: string | null;
}

export interface PolarisUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  total_tokens: number;
}

/** One PREVIOUS CONVERSATIONS row. `preview` is the (decrypted) first user
 * message, truncated, so the list reads as something more than a bare date. */
export interface PolarisThreadSummary {
  id: string;
  title: string | null;
  preview: string | null;
  mode: PolarisMode | null;
  created_at: string;
  updated_at: string;
}

/** One starter on polaris home: a question in one mode, from one of the person's top pillars. */
export interface PolarisStarter {
  mode: PolarisMode;
  text: string;
  pillar_tag: Pillar;
}

/** PHE-129: a plan card's state, keyed by the reply it came from: the checked steps and the save. */
export interface PolarisPlanState {
  message_id: string;
  done: number[];
  saved: boolean;
}

/** A saved plan for "your conversations": its reply decrypted, for the client to parse into steps. */
export interface PolarisSavedPlan extends PolarisPlanState {
  thread_id: string;
  body: string;
  saved_at: string;
}

/** ponytail: plans have at most a handful of steps; indexes past this are dropped. */
const PLAN_STEPS_MAX = 12;
const SAVED_PLANS_MAX = 20;

/** Checked step indexes from a request: whole numbers in range, once each, in order. */
export function planSteps(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const steps = value.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < PLAN_STEPS_MAX);
  return [...new Set(steps)].sort((a, b) => a - b);
}

/** A single turn returned when a thread is reloaded (body decrypted for render). */
export interface PolarisMessageView {
  id: string;
  role: "user" | "assistant";
  body: string;
  pillar_tag: Pillar | null;
  created_at: string;
}

@Injectable()
export class PolarisService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly encryption: EncryptionService,
    private readonly voiceStandard: VoiceStandardService,
    private readonly crisis: CrisisService,
    private readonly tokenBudget: TokenBudgetService,
    private readonly traitProfile: TraitProfileService
  ) {}

  async ask(userId: string, body: AskBody) {
    const question = body.question?.trim();
    if (!question) {
      throw new HttpException({ error: "question required" }, 400);
    }

    const supabase = this.supabaseService.getClient();

    // (1) Crisis pre-flight (PHE-39) over the question BEFORE the allowance gate or
    // any Claude answer call — a crisis turn never counts against the weekly
    // question allowance. The async gate fails closed (any timeout/HTTP/parse/
    // missing-key error → triggered).
    const crisisResult = await this.crisis.detectCrisis(question);
    if (crisisResult.triggered) {
      // Best-effort, never throws — persists a sha256 hash of the text only.
      await this.crisis.recordCrisisEvent(userId, question, crisisResult.category);
      const { id: threadId, mode } = await this.resolveConversation(userId, body);
      await this.persistMessage(userId, threadId, "user", question, null, 0);
      const crisisAnswer = this.voiceStandard.sanitizeProse(
        this.crisis.response.insight
      );
      const aiMessageId = await this.persistMessage(
        userId,
        threadId,
        "assistant",
        crisisAnswer,
        null,
        0
      );
      await this.touchConversation(threadId);
      return {
        answer: crisisAnswer,
        pillar_tag: null,
        thread_id: threadId,
        mode,
        message_id: aiMessageId,
        usage: this.emptyUsage(),
        is_crisis: true,
        resources: this.crisis.response.resources,
      };
    }

    // (2) Allowance gate (PHE-27 / PHE-94) — short-circuit once the week's question
    // allowance is used up (no Claude call, no debit). The limit (3 free / 40 full)
    // is derived from the live tier at check time; there is no separate free
    // lock-out — free simply has a smaller allowance.
    const allowance = await this.tokenBudget.check(userId);
    if (allowance.limit_reached) {
      const { id: threadId, mode } = await this.resolveConversation(userId, body);
      return {
        answer: null,
        pillar_tag: null,
        thread_id: threadId,
        mode,
        message_id: null,
        usage: this.emptyUsage(),
        limit_reached: true,
        message: AT_LIMIT_MESSAGE,
        upgrade_cta: true,
        allowance,
      };
    }

    // The conversation carries the mode (and any opening context) for every turn.
    const conversation = await this.resolveConversation(userId, body);

    // (3a) Route to a pillar via the verbatim keyword map; fall back to the user's
    // top-scoring active pillar from constellation_state.
    // ---- user_traits + constellation grounding read (reconciliation anchor) ----
    const { data: constellation } = await supabase
      .from("constellation_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let pillar = inferPillarFromKeywords(question);
    if (!pillar) {
      pillar = topScoringPillar(constellation) ?? "origin";
    }

    // (3b) Assemble the grounding block: routed pillar's synthesis + matching trait
    // insights + most recent observations. Trait insights come from PHE-24's ranked
    // `inferTraitInsight`; the direct `user_traits` read is kept as a fallback for
    // when that returns no match (empty is handled gracefully either way).
    const synthesis: string | null =
      (constellation?.[CONSTELLATION_SYNTHESIS_COLUMNS[pillar]] as
        | string
        | null) ?? null;

    const [traitMatches, { data: traitRows }, { data: observationRows }] =
      await Promise.all([
        this.traitProfile.inferTraitInsight(question, userId),
        supabase
          .from("user_traits")
          .select("insight, keyword_tags")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("observations")
          .select("body, pillar, surfaced_at")
          .eq("user_id", userId)
          .order("surfaced_at", { ascending: false })
          .limit(5),
      ]);

    // Only `insight` is renderable — keywordTags/score are internal and never
    // reach the grounding block or the client. Fall back to the direct read's
    // keyword match when PHE-24 surfaces no ranked insight.
    const traitInsights =
      traitMatches.length > 0
        ? traitMatches.map((m) => m.insight)
        : matchTraitInsights(traitRows ?? [], question, pillar);
    const observations = (observationRows ?? [])
      .map((o) => (o.body as string | null)?.trim())
      .filter((b): b is string => !!b);
    const nearestObservation = observations[0] ?? null;

    const synthesisText = synthesis?.trim() ?? "";
    const sparse = !synthesisText && observations.length === 0;

    const groundingBlock = buildGroundingBlock({
      pillar,
      synthesis: synthesisText,
      traitInsights,
      observations,
      nearestObservation,
      context: conversation.context,
    });

    // (3c) One real-time Claude call. Voice Standard renders FIRST (byte-stable →
    // cached across every request); the static task instructions and the per-user
    // grounding block follow, with a second cache breakpoint on the grounding block
    // so a warm same-session prefix reads from cache. The volatile question stays in
    // the user message, after the last breakpoint.
    const systemBlocks = await this.voiceStandard.buildSystemBlocks(
      POLARIS_TASK_INSTRUCTIONS
    );
    // The mode block is one of three fixed texts, so it stays in the cached prefix.
    systemBlocks.push({ type: "text", text: MODE_INSTRUCTIONS[conversation.mode] });
    systemBlocks.push({
      type: "text",
      text: groundingBlock,
      cache_control: { type: "ephemeral" },
    });

    let rawAnswer: string;
    let usage: PolarisUsage;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.get<string>("ANTHROPIC_API_KEY") as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: POLARIS_MODEL,
          max_tokens: MAX_TOKENS,
          system: systemBlocks,
          messages: [{ role: "user", content: question }],
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
        }),
      });
      const claude: any = await res.json();
      if (!res.ok) {
        throw new Error(
          claude?.error?.message ?? `anthropic ${res.status}`
        );
      }
      const textBlock = Array.isArray(claude.content)
        ? claude.content.find((b: any) => b.type === "text")
        : null;
      rawAnswer = (textBlock?.text ?? "").trim();
      if (!rawAnswer) throw new Error("empty answer");
      usage = normalizeUsage(claude.usage);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("polaris ask error:", e);
      throw new HttpException({ error: "polaris failed" }, 500);
    }

    // (8) Plain-text guard: strip any markup the model emitted (HTML, **, _, angle
    // brackets). Then append the verbatim sparse nudge when the constellation is thin.
    let answer = this.voiceStandard.sanitizeProse(rawAnswer);
    // The honest-limits line is fixed copy around an observation that was checked
    // when it was generated, so only the model's own replies get the voice check.
    // Re-running sanitizeProse on clean text changes nothing; it only logs.
    if (!answer.startsWith(HONEST_LIMITS_OPENER)) {
      this.voiceStandard.sanitizeProse(answer, "polaris");
    }
    if (sparse) {
      answer = `${answer} ${SPARSE_NUDGE}`.trim();
    }

    // (9) Persist the conversation + encrypted user/ai messages with the routed
    // pillar tag (the Anthropic token usage is logged on each message), then (10)
    // debit the weekly meter by ONE question. Token usage is reported to the client
    // but never drives the meter (PHE-94).
    const threadId = conversation.id;
    await this.persistMessage(
      userId,
      threadId,
      "user",
      question,
      pillar,
      usage.input_tokens
    );
    const aiMessageId = await this.persistMessage(
      userId,
      threadId,
      "assistant",
      answer,
      pillar,
      usage.output_tokens
    );
    await this.touchConversation(threadId);
    const debited = await this.tokenBudget.debit(
      userId,
      allowance.week,
      allowance.limit
    );

    return {
      answer,
      pillar_tag: pillar,
      thread_id: threadId,
      mode: conversation.mode,
      message_id: aiMessageId,
      usage,
      sparse,
      allowance: debited,
    };
  }

  // ---- chat surface reads (PHE-23) -----------------------------------------

  /**
   * Idle-view payload: past threads (most-recent first) with their mode, one
   * starter question per mode from the top-scoring pillars, and the live
   * weekly question allowance for the allowance badge.
   * Ownership is enforced by the `user_id` filter (service-role client bypasses
   * RLS). `preview` decrypts each thread's first user message.
   */
  async listThreads(
    userId: string
  ): Promise<{
    threads: PolarisThreadSummary[];
    starters: PolarisStarter[];
    allowance: WeeklyAllowance;
    plans: PolarisSavedPlan[];
  }> {
    const supabase = this.supabaseService.getClient();

    const [{ data: conversations }, { data: constellation }, allowance, plans] =
      await Promise.all([
        supabase
          .from("polaris_conversations")
          .select("id, title, mode, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("constellation_state")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        this.tokenBudget.check(userId),
        this.savedPlans(userId),
      ]);

    const rows = conversations ?? [];
    const threads = await Promise.all(
      rows.map(async (row) => ({
        id: row.id as string,
        title: (row.title as string | null) ?? null,
        preview: await this.firstMessagePreview(userId, row.id as string),
        mode: (row.mode as PolarisMode | null) ?? null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      }))
    );

    return {
      threads,
      starters: computeStarters(constellation),
      allowance,
      plans,
    };
  }

  /**
   * PHE-129: check a plan's steps or save it. The plan is keyed by the polaris
   * reply it came from, which must be the caller's; `done` replaces the checked
   * steps and `saved` sets or clears the save, each only when sent.
   */
  async setPlan(
    userId: string,
    messageId: string,
    patch: { done?: unknown; saved?: unknown }
  ): Promise<PolarisPlanState> {
    const supabase = this.supabaseService.getClient();
    const { data: message } = await supabase
      .from("polaris_messages")
      .select("id, user_id, role")
      .eq("id", messageId)
      .maybeSingle();
    if (!message || message.user_id !== userId || message.role !== "assistant") {
      throw new HttpException({ error: "plan not found" }, 404);
    }
    const { data: existing } = await supabase
      .from("polaris_plans")
      .select("done, saved_at")
      .eq("message_id", messageId)
      .maybeSingle();
    const done = patch.done === undefined ? planSteps(existing?.done) : planSteps(patch.done);
    const savedAt =
      typeof patch.saved !== "boolean"
        ? ((existing?.saved_at as string | null) ?? null)
        : patch.saved
          ? ((existing?.saved_at as string | null) ?? new Date().toISOString())
          : null;
    const { error } = await supabase.from("polaris_plans").upsert({
      message_id: messageId,
      user_id: userId,
      done,
      saved_at: savedAt,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new HttpException({ error: "could not save the plan" }, 500);
    return { message_id: messageId, done, saved: savedAt !== null };
  }

  /** Saved plans, newest first, each with its reply decrypted. */
  private async savedPlans(userId: string): Promise<PolarisSavedPlan[]> {
    const supabase = this.supabaseService.getClient();
    const { data: plans } = await supabase
      .from("polaris_plans")
      .select("message_id, done, saved_at")
      .eq("user_id", userId)
      .not("saved_at", "is", null)
      .order("saved_at", { ascending: false })
      .limit(SAVED_PLANS_MAX);
    if (!plans?.length) return [];
    const { data: messages } = await supabase
      .from("polaris_messages")
      .select("id, conversation_id, body")
      .eq("user_id", userId)
      .in("id", plans.map((p) => p.message_id as string));
    const byId = new Map((messages ?? []).map((m) => [m.id as string, m]));
    return plans.flatMap((p) => {
      const m = byId.get(p.message_id as string);
      return m
        ? [
            {
              message_id: p.message_id as string,
              thread_id: m.conversation_id as string,
              body: this.encryption.decrypt(m.body as string),
              done: planSteps(p.done),
              saved: true,
              saved_at: p.saved_at as string,
            },
          ]
        : [];
    });
  }

  /**
   * Reload a single thread's messages (oldest-first) with each `body` decrypted
   * for plain-text render. Ownership-checked exactly like `ask`: a thread the
   * caller does not own (or that does not exist) is a 404 — never another user's
   * conversation.
   */
  async getThread(
    userId: string,
    threadId: string
  ): Promise<{
    thread_id: string;
    mode: PolarisMode | null;
    messages: PolarisMessageView[];
    plans: PolarisPlanState[];
  }> {
    const supabase = this.supabaseService.getClient();

    const { data: conversation } = await supabase
      .from("polaris_conversations")
      .select("id, user_id, mode")
      .eq("id", threadId)
      .maybeSingle();
    if (!conversation || conversation.user_id !== userId) {
      throw new HttpException({ error: "thread not found" }, 404);
    }

    const { data: messageRows } = await supabase
      .from("polaris_messages")
      .select("id, role, body, pillar_tag, created_at")
      .eq("conversation_id", threadId)
      .order("created_at", { ascending: true });

    const messages: PolarisMessageView[] = (messageRows ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as "user" | "assistant",
      body: this.encryption.decrypt(m.body as string),
      pillar_tag: (m.pillar_tag as Pillar | null) ?? null,
      created_at: m.created_at as string,
    }));

    const replies = messages.filter((m) => m.role === "assistant").map((m) => m.id);
    const { data: planRows } = replies.length
      ? await supabase
          .from("polaris_plans")
          .select("message_id, done, saved_at")
          .eq("user_id", userId)
          .in("message_id", replies)
      : { data: [] };

    return {
      thread_id: threadId,
      mode: (conversation.mode as PolarisMode | null) ?? null,
      messages,
      plans: (planRows ?? []).map((p) => ({
        message_id: p.message_id as string,
        done: planSteps(p.done),
        saved: p.saved_at !== null,
      })),
    };
  }

  /** Decrypt the earliest user message of a thread, truncated for the list
   * preview. Null when the thread has no user turn yet. */
  private async firstMessagePreview(
    userId: string,
    conversationId: string
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("polaris_messages")
      .select("body")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data?.body) return null;
    const text = this.encryption.decrypt(data.body as string).trim();
    return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text;
  }

  // ---- persistence helpers -------------------------------------------------

  /** Return the caller's conversation, creating one when `thread_id` is absent or
   * not owned by the user (service-role client bypasses RLS, so ownership is checked
   * here). A new conversation takes the requested mode and opening context (the
   * context is encrypted at rest, like the messages); an existing one keeps its own. */
  private async resolveConversation(
    userId: string,
    body: AskBody
  ): Promise<Conversation> {
    const supabase = this.supabaseService.getClient();
    if (body.thread_id) {
      const { data } = await supabase
        .from("polaris_conversations")
        .select("id, user_id, mode, context")
        .eq("id", body.thread_id)
        .maybeSingle();
      if (data && data.user_id === userId) {
        return {
          id: data.id as string,
          mode: parseMode(data.mode),
          context: data.context ? this.encryption.decrypt(data.context as string) : null,
        };
      }
    }
    const mode = parseMode(body.mode);
    const context = body.context?.trim().slice(0, CONTEXT_LIMIT) || null;
    const { data, error } = await supabase
      .from("polaris_conversations")
      .insert({
        user_id: userId,
        mode,
        context: context ? this.encryption.encrypt(context) : null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new HttpException({ error: "could not open conversation" }, 500);
    }
    return { id: data.id as string, mode, context };
  }

  /** Append one polaris_messages turn (append-only table). `body` is encrypted at
   * rest with the shared EncryptionService. Returns the new message id. */
  private async persistMessage(
    userId: string,
    conversationId: string,
    role: "user" | "assistant",
    body: string,
    pillarTag: Pillar | null,
    tokenCount: number
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("polaris_messages")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        body: this.encryption.encrypt(body),
        pillar_tag: pillarTag,
        token_count: tokenCount,
      })
      .select("id")
      .single();
    return (data?.id as string) ?? null;
  }

  /** Bump the conversation's updated_at (the touch trigger sets the value). */
  private async touchConversation(conversationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from("polaris_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  private emptyUsage(): PolarisUsage {
    return {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      total_tokens: 0,
    };
  }
}

// ---- pure helpers (no DI; unit-testable) -----------------------------------

// One starter question per mode for each pillar (spec doc 4), lowercase and in
// voice, written as the person would ask it. Polaris home shows one per mode,
// each drawn from a different one of the person's top pillars.
const STARTER_QUESTIONS: Record<PolarisMode, Record<Pillar, string>> = {
  clarify: {
    origin: "what from where i started still shapes the questions i ask now?",
    emergence: "why did the things i chose on my own matter so much to me?",
    self_creation: "what am i really trying to build when i make things?",
    convergence: "why do my separate interests keep pulling toward each other?",
    becoming: "what is actually changing for me right now?",
    recognition: "what are people seeing in me that i haven’t named yet?",
    transcendence: "what am i reaching for underneath my plans?",
  },
  understand: {
    origin: "what pulled me toward the things i started with?",
    emergence: "what were people noticing about me before i noticed it myself?",
    self_creation: "what does the way i make things keep returning to?",
    convergence: "where do my different worlds actually meet?",
    becoming: "what keeps showing up in how i spend my time lately?",
    recognition: "how do people actually experience me?",
    transcendence: "where is all of this quietly heading?",
  },
  decide: {
    origin: "what from my earliest interests is worth bringing back now?",
    emergence: "which of the things i chose for myself should get more room?",
    self_creation: "what should i make next, given what i keep returning to?",
    convergence: "how could i bring my separate worlds into one project?",
    becoming: "what is one next step that fits how i’m changing?",
    recognition: "how do i build on what people are starting to see?",
    transcendence: "what would a first step toward where this is heading look like?",
  },
};

// Starters when the constellation has no scores yet.
const DEFAULT_STARTER_PILLARS: Pillar[] = ["origin", "emergence", "self_creation"];

/**
 * One starter per mode, in mode order, each from a different one of the
 * person's three top-scoring pillars (padded with the default pillars when
 * scores are thin), so the three cover different parts of their life.
 */
export function computeStarters(
  constellation: Record<string, unknown> | null | undefined
): PolarisStarter[] {
  const chosen: Pillar[] = topScoringPillars(constellation, POLARIS_MODES.length);
  for (const pillar of DEFAULT_STARTER_PILLARS) {
    if (chosen.length >= POLARIS_MODES.length) break;
    if (!chosen.includes(pillar)) chosen.push(pillar);
  }
  return POLARIS_MODES.map((mode, i) => ({
    mode,
    text: STARTER_QUESTIONS[mode][chosen[i]],
    pillar_tag: chosen[i],
  }));
}

/** Top-N pillars by constellation score (desc). Empty when no numeric scores. */
function topScoringPillars(
  constellation: Record<string, unknown> | null | undefined,
  n: number
): Pillar[] {
  if (!constellation) return [];
  const scored: Array<{ pillar: Pillar; score: number }> = [];
  for (const pillar of ALL_PILLARS) {
    const score = constellation[CONSTELLATION_SCORE_COLUMNS[pillar]];
    if (typeof score === "number") scored.push({ pillar, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s) => s.pillar);
}

/** Highest-scoring pillar from a constellation_state row, or null if no scores. */
function topScoringPillar(
  constellation: Record<string, unknown> | null | undefined
): Pillar | null {
  if (!constellation) return null;
  let best: Pillar | null = null;
  let bestScore = -1;
  for (const pillar of ALL_PILLARS) {
    const score = constellation[CONSTELLATION_SCORE_COLUMNS[pillar]];
    if (typeof score === "number" && score > bestScore) {
      bestScore = score;
      best = pillar;
    }
  }
  return best;
}

/** Trait insights whose keyword tags intersect the question's words or the routed
 * pillar name (PHE-24 `inferTraitInsight`-style). Empty until PHE-24 populates the table. */
function matchTraitInsights(
  rows: Array<{ insight: string | null; keyword_tags: string[] | null }>,
  question: string,
  pillar: Pillar
): string[] {
  const q = question.toLowerCase();
  const out: string[] = [];
  for (const row of rows) {
    if (!row.insight) continue;
    const tags = row.keyword_tags ?? [];
    const hit =
      tags.length === 0
        ? false
        : tags.some(
            (t) => q.includes(t.toLowerCase()) || t.toLowerCase() === pillar
          );
    if (hit) out.push(row.insight.trim());
  }
  return out;
}

/** Static, byte-stable Polaris task instructions. Sits after the cached Voice
 * Standard and before the grounding block breakpoint, so it caches as part of the
 * warm prefix. Voice/tone rules come from the Voice Standard block itself. */
const POLARIS_TASK_INSTRUCTIONS = `you are polaris, the answer engine for PHENYX. a person asks you a question about themselves, and you answer from the grounding you are given.

rules, never break these:
- answer in plain text only. no markdown, no html, no asterisks, no underscores, no angle brackets.
- two to three sentences, personal first, in plain language.
- ground every answer only in the constellation grounding block provided below. never invent a trait, pattern, platform, or signal you were not given.
- if the supplied grounding does not support an answer, do not guess. return the honest-limits line exactly as instructed in the grounding block.
- no diagnostic or clinical language. no advice framed as therapy.
- never ask who the person is. you already have their constellation, so start from the grounding and skip introductions.`;

/** One block per mode, after the task instructions. Fixed text, so each caches. */
const MODE_INSTRUCTIONS: Record<PolarisMode, string> = {
  clarify: `mode: clarify. the person wants to untangle a question. help them see what they are really asking: name the tension you can see in their grounding, in two or three sentences, then end with one short question that helps them say it more precisely.`,
  understand: `mode: understand. the person wants to explore a recurring pattern. follow it to its source in the grounding: where it began, what keeps reinforcing it and where it shows now, naming the dates and platforms you were given. keep it to a few sentences and end with one short question back to them.`,
  decide: `mode: decide. the person wants to choose a direction and shape next steps. weigh the options against what their grounding shows about when they do their best work and what they keep returning to. you may lay out a numbered plan of at most four short steps, each on its own line, introduced by one short line that names it and ends in a colon (for example "a four-week shape:"). a step may open with when it happens and a colon, such as "week one: choose one room and one sound to work with.". end with one short question back to them.`,
};

/** Build the per-user grounding block that anchors the Claude call. Byte-stable for a
 * given (pillar, synthesis, traits, observations) so it caches across identical
 * same-session questions. Carries the verbatim honest-limits instruction. */
function buildGroundingBlock(input: {
  pillar: Pillar;
  synthesis: string;
  traitInsights: string[];
  observations: string[];
  nearestObservation: string | null;
  /** The moment or discovery the conversation was opened from, if any. */
  context?: string | null;
}): string {
  const { pillar, synthesis, traitInsights, observations, nearestObservation, context } =
    input;

  const lines: string[] = [];
  lines.push("CONSTELLATION GROUNDING");
  lines.push(`routed pillar: ${pillar}`);
  lines.push("");
  lines.push("pillar synthesis:");
  lines.push(synthesis ? synthesis : "none yet");
  lines.push("");
  lines.push("matching trait insights:");
  lines.push(
    traitInsights.length
      ? traitInsights.map((t) => `- ${t}`).join("\n")
      : "none yet"
  );
  lines.push("");
  lines.push("recent observations:");
  lines.push(
    observations.length
      ? observations.map((o) => `- ${o}`).join("\n")
      : "none yet"
  );
  if (context) {
    lines.push("");
    lines.push("the person opened this conversation from:");
    lines.push(context);
  }
  lines.push("");
  lines.push("honest-limits rule:");
  if (nearestObservation) {
    lines.push(
      `if the material above does not support an answer, respond with exactly this line and nothing else: "${HONEST_LIMITS_OPENER} closest thing it’s noticed lately: ${nearestObservation}"`
    );
  } else {
    lines.push(
      `if the material above does not support an answer, say plainly that polaris does not have a clear read on this yet. do not invent signal.`
    );
  }
  return lines.join("\n");
}

/** Normalize Anthropic usage into the shape we report (never debited — the
 * weekly meter counts questions, PHE-94). total_tokens sums
 * input + output + cache read + cache creation (ticket §9). */
function normalizeUsage(usage: any): PolarisUsage {
  const input_tokens = Number(usage?.input_tokens ?? 0);
  const output_tokens = Number(usage?.output_tokens ?? 0);
  const cache_read_input_tokens = Number(usage?.cache_read_input_tokens ?? 0);
  const cache_creation_input_tokens = Number(
    usage?.cache_creation_input_tokens ?? 0
  );
  return {
    input_tokens,
    output_tokens,
    cache_read_input_tokens,
    cache_creation_input_tokens,
    total_tokens:
      input_tokens +
      output_tokens +
      cache_read_input_tokens +
      cache_creation_input_tokens,
  };
}
