import { Injectable } from "@nestjs/common";

@Injectable()
export class OnairosSnapshotService {
  /**
   * Redacts secrets from Onairos completion payloads before storing in Supabase.
   * Never persist the session JWT (`token`) in `user_profiles`.
   */
  redactOnairosForProfile(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== "object") {
      return {};
    }
    const o = { ...(input as Record<string, unknown>) };
    delete (o as any).token;
    return o;
  }
}
