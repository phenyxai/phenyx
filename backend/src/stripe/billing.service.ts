import { Injectable } from "@nestjs/common";

/** Subscription / purchase tier stored on `user_profiles.tier`. */
export type PaidAccessTier = "pro" | "gifted";

@Injectable()
export class BillingService {
  hasFullAccess(tier: string | null | undefined): boolean {
    return tier === "pro" || tier === "gifted";
  }
}
