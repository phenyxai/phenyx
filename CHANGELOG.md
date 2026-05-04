# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-05-03

### Changed (billing)

- Single **Pro** plan (monthly subscription + yearly as one-time payment in Stripe) and **gifted constellation** one-time; removed separate Signal/Observatory **subscription** tiers.
- Env: **`STRIPE_PRO_MONTHLY_PRICE_ID`**, **`STRIPE_PRO_YEARLY_PRICE_ID`**, **`STRIPE_GIFT_PRICE_ID`** (replaces Signal/Observatory price env vars).
- **`/upgrade`**: Free + Pro + Gifted constellation cards; checkout body uses `checkoutKind: "pro" | "gift"` and `billingPeriod` for Pro.
- **`/settings`**: Signal & Observatory experience modes gated with **`hasFullAccess()`** (`pro` or `gifted` tiers); billing portal for monthly subscribers with **`stripe_subscription_id`**.
- **Webhooks**: `checkout.session.completed` handles **subscription** (Pro monthly) and **payment** (Pro yearly one-time + gift); tier values **`pro`** / **`gifted`** / **`free`**.
- **API** — `POST /api/stripe/billing-portal`.

### Migration (optional SQL)

- `supabase/migrations/20260503130500_normalize_legacy_subscription_tiers.sql` maps legacy `signal` / `observatory` / `paid` tiers to **`pro`**.

## [0.2.1] - 2026-05-03

### Added

- **`scripts/check-env.mjs`** — Run `pnpm check:env` to verify `.env.local` (and process env) for required Supabase vars and list missing server keys.
- **`.env.example`** — Documents all variables used by the app (public and server-only).

## [0.2.0] - 2026-05-02

### Added

- **`user_profiles.onairos_data`** — JSON column for a redacted Onairos completion snapshot (JWT `token` is never stored). Apply migration: `supabase/migrations/20260502120000_user_profiles_onairos_data.sql` in the Supabase SQL editor or via CLI.
- **`lib/onairos-snapshot.ts`** — `redactOnairosForProfile()` strips secrets before persistence.
- **`types/onairos-augment.d.ts`** — Declares `initializeApiKey` and `children` on `OnairosButton` where upstream `.d.ts` is incomplete.
- **Onboarding** — On `onComplete` (with `autoFetch`), saves redacted Onairos payload to `user_profiles` immediately; **`GET /api/synthesize-constellation`** still upserts `constellation_state` and now also refreshes `user_profiles.onairos_data` server-side.
- **`OnairosButtonWrapper`** — `allowedPlatforms` default: `youtube`, `linkedin`, `chatgpt`, `reddit` (connector IDs per Onairos CONNECTORS.md); optional `autoFetch` prop.

### Changed

- **`NEXT_PUBLIC_ONAIROS_API_KEY`** — Required for SDK init (replace hardcoded key). Set in `.env.local`, Cloudflare/Vercel, and CI.
- **Stripe checkout** — API returns `session.url`; upgrade flow redirects via `window.location` (compatible with `@stripe/stripe-js` v9 where `redirectToCheckout` typing was removed).
- **Stripe server SDK** — API version `2026-04-22.dahlia`.
- **Node** — `engines.node >=20`, `.nvmrc` set to `20`.

### Fixed

- TypeScript: duplicate style keys in `daily` / `OrboGuide`; SVG `textAnchor` typing in `constellation`; invalid `.catch` on `supabase.rpc` builder in onboarding.
