import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Service-role client; lazy so module load does not require env vars. */
  getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.config.get<string>("SUPABASE_URL");
      const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) {
        throw new Error(
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
        );
      }
      this.client = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this.client;
  }

  /**
   * Anon-key client. Used by the OTP-verify path to exchange an admin-generated
   * magic-link token for a real GoTrue session (access + refresh tokens) which
   * the browser then adopts — the service-role client cannot mint a session.
   * Lazy + stateless (no session persistence) so concurrent verifies don't share
   * auth state.
   */
  getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      const url = this.config.get<string>("SUPABASE_URL");
      const key = this.config.get<string>("SUPABASE_ANON_KEY");
      if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      }
      this.anonClient = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this.anonClient;
  }
}
