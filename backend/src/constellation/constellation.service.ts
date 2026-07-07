import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { BillingService } from "../stripe/billing.service";
import {
  applyReadGate,
  ObservationRow,
  ServedObservation,
} from "../observations/gating";
import { normalizePillar } from "../observations/signal-hash";

/**
 * PHE-31 — read model behind `GET /constellation`.
 *
 * Assembles the authed user's constellation (the four active pillar scores +
 * syntheses, the three locked pillars, the identity portrait, mantra, foresight,
 * and version) together with their observations timeline grouped per pillar. The
 * observations feed is gated exactly like the daily feed / timeline routes:
 * capabilities come from {@link BillingService.capabilitiesFor} and the same
 * pure {@link applyReadGate} is applied, so free serves one unlocked body (no
 * citations/provenance) and pro/gifted serve everything.
 */

/** Seven-pillar model, active-first — matches PILLAR_ORDER + the frontend layout. */
const PILLARS = [
  "origin",
  "emergence",
  "self_creation",
  "convergence",
  "becoming",
  "recognition",
  "transcendence",
] as const;
type Pillar = (typeof PILLARS)[number];

/** The four pillars active at onboarding; the other three stay locked (null). */
const ACTIVE_PILLARS: ReadonlySet<string> = new Set([
  "origin",
  "emergence",
  "self_creation",
  "convergence",
]);

interface ConstellationTimelineEntry {
  id: string;
  /** Voice-Standard prose, or null when the read gate redacted a locked entry. */
  body: string | null;
  meta_label: string | null;
  surfaced_at: string;
  is_new: boolean;
}

interface ConstellationPillar {
  pillar: Pillar;
  active: boolean;
  score: number | null;
  synthesis: string | null;
  observation_count: number;
  has_new: boolean;
  source_platforms: string[];
  source_insight: string | null;
  timeline: ConstellationTimelineEntry[];
}

export interface ConstellationResponse {
  stellar_color: string | null;
  archetype: string | null;
  version: number | null;
  generated_at: string | null;
  /** Identity-portrait jsonb ({ prose } | string) — passed through verbatim. */
  portrait: unknown;
  mantra: string | null;
  foresight: string | null;
  pillars: ConstellationPillar[];
}

@Injectable()
export class ConstellationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billing: BillingService
  ) {}

  async getConstellation(userId: string): Promise<ConstellationResponse> {
    const supabase = this.supabaseService.getClient();

    // user_profiles is keyed by `id` (= auth.users.id); everything else by user_id.
    const [profileRes, stateRes, obsRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("stellar_color, tier")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("constellation_state")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("observations")
        .select(
          "id,pillar,body,source_platforms,meta_label,is_new,locked_for_free,surfaced_at"
        )
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: false }),
    ]);

    const tier = (profileRes.data?.tier as string | null) ?? "free";
    const capabilities = this.billing.capabilitiesFor(tier);
    const state = (stateRes.data ?? null) as Record<string, unknown> | null;

    // freshest-first, so the free unlock lands at index 0 (matches applyReadGate).
    const rows = (obsRes.data ?? []) as ObservationRow[];
    const served = applyReadGate(rows, capabilities);

    return {
      stellar_color: (profileRes.data?.stellar_color as string | null) ?? null,
      archetype: (state?.archetype as string | null) ?? null,
      version: (state?.version as number | null) ?? null,
      generated_at: (state?.generated_at as string | null) ?? null,
      portrait: state?.portrait ?? null,
      mantra: (state?.mantra as string | null) ?? null,
      foresight: (state?.foresight as string | null) ?? null,
      pillars: this.buildPillars(state, rows, served),
    };
  }

  private buildPillars(
    state: Record<string, unknown> | null,
    rows: ObservationRow[],
    served: ServedObservation[]
  ): ConstellationPillar[] {
    const byPillar = new Map<string, ConstellationPillar>();
    for (const pillar of PILLARS) {
      byPillar.set(pillar, {
        pillar,
        active: ACTIVE_PILLARS.has(pillar),
        score: this.readScore(state, pillar),
        synthesis: this.readSynthesis(state, pillar),
        observation_count: 0,
        has_new: false,
        source_platforms: [],
        source_insight: null,
        timeline: [],
      });
    }

    // rows and served are index-aligned — applyReadGate maps 1:1 in order.
    rows.forEach((row, i) => {
      const detail = byPillar.get(normalizePillar(row.pillar));
      if (!detail) return;
      const gated = served[i];

      detail.observation_count += 1;
      if (row.is_new) detail.has_new = true;

      detail.timeline.push({
        id: row.id,
        // Locked entries omit `body`/`sources`/`meta_line` in the gate.
        body: gated?.body ?? null,
        meta_label: gated?.meta_line ?? null,
        surfaced_at: row.surfaced_at,
        is_new: row.is_new,
      });

      // Citations only when the gate served them (pro/gifted). Freshest-first
      // union keeps the pillar's source badges stable across reads.
      for (const platform of gated?.sources ?? []) {
        if (!detail.source_platforms.includes(platform)) {
          detail.source_platforms.push(platform);
        }
      }
      if (!detail.source_insight && gated?.meta_line) {
        detail.source_insight = gated.meta_line;
      }
    });

    return PILLARS.map((p) => byPillar.get(p) as ConstellationPillar);
  }

  private readScore(
    state: Record<string, unknown> | null,
    pillar: Pillar
  ): number | null {
    const v = state?.[`${pillar}_score`];
    return typeof v === "number" ? v : null;
  }

  private readSynthesis(
    state: Record<string, unknown> | null,
    pillar: Pillar
  ): string | null {
    const v = state?.[`${pillar}_synthesis`];
    return typeof v === "string" ? v : null;
  }
}
