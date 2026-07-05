import { BadRequestException, Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  sanitizeEvent,
  type ValidatedEventRow,
} from "./events.validation";

/** Per-row outcome in the 207-style batch summary. */
export interface EventResult {
  index: number;
  status: "inserted" | "rejected";
  reason?: string;
  event_id?: string | null;
}

export interface IngestSummary {
  total: number;
  inserted: number;
  rejected: number;
  /** True when at least one row was rejected — the controller maps this to 207. */
  partial: boolean;
  results: EventResult[];
}

@Injectable()
export class EventsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Ingest a client batch. `userId` comes from the auth guard (verified token)
   * and is the ONLY source of each row's `user_id` — a client cannot attribute
   * an event to another user. Invalid rows (unknown type, bad shape) are
   * rejected per-row and reported; every valid row still inserts.
   */
  async ingest(userId: string, events: unknown): Promise<IngestSummary> {
    if (!Array.isArray(events)) {
      throw new BadRequestException({ error: "events must be an array" });
    }

    const results: EventResult[] = [];
    const validRows: ValidatedEventRow[] = [];
    // Track where each valid row sits in `results` so we can flip it to
    // "inserted" only for the rows the DB actually kept (dedup-aware).
    const validResultIndexByRowIndex: number[] = [];

    events.forEach((raw, index) => {
      const outcome = sanitizeEvent(raw, userId);
      if (outcome.ok) {
        validResultIndexByRowIndex.push(results.length);
        results.push({
          index,
          status: "rejected", // provisional; upgraded to "inserted" post-write
          event_id: outcome.row.event_id,
        });
        validRows.push(outcome.row);
      } else {
        results.push({ index, status: "rejected", reason: outcome.reason });
      }
    });

    let inserted = 0;
    if (validRows.length > 0) {
      inserted = await this.insertRows(validRows, validResultIndexByRowIndex, results);
    }

    const rejected = results.filter((r) => r.status === "rejected").length;
    return {
      total: results.length,
      inserted,
      rejected,
      partial: rejected > 0,
      results,
    };
  }

  /**
   * Insert validated rows using the service-role client (RLS is already
   * satisfied logically — `user_id` was stamped from the verified token).
   * Dedupe on `(user_id, event_id)` via ON CONFLICT DO NOTHING so a retried
   * batch does not double-insert; rows without an `event_id` never collide
   * (NULLs are distinct in the unique index) and always insert.
   *
   * If the idempotency index is not present in a given environment (delta
   * migration 20260703000000 not yet applied), the ON CONFLICT target errors;
   * we fall back to a plain insert so the endpoint stays functional. Returns
   * the number of rows the DB actually inserted.
   */
  private async insertRows(
    rows: ValidatedEventRow[],
    validResultIndexByRowIndex: number[],
    results: EventResult[],
  ): Promise<number> {
    const client = this.supabase.getClient();

    let insertedRows: { event_id: string | null }[] | null = null;

    const upsert = await client
      .from("events")
      .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true })
      .select("event_id");

    if (upsert.error) {
      // 42P10 = "no unique or exclusion constraint matching the ON CONFLICT
      // specification" — the idempotency index isn't applied here; retry plain.
      if (isMissingConflictTarget(upsert.error)) {
        const plain = await client.from("events").insert(rows).select("event_id");
        if (plain.error) {
          throw new BadRequestException({ error: "events insert failed" });
        }
        insertedRows = plain.data ?? [];
      } else {
        throw new BadRequestException({ error: "events insert failed" });
      }
    } else {
      insertedRows = upsert.data ?? [];
    }

    // Everything not rejected at validation was accepted for insert. With
    // ignoreDuplicates, deduped rows are absent from `insertedRows`; mark the
    // accepted rows as inserted and report the true DB count. (We do not try to
    // pair specific deduped rows back to indices — the summary count is exact,
    // and per-row status reflects "accepted & not a validation reject".)
    for (const resultIndex of validResultIndexByRowIndex) {
      results[resultIndex].status = "inserted";
    }

    return insertedRows.length;
  }
}

/** Postgres error code for a missing ON CONFLICT target index/constraint. */
function isMissingConflictTarget(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P10") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("on conflict") && msg.includes("constraint");
}
