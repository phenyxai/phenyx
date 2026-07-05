import { HttpException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { OnairosSnapshotService } from "../persona/onairos-snapshot.service";
import { PersonaService } from "../persona/persona.service";
import type { OnairosConnectDto } from "./onairos.dto";

type SynthesisTrigger = "onboarding" | "platform_refresh";

interface EnqueueInput {
  userId: string;
  platforms: string[];
  trigger: SynthesisTrigger;
  redactedSnapshot: Record<string, unknown>;
}

/**
 * Onairos server loop (PHE-40).
 *
 * connect → verify token server-side then DISCARD → redact trait object →
 * upsert onairos_connections on (user_id, platform) → enqueue synthesis once.
 * disconnect → status flip + disconnected_at; NO synthesis, NO data deletion.
 *
 * Hard invariant: the Onairos JWT is never persisted (DB or logs) and never
 * returned. It exists only as a local `token` parameter during verification.
 */
@Injectable()
export class OnairosService {
  private readonly logger = new Logger("OnairosService");

  // Process-local idempotency guard on the synthesis event_id.
  // SEAM (PHE-34 durable queue): a Set in one process cannot dedup across
  // replicas or restarts. When PHE-34's synthesis queue lands, this becomes the
  // queue's durable dedup keyed on the same event_id.
  private readonly processedSynthesisEvents = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly snapshot: OnairosSnapshotService,
    private readonly persona: PersonaService
  ) {}

  async connect(userId: string, dto: OnairosConnectDto) {
    const platforms = this.normalizePlatforms(dto);
    if (platforms.length === 0) {
      throw new HttpException({ error: "platform required" }, 400);
    }

    // 1) Verify the Onairos token server-side, then DISCARD. `token` is a local
    //    const only — nothing below reads it, so it cannot reach the DB or logs.
    if (dto.token !== undefined) {
      const verified = await this.verifyToken(dto.token);
      if (!verified) {
        throw new HttpException({ error: "invalid onairos token" }, 401);
      }
    }

    // 2) Redact the trait object before ANY persist (deep-strips token/jwt/etc,
    //    so a schema-loose trait-shape change cannot smuggle a credential through).
    const redacted =
      dto.trait_object !== undefined
        ? this.snapshot.redactOnairosForProfile(dto.trait_object)
        : null;

    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    // 3) Upsert one connection row per platform on (user_id, platform).
    //    A bare reconnect ({ platform } only) records the connection without
    //    clobbering an existing redacted snapshot.
    const rows = platforms.map((platform) => ({
      user_id: userId,
      platform,
      status: "connected",
      ...(redacted ? { redacted_snapshot: redacted } : {}),
      connected_at: now,
      disconnected_at: null,
    }));

    const { error } = await supabase
      .from("onairos_connections")
      .upsert(rows, { onConflict: "user_id,platform" });
    if (error) {
      this.logger.error(`connect upsert failed: ${error.message}`);
      throw new HttpException({ error: "connect failed" }, 500);
    }

    // 4) Enqueue synthesis exactly once for this (user, platforms, trait) event.
    //    Only when new trait data arrived — a bare reconnect has nothing to
    //    re-synthesize.
    let synthesisEnqueued = false;
    if (redacted) {
      synthesisEnqueued = await this.enqueueSynthesis({
        userId,
        platforms,
        trigger: dto.trigger ?? "platform_refresh",
        redactedSnapshot: redacted,
      });
    }

    this.audit("onairos_connect", {
      platforms,
      traitCount: this.countTraits(redacted),
      synthesisEnqueued,
    });

    return { platforms, status: "connected", synthesisEnqueued };
  }

  async disconnect(userId: string, platform: string) {
    const normalized = platform.trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    // Status flip only. No synthesis re-run, no observation/pattern deletion —
    // a later observation pull simply sees one fewer live platform.
    const { error } = await supabase
      .from("onairos_connections")
      .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("platform", normalized);
    if (error) {
      this.logger.error(`disconnect update failed: ${error.message}`);
      throw new HttpException({ error: "disconnect failed" }, 500);
    }

    this.audit("onairos_disconnect", { platforms: [normalized] });
    return { platform: normalized, status: "disconnected" };
  }

  async listConnections(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("onairos_connections")
      .select("platform, status, connected_at, disconnected_at")
      .eq("user_id", userId);
    if (error) {
      this.logger.error(`list connections failed: ${error.message}`);
      return { connections: [] };
    }
    return { connections: data ?? [] };
  }

  // --------------------------------------------------------------------------
  // Synthesis enqueue (idempotent) + seams.
  // --------------------------------------------------------------------------
  private async enqueueSynthesis(input: EnqueueInput): Promise<boolean> {
    const eventId = this.synthesisEventId(
      input.userId,
      input.platforms,
      input.redactedSnapshot
    );
    if (this.processedSynthesisEvents.has(eventId)) {
      return false; // already enqueued for this exact (user, platforms, trait).
    }
    this.processedSynthesisEvents.add(eventId);

    // PHE-42 "Onairos refresh skip-frozen": a frozen account must NOT trigger new
    // synthesis pulls (its patterns are retained, but no new data is ingested).
    if (await this.isAccountFrozen(input.userId)) {
      this.audit("onairos_synthesis_skipped_frozen", {
        platforms: input.platforms,
      });
      return false;
    }

    // SEAM (PHE-34 durable queue): today we drive the existing synchronous
    // synthesis (PersonaService.generatePrompts) fire-and-forget with the
    // REDACTED snapshot — never the token. When PHE-34's queue lands, replace this
    // direct call with an enqueue keyed on `eventId`; the dedup Set above becomes
    // the queue's durable dedup.
    void this.persona
      .generatePrompts({ userId: input.userId, onairosData: input.redactedSnapshot })
      .catch((e) =>
        this.logger.error(
          `synthesis trigger failed: ${e instanceof Error ? e.message : String(e)}`
        )
      );
    return true;
  }

  /**
   * SEAM: real Onairos token verification (SDK / `ONAIROS_API_SECRET`). Today we
   * structurally validate a non-empty bearer-shaped string; when the secret is
   * configured this is where HMAC / JWKS verification attaches. Either way the
   * token is DISCARDED after this returns — its value never leaves this method.
   */
  private async verifyToken(token: string): Promise<boolean> {
    // Reading the secret documents the wiring point without persisting anything.
    const _secret = this.config.get<string>("ONAIROS_API_SECRET");
    void _secret;
    return typeof token === "string" && token.trim().length > 0;
  }

  /**
   * PHE-42 account-freeze lookup. A frozen account retains its data but ingests
   * nothing new, so no Onairos-driven synthesis fires while frozen. Keyed by
   * `user_profiles.id` (= auth.users.id). Fail-open on a read error — a transient
   * lookup failure must not silently drop a legitimate synthesis.
   */
  private async isAccountFrozen(userId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("frozen")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      this.logger.error(`frozen lookup failed for ${userId}: ${error.message}`);
      return false;
    }
    return data?.frozen === true;
  }

  private normalizePlatforms(dto: OnairosConnectDto): string[] {
    const list: string[] = [];
    if (typeof dto.platform === "string") list.push(dto.platform);
    if (Array.isArray(dto.platforms)) {
      for (const p of dto.platforms) if (typeof p === "string") list.push(p);
    }
    return Array.from(
      new Set(list.map((p) => p.trim().toLowerCase()).filter((p) => p.length > 0))
    );
  }

  /** event_id = sha256(user_id | sorted-platforms | trait_hash). */
  private synthesisEventId(
    userId: string,
    platforms: string[],
    snapshot: Record<string, unknown>
  ): string {
    const traitHash = createHash("sha256")
      .update(this.stableStringify(snapshot))
      .digest("hex");
    const key = `${userId}|${[...platforms].sort().join(",")}|${traitHash}`;
    return createHash("sha256").update(key).digest("hex");
  }

  /** Deterministic stringify (sorted keys) so the trait hash is stable. */
  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`);
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value ?? null);
  }

  /** Structural key count only — never trait content. */
  private countTraits(snapshot: Record<string, unknown> | null): number {
    if (!snapshot || typeof snapshot !== "object") return 0;
    return Object.keys(snapshot).length;
  }

  /**
   * Audit sink — STRUCTURAL metadata only (platform, trait count, timestamp).
   * Never trait content, never the token.
   */
  private audit(
    event: string,
    meta: { platforms: string[]; traitCount?: number; synthesisEnqueued?: boolean }
  ): void {
    this.logger.log(
      JSON.stringify({
        event,
        platforms: meta.platforms,
        traitCount: meta.traitCount ?? 0,
        synthesisEnqueued: meta.synthesisEnqueued ?? false,
        ts: new Date().toISOString(),
      })
    );
  }
}
