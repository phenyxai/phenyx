## Capacitor Integration Guide (React/Vite → iOS/Android)

This guide is for teams shipping a Capacitor app (WKWebView) who want to integrate the `onairos` npm SDK with **minimal changes**.

### What you get

- **Same UI as mobile web** (SDK modal + onboarding + data request).
- **Works with dynamic import** (`await import('onairos')`) on iOS WKWebView.
- **OAuth connectors**: mobile-friendly redirect flows; Google-backed connectors use secure browser when available.

---

## 1) Install

```bash
npm install onairos
```

---

## 2) Vite config (recommended)

In your host app’s `vite.config.ts`, exclude `onairos` from dependency pre-bundling:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['onairos'],
  },
});
```

---

## 3) Add the SDK (single-line integration)

Render the button anywhere in your app:

```jsx
import { OnairosButton } from 'onairos';

export default function SettingsScreen() {
  return (
    <OnairosButton
      webpageName="My App"
      requestData={['email', 'profile', 'social']}
      onComplete={(result) => {
        // result.approved
        // result.apiResponse (when autoFetch is enabled)
        console.log(result);
      }}
    />
  );
}
```

### API key + base URL (recommended)

If you want to provide an API key / base URL without wiring env vars, set globals once before rendering:

```js
window.onairosApiKey = 'ona_...';
window.onairosBaseUrl = 'https://api2.onairos.uk'; // optional
```

---

## 4) Capacitor config (best experience)

The SDK will run without special config for many flows, but these settings make OAuth navigation far more reliable.

### `capacitor.config.*`

- **Recommended**: run iOS WebView as `https://localhost` (helps with OAuth and embedded widgets).
- **Recommended**: allow navigation to Onairos + OAuth domains so redirects stay in-app where appropriate.

Example:

```json
{
  "appId": "com.yourapp.id",
  "appName": "Your App",
  "webDir": "dist",
  "server": {
    "hostname": "localhost",
    "iosScheme": "https",
    "allowNavigation": [
      "*.onairos.uk",
      "onairos.uk",
      "accounts.google.com",
      "*.google.com",
      "*.twitter.com",
      "*.linkedin.com",
      "*.reddit.com"
    ]
  }
}
```

### Capacitor plugins (OAuth)

- **Recommended**: install the Browser plugin for Google-backed OAuth (YouTube/Gmail).
  - Google often blocks embedded WKWebView with `disallowed_useragent`; a secure browser is required.

```bash
npm install @capacitor/browser
npx cap sync
```

> Note: the SDK will still attempt to fall back gracefully if the plugin isn’t available, but Google-backed flows may be blocked by policy in embedded webviews.

---

## 5) Build & run on device

```bash
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode, select your iPhone and Run.

---

## 6) Troubleshooting

### “import('onairos') crashes on iOS”

- Ensure you’re on a recent `onairos` version (5.2.x+ contains WKWebView import-time fixes).
- Ensure the host app isn’t polyfilling/rewriting globals that WKWebView doesn’t support.

### “OAuth returns but the modal closes / doesn’t reopen”

- Ensure your app isn’t stripping query params from `capacitor://localhost` navigations.
- If you have a router, make sure it doesn’t hard-reset to a “home screen” on every reload.
- The SDK uses localStorage/sessionStorage flags to reopen the modal after OAuth redirects.

### “Google button doesn’t show in Capacitor”

- Some iOS WKWebView origins (especially `capacitor://localhost`) don’t reliably support the embedded Google widget.
- Use `iosScheme: "https"` + `hostname: "localhost"` so the origin becomes `https://localhost`.
- For Google-backed OAuth connectors (YouTube/Gmail), install `@capacitor/browser` so the SDK can open a secure browser.












