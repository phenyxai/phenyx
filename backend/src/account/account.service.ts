import { HttpException, Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import {
  AccountDeleteDto,
  DELETE_CONFIRMATION_PHRASE,
  isDeleteConfirmed,
} from "./account.dto";
import { scrubCredentials } from "./account.redaction";

/**
 * PHE-42 — Account Lifecycle service.
 *
 * Three owner-scoped operations, all keyed by the `userId` the guard resolved
 * from the bearer (never the request body):
 *   • export   — a single portable JSON dump of everything observed about the
 *                owner, with Polaris turns decrypted owner-side and a hard "no
 *                token/JWT ever leaves" guarantee (see {@link scrubCredentials}).
 *   • freeze   — flip `user_profiles.frozen`; idempotent no-op when already there.
 *   • delete   — service-role delete of the auth user, cascading every owned row.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryption: EncryptionService
  ) {}

  // --------------------------------------------------------------------------
  // Export
  // --------------------------------------------------------------------------

  /**
   * Assemble the portable export bundle. Every section is the owner's own rows;
   * Onairos snapshots are the redacted ones stored at connect time, Polaris turn
   * bodies are decrypted here (owner-only, server-side), and the whole bundle is
   * run through {@link scrubCredentials} as defense in depth so no credential-
   * shaped field can ever reach the download.
   */
  async exportAccount(userId: string): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();

    const [
      profile,
      persona,
      constellation,
      constellationPoints,
      observations,
      traits,
      onairos,
      conversations,
      messages,
      events,
    ] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_persona").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("constellation_state")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("constellation_points")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("observations")
        .select("*")
        .eq("user_id", userId)
        .order("surfaced_at", { ascending: true }),
      supabase
        .from("user_traits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("onairos_connections")
        .select("*")
        .eq("user_id", userId)
        .order("connected_at", { ascending: true }),
      supabase
        .from("polaris_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("polaris_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: true }),
    ]);

    const bundle: Record<string, unknown> = {
      export_metadata: {
        user_id: userId,
        exported_at: new Date().toISOString(),
        format: "phenyx.account.export.v1",
        // States plainly what the bundle intentionally never contains.
        note: "Owner data export. Contains no authentication tokens or JWTs. Onairos snapshots are the redacted ones stored at connect time; Polaris message bodies are decrypted for the owner.",
      },
      profile: profile.data ?? null,
      persona: persona.data ?? null,
      constellation: constellation.data ?? null,
      constellation_points: constellationPoints.data ?? [],
      observations: observations.data ?? [],
      traits: traits.data ?? [],
      onairos_connections: onairos.data ?? [],
      polaris_conversations: conversations.data ?? [],
      polaris_messages: this.decryptMessages(messages.data ?? []),
      events: events.data ?? [],
    };

    // Defense in depth: strip any credential-shaped key at any depth before the
    // bundle leaves the service, regardless of upstream schema drift.
    return scrubCredentials(bundle);
  }

  /**
   * Decrypt each Polaris turn body for the owner. The body is AES-256-GCM at rest
   * (phe31). A per-row try/catch keeps one undecryptable row from failing the
   * whole export: on failure the body is nulled and flagged rather than throwing.
   */
  private decryptMessages(
    rows: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const body = row.body;
      if (typeof body !== "string" || body.length === 0) return row;
      try {
        return { ...row, body: this.encryption.decrypt(body) };
      } catch (e) {
        this.logger.error(
          `polaris message decrypt failed during export: ${(e as Error).message}`
        );
        return { ...row, body: null, decrypt_error: true };
      }
    });
  }

  // --------------------------------------------------------------------------
  // Freeze / unfreeze
  // --------------------------------------------------------------------------

  /**
   * Flip `user_profiles.frozen`. Idempotent: freezing an already-frozen account
   * (or unfreezing an already-active one) is a no-op that still returns success
   * with `changed: false`.
   */
  async setFrozen(
    userId: string,
    frozen: boolean
  ): Promise<{ frozen: boolean; changed: boolean }> {
    const supabase = this.supabaseService.getClient();

    const { data: current, error: readErr } = await supabase
      .from("user_profiles")
      .select("frozen")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) {
      this.logger.error(`freeze read failed for ${userId}: ${readErr.message}`);
      throw new HttpException({ error: "freeze failed" }, 500);
    }
    if (!current) {
      throw new HttpException({ error: "profile not found" }, 404);
    }

    if (current.frozen === frozen) {
      return { frozen, changed: false }; // already in the requested state.
    }

    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({ frozen })
      .eq("id", userId);
    if (updateErr) {
      this.logger.error(`freeze update failed for ${userId}: ${updateErr.message}`);
      throw new HttpException({ error: "freeze failed" }, 500);
    }

    this.logger.log(
      JSON.stringify({ event: frozen ? "account_frozen" : "account_unfrozen", user_id: userId, ts: new Date().toISOString() })
    );
    return { frozen, changed: true };
  }

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------

  /**
   * Permanently delete the account. Requires the exact typed confirmation phrase
   * in the body — rejected (400) without it, before anything is touched. Deletes
   * the auth user via the service role, which cascades to every per-user table
   * (all declare `on delete cascade` on auth.users). Irreversible. Logs only
   * `{ user_id, timestamp }` — never any content.
   */
  async deleteAccount(
    userId: string,
    body: AccountDeleteDto | undefined
  ): Promise<{ deleted: true }> {
    if (!isDeleteConfirmed(body)) {
      throw new HttpException(
        {
          error: "confirmation required",
          detail: `send { "confirmation": "${DELETE_CONFIRMATION_PHRASE}" } to permanently delete this account`,
        },
        400
      );
    }

    const supabase = this.supabaseService.getClient();
    // Service-role auth-user delete → ON DELETE CASCADE removes every owned row
    // (profile, constellation, observations, traits, onairos, polaris, events, …).
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`account delete failed for ${userId}: ${error.message}`);
      throw new HttpException({ error: "delete failed" }, 500);
    }

    // Terminal audit — user id + timestamp only, never content.
    this.logger.log(
      JSON.stringify({ event: "account_deleted", user_id: userId, ts: new Date().toISOString() })
    );
    return { deleted: true };
  }
}
