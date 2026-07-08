# Handover — L1 · Auth + Identity → next lane

**Status:** shipped to `mvp` and **verified end-to-end on staging** (2026-06-30).
**`mvp` tip:** `14d854d`.

L1 (PHE-7, 11, 9, 12, 13) is complete: account creation, passphrase storage/verify, email OTP, sign-in + passphrase reset, and deterministic stellar color. This doc is the contract the next lane builds on.

---

## 1. What shipped (PRs, all merged to `mvp`)
| PR | What |
|----|------|
| #17 PHE-7 | Account creation (name+email+passphrase), `signup_drafts`, Argon2id |
| #18 PHE-11 | Passphrase verify + brute-force throttling |
| #19 PHE-9 | Email OTP delivery/verify + account materialization + GoTrue session minting |
| #20 PHE-12 | Sign-in + forgot/reset passphrase (single-use tokens) |
| #21 PHE-13 | Deterministic, immutable stellar color |
| #22 | Prisma ORM for Supabase (typed data access; coexists with supabase-js) |
| #23 | pnpm lockfile + native-build approval (deploy fix) |
| #24 | Multi-origin CORS (`FRONTEND_ORIGIN` = comma list) |
| #25 | Surface Resend send errors (no more silent email drops) |

**Verified on staging:** real account created — `auth.users` (email pre-confirmed) + `user_profiles` with Argon2id `passphrase_hash`, `passphrase_algo=argon2id`, `stellar_color=#E87722`; OTP + draft consumed.

## 2. The auth surface
- **Frontend entry points:** `/join` (signup s1 → OTP s2), `/signin` (name+passphrase, "sign in with email code" alt, "forgot your passphrase?"), `/reset?token=…` (reset landing), `/welcome` (s3 color reveal).
- **Backend routes (UNPREFIXED — no `/api`):** `POST /auth/signup/start`, `/auth/otp/send`, `/auth/otp/verify`, `/auth/signin`, `/auth/passphrase/reset/request`, `/auth/passphrase/reset/confirm`.
- **Session model:** the service-role client can't issue sessions, so the backend admin-`generateLink`s (magiclink for signup, recovery for signin/reset-existence) and exchanges the hashed token via an **anon** client (`SupabaseService.getAnonClient()`) → `{access_token, refresh_token}`. The frontend adopts it via `setSessionFromTokens()` in `frontend/lib/supabase-browser.ts`. `apiFetch()` (`frontend/lib/api-client.ts`) attaches the bearer on authed calls.

## 3. Integration contract — what the next lane MUST know
1. **`user_profiles` is keyed by `id` (= `auth.users.id`), NOT `user_id`.** The phe5 migrations declare `user_id`; the live DB + all app code use `id`. A reconcile migration (`20260603120250`) aligns fresh DBs. **Every profile read/write uses `id`.**
2. **Signed-in identity:** a logged-in user has a Supabase session on the browser client (read via the supabase browser client / `getSession`). Their `user_profiles` row carries `display_name`, `passphrase_hash`, `passphrase_algo`, `stellar_color` (+ pre-existing columns).
3. **Stellar color (the identity accent) — deterministic, immutable, persisted.**
   - Source of truth: `user_profiles.stellar_color` (hex). Computed once at account creation from `sha256(id + created_at)` → 14-color `STELLAR` palette.
   - Frontend: `frontend/lib/stellar.ts` exports `STELLAR` (14 hex), `STELLAR_NAMES`, `STELLAR_DEFAULT` (`#5599FF`), `hexToRgb`, `colorName()`. Backend mirror: `backend/src/common/stellar.util.ts` + SQL `stellar_color_for()` (all three byte-identical).
   - Exposed as CSS vars `--s` / `--s-rgb` via `frontend/contexts/session-color-context.tsx`.
   - ⚠️ **ACTION FOR NEXT LANE:** `SessionColorProvider` is currently mounted **only on the landing page** (`frontend/app/page.tsx`), **not** in the root shell (`frontend/app/layout.tsx`). So signed-in routes (`/onboarding`, `/constellation`, `/daily`) do **not** receive `--s`/`--s-rgb` from the provider — PHE-13's "single source of truth across the app shell" (AC#4) is only half-realized. **Hoist `SessionColorProvider` into the app shell/layout** so every signed-in screen gets the persisted color. Until then those screens fetch+apply `stellar_color` themselves.
4. **Routing handoff:** `/welcome` "i'm ready" → `router.push("/onboarding")`. The auth lane hands a freshly-created, signed-in user to **`/onboarding`**. Everything after that — onboarding flow, `/constellation` (the `ORIGIN`/`EMERGENCE` `0/100 forming` empty state is the expected new-account state), `/daily` — is the next lane's surface to populate.

## 4. Env / deploy (staging on Render)
Backend service requires (some newly added by L1):
- `DATABASE_URL` (**boot-critical** — Prisma `$connect()` on startup), `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (now used server-side for session minting), `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` (hex; also HMACs reset tokens)
- `FRONTEND_ORIGIN` — **comma-separated** allowlist; **first entry is the canonical origin used in reset links** (put the custom domain first)
- `RESEND_API_KEY` + `RESEND_FROM`
Notes: this is a **pnpm** repo (not npm) — native deps (`argon2`) + Prisma need `pnpm.onlyBuiltDependencies` in `backend/package.json`. Resend currently uses the `onboarding@resend.dev` test sender (delivers ONLY to the Resend-account owner's email; verify a domain for arbitrary recipients). Staging schema was applied via `docs/staging-auth-bundle.sql`.

## 5. Open follow-ups (Linear)
- **PHE-44** (High) — login-throttle: shared-IP budget reset on success + per-account lockout DoS.
- **PHE-45** (High) — signup OTP not bound to the specific draft (stale-draft completion).
- **PHE-46** (Med) — Argon2id DoS amplification; reset-token single-use TOCTOU; stellar SQL TZ dependency; **expired `signup_drafts` never swept** (accumulate).

## 6. Repo / cleanup state
- Auth-lane worktrees (`phenyx-phe-7/9/11/12/13`, `phenyx-prisma`) are merged — safe to remove. Other lanes' worktrees (`phenyx-landing-revamp`, `phenyx-onboarding`/PHE-19, `phenyx-phe-20`) are NOT this lane's.
- PHE-7/9/11/12/13 are still **Backlog** in Linear — move to Done (shipped + verified).
- See also memory: `auth-subsystem-mvp.md`, `prisma-orm-setup.md`, `frontend-build-gotchas.md`, `local-dev-env-gotchas.md`.
