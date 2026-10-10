import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { postAuthDestination } from "@/lib/auth-redirect"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

/**
 * PHE-97 — Google sign-in lands here. Supabase redirects back with `?code=`
 * (PKCE); we exchange it for a session (written to the auth cookies the browser
 * client reads), have the backend idempotently complete the profile, then send
 * new people to welcome and returning people to their constellation.
 *
 * Any failure (Google cancelled, a stale code, the profile could not be
 * completed) returns to /signin with `?error=google`; a half-finished session
 * is signed out first so the next attempt starts clean.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const returnTo = searchParams.get("returnTo")
  const origin = publicOrigin(request)

  const signinWithError = () =>
    NextResponse.redirect(new URL("/signin?error=google", origin))

  // Google cancel / provider error arrive as ?error=…&error_description=… with no code.
  if (!code) return signinWithError()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) return signinWithError()

  const isNew = await completeProfile(data.session.access_token)
  if (isNew === null) {
    await supabase.auth.signOut()
    return signinWithError()
  }

  return NextResponse.redirect(new URL(postAuthDestination({ isNew, returnTo }), origin))
}

/** POST /auth/profile/complete as the new session; null when it did not succeed. */
async function completeProfile(accessToken: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/profile/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const body = (await res.json()) as { is_new?: unknown }
    return body.is_new === true
  } catch {
    return null
  }
}

/**
 * The origin the browser used. Behind Render's proxy `request.nextUrl.origin`
 * is the internal host, so prefer the forwarded host outside local dev.
 */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https"
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}
