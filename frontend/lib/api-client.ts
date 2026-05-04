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
