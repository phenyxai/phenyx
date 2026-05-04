import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const protectedRoutes = [
  "/onboarding",
  "/constellation",
  "/collective",
  "/daily",
  "/welcome",
  "/settings",
  "/upgrade",
]

// Routes that should never be protected
const publicRoutes = [
  "/join",
  "/signin",
  "/demo",
  "/",
  "/privacy",
]

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          )
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Check if route is protected
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Check if route is explicitly public
  const isPublic = publicRoutes.some((route) =>
    pathname === route || (route !== "/" && pathname.startsWith(route))
  )

  // If protected and no session, redirect to signin with returnTo param
  if (isProtected && !session) {
    const signinUrl = new URL("/signin", req.url)
    signinUrl.searchParams.set("returnTo", pathname)
    return NextResponse.redirect(signinUrl)
  }

  return res
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/constellation/:path*",
    "/collective/:path*",
    "/daily/:path*",
    "/welcome/:path*",
    "/settings/:path*",
    "/upgrade/:path*",
  ],
}
