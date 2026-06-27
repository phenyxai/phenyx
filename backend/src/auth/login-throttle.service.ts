import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";

/**
 * Per-account + per-IP brute-force lockout for the passphrase verify path.
 *
 * This is intentionally separate from the HTTP-layer @nestjs/throttler guard
 * (per-IP request-rate limiting wired in AuthModule). This service tracks
 * *failed credential attempts* and locks the offending key after a threshold,
 * with exponential backoff — so it resists slow, low-rate brute force that
 * would slip under a raw request-rate limit, and it locks per *account* (name)
 * as well as per IP. Bundling it inside the verify path guarantees the
 * protection regardless of how the signin route (PHE-12) is wired.
 *
 * Storage is in-process: correct for the single-instance MVP. A multi-instance
 * deployment must back this with a shared store (Redis / Postgres) so a counter
 * is not trivially reset by load-balancing across instances. Documented as a
 * known constraint.
 */

/** Failed attempts allowed before a key is locked. */
const MAX_FAILED_ATTEMPTS = 5;
/** Base lockout once the threshold is crossed; doubles per extra failure. */
const BASE_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
/** Cap so backoff cannot grow unbounded. */
const MAX_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour
/** Idle window after which a key's counter is forgotten (no recent failures). */
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface AttemptRecord {
  failures: number;
  lockedUntil: number; // epoch ms; 0 = not locked
  lastFailureAt: number; // epoch ms
}

@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly records = new Map<string, AttemptRecord>();

  /**
   * Throws 429 if either the account key or the IP key is currently locked.
   * Call before attempting verification. Keys are namespaced so an account and
   * an IP never collide.
   */
  assertNotLocked(name: string, ip?: string): void {
    const now = Date.now();
    for (const key of this.keysFor(name, ip)) {
      const rec = this.records.get(key);
      if (rec && rec.lockedUntil > now) {
        // Generic message: never reveals whether the account exists.
        throw new HttpException(
          "too many attempts, try again later",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
  }

  /**
   * Record a failed credential attempt against both the account and IP keys.
   * Crossing the threshold sets an exponentially-backed-off lock.
   */
  recordFailure(name: string, ip?: string): void {
    const now = Date.now();
    for (const key of this.keysFor(name, ip)) {
      const rec = this.records.get(key);
      // Stale record (no failures within the window) starts fresh.
      const base =
        rec && now - rec.lastFailureAt <= ATTEMPT_WINDOW_MS
          ? rec
          : { failures: 0, lockedUntil: 0, lastFailureAt: now };

      base.failures += 1;
      base.lastFailureAt = now;

      if (base.failures >= MAX_FAILED_ATTEMPTS) {
        const over = base.failures - MAX_FAILED_ATTEMPTS;
        const lockMs = Math.min(BASE_LOCKOUT_MS * 2 ** over, MAX_LOCKOUT_MS);
        base.lockedUntil = now + lockMs;
      }
      this.records.set(key, base);
    }
  }

  /** Clear counters for an account+IP after a successful verification. */
  reset(name: string, ip?: string): void {
    for (const key of this.keysFor(name, ip)) {
      this.records.delete(key);
    }
  }

  private keysFor(name: string, ip?: string): string[] {
    const keys = [`acct:${name.trim().toLowerCase()}`];
    if (ip) keys.push(`ip:${ip}`);
    return keys;
  }
}
