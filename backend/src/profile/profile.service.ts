import { HttpException, Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { PassphraseService } from "../auth/passphrase.service";
import { pickHeldConstants, type HeldConstant } from "./held";

/**
 * PHE-30 / PHE-38 / PHE-75 — read model behind `GET /profile/overview`.
 *
 * Identity (name, email, joined, tier as free|pro), connected platforms,
 * stellar colour, and four "what has held" constants. Snapshot/foresight are
 * still returned for older clients but Profile v67 does not render them.
 */

export interface ProfileSnapshotItem {
  pillar_label: string;
  sentence: string;
}

export const NOTIFICATION_DEFAULTS = {
  new_observations: true,
  weekly_constellation_update: true,
  polaris_observations: false,
  platform_connection_alerts: true,
} as const;

export type NotificationPrefs = {
  new_observations: boolean;
  weekly_constellation_update: boolean;
  polaris_observations: boolean;
  platform_connection_alerts: boolean;
};

const NOTIFICATION_STORE_KEY = "__notifications";

export interface ProfileOverviewResponse {
  display_name: string | null;
  email: string | null;
  joined: string | null;
  stellar_color: string | null;
  connected_platforms: string[];
  held: HeldConstant[];
  /** Kept for older clients; Profile v67 does not render this. */
  snapshot: ProfileSnapshotItem[];
  foresight: string | null;
  /** `free` or `pro` — gifted is never returned as product copy. */
  tier: "free" | "pro";
  notification_prefs: NotificationPrefs;
}

const SNAPSHOT_LIMIT = 3;
const HELD_CANDIDATE_LIMIT = 16;
const ACTIVE_PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly passphrase: PassphraseService
  ) {}

  async getOverview(userId: string): Promise<ProfileOverviewResponse> {
    const supabase = this.supabaseService.getClient();

    const [profileRes, personaRes, connectionsRes, traitsRes, stateRes, email] =
      await Promise.all([
        supabase
          .from("user_profiles")
          .select("display_name, tier, stellar_color, created_at, prompt_times")
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
          .limit(HELD_CANDIDATE_LIMIT),
        supabase
          .from("constellation_state")
          .select(
            "foresight, origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis"
          )
          .eq("user_id", userId)
          .maybeSingle(),
        this.resolveEmail(userId),
      ]);

    const connected = (connectionsRes.data ?? []) as { platform: string }[];
    const personaPlatforms =
      (personaRes.data?.connected_platforms as string[] | null) ?? [];
    const connectedPlatforms =
      connected.length > 0
        ? [...new Set(connected.map((c) => c.platform))]
        : personaPlatforms;

    const state = (stateRes.data ?? null) as Record<string, unknown> | null;
    const traits = (traitsRes.data ?? []) as {
      keyword_tags: string[] | null;
      insight: string | null;
    }[];

    const rawTier = (profileRes.data?.tier as string | null) ?? "free";
    const promptTimes =
      (profileRes.data?.prompt_times as Record<string, unknown> | null) ?? {};

    return {
      display_name: (profileRes.data?.display_name as string | null) ?? null,
      email,
      joined: formatJoined(profileRes.data?.created_at as string | null),
      stellar_color: (profileRes.data?.stellar_color as string | null) ?? null,
      connected_platforms: connectedPlatforms,
      held: pickHeldConstants(this.buildHeld(traits, state)),
      snapshot: this.buildSnapshot(traits, state),
      foresight: (state?.foresight as string | null) ?? null,
      tier: rawTier === "free" ? "free" : "pro",
      notification_prefs: readStoredPrefs(promptTimes),
    };
  }

  async updateIdentity(
    userId: string,
    body: { display_name?: unknown; email?: unknown; passphrase?: unknown }
  ): Promise<{ updated: true }> {
    const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
    if (!passphrase.trim()) {
      throw new HttpException(
        { error: "enter your passphrase to confirm the change." },
        400
      );
    }
    const ok = await this.verifyCurrentPassphrase(userId, passphrase);
    if (!ok) {
      throw new HttpException(
        { error: "enter your passphrase to confirm the change." },
        400
      );
    }

    const supabase = this.supabaseService.getClient();
    const name =
      typeof body.display_name === "string" ? body.display_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (name) {
      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: name })
        .eq("id", userId);
      if (error) {
        this.logger.error(`identity name update failed: ${error.message}`);
        throw new HttpException({ error: "could not save the change." }, 500);
      }
    }

    if (email) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { email });
      if (error) {
        this.logger.error(`identity email update failed: ${error.message}`);
        throw new HttpException({ error: "could not save the change." }, 500);
      }
    }

    return { updated: true };
  }

  async getNotifications(userId: string): Promise<NotificationPrefs> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("prompt_times")
      .eq("id", userId)
      .maybeSingle();
    return readStoredPrefs(
      (data?.prompt_times as Record<string, unknown> | null) ?? {}
    );
  }

  async saveNotifications(
    userId: string,
    prefs: Partial<NotificationPrefs> | undefined
  ): Promise<{ notification_prefs: NotificationPrefs }> {
    const next = {
      ...NOTIFICATION_DEFAULTS,
      ...sanitizePrefs(prefs),
    };
    const supabase = this.supabaseService.getClient();
    const { data: current } = await supabase
      .from("user_profiles")
      .select("prompt_times")
      .eq("id", userId)
      .maybeSingle();
    const promptTimes = {
      ...((current?.prompt_times as Record<string, unknown> | null) ?? {}),
      [NOTIFICATION_STORE_KEY]: next,
    };
    const { error } = await supabase
      .from("user_profiles")
      .update({ prompt_times: promptTimes })
      .eq("id", userId);
    if (error) {
      this.logger.error(`notification prefs save failed: ${error.message}`);
      throw new HttpException({ error: "could not save your preferences." }, 500);
    }
    return { notification_prefs: next };
  }

  /**
   * Held constants prefer grounded traits (keyword + insight). When a person
   * has fewer than four traits, active-pillar syntheses fill the remaining
   * slots so the 2x2 still reads. Empty only when neither source has content.
   */
  private buildHeld(
    traits: { keyword_tags: string[] | null; insight: string | null }[],
    state: Record<string, unknown> | null
  ): HeldConstant[] {
    const fromTraits: HeldConstant[] = [];
    for (const t of traits) {
      const body = t.insight?.trim();
      if (!body) continue;
      const title = (t.keyword_tags ?? []).find((k) => k?.trim())?.trim() ?? "held";
      fromTraits.push({ title, body });
    }
    if (fromTraits.length >= 4) return fromTraits;

    const fromState: HeldConstant[] = [];
    for (const pillar of ACTIVE_PILLARS) {
      const synthesis = state?.[`${pillar}_synthesis`];
      if (typeof synthesis !== "string" || !synthesis.trim()) continue;
      fromState.push({
        title: pillar.replace(/_/g, " "),
        body: this.firstSentence(synthesis),
      });
    }
    return [...fromTraits, ...fromState];
  }

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

  private firstSentence(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^.*?[.!?](\s|$)/);
    return (match ? match[0] : trimmed).trim();
  }

  private async verifyCurrentPassphrase(
    userId: string,
    passphrase: string
  ): Promise<boolean> {
    if (!passphrase.trim()) return false;
    const { data, error } = await this.supabaseService
      .getClient()
      .from("user_profiles")
      .select("passphrase_hash")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data?.passphrase_hash) return false;
    return this.passphrase.verify(data.passphrase_hash as string, passphrase);
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  }
}

export function formatJoined(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - d.getTime() < weekMs) return "on phenyx since this week";
  return `on phenyx since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function readStoredPrefs(promptTimes: Record<string, unknown>): NotificationPrefs {
  const stored = promptTimes[NOTIFICATION_STORE_KEY];
  return {
    ...NOTIFICATION_DEFAULTS,
    ...sanitizePrefs(stored),
  };
}

function sanitizePrefs(value: unknown): Partial<NotificationPrefs> {
  if (!value || typeof value !== "object") return {};
  const src = value as Record<string, unknown>;
  const out: Partial<NotificationPrefs> = {};
  for (const key of Object.keys(NOTIFICATION_DEFAULTS) as (keyof NotificationPrefs)[]) {
    if (typeof src[key] === "boolean") out[key] = src[key] as boolean;
  }
  // Older modal used polaris_insights; map it onto polaris_observations.
  if (
    typeof src.polaris_insights === "boolean" &&
    typeof src.polaris_observations !== "boolean"
  ) {
    out.polaris_observations = src.polaris_insights;
  }
  return out;
}
