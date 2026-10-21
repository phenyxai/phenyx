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
  QUESTION_MAX,
  SET_SIZE,
  dedupeDiscoveries,
  selectSet,
  validateDiscovery,
  type Discovery,
  type DiscoveryCandidate,
  type PublicStory,
  type TrailEntry,
} from "./discover.rules";

/**
 * PHE-103 / PHE-129 — the discover tab: seven outward picks (a place, a
 * person, something to try, a detail, a medium, or something from the
 * person's own history), each with one personal reason from a dated source.
 *
 * `GET /discover` serves the latest set. When there is none it generates one
 * first (one run per person at a time; a second request waits on the first).
 * Generation grounds on the constellation, the dated observations and the
 * connected platforms, asks Claude for up to ten cards through the strict
 * `emit_discoveries` tool, then runs them through `discover.rules.ts`: limits,
 * dedup, one per point. Cards that break a limit get one regeneration. Only
 * the latest set is kept, plus any card the person saved: saved cards outlive
 * their set and come back as `saved`. A weekly cron refreshes sets for people
 * who have one.
 */

const CLAUDE_MODEL = "claude-opus-5-5";
/** A run that found nothing isn't repeated for this long. */
const EMPTY_COOLDOWN_MS = 60 * 60 * 1000;

export interface ServedDiscovery {
  id: string;
  type: string;
  pillar: string;
  headline: string;
  detail: string;
  reason: string;
  question: string;
  story: PublicStory | null;
  sources: string[];
  trail: TrailEntry[];
  saved: boolean;
}

const SERVED_COLUMNS = "id,set_id,type,pillar,headline,detail,reason,question,story,sources,trail,saved_at";
/** ponytail: the saved list is capped; page it when someone keeps more than this. */
const SAVED_MAX = 60;

type DiscoveryRow = Omit<ServedDiscovery, "saved"> & { set_id: string; saved_at: string | null };

function served({ set_id: _set, saved_at, ...card }: DiscoveryRow): ServedDiscovery {
  return { ...card, saved: saved_at !== null };
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

  async getSet(userId: string): Promise<{ discoveries: ServedDiscovery[]; saved: ServedDiscovery[] }> {
    let discoveries = await this.readLatestSet(userId);
    const emptyAt = this.emptyAt.get(userId) ?? 0;
    if (discoveries.length === 0 && Date.now() - emptyAt > EMPTY_COOLDOWN_MS) {
      await this.generate(userId);
      discoveries = await this.readLatestSet(userId);
    }
    return { discoveries, saved: await this.readSaved(userId) };
  }

  /** Save a card (the ★) or take it out of saved. Owner-scoped; false when it isn't theirs. */
  async setSaved(userId: string, id: string, saved: boolean): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .update({ saved_at: saved ? new Date().toISOString() : null })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
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
      .select(SERVED_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("position", { ascending: true })
      .limit(SET_SIZE * 2);
    const rows = (data ?? []) as unknown as DiscoveryRow[];
    const latest = rows[0]?.set_id;
    return rows.filter((row) => row.set_id === latest).map(served);
  }

  /** Saved cards, newest save first, whichever set they came from. */
  private async readSaved(userId: string): Promise<ServedDiscovery[]> {
    const { data } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select(SERVED_COLUMNS)
      .eq("user_id", userId)
      .not("saved_at", "is", null)
      .order("saved_at", { ascending: false })
      .limit(SAVED_MAX);
    return ((data ?? []) as unknown as DiscoveryRow[]).map(served);
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
        headline: card.headline,
        detail: card.detail,
        reason: card.reason,
        question: card.question,
        story: card.story,
        sources: card.sources,
        trail: card.trail,
      })),
    );
    if (error) {
      this.logger.error(`discover insert failed for ${userId}: ${error.message}`);
      throw error;
    }
    // Older sets go, except the cards the person saved.
    await supabase
      .from("discoveries")
      .delete()
      .eq("user_id", userId)
      .neq("set_id", setId)
      .is("saved_at", null);
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
        d && typeof d.headline === "string" && typeof d.detail === "string" && Array.isArray(d.trail),
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

DISCOVERIES ALREADY SHOWN OR SAVED (find new ones)
${lines(context.previousHeadlines) || "none, this is the first set"}
${
  chosen.length
    ? `\nALREADY CHOSEN FOR THIS SET (write ${SET_SIZE - chosen.length} more that differ from these)\n${lines(chosen.map((c) => c.headline))}\n`
    : ""
}
Return the discoveries through emit_discoveries.`;
}

const TASK_INSTRUCTIONS = `you are the discover engine for PHENYX.

your task: read the person’s constellation, their dated observations and their connected platforms, then find discoveries. a discovery points outward: one real thing in the world worth the person’s attention now, chosen because of something specific in their own history. where the constellation tells the person’s story, a discovery hands them something new to explore from it.

each discovery has exactly one type:
- place: somewhere to go, a kind of room, a city, a venue or a landscape
- person: someone whose work or life echoes theirs
- try: a small, concrete thing to do this week
- history: something from their own platforms years ago that is worth returning to (no public story)
- detail: a precise, true fact about something they already love
- medium: a form to explore, such as a kind of game, film, book or format

only name places, people and works you are certain exist, and only state facts about them you are certain of. when you are unsure of a fact, choose a different discovery. never invent a person, a work, a place or a number.

each field has a strict limit, and a card that breaks one is thrown away:
- headline: one idea in one sentence of about 55 characters and never more than ${HEADLINE_MAX}, e.g. "japan’s jazz kissa are rooms built for listening.".
- detail: one or two sentences on what the thing is, in plain words, e.g. "small cafés with one great sound system, warm lamps and walls of records, where people listen together."
- reason: one sentence on why it fits this person, grounded in their dated sources, e.g. "you keep saving rooms and replaying albums, and a kissa is both at once."
- question: the question the person would ask polaris about it, in their voice, under ${QUESTION_MAX} characters, e.g. "why might a listening room feel like such a natural place for me?"
- story: the public side, for every type except history: label (the name it goes by), title (a few words) and detail (one sentence). for history, leave all three empty.
- pillar: the constellation point the reason grows from.
- trail: the person’s dated sources behind the reason, earliest first. each entry names a platform from the connected platforms, a date copied from the grounding as yyyy, yyyy-mm or yyyy-mm-dd, and a short detail of what is there. never invent a date or a platform, since a card with no dated source is thrown away.
- confidence: from 0 to 1, how well the trail supports the reason.

write up to ten discoveries across the types, one for each constellation point first and then further ones where a point holds more. two discoveries never rest on the same dated source or point at the same thing.

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
            headline: {
              type: "string",
              description: `One idea in one sentence, about 55 characters, never more than ${HEADLINE_MAX}.`,
            },
            detail: {
              type: "string",
              description: "One or two sentences: what the thing is, in plain words.",
            },
            reason: {
              type: "string",
              description: "One sentence: why it fits this person, from their dated sources.",
            },
            question: {
              type: "string",
              description: `What the person would ask polaris about it, in their voice, under ${QUESTION_MAX} characters.`,
            },
            story: {
              type: "object",
              additionalProperties: false,
              description: "The public side. All three empty for history.",
              properties: {
                label: { type: "string", description: "The name it goes by, e.g. 'brian eno'." },
                title: { type: "string", description: "A few words, e.g. 'music for a place'." },
                detail: { type: "string", description: "One sentence on it." },
              },
              required: ["label", "title", "detail"],
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
            "headline",
            "detail",
            "reason",
            "question",
            "story",
            "trail",
            "confidence",
          ],
        },
      },
    },
    required: ["discoveries"],
  },
};
