// PHE-97 — where a person lands after signing in, for both doors (Google and
// the email code). New people go straight into onboarding (PHE-162 removed the
// welcome screen); returning people go straight to their constellation.
//
// Dependency-free so it runs under `node --test` and in the OAuth callback
// route handler alike.

/** The signed-in home. Hardcoded here rather than via `/dashboard` (PHE-96 owns that redirect). */
export const HOME_ROUTE = "/dashboard/constellation";

/** First stop for a brand-new account. */
export const ONBOARDING_ROUTE = "/onboarding";

/** Screens a deep link must never point back into (sign-in loops). */
const AUTH_PATHS = ["/signin", "/join", "/auth"];

/**
 * A `returnTo` value we are willing to redirect to: a same-origin path only.
 * Rejects absolute and protocol-relative URLs (`//host`, `/\host`) so the
 * parameter cannot become an open redirect, and drops the auth screens.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  const path = raw.split(/[?#]/, 1)[0];
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}

export function postAuthDestination({
  isNew,
  returnTo,
}: {
  isNew: boolean;
  returnTo?: string | null;
}): string {
  if (isNew) return ONBOARDING_ROUTE;
  return safeReturnTo(returnTo) ?? HOME_ROUTE;
}

/** The redirect URL handed to Supabase for Google; the callback route reads `returnTo`. */
export function oauthCallbackUrl(origin: string, returnTo?: string | null): string {
  const base = `${origin}/auth/callback`;
  const safe = safeReturnTo(returnTo);
  return safe ? `${base}?returnTo=${encodeURIComponent(safe)}` : base;
}
