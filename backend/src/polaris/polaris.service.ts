import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";
import { CrisisService } from "../synthesis/crisis.service";
import type { Pillar } from "../types/database";
import { inferPillarFromKeywords } from "./pillar-keyword.map";

// Sonnet-tier for chat latency (reality check: claude-sonnet-4-6, NOT an older id).
const POLARIS_MODEL = "claude-sonnet-4-6";
// 2-3 plain-text sentences in voice; small ceiling keeps first-token latency low.
const MAX_TOKENS = 400;

// Verbatim honest-limits + sparse copy (ticket §7). The honest-limits line is
// produced by the model (instructed in the grounding block); the sparse nudge is
// appended server-side so its wording is guaranteed byte-exact (AC3).
const SPARSE_NUDGE =
  "the more you connect, the clearer this gets. ask again as your constellation fills in.";

// Provisional weekly token budget by access tier. PHE-27 owns the real budget/tier
// policy + upgrade CTA; this is a minimal self-contained gate so the endpoint can
// short-circuit before a Claude call and debit actuals after. Numbers are placeholders.
// TODO(PHE-27): replace with the shipped budget policy + graceful upgrade CTA.
const WEEKLY_TOKEN_BUDGET_FREE = 50_000;
const WEEKLY_TOKEN_BUDGET_FULL = 500_000;

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
  created_at: string;
  updated_at: string;
}

/** One BASED ON WHAT WE SEE suggestion: a question + the pillar it grounds on. */
export interface SuggestedQuestion {
  text: string;
  pillar_tag: Pillar;
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
    private readonly crisis: CrisisService
  ) {}

  async ask(userId: string, body: AskBody) {
    const question = body.question?.trim();
    if (!question) {
      throw new HttpException({ error: "question required" }, 400);
    }

    const supabase = this.supabaseService.getClient();

    // (1) Crisis pre-flight over the question BEFORE any Claude call or token debit.
    // TODO(PHE-39): swap to async detectCrisis once the async chain is merged.
    if (this.crisis.detect(question)) {
      const threadId = await this.resolveConversation(userId, body.thread_id);
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
        message_id: aiMessageId,
        usage: this.emptyUsage(),
        is_crisis: true,
        resources: this.crisis.response.resources,
      };
    }

    // (2) Token gate — short-circuit if over the weekly budget (no Claude call, no debit).
    const week = isoWeekStart(new Date());
    const [tokensUsed, budget] = await Promise.all([
      this.readWeeklyTokens(userId, week),
      this.readWeeklyBudget(userId),
    ]);
    if (tokensUsed >= budget) {
      const threadId = await this.resolveConversation(userId, body.thread_id);
      return {
        answer: null,
        pillar_tag: null,
        thread_id: threadId,
        message_id: null,
        usage: this.emptyUsage(),
        limit_reached: true,
      };
    }

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
    // insights + most recent observations. `user_traits` is read directly (PHE-24
    // may not have populated it yet — empty is handled gracefully).
    const synthesis: string | null =
      (constellation?.[CONSTELLATION_SYNTHESIS_COLUMNS[pillar]] as
        | string
        | null) ?? null;

    const [{ data: traitRows }, { data: observationRows }] = await Promise.all([
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

    const traitInsights = matchTraitInsights(traitRows ?? [], question, pillar);
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
    });

    // (3c) One real-time Claude call. Voice Standard renders FIRST (byte-stable →
    // cached across every request); the static task instructions and the per-user
    // grounding block follow, with a second cache breakpoint on the grounding block
    // so a warm same-session prefix reads from cache. The volatile question stays in
    // the user message, after the last breakpoint.
    const systemBlocks = await this.voiceStandard.buildSystemBlocks(
      POLARIS_TASK_INSTRUCTIONS
    );
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
    if (sparse) {
      answer = `${answer} ${SPARSE_NUDGE}`.trim();
    }

    // (9) Debit the weekly counter by the ACTUAL total tokens, then (10) persist the
    // conversation + encrypted user/ai messages with the routed pillar tag.
    const threadId = await this.resolveConversation(userId, body.thread_id);
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
    await this.debitWeeklyTokens(userId, week, usage.total_tokens);

    return {
      answer,
      pillar_tag: pillar,
      thread_id: threadId,
      message_id: aiMessageId,
      usage,
      sparse,
    };
  }

  // ---- chat surface reads (PHE-23) -----------------------------------------

  /**
   * Main-view payload: the user's past threads (most-recent first, hidden by the
   * client when empty) plus server-computed suggested questions from their top
   * pillars. Ownership is enforced by the `user_id` filter (service-role client
   * bypasses RLS). `preview` decrypts each thread's first user message.
   */
  async listThreads(
    userId: string
  ): Promise<{
    threads: PolarisThreadSummary[];
    suggested_questions: SuggestedQuestion[];
  }> {
    const supabase = this.supabaseService.getClient();

    const [{ data: conversations }, { data: constellation }] = await Promise.all(
      [
        supabase
          .from("polaris_conversations")
          .select("id, title, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("constellation_state")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      ]
    );

    const rows = conversations ?? [];
    const threads = await Promise.all(
      rows.map(async (row) => ({
        id: row.id as string,
        title: (row.title as string | null) ?? null,
        preview: await this.firstMessagePreview(userId, row.id as string),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      }))
    );

    return {
      threads,
      suggested_questions: computeSuggestedQuestions(constellation),
    };
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
  ): Promise<{ thread_id: string; messages: PolarisMessageView[] }> {
    const supabase = this.supabaseService.getClient();

    const { data: conversation } = await supabase
      .from("polaris_conversations")
      .select("id, user_id")
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

    return { thread_id: threadId, messages };
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

  /** Return the caller's conversation id, creating one when `threadId` is absent or
   * not owned by the user (service-role client bypasses RLS, so ownership is checked
   * here). */
  private async resolveConversation(
    userId: string,
    threadId?: string
  ): Promise<string> {
    const supabase = this.supabaseService.getClient();
    if (threadId) {
      const { data } = await supabase
        .from("polaris_conversations")
        .select("id, user_id")
        .eq("id", threadId)
        .maybeSingle();
      if (data && data.user_id === userId) return data.id as string;
    }
    const { data, error } = await supabase
      .from("polaris_conversations")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (error || !data) {
      throw new HttpException({ error: "could not open conversation" }, 500);
    }
    return data.id as string;
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

  // ---- token accounting (provisional; PHE-27 owns the real policy) ----------

  private async readWeeklyTokens(userId: string, week: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("polaris_token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .eq("week", week)
      .maybeSingle();
    return (data?.tokens_used as number) ?? 0;
  }

  private async readWeeklyBudget(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    const tier = (data?.tier as string | undefined) ?? "free";
    return tier === "pro" || tier === "gifted"
      ? WEEKLY_TOKEN_BUDGET_FULL
      : WEEKLY_TOKEN_BUDGET_FREE;
  }

  /** Read-modify-write increment of the weekly meter. Single-user/low-concurrency
   * for MVP; PHE-27 may swap in an atomic RPC. */
  private async debitWeeklyTokens(
    userId: string,
    week: string,
    delta: number
  ): Promise<void> {
    if (delta <= 0) return;
    const supabase = this.supabaseService.getClient();
    const current = await this.readWeeklyTokens(userId, week);
    await supabase.from("polaris_token_usage").upsert(
      {
        user_id: userId,
        week,
        tokens_used: current + delta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week" }
    );
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

/** ISO week start (Monday) in UTC, as a YYYY-MM-DD date string — matches
 * polaris_token_usage.week (date, Monday week start, UTC). */
export function isoWeekStart(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // getUTCDay: 0=Sun..6=Sat. Shift so Monday is the week start.
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// One suggested question per pillar (BASED ON WHAT WE SEE). Lowercase, in voice;
// each is grounded on its pillar so tapping it routes cleanly through the ask
// pipeline's keyword/top-pillar cascade.
const PILLAR_QUESTIONS: Record<Pillar, string> = {
  origin: "what pulled me toward the things i started with?",
  emergence: "what were people noticing about me before i noticed it myself?",
  self_creation: "what does the way i make things say about me?",
  convergence: "where do my different worlds actually meet?",
  becoming: "who am i becoming when no one is watching?",
  recognition: "how do people actually experience me?",
  transcendence: "where is all of this quietly heading?",
};

// Default suggestions when the constellation has no scores yet — the first three
// active pillars, so the main view always renders three questions (AC1).
const DEFAULT_SUGGESTED_PILLARS: Pillar[] = [
  "origin",
  "emergence",
  "self_creation",
];

/**
 * Compute the three BASED ON WHAT WE SEE suggestions from the user's top-scoring
 * pillars. Ranks every pillar by its constellation score, takes the top three,
 * and falls back to the default active pillars when the constellation is empty —
 * so the section is always populated with one question per pillar.
 */
export function computeSuggestedQuestions(
  constellation: Record<string, unknown> | null | undefined
): SuggestedQuestion[] {
  const pillars = topScoringPillars(constellation, 3);
  const chosen = pillars.length > 0 ? pillars : DEFAULT_SUGGESTED_PILLARS;
  return chosen.map((pillar) => ({
    text: PILLAR_QUESTIONS[pillar],
    pillar_tag: pillar,
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
const POLARIS_TASK_INSTRUCTIONS = `you are polaris, the answer engine for PHENYX COLLECTIVE — the first identity observatory. a person asks you a question about who they are, and you answer from the grounding you are given.

rules — never break these:
- answer in plain text only. no markdown, no html, no asterisks, no underscores, no angle brackets.
- two to three sentences. sure tone, personal-first, plain language.
- ground every answer ONLY in the constellation grounding block provided below. never invent a trait, pattern, platform, or signal you were not given.
- if the supplied grounding does not support an answer, do NOT guess. return the honest-limits line exactly as instructed in the grounding block.
- no diagnostic or clinical language. no advice framed as therapy.`;

/** Build the per-user grounding block that anchors the Claude call. Byte-stable for a
 * given (pillar, synthesis, traits, observations) so it caches across identical
 * same-session questions. Carries the verbatim honest-limits instruction. */
function buildGroundingBlock(input: {
  pillar: Pillar;
  synthesis: string;
  traitInsights: string[];
  observations: string[];
  nearestObservation: string | null;
}): string {
  const { pillar, synthesis, traitInsights, observations, nearestObservation } =
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
  lines.push("");
  lines.push("honest-limits rule:");
  if (nearestObservation) {
    lines.push(
      `if the material above does not support an answer, respond with exactly this line and nothing else: "that's not something polaris has a clear read on yet. closest thing it's noticed lately: ${nearestObservation}"`
    );
  } else {
    lines.push(
      `if the material above does not support an answer, say plainly that polaris does not have a clear read on this yet. do not invent signal.`
    );
  }
  return lines.join("\n");
}

/** Normalize Anthropic usage into the shape we report + debit. total_tokens sums
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
