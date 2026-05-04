import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client: SupabaseClient | null = null;

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
}
