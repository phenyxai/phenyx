import { supabaseBrowser as supabase } from "@/lib/supabase-browser"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

// ---------------------------------------------------------------------------
// Session profile (PHE-13). The signed-in user's persisted identity, including
// the server-assigned, immutable stellar_color. user_profiles is keyed by `id`
// (= auth.users.id). Returns null when no one is signed in or the row is missing
// so callers can fall back to an ambient default without throwing.
// ---------------------------------------------------------------------------

export interface SessionProfile {
  id: string
  display_name: string | null
  stellar_color: string | null
}

export async function fetchProfile(): Promise<SessionProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, stellar_color")
    .eq("id", user.id)
    .maybeSingle()
  if (error || !data) return null
  return data as SessionProfile
}

// ---------------------------------------------------------------------------
// Profile tab overview (PHE-30 surface / PHE-38 engine). Everything the Profile
// tab renders that is NOT the tier (tier comes from useTier): the display name,
// connected-platform badges, the 3-item WHAT WE HAVE SEEN behavioral snapshot,
// and the WHAT PHENYX FORESEES line.
//
// The engine-backed endpoint (`/profile/overview`, PHE-38) is the source of
// truth once live. Until then we fall back to a supabase-direct read so the
// header (name + platforms) still renders; the engine-generated snapshot and
// foresight are simply absent (the tab renders their empty states). Every path
// resolves without throwing so the tab never crashes on missing data.
// ---------------------------------------------------------------------------

/** One WHAT WE HAVE SEEN item: a pillar label + a single sentence. */
export interface ProfileSnapshotItem {
  pillar_label: string
  sentence: string
}

/** How full is paid for; null when there is no billing (free, gifted). */
export type BillingPeriod = "monthly" | "yearly"

/** Shape of `GET /profile/overview` (backend `ProfileOverviewResponse`). */
export interface ProfileOverview {
  display_name: string | null
  email: string | null
  /** "with PHENYX since <month year>", or null when unknown. */
  joined: string | null
  stellar_color: string | null
  /** Platform slugs for the header badges; empty when nothing is connected. */
  connected_platforms: string[]
  /** "what has stayed with you" constants. */
  held: { title: string; body: string }[]
  /** Behavioral snapshot — kept for older clients; the insights tab does not render it. */
  snapshot: ProfileSnapshotItem[]
  /** Forward-looking foresight line; null until the engine has generated one. */
  foresight: string | null
  /** `free` or `pro` — gifted is never returned as product copy. */
  tier: "free" | "pro"
  notification_prefs?: Record<string, boolean>
  /** ISO timestamp of the next monthly charge; null on free, yearly, gifted, or when Stripe is unreachable. */
  renews_at: string | null
  /** `monthly` (subscription), `yearly` (one-time), or null (free, gifted). */
  billing_period: BillingPeriod | null
}

export async function fetchProfileOverview(): Promise<ProfileOverview | null> {
  // Prefer the engine-backed endpoint; it carries name, platforms, snapshot,
  // and foresight in one payload.
  try {
    const res = await apiFetch("/profile/overview")
    if (res.ok) return (await res.json()) as ProfileOverview
  } catch {
    // endpoint not live yet — fall through to the supabase-direct read
  }

  // Fallback while PHE-38 is not live: read what the signed-in client can see
  // directly. Header renders; engine-generated snapshot/foresight stay empty.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: persona }] = await Promise.all([
    supabase.from("user_profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_persona").select("connected_platforms").eq("user_id", user.id).maybeSingle(),
  ])

  return {
    display_name: (profile as { display_name: string | null } | null)?.display_name ?? null,
    email: user.email ?? null,
    joined: null,
    stellar_color: null,
    connected_platforms:
      (persona as { connected_platforms: string[] | null } | null)?.connected_platforms ?? [],
    held: [],
    snapshot: [],
    foresight: null,
    tier: "free",
    renews_at: null,
    billing_period: null,
  }
}

// ---------------------------------------------------------------------------
// Polaris answer engine (PHE-22 engine / PHE-23 chat surface). One authed
// question → exactly one grounded Claude call. `pillar_tag` is the routed pillar;
// `sparse` flags a thin constellation; `limit_reached` short-circuits over the
// weekly budget (no answer); `is_crisis` carries the crisis response + resources.
// ---------------------------------------------------------------------------

export interface PolarisUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  total_tokens: number
}

/**
 * Weekly Polaris allowance snapshot (PHE-27 / PHE-94), returned alongside each
 * ask. Counted in QUESTIONS: one completed ask is one unit.
 */
export interface PolarisAllowance {
  /** ISO week start (Monday) in UTC — the polaris_token_usage.week key. */
  week: string
  /** Questions asked this week so far. */
  used: number
  /** Tier-derived weekly question limit (3 free / 40 full). */
  limit: number
  /** max(0, limit - used). */
  remaining: number
  limit_reached: boolean
}

/** PHE-123: the three ways polaris helps (spec doc 4). */
export type PolarisMode = "clarify" | "understand" | "decide"

export interface PolarisAnswer {
  /** null when limit_reached is true (no Claude call was made). */
  answer: string | null
  pillar_tag: string | null
  thread_id: string
  /** The conversation's mode (fixed when it was opened). */
  mode?: PolarisMode
  message_id: string | null
  usage: PolarisUsage
  sparse?: boolean
  limit_reached?: boolean
  /** Verbatim at-limit copy on the over-budget short-circuit (PHE-27). */
  message?: string
  /** True on the over-budget short-circuit — surface the upgrade CTA (PHE-27). */
  upgrade_cta?: boolean
  /** Remaining weekly allowance for display (PHE-27). */
  allowance?: PolarisAllowance
  is_crisis?: boolean
  resources?: { us: string; text: string; international: string }
}

/**
 * Ask Polaris a question. Pass `threadId` to continue an existing conversation;
 * omit it to start a new one (the returned `thread_id` is the id to reuse), with
 * the mode and, from a moment or a discovery, the context it opens with. Throws
 * on a non-2xx response so callers can surface a retry affordance.
 */
export async function askPolaris(
  question: string,
  threadId?: string,
  open?: { mode: PolarisMode; context?: string | null },
): Promise<PolarisAnswer> {
  const res = await apiFetch("/api/polaris/ask", {
    method: "POST",
    body: JSON.stringify({
      question,
      ...(threadId ? { thread_id: threadId } : {}),
      ...(!threadId && open ? { mode: open.mode, ...(open.context ? { context: open.context } : {}) } : {}),
    }),
  })
  if (!res.ok) {
    throw new Error("polaris is unavailable right now. please try again.")
  }
  return (await res.json()) as PolarisAnswer
}

// ---------------------------------------------------------------------------
// Polaris chat surface reads (PHE-23). The main view loads `getPolarisThreads()`
// (past conversations + one starter per mode from the user's top pillars); tapping
// a past conversation calls `getPolarisThread(id)` to reload its decrypted
// messages. Sending is `askPolaris` above — these two are read-only.
// ---------------------------------------------------------------------------

/** One starter on polaris home: a question in one mode, from one of the person's top pillars. */
export interface PolarisStarter {
  mode: PolarisMode
  text: string
  pillar_tag: string
}

/** One PREVIOUS CONVERSATIONS row; `preview` is the thread's first user message. */
export interface PolarisThreadSummary {
  id: string
  title: string | null
  preview: string | null
  /** Null on conversations from before modes. */
  mode: PolarisMode | null
  created_at: string
  updated_at: string
}

export interface PolarisThreadsResponse {
  threads: PolarisThreadSummary[]
  starters: PolarisStarter[]
  /** Live weekly question allowance for the idle/chat allowance badge. */
  allowance?: PolarisAllowance
}

/** A single reloaded turn; `body` is decrypted server-side, rendered plain-text. */
export interface PolarisMessageView {
  id: string
  role: "user" | "assistant"
  body: string
  pillar_tag: string | null
  created_at: string
}

export interface PolarisThreadDetail {
  thread_id: string
  mode: PolarisMode | null
  messages: PolarisMessageView[]
}

/**
 * Load polaris home: past conversations, one starter per mode, and the weekly
 * allowance. Throws on a non-2xx so the caller can fall back to an empty idle
 * view.
 */
export async function getPolarisThreads(): Promise<PolarisThreadsResponse> {
  const res = await apiFetch("/api/polaris/threads")
  if (!res.ok) throw new Error("could not load polaris threads")
  return (await res.json()) as PolarisThreadsResponse
}

/**
 * Reload one thread's messages (decrypted, oldest-first). Throws on a non-2xx
 * (e.g. a 404 for a thread the caller does not own) so the caller can surface a
 * retry affordance.
 */
export async function getPolarisThread(id: string): Promise<PolarisThreadDetail> {
  const res = await apiFetch(`/api/polaris/threads/${id}`)
  if (!res.ok) throw new Error("could not load this conversation")
  return (await res.json()) as PolarisThreadDetail
}

export interface SignupStartResult {
  draft_id: string
  maskedEmail: string
}

/**
 * Stage a pending signup (name + email; PHE-97: there is no passphrase).
 * Pre-auth — no bearer is attached. On success the backend sends an email OTP
 * and returns the draft id + masked email.
 */
export async function signupStart(input: {
  name: string
  email: string
}): Promise<SignupStartResult> {
  const res = await fetch(`${API_BASE}/auth/signup/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let message = "something went wrong. please try again."
    try {
      const body = await res.json()
      // Nest ValidationPipe returns { message: string | string[] }.
      if (Array.isArray(body?.message)) message = body.message[0]
      else if (typeof body?.message === "string") message = body.message
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Email OTP (PHE-9). Shared by the /join signup s2 step and the email-code
// sign-in. Both endpoints are pre-auth (no bearer); on a successful verify the
// backend returns a session the caller adopts via supabase-browser.
// ---------------------------------------------------------------------------

export type OtpPurpose = "signup" | "signin"

/** Tokens returned on a successful verify; fed to supabase.auth.setSession. */
export interface OtpSession {
  access_token: string
  refresh_token: string
}

/**
 * `status` mirrors the backend outcome so callers can render the exact copy.
 * `no_account` comes only after a correct sign-in code for an email with no
 * account. On `ok`, `is_new` says whether this verify created the profile
 * (route to welcome) or found an existing one (route to the constellation).
 */
export interface OtpVerifyResult {
  status: "ok" | "invalid" | "expired" | "no_account"
  session?: OtpSession
  is_new?: boolean
}

/**
 * Send (or resend) an email OTP. Pass `draftId` for signup or `email` for signin.
 * Always resolves to a masked email on well-formed input — never reveals whether
 * an account exists. Throws only on transport / 4xx validation errors.
 */
export async function otpSend(input: {
  purpose: OtpPurpose
  draftId?: string
  email?: string
}): Promise<{ maskedEmail: string }> {
  const res = await fetch(`${API_BASE}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: input.purpose,
      ...(input.draftId ? { draft_id: input.draftId } : {}),
      ...(input.email ? { email: input.email } : {}),
    }),
  })
  if (!res.ok) throw new Error("could not send a code. please try again.")
  return res.json()
}

/**
 * Verify a submitted OTP. Returns a discriminated result: `ok` carries the
 * session; `invalid` / `expired` drive the verbatim wrong/expired copy. The
 * endpoint answers 200 for all three, so a non-ok HTTP status is a transport
 * failure and is normalized to `invalid`.
 */
export async function otpVerify(input: {
  code: string
  draftId?: string
  email?: string
  purpose?: OtpPurpose
}): Promise<OtpVerifyResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: input.code,
        ...(input.draftId ? { draft_id: input.draftId } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.purpose ? { purpose: input.purpose } : {}),
      }),
    })
    if (!res.ok) return { status: "invalid" }
    return (await res.json()) as OtpVerifyResult
  } catch {
    return { status: "invalid" }
  }
}
