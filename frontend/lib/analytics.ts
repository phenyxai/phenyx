/**
 * PHE-35 — Engagement instrumentation.
 *
 * A privacy-first, in-memory analytics queue for the dashboard. Events are
 * collected client-side and flushed in batches (with retry) to the Supabase
 * `events` table on an interval and on `visibilitychange`/`pagehide`. Every
 * event carries `user_id`, `event_type`, `occurred_at`, and a typed JSON
 * `props` — never any free-text user content.
 *
 * This replaces the prototype's `window._phenyxEventQueue`, keeping the SAME
 * event names and `props` shapes so prototype-era dashboards stay valid. The
 * backend ingest is PHE-43; this module is purely the client queue + wiring.
 *
 * Module design notes:
 *   - No static runtime imports. The Supabase browser client is loaded via a
 *     dynamic `import()` inside the flush path only, so this module is safe to
 *     import in a plain Node/SSR context (and unit-testable without pulling in
 *     `@supabase/ssr`). Browser globals are always accessed behind a
 *     `typeof window` guard.
 */

// ---------------------------------------------------------------------------
// Typed event names + prop shapes. These are the ONLY events that exist; the
// prop shape for each is fixed. `polaris_message` deliberately has no field
// that could hold message text — enforced by this type AND by a unit test.
// ---------------------------------------------------------------------------

export type EventType =
  | "tab_visit"
  | "tab_duration"
  | "days_since_last_visit"
  | "polaris_message"
  | "login"
  | "upgrade_to_pro"
  | "downgrade_to_free";

/** Empty-props marker: `{}` with no allowable keys. */
export type EmptyProps = Record<string, never>;

export interface EventPropsMap {
  tab_visit: { tab: string; previous: string | null };
  tab_duration: { tab: string; seconds: number };
  days_since_last_visit: { days: number };
  /** count + pillar tag + message LENGTH only — never the message text. */
  polaris_message: { count: number; pillar_tag: string | null; message_length: number };
  login: EmptyProps;
  upgrade_to_pro: EmptyProps;
  downgrade_to_free: EmptyProps;
}

/** The wire shape of every queued/persisted event. */
export interface AnalyticsEvent<T extends EventType = EventType> {
  user_id: string;
  event_type: T;
  occurred_at: string; // ISO 8601 (client timestamp)
  props: EventPropsMap[T];
}

// ---------------------------------------------------------------------------
// Pure builders (no side effects, no browser globals) — the unit-testable core.
// ---------------------------------------------------------------------------

/** Build the standard event envelope. `occurredAt` defaults to now. */
export function makeEvent<T extends EventType>(
  userId: string,
  eventType: T,
  props: EventPropsMap[T],
  occurredAt: string = new Date().toISOString(),
): AnalyticsEvent<T> {
  return { user_id: userId, event_type: eventType, occurred_at: occurredAt, props };
}

/**
 * Build `polaris_message` props from a message. The raw `message` is used ONLY
 * to derive `message_length`; it is never stored or returned. This is the seam
 * the Polaris tab (lane 05) calls — pass the message, and only its metadata
 * leaves this function.
 */
export function makePolarisMessageProps(input: {
  count: number;
  pillar_tag: string | null;
  message: string;
}): EventPropsMap["polaris_message"] {
  return {
    count: input.count,
    pillar_tag: input.pillar_tag,
    message_length: input.message.length,
  };
}

/**
 * Whole days between a previous timestamp and now. First-ever visit (no stored
 * ts) and clock skew (future ts) both yield 0.
 */
export function daysSince(prevTs: number | null, now: number): number {
  if (prevTs === null || !Number.isFinite(prevTs)) return 0;
  const ms = now - prevTs;
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/** `localStorage` key holding the last-visit timestamp for a user. */
export function lastVisitKey(userId: string): string {
  return `phenyx:${userId}:lastVisitTs`;
}

// ---------------------------------------------------------------------------
// Queue state + lifecycle.
// ---------------------------------------------------------------------------

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 50;
const MAX_RETRIES = 5;

let queue: AnalyticsEvent[] = [];
let userId: string | null = null;
let flushing = false;
let started = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;

/**
 * Associate the current user with the queue. Called once the session resolves.
 * Backfills any events queued before the user was known (e.g. the first
 * `tab_visit`, which is queued on the sidebar's initial render — before the
 * async `getUser()` returns).
 */
export function identify(id: string | null): void {
  userId = id;
  if (id) {
    for (const e of queue) if (!e.user_id) e.user_id = id;
  }
}

/** Queue an event. Client-only; a no-op during SSR. */
export function track<T extends EventType>(eventType: T, props: EventPropsMap[T]): void {
  if (typeof window === "undefined") return;
  queue.push(makeEvent(userId ?? "", eventType, props));
  ensureStarted();
}

/** Idempotently start the interval flusher + unload listeners (browser only). */
function ensureStarted(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  intervalId = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  // `visibilitychange` → hidden and `pagehide` are the reliable "the user is
  // leaving" signals; flush with keepalive so nothing is lost on tab close.
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", handlePageHide);
}

function handleVisibility(): void {
  if (document.visibilityState === "hidden") void flush({ keepalive: true });
}

function handlePageHide(): void {
  void flush({ keepalive: true });
}

/**
 * Flush queued events in a batch. Retries by re-queueing on failure (capped so
 * a persistently failing backend can't grow memory unbounded). `keepalive`
 * routes through a keepalive `fetch` so the request survives page unload.
 */
export async function flush(opts: { keepalive?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return;
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    const ok = await sendBatch(batch, opts.keepalive ?? false);
    if (!ok) throw new Error("events insert failed");
    consecutiveFailures = 0;
  } catch {
    consecutiveFailures += 1;
    // Re-queue at the front so ordering is preserved, until we give up.
    if (consecutiveFailures <= MAX_RETRIES) {
      queue.unshift(...batch);
    }
  } finally {
    flushing = false;
  }
}

/** Rows attributed to a user only — unattributed events can't satisfy RLS. */
function toRows(batch: AnalyticsEvent[]) {
  return batch
    .filter((e) => e.user_id)
    .map((e) => ({
      user_id: e.user_id,
      event_type: e.event_type,
      props: e.props,
      occurred_at: e.occurred_at,
    }));
}

async function sendBatch(batch: AnalyticsEvent[], keepalive: boolean): Promise<boolean> {
  const rows = toRows(batch);
  if (rows.length === 0) return true; // nothing attributable; treat as delivered
  if (keepalive) return sendKeepalive(rows);
  // Normal path: reuse the shared Supabase browser client (RLS applies —
  // `auth.uid() = user_id`). Loaded lazily to keep this module import-safe.
  const { supabaseBrowser } = await import("@/lib/supabase-browser");
  const { error } = await supabaseBrowser.from("events").insert(rows);
  return !error;
}

/**
 * Unload-safe delivery. `navigator.sendBeacon` can't set the `apikey` /
 * `Authorization` headers Supabase requires, so we use a keepalive `fetch`
 * straight to the PostgREST endpoint with the current session bearer.
 */
async function sendKeepalive(rows: ReturnType<typeof toRows>): Promise<boolean> {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anon) return false;
  try {
    const { supabaseBrowser } = await import("@/lib/supabase-browser");
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    const res = await fetch(`${url}/rest/v1/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${session?.access_token ?? anon}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Named seams. Other lanes import these rather than calling `track` with raw
// literals, so event names/prop shapes live in exactly one place.
// ---------------------------------------------------------------------------

export function trackTabVisit(tab: string, previous: string | null): void {
  track("tab_visit", { tab, previous });
}

export function trackTabDuration(tab: string, seconds: number): void {
  track("tab_duration", { tab, seconds });
}

export function trackLogin(): void {
  track("login", {});
}

export function trackUpgradeToPro(): void {
  track("upgrade_to_pro", {});
}

export function trackDowngradeToFree(): void {
  track("downgrade_to_free", {});
}

/**
 * Polaris (lane 05) seam. Pass the message; only `{ count, pillar_tag,
 * message_length }` is ever queued — the text never leaves this call.
 */
export function trackPolarisMessage(input: {
  count: number;
  pillar_tag: string | null;
  message: string;
}): void {
  track("polaris_message", makePolarisMessageProps(input));
}

/**
 * On load: read the stored last-visit ts, emit `days_since_last_visit`, then
 * overwrite the stored ts with `now`. Returns the computed days (0 on first
 * visit). Client-only.
 */
export function recordDaysSinceLastVisit(id: string, now: number = Date.now()): number {
  if (typeof window === "undefined") return 0;
  const key = lastVisitKey(id);
  let prev: number | null = null;
  try {
    const raw = window.localStorage.getItem(key);
    prev = raw ? Number(raw) : null;
  } catch {
    prev = null;
  }
  const days = daysSince(prev, now);
  track("days_since_last_visit", { days });
  try {
    window.localStorage.setItem(key, String(now));
  } catch {
    // best-effort; storage may be unavailable (private mode / quota)
  }
  return days;
}
