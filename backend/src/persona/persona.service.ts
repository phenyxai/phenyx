import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";
import { PILLARS } from "../constellation/layout";

// Task-specific instructions only — voice/tone rules come from the shared Voice
// Standard block (PHE-20), composed at call time via buildSystemBlocks().
const TASK_INSTRUCTIONS = `you are the PHENYX constellation synthesis engine. you read a person’s onairos trait data and write their constellation: a score and a one-paragraph synthesis for each of its seven pillars.

the seven pillars, from where they began to where they seem to be heading:

origin: where they began, the foundational self that was true before it was named. maps to consistency signals, the earliest behavioral patterns and stable recurring traits.

emergence: what they started caring about on their own, the first time something internal became visible to others. maps to traits others would recognize before they do, social and relational signals, and archetype alignment.

self_creation: who they became once they were on their own, the identity they are actively building through deliberate choices, creative output and disciplines pursued. maps to positive traits with high scores, creative and builder signals, and intentional behavior patterns.

convergence: when the separate parts started to meet, the through-line across seemingly unrelated traits and interests. maps to cross-trait patterns, the meeting point of positive and improvement traits, and recurring nudge themes.

becoming: how they are changing now. maps to the most recent material and the traits that are still shifting.

recognition: what others are starting to see in them. maps to signals of how their work and presence land with other people.

transcendence: where all of this seems to be leading. maps to the direction the recent patterns point in, read gently and never as a prediction.

read the data top down: the newest material shapes the later pillars, and the oldest shapes origin.

scoring rules:
- score each pillar 0 to 100 based on how strongly the trait data supports it.
- a trait_to_improve is never negative. low scores on consistency map to origin as a pattern of how this person moves through the world.
- use the user_summary and top_traits_explanation as primary synthesis material.
- the archetype label informs emergence most directly.
- return all seven pillars every time. when the data for a pillar is thin, give it a low score and a short, honest synthesis and keep it in the reply.

for each pillar return:
- score: integer 0-100
- synthesis: one paragraph, written directly to the person as "you". no therapeutic language. no "journey", "authentic", "growth". specific to their data, never generic. make it feel like the constellation already knows them.

return only a valid json object in this exact shape, with no preamble, markdown or explanation:

{
  "origin": { "score": 0-100, "synthesis": "string" },
  "emergence": { "score": 0-100, "synthesis": "string" },
  "self_creation": { "score": 0-100, "synthesis": "string" },
  "convergence": { "score": 0-100, "synthesis": "string" },
  "becoming": { "score": 0-100, "synthesis": "string" },
  "recognition": { "score": 0-100, "synthesis": "string" },
  "transcendence": { "score": 0-100, "synthesis": "string" }
}`;

interface GeneratePromptsBody {
  userId?: string;
  onairosData?: any;
}

@Injectable()
export class PersonaService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly onairosSnapshot: OnairosSnapshotService,
    private readonly voiceStandard: VoiceStandardService
  ) {}

  async generatePrompts(body: GeneratePromptsBody) {
    try {
      const supabase = this.supabaseService.getClient();
      const { userId, onairosData } = body;

      if (!userId || !onairosData) {
        throw new HttpException({ error: "missing required fields" }, 400);
      }

      // Treat every inbound Onairos shape as untrusted. This sanitized snapshot
      // is the only form allowed past the engine boundary into model prompts or
      // durable writes.
      const sanitizedOnairosData =
        this.onairosSnapshot.redactOnairosForProfile(onairosData);

      // Call Claude for synthesis. [Voice Standard] (cached) + [task instructions];
      // the per-request Onairos data stays in the user message, after the cached prefix.
      const system = await this.voiceStandard.buildSystemBlocks(TASK_INSTRUCTIONS);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.get<string>("ANTHROPIC_API_KEY") as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system,
          messages: [
            {
              role: "user",
              content: `Here is the user's Onairos data: ${JSON.stringify(
                sanitizedOnairosData
              )}`,
            },
          ],
        }),
      });

      const claude: any = await res.json();

      if (!claude.content?.[0]?.text) {
        // eslint-disable-next-line no-console
        console.error("Claude response missing content:", claude);
        throw new HttpException({ error: "synthesis_failed" }, 500);
      }

      // PHE-100: Claude is asked for all seven pillars, but whatever it returns,
      // a missing or malformed pillar is skipped instead of failing the run. Its
      // columns are left out of the upsert, so a refresh keeps the last good
      // value and a first run leaves it null; either way the constellation still
      // draws all seven points. Only a reply with no usable pillar fails.
      const synthesis: Record<string, { score: number; synthesis: string }> = {};

      try {
        const parsed = JSON.parse(claude.content[0].text.trim());
        for (const p of PILLARS) {
          const raw = parsed?.[p];
          if (typeof raw?.score !== "number" || typeof raw?.synthesis !== "string") {
            continue;
          }
          synthesis[p] = {
            // constellation_state only accepts integers 0..100.
            score: Math.round(Math.min(100, Math.max(0, raw.score))),
            // Plain-text guard — strip any markup the model slipped in.
            synthesis: this.voiceStandard.sanitizeProse(raw.synthesis),
          };
        }
        if (Object.keys(synthesis).length === 0) {
          throw new Error("no usable pillar");
        }
      } catch (parseError) {
        // eslint-disable-next-line no-console
        console.error(
          "Failed to parse Claude response:",
          parseError,
          claude.content[0].text
        );
        throw new HttpException({ error: "synthesis_failed" }, 500);
      }

      // Extract archetype from the sanitized, schema-loose trait block.
      const sanitizedTraits = sanitizedOnairosData.traits;
      const archetype =
        sanitizedTraits &&
        typeof sanitizedTraits === "object" &&
        !Array.isArray(sanitizedTraits) &&
        typeof (sanitizedTraits as Record<string, unknown>).archetype === "string"
          ? (sanitizedTraits as Record<string, unknown>).archetype
          : null;

      // Upsert into constellation_state
      const { data: existingState } = await supabase
        .from("constellation_state")
        .select("version")
        .eq("user_id", userId)
        .single();

      const newVersion = existingState ? existingState.version + 1 : 1;

      const { error: upsertError } = await supabase
        .from("constellation_state")
        .upsert(
          {
            user_id: userId,
            generated_at: new Date().toISOString(),
            version: newVersion,
            onairos_snapshot: sanitizedOnairosData,
            archetype,
            ...Object.fromEntries(
              Object.entries(synthesis).flatMap(([p, v]) => [
                [`${p}_score`, v.score],
                [`${p}_synthesis`, v.synthesis],
              ])
            ),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        // eslint-disable-next-line no-console
        console.error("Failed to upsert constellation_state:", upsertError);
        // Don't fail the request - synthesis was successful
      }

      const { error: profileErr } = await supabase
        .from("user_profiles")
        .update({ onairos_data: sanitizedOnairosData })
        .eq("id", userId);

      if (profileErr) {
        // eslint-disable-next-line no-console
        console.error(
          "Failed to update user_profiles.onairos_data:",
          profileErr
        );
      }

      return {
        success: true,
        synthesis,
        archetype,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // eslint-disable-next-line no-console
      console.error("synthesize-constellation error:", error);
      throw new HttpException({ error: "synthesis_failed" }, 500);
    }
  }
}
