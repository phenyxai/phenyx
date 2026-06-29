import { createBrowserClient } from "@supabase/ssr"

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
