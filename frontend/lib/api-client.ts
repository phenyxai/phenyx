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

/** PHE-124 / PHE-129 insights reading (backend `InsightsReading`). */
export interface InsightsReading {
  version: number
  generated_at: string
  /** "your story so far": one line and its dated milestones, oldest first. */
  story?: {
    summary: string
    milestones: { date: string; title: string; pillar: string }[]
  } | null
  becoming_clearer: { line: string; support: string } | null
  needs_shape: { line: string; support: string } | null
  matters: { title: string; body: string }[]
  /** "how you find your way"; absent on readings from before PHE-129. */
  ways?: { title: string; body: string }[]
}

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
  /** Insights reading; null until the first one has been generated. */
  insights: InsightsReading | null
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
    insights: null,
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
 * PHE-129: Polaris points this month, returned alongside each ask and on
 * polaris home. 30 free / 300 full, refreshing on the first of the month; bought
 * points are spent once the month's run out.
 */
export interface PolarisAllowance {
  /** First of the month (UTC), YYYY-MM-01. */
  month: string
  /** When the monthly points come back, YYYY-MM-DD. */
  resets: string
  /** The month's points by plan. */
  limit: number
  /** The month's points used so far. */
  used: number
  monthly_left: number
  /** Bought points still available. */
  purchased: number
  /** monthly_left + purchased. */
  remaining: number
  limit_reached: boolean
  full: boolean
}

/** PHE-123: the three ways polaris helps (spec doc 4). */
export type PolarisMode = "clarify" | "understand" | "decide"

export interface PolarisAnswer {
  /** null when limit_reached is true (no Claude call was made). */
  answer: string | null
  pillar_tag: string | null
  /** null when limit_reached opened no conversation. */
  thread_id: string | null
  /** The conversation's mode: a starting point's, or null for a typed question. */
  mode?: PolarisMode | null
  message_id: string | null
  usage: PolarisUsage
  sparse?: boolean
  /** True when the points left could not cover this turn: no Claude call, no debit. */
  limit_reached?: boolean
  /** The out-of-points note on that short-circuit. */
  message?: string
  /** What the turn cost, or would have. */
  cost?: number
  allowance?: PolarisAllowance
  is_crisis?: boolean
  resources?: { us: string; text: string; international: string }
}

/**
 * Ask Polaris a question. Pass `threadId` to continue an existing conversation;
 * omit it to start a new one (the returned `thread_id` is the id to reuse), with
 * a starting point's mode (a typed question sends none, and polaris reads it
 * from the phrasing) and, from a moment or a discovery, the context it opens
 * with. `followUp` marks one of the follow-up chips. Throws on a non-2xx
 * response so callers can surface a retry.
 */
export async function askPolaris(
  question: string,
  threadId?: string,
  open?: { mode: PolarisMode | null; context?: string | null },
  followUp = false,
): Promise<PolarisAnswer> {
  const res = await apiFetch("/api/polaris/ask", {
    method: "POST",
    body: JSON.stringify({
      question,
      ...(threadId ? { thread_id: threadId } : {}),
      ...(!threadId && open?.mode ? { mode: open.mode } : {}),
      ...(!threadId && open?.context ? { context: open.context } : {}),
      ...(followUp ? { follow_up: true } : {}),
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

/** PHE-129: a plan card's state, keyed by the polaris reply it came from. */
export interface PolarisPlanState {
  message_id: string
  done: number[]
  saved: boolean
}

/** A saved plan; `body` is its decrypted reply, parsed into steps on the client. */
export interface PolarisSavedPlan extends PolarisPlanState {
  thread_id: string
  body: string
  saved_at: string
}

/** PHE-129: an open question polaris left in a conversation ("questions to return to", full). */
export interface PolarisReturnQuestion {
  thread_id: string
  /** What the conversation was about. */
  title: string
  /** The question polaris asked last. */
  line: string
}

export interface PolarisThreadsResponse {
  threads: PolarisThreadSummary[]
  starters: PolarisStarter[]
  /** This month's points for the usage pop-up. */
  allowance?: PolarisAllowance
  plans?: PolarisSavedPlan[]
  /** At most three on full; null on free. */
  returns?: PolarisReturnQuestion[] | null
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
  plans?: PolarisPlanState[]
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

/** Check a plan's steps (`done` replaces them) or save it. Throws on a non-2xx. */
export async function setPolarisPlan(
  messageId: string,
  patch: { done?: number[]; saved?: boolean },
): Promise<PolarisPlanState> {
  const res = await apiFetch(`/api/polaris/plans/${messageId}`, {
    method: "POST",
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error("could not save the plan")
  return (await res.json()) as PolarisPlanState
}

/**
 * PHE-129: buy polaris points (100 to 2,000 in steps of 100) or a discovery
 * pack (1, 3 or 10). Sends the browser to checkout; throws when checkout could
 * not start.
 */
export async function startPurchase(kind: "points" | "discoveries", amount: number): Promise<void> {
  const res = await apiFetch("/stripe/purchase", {
    method: "POST",
    body: JSON.stringify({ kind, amount }),
  })
  const { url } = res.ok ? ((await res.json()) as { url?: string | null }) : { url: null }
  if (!url) throw new Error("checkout could not be started. please try again.")
  window.location.assign(url)
}
