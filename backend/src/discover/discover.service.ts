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
  discoveryWeek,
  safeTimeZone,
  selectSet,
  validateDiscovery,
  type Discovery,
  type DiscoveryCandidate,
  type PublicStory,
  type TrailEntry,
} from "./discover.rules";

/**
 * PHE-103 / PHE-129 — the discover tab: outward picks (a place, a person,
 * something to try, a detail, a medium, a field, or something from the
 * person's own history), each with one personal reason from a dated source.
 *
 * PHE-158: the deck is this week's cards. Every person gets seven a week on
 * either plan, and the week opens monday 9am in their own time. Generation
 * writes sets of seven that wait unrevealed; the first `GET /discover` of a
 * week reveals the week's seven (generating first when too few are waiting)
 * and serves the deck, the saved cards and the allowance. Last week's cards
 * leave the deck, and saved ones stay in saved. Bought discoveries add cards
 * on top through `POST /discover/reveal`, which charges nothing when nothing
 * new could be found ("all caught up").
 *
 * Generation grounds on the constellation, the dated observations and the
 * connected platforms, asks Claude for up to ten cards through the strict
 * `emit_discoveries` tool, then runs them through `discover.rules.ts`: limits,
 * dedup, at least five kinds. A set short of seven gets up to two more passes
 * (one run per person at a time; a second request waits on the first). A
 * weekly cron tops up the waiting cards before the week opens.
 */

const CLAUDE_MODEL = "claude-opus-5-5";
/** A run that found nothing isn't repeated for this long. */
const EMPTY_COOLDOWN_MS = 60 * 60 * 1000;
/** Claude calls one generation may make to fill a set of seven. */
const MAX_PASSES = 3;

/** The week's discoveries, surfaced to the client. */
export interface DiscoveryAllowance {
  /** The monday the week opened (local date): the discovery_usage key. */
  week: string;
  /** When the next week opens, an ISO instant (monday 9am local). */
  resets: string;
  /** The week's discoveries: seven on every plan (PHE-158). */
  limit: number;
  used: number;
  weekly_left: number;
  /** Bought discoveries still available. */
  purchased: number;
  /** weekly_left + purchased: how many can be added now. */
  available: number;
}

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

const SERVED_COLUMNS = "id,type,pillar,headline,detail,reason,question,story,sources,trail,saved_at";
/** ponytail: the deck and the saved list are capped; page them when someone keeps more than this. */
const DECK_MAX = 100;
const SAVED_MAX = 60;
/** Most cards one reveal can add: the largest pack. */
export const REVEAL_MAX = 10;
/** Headlines the writer is told not to repeat (rebuild doc 11.4). */
const SEEN_DAYS = 60;

type DiscoveryRow = Omit<ServedDiscovery, "saved"> & { saved_at: string | null };

function served({ saved_at, ...card }: DiscoveryRow): ServedDiscovery {
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

  /** The deck, the saved cards and the week's allowance. The week's first visit reveals its seven. */
  async getDeck(
    userId: string,
    timeZone: unknown,
  ): Promise<{ deck: ServedDiscovery[]; saved: ServedDiscovery[]; allowance: DiscoveryAllowance }> {
    const week = discoveryWeek(new Date(), safeTimeZone(timeZone));
    let allowance = await this.allowance(userId, week);
    const emptyAt = this.emptyAt.get(userId) ?? 0;
    if (allowance.weekly_left > 0 && Date.now() - emptyAt > EMPTY_COOLDOWN_MS) {
      allowance = (await this.revealWaiting(userId, allowance.weekly_left, allowance)).allowance;
    }
    const [deck, saved] = await Promise.all([this.readDeck(userId, week.opened), this.readSaved(userId)]);
    return { deck, saved, allowance };
  }

  /**
   * Add `count` cards to the deck: from the week's allowance first, then bought
   * ones. Generates more first when too few are waiting. Nothing is charged
   * when nothing new turned up (`caught_up`), or when `count` is more than the
   * allowance covers (`short`).
   */
  // ponytail: read-then-write charge, like polaris points; two reveals at once can under-count. Move to an RPC if that shows up.
  async reveal(
    userId: string,
    count: number,
    timeZone: unknown,
  ): Promise<{ added: ServedDiscovery[]; caught_up: boolean; short: boolean; allowance: DiscoveryAllowance }> {
    const week = discoveryWeek(new Date(), safeTimeZone(timeZone));
    const before = await this.allowance(userId, week);
    if (count > before.available) return { added: [], caught_up: false, short: true, allowance: before };
    const { added, allowance } = await this.revealWaiting(userId, count, before);
    return { added, caught_up: added.length === 0, short: false, allowance };
  }

  /** Reveal up to `count` waiting cards, oldest set first, generating first when too few wait, and charge them. */
  private async revealWaiting(
    userId: string,
    count: number,
    before: DiscoveryAllowance,
  ): Promise<{ added: ServedDiscovery[]; allowance: DiscoveryAllowance }> {
    if ((await this.waiting(userId)) < count) await this.generate(userId);
    const supabase = this.supabaseService.getClient();
    const { data: waiting } = await supabase
      .from("discoveries")
      .select("id")
      .eq("user_id", userId)
      .is("revealed_at", null)
      .order("created_at", { ascending: true })
      .order("position", { ascending: true })
      .limit(count);
    const ids = ((waiting ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return { added: [], allowance: before };

    const { data, error } = await supabase
      .from("discoveries")
      .update({ revealed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", ids)
      .is("revealed_at", null)
      .select(SERVED_COLUMNS);
    if (error) throw error;
    const added = ((data ?? []) as unknown as DiscoveryRow[]).map(served);
    return { added, allowance: await this.charge(userId, before, added.length) };
  }

  /** Save a card (the ★) or take it out of saved. Owner-scoped and deck-only; false when it isn't theirs. */
  async setSaved(userId: string, id: string, saved: boolean): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .update({ saved_at: saved ? new Date().toISOString() : null })
      .eq("user_id", userId)
      .eq("id", id)
      .not("revealed_at", "is", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /** The week's allowance: seven less what was revealed this week, plus bought discoveries. */
  private async allowance(userId: string, week: { week: string; resets: string }): Promise<DiscoveryAllowance> {
    const supabase = this.supabaseService.getClient();
    const [{ data: usage }, { data: balance }] = await Promise.all([
      supabase.from("discovery_usage").select("used").eq("user_id", userId).eq("week", week.week).maybeSingle(),
      supabase.from("purchased_balances").select("discoveries").eq("user_id", userId).maybeSingle(),
    ]);
    return this.snapshot(week, Number(usage?.used ?? 0), Math.max(0, Number(balance?.discoveries ?? 0)));
  }

  /** Spend `n`: the week's discoveries first, then bought ones. One count per person per week. */
  private async charge(userId: string, before: DiscoveryAllowance, n: number): Promise<DiscoveryAllowance> {
    const fromWeek = Math.min(n, before.weekly_left);
    const fromPurchased = Math.min(before.purchased, n - fromWeek);
    const supabase = this.supabaseService.getClient();
    const used = before.used + fromWeek;
    const purchased = before.purchased - fromPurchased;
    const now = new Date().toISOString();
    if (fromWeek > 0) {
      await supabase
        .from("discovery_usage")
        .upsert({ user_id: userId, week: before.week, used, updated_at: now }, { onConflict: "user_id,week" });
    }
    if (fromPurchased > 0) {
      await supabase.from("purchased_balances").update({ discoveries: purchased, updated_at: now }).eq("user_id", userId);
    }
    return this.snapshot(before, used, purchased);
  }

  private snapshot(week: { week: string; resets: string }, used: number, purchased: number): DiscoveryAllowance {
    const weekly_left = Math.max(0, SET_SIZE - used);
    return {
      week: week.week,
      resets: week.resets,
      limit: SET_SIZE,
      used,
      weekly_left,
      purchased,
      available: weekly_left + purchased,
    };
  }

  /** How many generated cards are waiting to be revealed. */
  private async waiting(userId: string): Promise<number> {
    const { count } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revealed_at", null);
    return count ?? 0;
  }

  generate(userId: string): Promise<void> {
    const running = this.inflight.get(userId);
    if (running) return running;
    const run = this.runGeneration(userId).finally(() => this.inflight.delete(userId));
    this.inflight.set(userId, run);
    return run;
  }

  /**
   * Sunday 01:00 UTC, an hour after the weekly observations, which discover
   * grounds on, and before the week opens anywhere: tops up the waiting cards
   * for everyone who has had a deck, so monday's seven arrive at once.
   */
  @Cron("0 1 * * 0", { name: "weekly-discover", timeZone: "UTC" })
  async refreshWeekly(): Promise<void> {
    // ponytail: one PostgREST page (1,000 rows); page through when discover outgrows it.
    const { data } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select("user_id")
      .eq("position", 0)
      .not("revealed_at", "is", null);
    const people = new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    for (const user_id of people) {
      try {
        if ((await this.waiting(user_id)) < SET_SIZE) await this.generate(user_id);
      } catch (e) {
        this.logger.error(`weekly discover failed for ${user_id}: ${(e as Error).message}`);
      }
    }
  }

  /** The deck: every card revealed since the week opened, newest first, then by its place in its set. */
  private async readDeck(userId: string, weekOpened: string): Promise<ServedDiscovery[]> {
    const { data } = await this.supabaseService
      .getClient()
      .from("discoveries")
      .select(SERVED_COLUMNS)
      .eq("user_id", userId)
      .gte("revealed_at", weekOpened)
      .order("revealed_at", { ascending: false })
      .order("position", { ascending: true })
      .limit(DECK_MAX);
    return ((data ?? []) as unknown as DiscoveryRow[]).map(served);
  }

  /** Saved cards from any week, newest save first. */
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

    // PHE-158: a set short of seven asks again for the rest; the chosen cards stay.
    let set: Discovery[] = [];
    let candidates = 0;
    for (let pass = 0; pass < MAX_PASSES && set.length < SET_SIZE; pass++) {
      const emitted = await this.emitDiscoveries(context, set);
      candidates += emitted.length;
      const valid = check(emitted);
      if (valid.length === 0) break;
      set = selectSet(dedupeDiscoveries([...set, ...valid]));
    }
    this.logger.log(`discover user=${userId} candidates=${candidates} shown=${set.length}`);
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
      supabase
        .from("discoveries")
        .select("headline")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - SEEN_DAYS * 86_400_000).toISOString()),
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

DISCOVERIES FROM THE LAST ${SEEN_DAYS} DAYS (never repeat a headline)
${lines(context.previousHeadlines) || "none, this is the first set"}
${
  chosen.length
    ? `\nALREADY CHOSEN FOR THIS SET (write ${SET_SIZE - chosen.length} more that differ from these)\n${lines(chosen.map((c) => c.headline))}\n`
    : ""
}
Return the discoveries through emit_discoveries.`;
}

const TASK_INSTRUCTIONS = `you are the discover engine for PHENYX.

your task: suggest discoveries for the person, things to explore that could open a new part of them. read their constellation, their dated observations and their connected platforms. start from what they already love and reach past what it is usually called, so someone who saves lamp-lit rooms meets a listening café rather than another film fact.

each discovery has exactly one kind:
- place: somewhere to go that holds what they love, e.g. jazz kissa, listening cafés with warm lamps and records
- person: someone public whose path rhymes with theirs, e.g. brian eno writing music for a place
- try: one small, doable activity, e.g. a sound walk through the neighborhood
- detail: a fun fact that gives their taste a name, e.g. warm lamplight sits around 2700 kelvin
- history: a goal or idea they set down on their own platforms, e.g. a pottery class saved three times in 2019 (no public story)
- medium: a new form that joins two of their sides, e.g. a game told entirely through one house
- field: a craft next to theirs, e.g. production design, rooms that tell you who lives there

write ten discoveries using at least five kinds. no more than two may stay inside the person’s main craft; the rest reach into neighboring worlds. two discoveries never rest on the same source entry (the same platform, date and title) or point at the same thing.

only name places, people and works that are well documented in public history, and only state facts about them you are certain of. when you are unsure of a fact, leave the card out. never invent a person, a work, a place or a number.

each field has a strict limit, and a card that breaks one is thrown away:
- headline: one idea in one sentence that makes them curious, about 55 characters and never more than ${HEADLINE_MAX}, e.g. "japan’s jazz kissa are rooms built for listening.".
- detail: one or two sentences on what the thing is, in plain words, e.g. "small cafés with one great sound system, warm lamps and walls of records, where people listen together."
- reason: one sentence about their life now, grounded in their dated sources and never about PHENYX, e.g. "you keep saving rooms and replaying albums, and a kissa is both at once."
- question: the question the person would ask polaris about it, in their own voice, under ${QUESTION_MAX} characters, e.g. "why might a listening room feel like such a natural place for me?"
- story: the public side, for every kind except history: label (the name it goes by), title (a few words) and detail (one sentence). for history, leave all three empty.
- pillar: the constellation point the reason grows from.
- trail: the person’s dated sources behind the reason, earliest first. each entry names a platform from the connected platforms, a date copied from the grounding as yyyy, yyyy-mm or yyyy-mm-dd, a title of a few words for what the source is (e.g. "lamp-lit rooms board"), and one line on what is there. never invent a date or a platform, since a card with no dated source is thrown away.
- confidence: from 0 to 1, how well the trail supports the reason.

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
                  title: { type: "string", description: "A few words for what the source is." },
                  detail: { type: "string", description: "One line on what is there." },
                },
                required: ["platform", "date", "title", "detail"],
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
