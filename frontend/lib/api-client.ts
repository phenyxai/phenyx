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
