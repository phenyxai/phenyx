import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { OnairosSnapshotService } from "./onairos-snapshot.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";

// Task-specific instructions only — voice/tone rules come from the shared Voice
// Standard block (PHE-20), composed at call time via buildSystemBlocks().
const TASK_INSTRUCTIONS = `you are the PHENYX constellation synthesis engine. your job is to map a person’s onairos trait data to four identity pillar scores and write a one-paragraph synthesis for each active pillar.

the four active pillars at onboarding are:

origin: the foundational self, what was always true before it was named. maps to consistency signals, earliest behavioral patterns and stable recurring traits.

emergence: how identity became visible to others, the first time something internal showed. maps to traits others would recognize before the person does, social and relational signals, and archetype alignment.

self-creation: the identity the person is actively building: deliberate choices, creative output, disciplines pursued. maps to positive traits with high scores, creative and builder signals, and intentional behavior patterns.

convergence: where all the threads meet, the through-line across traits and interests that seem unrelated. maps to cross-trait patterns, the intersection of positive and improvement traits, and recurring nudge themes.

scoring rules:
- score each pillar 0 to 100 based on how strongly the trait data supports it
- read a trait_to_improve as a pattern too. low consistency scores map to origin as a pattern in how this person moves through the world
- use the user_summary and top_traits_explanation as primary synthesis material
- the archetype label informs emergence most directly

for each pillar return:
- score: integer 0-100
- synthesis: one paragraph, written directly to the person as "you", reflecting back what their data shows. no therapeutic language, and never "journey", "authentic" or "growth". specific to their data, never generic.

return only a valid JSON object in this exact shape. no preamble, no markdown, no explanation:

{
  "origin": { "score": 0-100, "synthesis": "string" },
  "emergence": { "score": 0-100, "synthesis": "string" },
  "self_creation": { "score": 0-100, "synthesis": "string" },
  "convergence": { "score": 0-100, "synthesis": "string" }
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
          max_tokens: 1000,
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

      let synthesis: {
        origin: { score: number; synthesis: string };
        emergence: { score: number; synthesis: string };
        self_creation: { score: number; synthesis: string };
        convergence: { score: number; synthesis: string };
      };

      try {
        synthesis = JSON.parse(claude.content[0].text.trim());

        const pillars = [
          "origin",
          "emergence",
          "self_creation",
          "convergence",
        ] as const;
        for (const p of pillars) {
          if (
            typeof synthesis[p]?.score !== "number" ||
            typeof synthesis[p]?.synthesis !== "string"
          ) {
            throw new Error(`invalid shape for ${p}`);
          }
          // Plain-text guard — strip any markup the model slipped in.
          synthesis[p].synthesis = this.voiceStandard.sanitizeProse(
            synthesis[p].synthesis,
            "pillar"
          );
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
            origin_score: synthesis.origin.score,
            origin_synthesis: synthesis.origin.synthesis,
            emergence_score: synthesis.emergence.score,
            emergence_synthesis: synthesis.emergence.synthesis,
            self_creation_score: synthesis.self_creation.score,
            self_creation_synthesis: synthesis.self_creation.synthesis,
            convergence_score: synthesis.convergence.score,
            convergence_synthesis: synthesis.convergence.synthesis,
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
