import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ObservationsService } from "./observations.service";

/**
 * Weekly observation regeneration (PHE-37). Sunday 00:00 UTC, re-evaluating each
 * active, non-frozen user's latest snapshot. Generation is a background job —
 * per-user failures are already swallowed inside the service, and the whole run
 * is wrapped so a failure never crashes the process (stale feed served on failure).
 *
 * PHE-42 SEAM: the frozen-user skip lives in `ObservationsService.selectActiveUserIds`.
 */
@Injectable()
export class ObservationsCron {
  private readonly logger = new Logger(ObservationsCron.name);

  constructor(private readonly observations: ObservationsService) {}

  @Cron("0 0 * * 0", { name: "weekly-observations", timeZone: "UTC" })
  async handleWeekly(): Promise<void> {
    this.logger.log("weekly observation generation starting");
    try {
      const result = await this.observations.runWeeklyGeneration();
      this.logger.log(`weekly observation generation done: ${JSON.stringify(result)}`);
    } catch (e) {
      this.logger.error(`weekly observation generation failed: ${(e as Error).message}`);
    }
  }
}
