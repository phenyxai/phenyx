import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { SupabaseService } from "../supabase/supabase.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";
import { PILLAR_ORDER } from "../observations/gating";
import {
  DISCOVERY_TYPES,
  HEADLINE_MAX,
  SET_SIZE,
  TIME_CONTEXT_MAX,
  dedupeDiscoveries,
  selectSet,
  validateDiscovery,
  type Discovery,
  type DiscoveryCandidate,
  type TrailEntry,
} from "./discover.rules";

/**
 * PHE-103 — the discover tab: seven single connections across a person's
 * platforms, one card each.
 *
 * `GET /discover` serves the latest set. When there is none it generates one
 * first (one run per person at a time; a second request waits on the first).
 * Generation grounds on the constellation, the dated observations and the
 * connected platforms, asks Claude for up to ten cards through the strict
 * `emit_discoveries` tool, then runs them through `discover.rules.ts`: limits,
 * dedup, one per point. Cards that break a limit get one regeneration. Only
 * the latest set is kept. A weekly cron refreshes sets for people who have one.
 */

const CLAUDE_MODEL = "claude-opus-5-5";
/** A run that found nothing isn't repeated for this long. */
const EMPTY_COOLDOWN_MS = 60 * 60 * 1000;

export interface ServedDiscovery {
  id: string;
  type: string;
  pillar: string;
  time_context: string;
  headline: string;
  what_surfaced: string;
  why_now: string;
  sources: string[];
  trail: TrailEntry[];
}

interface DiscoverContext {
  state: Record<string, string | null> | null;
  observations: {
    pillar: string;
    body: string;
    source_platforms: string[] | null;
    span_start: string | null;
    span_end: string | null;
    evidence_span: string | null;
  }[];
  connections: {
    platform: string;
    connected_at: string | null;
    redacted_snapshot: Record<string, unknown> | null;
  }[];
  traits: { keyword_tags: string[] | null; insight: string | null }[];
  previousHeadlines: string[];
}

@Injectable()
export class DiscoverService {
  private readonly logger = new Logger(DiscoverService.name);
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly emptyAt = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly voiceStandard: VoiceStandardService,
  ) {}

  async getSet(userId: string): Promise<{ discoveries: ServedDiscovery[] }> {
    let discoveries = await this.readLatestSet(userId);
    const emptyAt = this.emptyAt.get(userId) ?? 0;
    if (discoveries.length === 0 && Date.now() - emptyAt > EMPTY_COOLDOWN_MS) {
      await this.generate(userId);
      discoveries = await this.readLatestSet(userId);
    }
    return { discoveries };
  }

  generate(userId: string): Promise<void> {
    const running = this.inflight.get(userId);
    if (running) return running;
    const run = this.runGeneration(userId).finally(() => this.inflight.delete(userId));
    this.inflight.set(userId, run);
    return run;
  }

  /** Sunday 01:00 UTC, an hour after the weekly observations, which discover grounds on. */
  @Cron("0 1 * * 0", { name: "weekly-discover", timeZone: "UTC" })
  async refreshWeekly(): Promise<void> {
    // ponytail: one PostgREST page (1,000 people); page through when discover outgrows it.
    const { data } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select("user_id")
      .eq("position", 0);
    for (const { user_id } of (data ?? []) as { user_id: string }[]) {
      try {
        await this.generate(user_id);
      } catch (e) {
        this.logger.error(`weekly discover failed for ${user_id}: ${(e as Error).message}`);
      }
    }
  }

  private async readLatestSet(userId: string): Promise<ServedDiscovery[]> {
    const { data } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select("id,set_id,type,pillar,time_context,headline,what_surfaced,why_now,sources,trail")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("position", { ascending: true })
      .limit(SET_SIZE * 2);
    const rows = (data ?? []) as (ServedDiscovery & { set_id: string })[];
    const latest = rows[0]?.set_id;
    return rows.filter((row) => row.set_id === latest).map(({ set_id: _set, ...card }) => card);
  }

  private async runGeneration(userId: string): Promise<void> {
    const context = await this.loadContext(userId);
    if (!context) return;

    const platforms = new Set(context.connections.map((c) => c.platform.trim().toLowerCase()));
    const check = (candidates: DiscoveryCandidate[]) =>
      candidates
        .map((c) => validateDiscovery(c, platforms))
        .filter((card): card is Discovery => card !== null);

    const first = await this.emitDiscoveries(context, []);
    const firstValid = check(first);
    let set = selectSet(dedupeDiscoveries(firstValid));
    // A card that broke a limit is regenerated once; the rest of the set stays.
    if (set.length < SET_SIZE && firstValid.length < first.length) {
      const more = await this.emitDiscoveries(context, set);
      set = selectSet(dedupeDiscoveries([...set, ...check(more)]));
    }
    this.logger.log(`discover user=${userId} candidates=${first.length} shown=${set.length}`);
    if (set.length === 0) {
      this.emptyAt.set(userId, Date.now());
      return;
    }

    const supabase = this.supabaseService.getClient();
    const setId = randomUUID();
    const { error } = await supabase.from("discoveries").insert(
      set.map((card, position) => ({
        user_id: userId,
        set_id: setId,
        position,
        type: card.type,
        pillar: card.pillar,
        time_context: card.time_context,
        headline: card.headline,
        what_surfaced: card.what_surfaced,
        why_now: card.why_now,
        sources: card.sources,
        trail: card.trail,
      })),
    );
    if (error) {
      this.logger.error(`discover insert failed for ${userId}: ${error.message}`);
      throw error;
    }
    await supabase.from("discoveries").delete().eq("user_id", userId).neq("set_id", setId);
    this.emptyAt.delete(userId);
  }

  /** Null when there is nothing to read yet, or the account is frozen (PHE-42: no new generation). */
  private async loadContext(userId: string): Promise<DiscoverContext | null> {
    const supabase = this.supabaseService.getClient();
    const [profile, state, observations, connections, traits, previous] = await Promise.all([
      supabase.from("user_profiles").select("frozen").eq("id", userId).maybeSingle(),
      supabase
        .from("constellation_state")
        .select(["archetype", "foresight", ...PILLAR_ORDER.map((p) => `${p}_synthesis`)].join(","))
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("observations")
        .select("pillar,body,source_platforms,span_start,span_end,evidence_span")
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false })
        .limit(60),
      supabase
        .from("onairos_connections")
        .select("platform,connected_at,redacted_snapshot")
        .eq("user_id", userId)
        .eq("status", "connected"),
      supabase
        .from("user_traits")
        .select("keyword_tags,insight")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("discoveries").select("headline").eq("user_id", userId),
    ]);

    if (profile.data?.frozen === true) return null;
    const connected = (connections.data ?? []) as DiscoverContext["connections"];
    if (connected.length === 0) return null;
    return {
      state: (state.data as unknown as DiscoverContext["state"]) ?? null,
      observations: (observations.data ?? []) as DiscoverContext["observations"],
      connections: connected,
      traits: (traits.data ?? []) as DiscoverContext["traits"],
      previousHeadlines: ((previous.data ?? []) as { headline: string }[]).map((r) => r.headline),
    };
  }

  private async emitDiscoveries(
    context: DiscoverContext,
    chosen: Discovery[],
  ): Promise<DiscoveryCandidate[]> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      this.logger.warn("ANTHROPIC_API_KEY missing, skipping discover generation");
      return [];
    }
    const system = await this.voiceStandard.buildSystemBlocks(TASK_INSTRUCTIONS);

    // Same raw-fetch pattern as the observation engine; this backend has no
    // Anthropic SDK. Opus 5.5 rejects forced tool_choice, so the prompt asks
    // for the tool call and strict mode keeps its input on the schema.
    let claude: any;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "server-side-fallback-2026-07-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          fallbacks: "default",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system,
          tools: [EMIT_DISCOVERIES_TOOL],
          messages: [{ role: "user", content: buildUserMessage(context, chosen) }],
        }),
      });
      claude = await res.json();
      if (!res.ok) {
        this.logger.error(`discover Claude call ${res.status}: ${claude?.error?.type ?? "unknown"}`);
        return [];
      }
    } catch (e) {
      this.logger.error(`discover Claude call failed: ${(e as Error).message}`);
      return [];
    }
    if (claude?.stop_reason === "refusal") {
      this.logger.warn(`discover Claude refusal: ${claude?.stop_details?.category ?? "unknown"}`);
      return [];
    }

    const blocks: any[] = Array.isArray(claude?.content) ? claude.content : [];
    const emitted = blocks.find((b) => b?.type === "tool_use" && b?.name === "emit_discoveries")
      ?.input?.discoveries;
    if (!Array.isArray(emitted)) {
      this.logger.warn("Claude returned no emit_discoveries tool call");
      return [];
    }
    return emitted.filter(
      (d: any): d is DiscoveryCandidate =>
        d && typeof d.headline === "string" && Array.isArray(d.trail),
    );
  }
}

function asMonth(iso: string | null): string | null {
  return iso ? iso.slice(0, 7) : null;
}

function buildUserMessage(context: DiscoverContext, chosen: Discovery[]): string {
  const connections = context.connections
    .map(
      (c) =>
        `- ${c.platform.toLowerCase()}${c.connected_at ? ` (connected ${c.connected_at.slice(0, 10)})` : ""}: ${
          c.redacted_snapshot ? JSON.stringify(c.redacted_snapshot) : "no snapshot"
        }`,
    )
    .join("\n");

  const state = context.state;
  const points = PILLAR_ORDER.map((p) => {
    const synthesis = state?.[`${p}_synthesis`];
    return synthesis ? `- ${p}: ${synthesis}` : null;
  })
    .filter(Boolean)
    .join("\n");

  const observations = context.observations
    .map((o) => {
      const start = asMonth(o.span_start);
      const end = asMonth(o.span_end);
      const when = start && end ? `${start} to ${end}` : o.evidence_span ?? "undated";
      return `- [${o.pillar}] ${(o.source_platforms ?? []).join(", ") || "no platform"} · ${when} · ${o.body}`;
    })
    .join("\n");

  const traits = context.traits
    .map((t) => `- ${(t.keyword_tags ?? []).join(", ")}${t.insight ? `: ${t.insight}` : ""}`)
    .join("\n");

  const lines = (headlines: string[]) => headlines.map((h) => `- ${h}`).join("\n");

  return `CONNECTED PLATFORMS (the only platforms a trail may name)
${connections}

CONSTELLATION
archetype: ${state?.archetype ?? "unknown"}
foresight: ${state?.foresight ?? "none"}
the seven points:
${points || "none written yet"}

DATED OBSERVATIONS (copy trail platforms and dates from these)
${observations || "none yet"}

GROUNDED TRAITS
${traits || "none"}

THE LAST SET OF DISCOVERIES (find new ones)
${lines(context.previousHeadlines) || "none, this is the first set"}
${
  chosen.length
    ? `\nALREADY CHOSEN FOR THIS SET (write ${SET_SIZE - chosen.length} more that differ from these)\n${lines(chosen.map((c) => c.headline))}\n`
    : ""
}
Return the discoveries through emit_discoveries.`;
}

const TASK_INSTRUCTIONS = `you are the discover engine for PHENYX.

your task: read the person’s constellation, their dated observations and their connected platforms, then find discoveries. a discovery is one connection across their platforms that is worth noticing now. where the constellation tells the whole story, a discovery points at a single thread.

each discovery has exactly one type:
- resurfaced: something from years ago reappearing in recent work
- connection: the same people or ideas showing up across two parts of life
- pattern: the same behaviour repeating across contexts
- rhythm: when and under what conditions the person does their best work
- unfinished thread: an idea that keeps returning without being acted on
- memory: a marker tied to a transition
- taste: a preference that has held for years
- possibility: interests that are starting to combine
- health: how rest and energy shape depth
- language: wording that changes before behaviour does
- network: older connections becoming relevant to newer work

each field has a strict limit, and a card that breaks one is thrown away:
- headline: one idea in about 50 characters and never more than ${HEADLINE_MAX}, with no full stop at the end.
- time_context: a short phrase for the time the discovery spans, such as "8 years apart" or "visible across 14 months", under ${TIME_CONTEXT_MAX} characters.
- what_surfaced: one sentence naming the observed facts with their dates and platforms.
- why_now: one sentence naming what in recent data brought it back.
- pillar: the constellation point the discovery belongs to.
- trail: the dated sources behind it, earliest first. each entry names a platform from the connected platforms, a date copied from the grounding as yyyy, yyyy-mm or yyyy-mm-dd, and a short detail of what is there. never invent a date or a platform, since a card with no dated source is thrown away.
- confidence: from 0 to 1, how well the trail supports the discovery.

write up to ten discoveries, one for each constellation point first and then further ones where a point holds more than one thread. two discoveries never rest on the same dated source, and two on the same point never cover the same stretch of time.

write to the person as "you" and reflect what the data suggests, since the person decides who they are and the copy never declares it.

you must return your result by calling the emit_discoveries tool. do not answer in plain text.

strict prohibitions, never break these:
- no diagnostic or clinical language
- never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology
- no therapeutic advice; these are reflections the person can check against their constellation`;

const EMIT_DISCOVERIES_TOOL = {
  name: "emit_discoveries",
  description:
    "Emit the discoveries found across the person’s platforms, each with a dated source trail. Emit an empty array if nothing is grounded well enough.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      discoveries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: [...DISCOVERY_TYPES] },
            pillar: { type: "string", enum: [...PILLAR_ORDER] },
            time_context: {
              type: "string",
              description: `Short time phrase under ${TIME_CONTEXT_MAX} characters, e.g. "8 years apart".`,
            },
            headline: {
              type: "string",
              description: `One idea, about 50 characters, never more than ${HEADLINE_MAX}.`,
            },
            what_surfaced: {
              type: "string",
              description: "One sentence: the observed facts with dates and platforms.",
            },
            why_now: {
              type: "string",
              description: "One sentence: what in recent data brought it back.",
            },
            trail: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  platform: { type: "string", description: "A connected platform, lowercase." },
                  date: {
                    type: "string",
                    description: "yyyy, yyyy-mm or yyyy-mm-dd, copied from the grounding.",
                  },
                  detail: { type: "string", description: "A few words on what is there." },
                },
                required: ["platform", "date", "detail"],
              },
            },
            confidence: { type: "number" },
          },
          required: [
            "type",
            "pillar",
            "time_context",
            "headline",
            "what_surfaced",
            "why_now",
            "trail",
            "confidence",
          ],
        },
      },
    },
    required: ["discoveries"],
  },
};
