import { createBrowserClient } from "@supabase/ssr";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
/** JWT-shaped placeholder so `createBrowserClient` never receives empty strings during prerender */
const PLACEHOLDER_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.invalid-placeholder";

function resolvePublicEnv() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) {
    if (typeof window === "undefined") {
      console.warn(
        "[phenyx] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing at build. " +
          "Using placeholders so `next build` can finish — add both in Cloudflare Pages → Environment variables and redeploy."
      );
    }
    return { url: PLACEHOLDER_URL, key: PLACEHOLDER_ANON };
  }
  return { url, key };
}

const resolved = resolvePublicEnv();
export const supabaseBrowser = createBrowserClient(resolved.url, resolved.key);

/**
 * Adopt a session returned by the backend OTP-verify endpoint (PHE-9), so the
 * user is authenticated client-side immediately after entering their code. The
 * backend mints the tokens (service role can't issue a session); the browser
 * just stores them. Returns false if Supabase rejects the tokens.
 */
export async function setSessionFromTokens(tokens: {
  access_token: string;
  refresh_token: string;
}): Promise<boolean> {
  const { error } = await supabaseBrowser.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) {
    console.error("[phenyx] failed to set session after OTP verify:", error.message);
    return false;
  }
  return true;
}
