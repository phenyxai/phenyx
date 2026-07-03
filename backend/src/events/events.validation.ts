/**
 * PHE-43 — analytics events ingest validation (pure, dependency-free).
 *
 * No NestJS decorators, no runtime imports: this module holds the allowlist +
 * per-event prop sanitization so it can be unit-tested with Node's built-in
 * runner (`node --experimental-strip-types --test`) exactly like the frontend
 * queue's tests, without booting the Nest app or a Supabase client.
 *
 * Two privacy/trust invariants live here and nowhere else:
 *   1. `user_id` is NEVER read from client input — the caller passes the id
 *      resolved from the auth token, and it is the only source of `user_id`.
 *   2. `polaris_message` (and every type) keeps ONLY its allowlisted prop keys.
 *      Any free-text content key (message/text/body/…) is stripped before the
 *      row is built, so message content can never reach the database.
 */

/**
 * Allowlisted event types. Includes the PHE-35 client queue's actual names
 * (`upgrade_to_pro` / `downgrade_to_free`) and the ticket's bare `upgrade` /
 * `downgrade` spellings for compatibility. Anything else is rejected per-row.
 */
export const ALLOWED_EVENT_TYPES = [
  "tab_visit",
  "tab_duration",
  "days_since_last_visit",
  "polaris_message",
  "login",
  "upgrade_to_pro",
  "downgrade_to_free",
  // Compatibility aliases (ticket body spelling).
  "upgrade",
  "downgrade",
] as const;

export type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];

const ALLOWED_EVENT_TYPE_SET: ReadonlySet<string> = new Set(ALLOWED_EVENT_TYPES);

/**
 * Allowlisted prop keys per event type. Any key not listed here is stripped
 * (privacy-first): the row still inserts, but only structured, non-content
 * fields survive. `polaris_message` deliberately has NO content key — only
 * `count`, `pillar_tag`, and the message LENGTH (both the queue's actual
 * `message_length` and the ticket's `length` spelling are accepted).
 */
export const ALLOWED_PROP_KEYS: Record<AllowedEventType, readonly string[]> = {
  tab_visit: ["tab", "previous"],
  tab_duration: ["tab", "seconds"],
  days_since_last_visit: ["days"],
  polaris_message: ["count", "pillar_tag", "message_length", "length"],
  login: [],
  upgrade_to_pro: [],
  downgrade_to_free: [],
  upgrade: [],
  downgrade: [],
};

/** A validated, ready-to-insert row. `user_id` is always server-supplied. */
export interface ValidatedEventRow {
  user_id: string;
  event_type: AllowedEventType;
  props: Record<string, unknown>;
  occurred_at: string;
  event_id: string | null;
}

export type SanitizeResult =
  | { ok: true; row: ValidatedEventRow }
  | { ok: false; reason: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Keep only the allowlisted keys for a given event type; drop everything else. */
function sanitizeProps(
  eventType: AllowedEventType,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = ALLOWED_PROP_KEYS[eventType];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      out[key] = props[key];
    }
  }
  return out;
}

/**
 * Validate + sanitize a single client-supplied event.
 *
 * @param raw    the untrusted client event object
 * @param userId the id resolved from the auth token — the ONLY source of user_id
 * @param now    injectable clock for deterministic tests
 */
export function sanitizeEvent(
  raw: unknown,
  userId: string,
  now: () => string = () => new Date().toISOString(),
): SanitizeResult {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: "event must be an object" };
  }

  const eventType = raw.event_type;
  if (typeof eventType !== "string" || !ALLOWED_EVENT_TYPE_SET.has(eventType)) {
    return { ok: false, reason: `unknown event_type: ${String(eventType)}` };
  }

  const rawProps = raw.props;
  if (rawProps !== undefined && !isPlainObject(rawProps)) {
    return { ok: false, reason: "props must be an object" };
  }
  const props = sanitizeProps(
    eventType as AllowedEventType,
    isPlainObject(rawProps) ? rawProps : {},
  );

  // occurred_at: accept a valid timestamp string; otherwise stamp server time.
  // Never trust an unparseable client value into a `timestamptz not null` column.
  let occurredAt: string;
  if (typeof raw.occurred_at === "string" && !Number.isNaN(Date.parse(raw.occurred_at))) {
    occurredAt = raw.occurred_at;
  } else {
    occurredAt = now();
  }

  // event_id: optional idempotency key. Only non-empty strings are honored.
  let eventId: string | null = null;
  if (typeof raw.event_id === "string" && raw.event_id.length > 0) {
    eventId = raw.event_id;
  } else if (raw.event_id !== undefined && raw.event_id !== null) {
    return { ok: false, reason: "event_id must be a string" };
  }

  return {
    ok: true,
    row: {
      // Server-stamped. Any client-supplied `user_id` in `raw` is ignored.
      user_id: userId,
      event_type: eventType as AllowedEventType,
      props,
      occurred_at: occurredAt,
      event_id: eventId,
    },
  };
}
