import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { sanitizeProse } from "./sanitize-prose";

export interface VoiceStandard {
  id: string;
  version: number;
  body: string;
  is_active: boolean;
  created_at: string;
}

/**
 * One block in the Anthropic `system` array. The Voice Standard block carries
 * `cache_control: { type: "ephemeral" }` so the byte-stable standard is prompt-cached
 * across requests (and shared across every generator that composes it).
 */
export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * PHE-20 — the single source of truth for the Polaris Voice Standard.
 *
 * `getActiveVoiceStandard()` reads the one active, versioned row from the
 * `voice_standard` table (DB-backed so wording changes ship with no code deploy).
 * `buildSystemBlocks()` composes [Voice Standard (cached)] + [task instructions]
 * into the Anthropic system array used by both the synthesis and persona generators.
 *
 * The standard is marked `cache_control: ephemeral` and rendered first so it forms a
 * byte-stable, cacheable prefix shared across every Claude call in the product.
 */
@Injectable()
export class VoiceStandardService {
  /**
   * Short-lived in-process cache of the active standard. Avoids a DB round-trip on
   * every Claude call while keeping activation eventually-consistent: when a new
   * version is activated in the DB, all running instances pick it up within
   * CACHE_TTL_MS with no code deploy or restart (PHE-20 AC3). The TTL is short
   * relative to how often wording changes, so the byte-stable prompt-cache prefix is
   * effectively unaffected. refresh() forces an immediate re-fetch (e.g. from a future
   * admin activation endpoint that wants zero-lag propagation on the local instance).
   */
  private static readonly CACHE_TTL_MS = 60_000;
  private cached: VoiceStandard | null = null;
  private cachedAt = 0;

  constructor(private readonly supabaseService: SupabaseService) {}

  async getActiveVoiceStandard(): Promise<VoiceStandard> {
    if (
      this.cached &&
      Date.now() - this.cachedAt < VoiceStandardService.CACHE_TTL_MS
    ) {
      return this.cached;
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("voice_standard")
      .select("id, version, body, is_active, created_at")
      .eq("is_active", true)
      .single();

    if (error || !data) {
      throw new Error(
        `no active voice_standard found${error ? `: ${error.message}` : ""}`
      );
    }

    this.cached = data as VoiceStandard;
    this.cachedAt = Date.now();
    return this.cached;
  }

  /** Drop the in-process cache so the next read re-fetches the active version. */
  refresh(): void {
    this.cached = null;
    this.cachedAt = 0;
  }

  /**
   * Build the Anthropic `system` array: the active Voice Standard (cached, frozen,
   * first) followed by the caller's task-specific instructions (scoring rules,
   * JSON shape, safety prohibitions). Per-request volatile grounding belongs in the
   * user message, after this cached prefix.
   */
  async buildSystemBlocks(taskInstructions: string): Promise<SystemBlock[]> {
    const standard = await this.getActiveVoiceStandard();
    return [
      {
        type: "text",
        text: standard.body,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: taskInstructions },
    ];
  }

  /** Plain-text guard — strips any markup the model emits. See sanitize-prose.ts. */
  sanitizeProse(text: string): string {
    return sanitizeProse(text);
  }
}
