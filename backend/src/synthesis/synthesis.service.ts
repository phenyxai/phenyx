import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import { CrisisService } from "./crisis.service";
import { VoiceStandardService } from "../voice-standard/voice-standard.service";

const PILLAR_POSITIONS: Record<string, { x: number; y: number }> = {
  ORIGIN: { x: 0.5, y: 0.88 },
  EMERGENCE: { x: 0.22, y: 0.72 },
  "SELF-CREATION": { x: 0.14, y: 0.45 },
  CONVERGENCE: { x: 0.5, y: 0.48 },
  BECOMING: { x: 0.8, y: 0.52 },
  RECOGNITION: { x: 0.72, y: 0.25 },
  TRANSCENDENCE: { x: 0.5, y: 0.1 },
};

interface SynthesizeBody {
  pillar?: string;
  reflectionText?: string;
  onairosData?: unknown;
  experienceMode?: "signal" | "observatory" | "reflection" | string;
}

@Injectable()
export class SynthesisService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly encryption: EncryptionService,
    private readonly crisis: CrisisService,
    private readonly voiceStandard: VoiceStandardService
  ) {}

  async synthesize(userId: string, body: SynthesizeBody) {
    const supabase = this.supabaseService.getClient();
    const { pillar, reflectionText, onairosData, experienceMode } = body;

    const VALID = Object.keys(PILLAR_POSITIONS);
    if (!pillar || !VALID.includes(pillar)) {
      throw new HttpException({ error: "invalid pillar" }, 400);
    }
    if (!reflectionText?.trim()) {
      throw new HttpException({ error: "reflection required" }, 400);
    }

    if (this.crisis.detect(reflectionText)) {
      await supabase.from("user_persona").upsert(
        {
          user_id: userId,
          pillar,
          reflection_text: this.encryption.encrypt(reflectionText),
          synthesized_insight: null,
          onairos_data: onairosData
            ? this.encryption.encrypt(JSON.stringify(onairosData))
            : null,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pillar" }
      );

      return {
        insight: this.crisis.response.insight,
        resources: this.crisis.response.resources,
        isCrisis: true,
      };
    }

    const modeInstruction =
      experienceMode === "signal"
        ? "the user is in signal mode. be direct and concise. lead with the core recognition immediately. one or two sentences maximum."
        : experienceMode === "observatory"
        ? "the user is in observatory mode. name the sources. be specific about which signals shaped this insight. include the pattern name explicitly."
        : "the user is in reflection mode. use the full cinematic voice. three sentences. poetic but precise.";

    // Fetch constellation_state for additional context
    let constellationContext = "";
    const { data: constellationState } = await supabase
      .from("constellation_state")
      .select(
        "origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis"
      )
      .eq("user_id", userId)
      .single();

    if (constellationState) {
      const syntheses = [
        constellationState.origin_synthesis,
        constellationState.emergence_synthesis,
        constellationState.self_creation_synthesis,
        constellationState.convergence_synthesis,
      ]
        .filter(Boolean)
        .join(" ");

      if (syntheses) {
        constellationContext = `\n\nAdditional constellation context for this user: ${syntheses}`;
      }
    }

    // Task-specific instructions only — voice/tone rules come from the shared
    // Voice Standard block (PHE-20), composed below via buildSystemBlocks().
    const taskInstructions = `you are the synthesis engine for PHENYX COLLECTIVE — the first identity observatory.

your task: read a written personal reflection and optional platform behavioral signals, then synthesize a single precise emotionally resonant insight that names the pattern the person could not name themselves.

this is not a summary. it is a recognition.

${modeInstruction}

strict prohibitions — never break these:
- no diagnostic language
- no disorders, conditions, or pathologies
- no content interpretable as therapeutic advice
- never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology
- if reflection contains distressing content: return a warm observation about the person's capacity for self-awareness. do not address the distress directly.

also return three float values between 0 and 1:
intensity: strength of this identity signal
clarity: how defined this pillar is becoming
depth: emotional depth reached in this reflection

return ONLY valid JSON. no markdown. no backticks. no preamble. exactly this shape:
{"insight":string,"intensity":number,"clarity":number,"depth":number}`;

    const userMessage = `pillar: ${pillar}
onairos behavioral context: ${
      onairosData ? JSON.stringify(onairosData) : "not connected — reflection only"
    }
reflection: ${reflectionText}${constellationContext}`;

    let synthesis: {
      insight: string;
      intensity: number;
      clarity: number;
      depth: number;
    };

    try {
      // [Voice Standard] (cached) + [task instructions]; per-request grounding
      // stays in the user message, after the cached prefix.
      const system = await this.voiceStandard.buildSystemBlocks(taskInstructions);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.get<string>("ANTHROPIC_API_KEY") as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      const claude: any = await res.json();
      synthesis = JSON.parse(claude.content[0].text.trim());
      if (typeof synthesis.insight !== "string") throw new Error("invalid shape");
      // Plain-text guard — strip any markup the model slipped in.
      synthesis.insight = this.voiceStandard.sanitizeProse(synthesis.insight);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("synthesis error:", e);
      throw new HttpException({ error: "synthesis failed" }, 500);
    }

    const encReflection = this.encryption.encrypt(reflectionText);
    const encInsight = this.encryption.encrypt(synthesis.insight);
    const encOnairos = onairosData
      ? this.encryption.encrypt(JSON.stringify(onairosData))
      : null;

    await supabase.from("user_persona").upsert(
      {
        user_id: userId,
        pillar,
        reflection_text: encReflection,
        synthesized_insight: encInsight,
        onairos_data: encOnairos,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,pillar" }
    );

    const pos = PILLAR_POSITIONS[pillar];

    await supabase.from("constellation_points").upsert(
      {
        user_id: userId,
        pillar,
        x_position: pos.x,
        y_position: pos.y,
        intensity: synthesis.intensity,
        label: pillar.toLowerCase(),
        is_active: true,
      },
      { onConflict: "user_id,pillar" }
    );

    await supabase.rpc("increment_constellation_age", {
      user_id_input: userId,
      amount: 10,
    });

    return {
      insight: synthesis.insight,
      intensity: synthesis.intensity,
      clarity: synthesis.clarity,
      depth: synthesis.depth,
      pillar,
      isCrisis: false,
    };
  }
}
