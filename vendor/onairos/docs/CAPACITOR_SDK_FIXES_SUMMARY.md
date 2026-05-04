## Capacitor / iOS WKWebView Compatibility Fixes (SDK Summary)

This doc summarizes the changes made in the `onairos` npm package to ensure **Capacitor iOS (WKWebView)** compatibility, especially around **`import('onairos')`** stability, styling parity, and OAuth return behavior.

### Goals

- **No WKWebView crash at module import time** (including dynamic import).
- **Same UI styling/layout** as mobile Safari (SDK should look identical).
- **OAuth flows return back into the SDK modal** (especially on iOS where popups are unreliable).
- **Safe for web + mobile Safari** (changes are guarded and/or ESM-only when required).

### Key fixes (high-level)

- **Removed import-time WKWebView hazards**
  - **No static `@capacitor/*` imports at module top-level** (prevents premature evaluation in environments that don’t fully support them).
  - **Guarded all `process.env` access** with `typeof process !== 'undefined'` to prevent `ReferenceError: Can't find variable: process` on iOS.
  - **Disabled ESM obfuscation** after it caused WebKit-specific TDZ crashes (`Cannot access uninitialized variable`).

- **Ensured SDK CSS always loads (no “unstyled Capacitor UI”)**
  - `package.json` now includes `sideEffects: ["*.css"]` so bundlers do not tree-shake the SDK’s global CSS.
  - `src/onairos.jsx` imports `src/styles/tailwind.css`.
  - ESM output uses runtime CSS injection (via `style-loader`) to work reliably in Vite/Capacitor consumers.

- **Modal layout parity for Capacitor**
  - `ModalPageLayout` treats Capacitor native as “mobile modal” and uses bottom-sheet sizing (safe-area friendly) instead of full-screen top-aligned layouts.

- **OAuth return reliability (don’t “lose the modal” after connecting)**
  - The OAuth callback page and the SDK coordinate via localStorage/sessionStorage flags so that after iOS redirects/reloads, the SDK **reopens directly into UniversalOnboarding**.
  - The SDK now stores a **clean** `onairos_return_url` (strips any stale `onairos_oauth_*` params) so the next connector does not inherit old OAuth-return query params.

### Files touched / where to look

- **Build / packaging**
  - `package.json` (CSS sideEffects)
  - `webpack.config.js` (ESM: style injection, obfuscation disabled)

- **WKWebView runtime safety**
  - `src/components/UniversalOnboarding.jsx` (guarded env access; OAuth handling)
  - `src/onairosButton.jsx` (OAuth return handling; modal restore)
  - `src/utils/apiKeyValidation.js` (guarded `process.env.NODE_ENV`)

- **Styling parity**
  - `src/onairos.jsx` (imports Tailwind CSS)
  - `src/styles/tailwind.css`

- **OAuth callback page**
  - `public/oauth-callback.html` (preserves/sets onboarding return flags for reliable modal restore)

### Known platform constraints (not SDK bugs)

- **Google Sign-In in embedded WKWebView**
  - The embedded Google button (`@react-oauth/google` / `GoogleLogin`) can fail to render or be blocked in WKWebView contexts such as `capacitor://localhost` depending on origin/scheme and Google policy.
  - For Google-backed OAuth connectors (YouTube/Gmail), Google commonly enforces **`disallowed_useragent`** in embedded webviews. The SDK therefore prefers **opening a secure system browser** in Capacitor (when available) for those flows.












