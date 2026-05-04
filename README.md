# Phenyx Collective

Identity-formation app. Two services, one repo.

```
.
├── frontend/   Next.js 16 (App Router) — UI, marketing, auth-gated pages
├── backend/    NestJS — REST API, Stripe, Supabase service-role, Anthropic
└── supabase/   Shared SQL migrations
```

## Local development

Both services run independently. Start each in its own terminal.

### Backend (port 4000)

```bash
cd backend
pnpm install
pnpm start:dev
```

Requires `backend/.env` (see `backend/.env.example`). Holds all secrets: Supabase service role, Stripe secret, Anthropic key, encryption key.

### Frontend (port 3000)

```bash
cd frontend
pnpm install
pnpm dev
```

Requires `frontend/.env.local` (see `frontend/.env.example`). Public keys only — points at the backend via `NEXT_PUBLIC_API_BASE_URL`.

## Deployment

Two Render Web Services from this repo, each rooted at its subdirectory.

| Service | Root | Build | Start |
|---|---|---|---|
| `phenyx-frontend` | `frontend/` | `pnpm install && pnpm build` | `pnpm start` |
| `phenyx-backend` | `backend/` | `pnpm install && pnpm build` | `pnpm start:prod` |

After deploy: set `NEXT_PUBLIC_API_BASE_URL` on the frontend to the backend's Render URL, and `FRONTEND_ORIGIN` on the backend to the frontend's Render URL. Update the Stripe webhook endpoint in the Stripe Dashboard to `<backend-url>/stripe/webhook`.

## Auth flow

Frontend holds the Supabase session (browser cookies). Every API call from the frontend includes `Authorization: Bearer <jwt>`. The backend's `SupabaseAuthGuard` validates the token via `supabase.auth.getUser()` on every guarded route.

## Database

Supabase (Postgres). Migrations live in `supabase/migrations/`. The backend uses the service-role key for privileged operations; the frontend only uses the anon key.
