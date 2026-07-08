# PHENYX — Deployment Runbook

Staging is two Render Node-20 web services that deploy from **`mvp`**:
`phenyxcollective-backend-staging` (NestJS) and `phenyxcollective-frontend-staging` (Next.js).
Infra is captured in [`render.yaml`](./render.yaml) (reference blueprint). This runbook is the ordered checklist to get a fresh `mvp` running.

---

## Critical path (in order)

### 1. Apply Supabase migrations ⚠️ do this FIRST
The API reads tables that only exist once migrations run (`observations`, `polaris_*`, `polaris_token_usage`, `user_traits`, `events`, `voice_standard`, and `constellation_state.foresight/mantra`). **Prisma does not apply these** — it is introspection-only; the schema lives in `supabase/migrations/*.sql`.

```bash
supabase link --project-ref <staging-project-ref>
supabase db push                                  # applies pending migrations
# verify:
psql "$DIRECT_URL" -f supabase/verification/phe31_acceptance.sql
```
Skipping this makes every `/constellation`, `/profile/overview`, Polaris, and observations call 500.

### 2. Set env vars on both Render services
Full reference below. All secrets are `sync: false` in `render.yaml` — set their values in the Render dashboard (or `render env`), never in git.

### 3. Confirm build/start commands
| Service | Build | Start | Health |
|---|---|---|---|
| backend | `npm install && npm run build` (`postinstall` → `prisma generate`) | `npm run start:prod` | `GET /health` |
| frontend | `npm install && npm run build` | `npm run start` | — |

### 4. Stripe webhook
Register `https://<backend-url>/stripe/webhook` in the Stripe dashboard → put its signing secret in `STRIPE_WEBHOOK_SECRET`. `main.ts` already mounts `express.raw()` on that path. Create the 3 Price IDs and set them. Test keys for staging, live keys for prod.

### 5. Deploy + smoke test
Trigger a deploy, then run `./scripts/smoke-test.sh https://<backend-url> https://<frontend-url>` and walk the real flow (see §Smoke test).

---

## Environment variables

### Backend (`phenyxcollective-backend-staging`)
| Var | Purpose | How to get / generate |
|---|---|---|
| `PORT` | listen port | Render sets this automatically |
| `FRONTEND_ORIGIN` | CORS allow-list (comma-separated origins) | the frontend URL(s) |
| `SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** admin client | Supabase → Settings → API |
| `DATABASE_URL` | Prisma runtime (txn pooler `:6543` `?pgbouncer=true`) | Supabase → Settings → Database |
| `DIRECT_URL` | migrations/introspection (session pooler `:5432`) | Supabase → Settings → Database |
| `ANTHROPIC_API_KEY` | Claude synthesis/Polaris/crisis | console.anthropic.com |
| `RESEND_API_KEY` | OTP + passphrase-reset emails | resend.com → API Keys |
| `RESEND_FROM` | verified From address | resend.com → Domains |
| `ONAIROS_API_SECRET` | Onairos callback verification | Onairos dashboard |
| `STRIPE_SECRET_KEY` | Stripe API | dashboard.stripe.com → API keys |
| `STRIPE_WEBHOOK_SECRET` | webhook signature | Stripe → Webhooks → your endpoint |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | pro monthly price | Stripe → Products |
| `STRIPE_PRO_YEARLY_PRICE_ID` | pro yearly price | Stripe → Products |
| `STRIPE_GIFT_PRICE_ID` | gift price | Stripe → Products |
| `ENCRYPTION_KEY` | AES-256-GCM + HMAC key | `openssl rand -hex 32` — see warning below |

> **`ENCRYPTION_KEY` is load-bearing.** It must be **64 hex chars (32 bytes)** and **identical across every restart and instance, forever**. It encrypts reflections + Polaris messages and keys the HMAC fingerprints used for lookups/dedup. Rotate it and all existing encrypted data becomes unreadable and lookups break. Generate once, store in a secrets manager, never change it without a re-encryption migration.

### Frontend (`phenyxcollective-frontend-staging`)
> `NEXT_PUBLIC_*` are **inlined at build time** — they must be set *before* `next build` runs (Render injects service env into the build).

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client Supabase (OTP auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client Supabase |
| `NEXT_PUBLIC_API_BASE_URL` | the **backend** URL, e.g. `https://api.staging.phenyxcollective.com` |
| `NEXT_PUBLIC_ONAIROS_API_KEY` | Onairos SDK |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | gates `/admin` (page-level only — weak) |

---

## Smoke test
`./scripts/smoke-test.sh <backend-url> [frontend-url]` checks liveness. Then walk the flow manually:
1. `GET /health` → 200
2. Sign up → OTP email arrives (**Resend** works)
3. Onboarding → Onairos connect → synthesis returns (**Claude** works, **migrations** applied)
4. Dashboard → `/constellation` + `/profile/overview` return data (not the Supabase fallback)
5. Upgrade → Stripe checkout redirect; complete a test payment → tier updates via webhook

---

## Before real users (pre-prod hardening)
- **Backend `numInstances: 1`.** Auth throttle + OTP ledgers are in-memory; multiple instances reset lockouts. Keep single-instance until externalized to Postgres/Redis.
- **Error tracking** — add Sentry (needs a DSN). CI (build+typecheck) and structured Stripe logs already exist.
- **Onairos HMAC** — `ONAIROS_API_SECRET` verification is currently structural-only; implement real verification before trusting inbound trait data.

## Production promotion (separate, deliberate)
Prod is **not** a `git push` — it's its own stack:
- separate Render services (deploy from `main`/`prod`, or manual promotion of a known-good `mvp` commit),
- a **separate Supabase project** (run migrations there),
- **live** Stripe keys + a prod webhook endpoint,
- the production domain + `FRONTEND_ORIGIN`/`NEXT_PUBLIC_API_BASE_URL` pointing at prod URLs,
- a fresh `ENCRYPTION_KEY` for the prod DB (kept forever).
