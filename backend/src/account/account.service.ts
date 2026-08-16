import { HttpException, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { EncryptionService } from "../common/encryption.service";
import { PassphraseService, PASSPHRASE_ALGO } from "../auth/passphrase.service";
import {
  AccountCloseDto,
  AccountPassphraseChangeDto,
  closeAccountError,
  passphraseChangeError,
  readPassphrase,
} from "./account.dto";
import { scrubCredentials } from "./account.redaction";

/**
 * PHE-42 / PHE-75 — Account Lifecycle service.
 *
 * Owner-scoped operations, all keyed by the `userId` the guard resolved from
 * the bearer (never the request body):
 *   • export   — a single portable JSON dump of everything observed about the
 *                owner, with Polaris turns decrypted owner-side and a hard "no
 *                token/JWT ever leaves" guarantee (see {@link scrubCredentials}).
 *   • close    — two-gate destroy: current passphrase + typed confirmation.
 *   • passphrase — rotate the returning passphrase after proving the current one.
 *
 * Freeze/pause is gone: disconnecting through Onairos is the only stop.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryption: EncryptionService,
    private readonly passphrase: PassphraseService
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
      sourceRecords,
      signals,
      underneath,
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
      supabase
        .from("source_records")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("signals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("underneath_readings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const bundle: Record<string, unknown> = {
      export_metadata: {
        user_id: userId,
        exported_at: new Date().toISOString(),
        format: "phenyx.account.export.v1",
        note: "Owner export. Contains no authentication tokens or JWTs. Onairos snapshots are the redacted ones stored at connect time; Polaris message bodies are decrypted for the owner.",
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
      source_records: sourceRecords.error ? [] : sourceRecords.data ?? [],
      signals: signals.error ? [] : signals.data ?? [],
      underneath_readings: underneath.error ? [] : underneath.data ?? [],
    };

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
  // Close
  // --------------------------------------------------------------------------

  /**
   * Permanently close the account. Checks run in fill order: passphrase first,
   * then the typed confirmation phrase. Rejected (400) before anything is
   * touched. Deletes the auth user via the service role, which cascades to every
   * per-user table. Irreversible. Logs only `{ user_id, timestamp }` — never any
   * content.
   */
  async closeAccount(
    userId: string,
    body: AccountCloseDto | undefined
  ): Promise<{ deleted: true }> {
    const passphrase = readPassphrase(body?.passphrase);
    const fieldError = closeAccountError(passphrase, body?.confirmation);
    if (fieldError) {
      throw new HttpException({ error: fieldError }, 400);
    }

    const verified = await this.verifyCurrentPassphrase(userId, passphrase);
    if (!verified) {
      throw new HttpException(
        { error: "enter your passphrase to confirm it is you." },
        400
      );
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`account close failed for ${userId}: ${error.message}`);
      throw new HttpException({ error: "could not close the account." }, 500);
    }

    this.logger.log(
      JSON.stringify({ event: "account_deleted", user_id: userId, ts: new Date().toISOString() })
    );
    return { deleted: true };
  }

  // --------------------------------------------------------------------------
  // Passphrase change
  // --------------------------------------------------------------------------

  async changePassphrase(
    userId: string,
    body: AccountPassphraseChangeDto | undefined
  ): Promise<{ updated: true }> {
    const current = readPassphrase(body?.currentPassphrase);
    const next = readPassphrase(body?.newPassphrase);
    const fieldError = passphraseChangeError(current, next);
    if (fieldError) {
      throw new HttpException({ error: fieldError }, 400);
    }

    const verified = await this.verifyCurrentPassphrase(userId, current);
    if (!verified) {
      throw new HttpException(
        { error: "enter your current passphrase to confirm it is you." },
        400
      );
    }

    const newHash = await this.passphrase.hash(next);
    const supabase = this.supabaseService.getClient();
    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({ passphrase_hash: newHash, passphrase_algo: PASSPHRASE_ALGO })
      .eq("id", userId);
    if (updateErr) {
      this.logger.error(`passphrase change failed for ${userId}: ${updateErr.message}`);
      throw new HttpException({ error: "could not update your passphrase." }, 500);
    }

    // Rotate the unused GoTrue password so existing sessions must re-enter.
    const { error: rotateErr } = await supabase.auth.admin.updateUserById(userId, {
      password: randomBytes(32).toString("hex"),
    });
    if (rotateErr) {
      this.logger.error(`session rotate after passphrase change failed: ${rotateErr.message}`);
    }

    return { updated: true };
  }

  /** True when the typed passphrase matches the stored Argon2id hash. */
  async verifyCurrentPassphrase(userId: string, passphrase: string): Promise<boolean> {
    if (!passphrase.trim()) return false;
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("passphrase_hash")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data?.passphrase_hash) return false;
    return this.passphrase.verify(data.passphrase_hash as string, passphrase);
  }

  /**
   * Remove constellation content (points, observations, polaris history, traits,
   * v66 records) while keeping the account and profile. Irreversible.
   */
  async clearConstellation(userId: string): Promise<{ cleared: true }> {
    const supabase = this.supabaseService.getClient();
    const tables = [
      "underneath_readings",
      "artifact_observations",
      "generated_artifacts",
      "observation_signals",
      "area_signal_memberships",
      "areas",
      "signal_source_records",
      "signals",
      "source_records",
      "polaris_messages",
      "polaris_conversations",
      "observations",
      "user_traits",
      "constellation_points",
      "constellation_state",
    ];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) {
        this.logger.error(`constellation clear ${table} failed: ${error.message}`);
      }
    }
    return { cleared: true };
  }
}
