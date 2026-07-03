import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";

const CRISIS_PATTERNS = [
  /\b(suicide|suicidal)\b/i,
  /\bkill (my|him|her|them)self\b/i,
  /\bend (my|his|her|their) life\b/i,
  /\bnot worth living\b/i,
  /\bwant to die\b/i,
  /\bcan't go on\b/i,
  /\bno reason to live\b/i,
  /\bhurt (my|him|her|them)self\b/i,
  /\bself.?harm\b/i,
];

export const CRISIS_RESPONSE = {
  insight:
    "what you shared took courage. if you are in a difficult moment right now, please reach out to someone who can be with you.",
  resources: {
    us: "988 — call or text, 24 hours",
    text: "crisis text line — text home to 741741",
    international: "findahelpline.com",
  },
  isCrisis: true,
};

// Model IDs are exact — do not append or strip suffixes. Haiku is the fastest
// model; the pre-flight must add as little latency as possible over the regex.
const CRISIS_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// The semantic gate must never hold up a user turn. If Haiku has not answered
// within this budget we abort and fail closed (treat as crisis).
const CRISIS_TIMEOUT_MS = 1500;

/** Structured output of the semantic crisis gate. */
interface FlagCrisisInput {
  triggered: boolean;
  category: string;
}

const FLAG_CRISIS_TOOL = {
  name: "flag_crisis",
  description:
    "Report whether the text indicates an acute crisis — suicidal ideation, intent to self-harm, intent to harm others, or being in immediate physical danger — that requires surfacing crisis-support resources instead of a normal response.",
  strict: true as const,
  input_schema: {
    type: "object",
    properties: {
      triggered: {
        type: "boolean",
        description:
          "true only when the text indicates acute risk of harm to self or others, or immediate danger.",
      },
      category: {
        type: "string",
        description:
          'short lowercase label of the crisis kind when triggered (e.g. suicidal_ideation, self_harm, harm_to_others, immediate_danger); the literal "none" when not triggered.',
      },
    },
    required: ["triggered", "category"],
    additionalProperties: false,
  },
};

const CRISIS_INSTRUCTIONS = `you are a safety pre-flight classifier for PHENYX COLLECTIVE. you read a single piece of user free-text and decide ONE thing: does it indicate an acute crisis — suicidal ideation, intent to self-harm, intent to harm others, or being in immediate physical danger — such that the product must surface crisis-support resources instead of generating a normal response?

rules:
- triggered = true ONLY for acute risk of harm to self or others, or immediate danger. dark, sad, angry, grieving, or otherwise distressing content that is NOT about imminent harm is triggered = false.
- category: a short lowercase label for the kind of crisis when triggered, otherwise null.

you MUST answer by calling the flag_crisis tool. do not answer in plain text.`;

/**
 * PHE-39 — crisis pre-flight.
 *
 * Two layers: a synchronous regex fast-path (`detect`) that keeps the common
 * case sub-second, and an async semantic gate (`detectCrisis`) that adds a Haiku
 * classifier behind the regex to catch phrasing the patterns miss. The gate
 * FAILS CLOSED — any timeout, HTTP, or parse error is treated as a crisis so the
 * conservative path always protects the user. Callers that trigger persist a
 * `crisis_events` row via `recordCrisisEvent` (hashed text only, never plaintext).
 */
@Injectable()
export class CrisisService {
  private readonly logger = new Logger(CrisisService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService
  ) {}

  /**
   * Synchronous regex fast-path. Kept for back-compat with callers that have not
   * yet moved to the async gate. Returns true on any pattern hit.
   */
  detect(text: string): boolean {
    return CRISIS_PATTERNS.some((p) => p.test(text));
  }

  /**
   * Async crisis gate. Regex fast-path first: on a pattern hit it short-circuits
   * `{ triggered: true }` with NO model call. Otherwise it runs a bounded Haiku
   * classifier. Fails closed: on timeout / HTTP / parse error it returns
   * `{ triggered: true }` and logs loudly. Never mutates state and never logs the
   * raw text — safe to call anywhere a user free-text surface needs pre-flighting.
   */
  async detectCrisis(
    text: string
  ): Promise<{ triggered: boolean; category?: string }> {
    if (!text || !text.trim()) return { triggered: false };

    // Regex authoritative fast-path — a hit never needs the model.
    if (this.detect(text)) return { triggered: true };

    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      // No key configured — fail closed rather than silently letting text through.
      this.logger.error(
        "crisis gate: ANTHROPIC_API_KEY missing — failing closed (treated as crisis)"
      );
      return { triggered: true };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CRISIS_TIMEOUT_MS);
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: CRISIS_MODEL,
          max_tokens: 128,
          // Stable prefix (instructions + tool) is prompt-cached; only the user
          // text below is volatile. Force the tool so the classifier answers in
          // one structured turn with no free-text latency.
          system: [
            {
              type: "text",
              text: CRISIS_INSTRUCTIONS,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [FLAG_CRISIS_TOOL],
          tool_choice: { type: "tool", name: FLAG_CRISIS_TOOL.name },
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!res.ok) {
        this.logger.error(
          `crisis gate: anthropic ${res.status} — failing closed (treated as crisis)`
        );
        return { triggered: true };
      }

      const claude: any = await res.json();
      const toolUse = Array.isArray(claude?.content)
        ? claude.content.find(
            (b: any) =>
              b?.type === "tool_use" && b?.name === FLAG_CRISIS_TOOL.name
          )
        : undefined;
      const input = toolUse?.input as FlagCrisisInput | undefined;

      if (!input || typeof input.triggered !== "boolean") {
        this.logger.error(
          "crisis gate: no valid flag_crisis output — failing closed (treated as crisis)"
        );
        return { triggered: true };
      }

      if (!input.triggered) return { triggered: false };
      const raw =
        typeof input.category === "string" ? input.category.trim() : "";
      const category = raw && raw.toLowerCase() !== "none" ? raw : undefined;
      return { triggered: true, category };
    } catch (e) {
      // AbortError (timeout) and any network error land here — fail closed.
      const reason =
        (e as Error)?.name === "AbortError"
          ? `timeout after ${CRISIS_TIMEOUT_MS}ms`
          : "request error";
      this.logger.error(
        `crisis gate: ${reason} — failing closed (treated as crisis)`,
        e as Error
      );
      return { triggered: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Append-only record of a crisis trigger. Stores ONLY a sha256 hash of the
   * text — never the plaintext, and the raw text is never logged. Best-effort:
   * a persistence failure must never block the supportive-resources response, so
   * it is caught and logged, not thrown.
   */
  async recordCrisisEvent(
    userId: string,
    text: string,
    category?: string
  ): Promise<void> {
    try {
      const textHash = createHash("sha256").update(text).digest("hex");
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase.from("crisis_events").insert({
        user_id: userId,
        category: category ?? null,
        text_hash: textHash,
      });
      if (error) {
        this.logger.error(
          `crisis event persist failed for ${userId}: ${error.message}`
        );
      }
    } catch (e) {
      this.logger.error(
        `crisis event persist threw for ${userId}`,
        e as Error
      );
    }
  }

  get response() {
    return CRISIS_RESPONSE;
  }
}
