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

export interface ProfileOverview {
  display_name: string | null
  /** Platform slugs for the header badges; empty when nothing is connected. */
  connected_platforms: string[]
  /** Behavioral snapshot — the engine returns exactly 3 items. */
  snapshot: ProfileSnapshotItem[]
  /** Forward-looking foresight line; null until the engine has generated one. */
  foresight: string | null
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
    connected_platforms:
      (persona as { connected_platforms: string[] | null } | null)?.connected_platforms ?? [],
    snapshot: [],
    foresight: null,
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

/** Weekly Polaris token allowance snapshot (PHE-27), returned alongside each ask. */
export interface PolarisAllowance {
  /** ISO week start (Monday) in UTC — the polaris_token_usage.week key. */
  week: string
  /** Tokens debited this week so far. */
  used: number
  /** Tier-derived weekly limit (0 free / 800 pro|gifted). */
  limit: number
  /** max(0, limit - used). */
  remaining: number
  limit_reached: boolean
}

export interface PolarisAnswer {
  /** null when limit_reached is true (no Claude call was made). */
  answer: string | null
  pillar_tag: string | null
  thread_id: string
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
 * omit it to start a new one (the returned `thread_id` is the id to reuse). Throws
 * on a non-2xx response so callers can surface a retry affordance.
 */
export async function askPolaris(
  question: string,
  threadId?: string,
): Promise<PolarisAnswer> {
  const res = await apiFetch("/api/polaris/ask", {
    method: "POST",
    body: JSON.stringify({ question, ...(threadId ? { thread_id: threadId } : {}) }),
  })
  if (!res.ok) {
    throw new Error("polaris is unavailable right now. please try again.")
  }
  return (await res.json()) as PolarisAnswer
}

// ---------------------------------------------------------------------------
// Polaris chat surface reads (PHE-23). The main view loads `getPolarisThreads()`
// (past conversations + suggested questions from the user's top pillars); tapping
// a past conversation calls `getPolarisThread(id)` to reload its decrypted
// messages. Sending is `askPolaris` above — these two are read-only.
// ---------------------------------------------------------------------------

/** One BASED ON WHAT WE SEE suggestion: a question + the pillar it grounds on. */
export interface SuggestedQuestion {
  text: string
  pillar_tag: string
}

/** One PREVIOUS CONVERSATIONS row; `preview` is the thread's first user message. */
export interface PolarisThreadSummary {
  id: string
  title: string | null
  preview: string | null
  created_at: string
  updated_at: string
}

export interface PolarisThreadsResponse {
  threads: PolarisThreadSummary[]
  suggested_questions: SuggestedQuestion[]
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
  messages: PolarisMessageView[]
}

/**
 * Load the Polaris main view: past conversations (most-recent first; the section
 * is hidden client-side when empty) and the suggested questions. Throws on a
 * non-2xx so the caller can fall back to an empty main view.
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
 * Stage a pending signup (name + email + passphrase). Pre-auth — no bearer is
 * attached. On success the backend sends an email OTP and returns the draft id +
 * masked email; the raw passphrase is hashed server-side and never returned.
 */
export async function signupStart(input: {
  name: string
  email: string
  passphrase: string
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
// Email OTP (PHE-9). Shared by the /join signup s2 step and (PHE-12) email
// sign-in. Both endpoints are pre-auth (no bearer); on a successful verify the
// backend returns a session the caller adopts via supabase-browser.
// ---------------------------------------------------------------------------

export type OtpPurpose = "signup" | "signin"

/** Tokens returned on a successful verify; fed to supabase.auth.setSession. */
export interface OtpSession {
  access_token: string
  refresh_token: string
}

/** `status` mirrors the backend outcome so callers can render the exact copy. */
export interface OtpVerifyResult {
  status: "ok" | "invalid" | "expired"
  session?: OtpSession
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

// ---------------------------------------------------------------------------
// Sign in + passphrase reset (PHE-12). All pre-auth (no bearer). Each endpoint
// answers 200 with an `{ ok }`-shaped body so the outcome never leaks via HTTP
// status, and the caller maps a failure to the single generic copy.
// ---------------------------------------------------------------------------

/** `ok: true` carries the session to adopt via supabase-browser. */
export interface SigninResult {
  ok: boolean
  session?: OtpSession
}

/**
 * Returning-user sign-in with name + passphrase. Resolves to `{ ok: false }` for
 * any failure — an unknown name, a wrong passphrase, a lockout (429), or a
 * transport error — so the UI shows one generic message (no enumeration).
 */
export async function signin(input: {
  name: string
  passphrase: string
}): Promise<SigninResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) return { ok: false }
    return (await res.json()) as SigninResult
  } catch {
    return { ok: false }
  }
}

/**
 * Request a passphrase reset link. Enumeration-resistant: the backend always
 * answers 200 whether or not the email maps to an account, and the UI shows the
 * same success copy regardless. Errors are swallowed for the same reason — the
 * caller only validates email shape client-side before calling.
 */
export async function passphraseResetRequest(input: {
  email: string
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/passphrase/reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    // Best-effort: never reveal delivery/account state to the caller.
  }
}

/** `ok: false` covers an invalid, expired, or already-used token (one outcome). */
export interface ResetConfirmResult {
  ok: boolean
}

/**
 * Confirm a passphrase reset with the single-use token from the emailed link and
 * a new passphrase. Resolves to `{ ok: false }` for a rejected token or a
 * transport error so the UI shows one generic "invalid or expired" message.
 */
export async function passphraseResetConfirm(input: {
  token: string
  newPassphrase: string
}): Promise<ResetConfirmResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/passphrase/reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) return { ok: false }
    return (await res.json()) as ResetConfirmResult
  } catch {
    return { ok: false }
  }
}
