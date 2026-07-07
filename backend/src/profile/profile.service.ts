import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

/**
 * PHE-30 / PHE-38 — read model behind `GET /profile/overview`.
 *
 * Everything the Profile tab renders in one payload: the display name, the
 * connected-platform badges (from `onairos_connections`, falling back to the
 * `user_persona` snapshot), the three-item "WHAT WE HAVE SEEN" behavioral
 * snapshot (grounded traits, degrading to the active-pillar syntheses), the
 * "WHAT PHENYX FORESEES" line (`constellation_state.foresight`), and the tier.
 */

export interface ProfileSnapshotItem {
  pillar_label: string;
  sentence: string;
}

export interface ProfileOverviewResponse {
  display_name: string | null;
  connected_platforms: string[];
  /** The Profile tab renders exactly (up to) 3 items. */
  snapshot: ProfileSnapshotItem[];
  foresight: string | null;
  tier: string;
}

const SNAPSHOT_LIMIT = 3;
const ACTIVE_PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
] as const;

@Injectable()
export class ProfileService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getOverview(userId: string): Promise<ProfileOverviewResponse> {
    const supabase = this.supabaseService.getClient();

    // user_profiles is keyed by `id` (= auth.users.id); the rest by user_id.
    const [profileRes, personaRes, connectionsRes, traitsRes, stateRes] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("display_name, tier")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("user_persona")
          .select("connected_platforms")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("onairos_connections")
          .select("platform")
          .eq("user_id", userId)
          .eq("status", "connected"),
        supabase
          .from("user_traits")
          .select("keyword_tags, insight")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(SNAPSHOT_LIMIT * 4),
        supabase
          .from("constellation_state")
          .select(
            "foresight, origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis"
          )
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const connected = (connectionsRes.data ?? []) as { platform: string }[];
    const personaPlatforms =
      (personaRes.data?.connected_platforms as string[] | null) ?? [];
    // onairos_connections is the source of truth; fall back to the persona
    // snapshot so the header still populates before any connection row exists.
    const connectedPlatforms =
      connected.length > 0
        ? [...new Set(connected.map((c) => c.platform))]
        : personaPlatforms;

    const state = (stateRes.data ?? null) as Record<string, unknown> | null;
    const traits = (traitsRes.data ?? []) as {
      keyword_tags: string[] | null;
      insight: string | null;
    }[];

    return {
      display_name: (profileRes.data?.display_name as string | null) ?? null,
      connected_platforms: connectedPlatforms,
      snapshot: this.buildSnapshot(traits, state),
      foresight: (state?.foresight as string | null) ?? null,
      tier: (profileRes.data?.tier as string | null) ?? "free",
    };
  }

  /**
   * "WHAT WE HAVE SEEN" — up to 3 behavioral snapshot items. Prefers the grounded
   * trait store (keyword label + insight); when a user has no traits yet it
   * degrades to the active-pillar syntheses so the section still reads. Returns an
   * empty array only when neither source has content (the tab hides it then).
   */
  private buildSnapshot(
    traits: { keyword_tags: string[] | null; insight: string | null }[],
    state: Record<string, unknown> | null
  ): ProfileSnapshotItem[] {
    const fromTraits: ProfileSnapshotItem[] = [];
    for (const t of traits) {
      const sentence = t.insight?.trim();
      if (!sentence) continue;
      const label = (t.keyword_tags ?? []).find((k) => k?.trim())?.trim();
      fromTraits.push({ pillar_label: label ?? "signal", sentence });
      if (fromTraits.length >= SNAPSHOT_LIMIT) break;
    }
    if (fromTraits.length > 0) return fromTraits;

    const fromState: ProfileSnapshotItem[] = [];
    for (const pillar of ACTIVE_PILLARS) {
      const synthesis = state?.[`${pillar}_synthesis`];
      if (typeof synthesis !== "string" || !synthesis.trim()) continue;
      fromState.push({
        pillar_label: pillar.replace(/_/g, " "),
        sentence: this.firstSentence(synthesis),
      });
      if (fromState.length >= SNAPSHOT_LIMIT) break;
    }
    return fromState;
  }

  /** First sentence of a synthesis paragraph, for the compact snapshot line. */
  private firstSentence(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^.*?[.!?](\s|$)/);
    return (match ? match[0] : trimmed).trim();
  }
}
