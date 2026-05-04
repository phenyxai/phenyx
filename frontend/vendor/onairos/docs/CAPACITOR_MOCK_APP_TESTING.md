# Capacitor (iOS WKWebView) Mock App Testing

This SDK previously bundled static imports of `@capacitor/*` into the published entrypoint, which meant **`import('onairos')` could evaluate Capacitor packages immediately**. In some iOS WKWebView environments, that evaluation can crash before any “platform guard” code runs.

We fixed this by removing **all static** `@capacitor/*` imports from `src/` and switching to runtime access via `window.Capacitor.Plugins.*` only when actually running in a native Capacitor app.

## What changed in the SDK (high level)

- Added `src/utils/capacitorPlugins.js` which only reads:
  - `window.Capacitor`
  - `window.Capacitor.isNativePlatform()`
  - `window.Capacitor.Plugins.Browser`
  - `window.Capacitor.Plugins.App`
- Updated the following files to use that helper instead of importing `@capacitor/*`:
  - `src/onairosButton.jsx`
  - `src/components/UniversalOnboarding.jsx`
  - `src/components/GoogleButton.js`
  - `src/components/EmailAuth.js`
  - `src/components/connectors/GmailConnector.js`
  - `src/components/connectors/YoutubeConnector.js`
- Verified the built entrypoints contain **no `@capacitor/*` imports**:
  - `dist/onairos.esm.js`
  - `dist/onairos.bundle.js`

## How to test on an iPhone via Xcode (mock Capacitor app)

### 1) Build/pack the SDK locally

From this repo (`onairos-npm`):

```bash
npm run build
npm pack
```

This produces a tarball like `onairos-5.1.1.tgz`.

### 2) Create a new Capacitor app (React + Vite example)

In a separate folder (outside this repo is fine):

```bash
npm create vite@latest onairos-cap-test -- --template react
cd onairos-cap-test
npm install
```

Install Capacitor:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init onairos.cap.test com.onairos.captest --web-dir dist
npx cap add ios
```

### 3) Install the SDK tarball into the mock app

From the mock app folder, install the tarball you created in step 1:

```bash
npm install /absolute/path/to/onairos-npm/onairos-5.1.1.tgz
```

### 4) Add a “dynamic import” crash test

In `src/App.jsx`, add a button like:

```jsx
import { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('idle');

  const testDynamicImport = async () => {
    setStatus('importing...');
    console.log('[cap-test] before import(onairos)');
    try {
      const mod = await import('onairos');
      console.log('[cap-test] after import(onairos)', Object.keys(mod));
      setStatus('import ok');
    } catch (e) {
      console.error('[cap-test] import failed', e);
      setStatus('import failed (caught)');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <button onClick={testDynamicImport}>Test import('onairos')</button>
      <div>Status: {status}</div>
    </div>
  );
}
```

### 5) Run on device

Build the web assets, sync, then open Xcode:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:
- Select your connected iPhone as the run target
- Run

### 6) What “pass” looks like

- Tapping **Test import('onairos')** should **not crash the app**
- You should see logs:
  - `[cap-test] before import(onairos)`
  - `[cap-test] after import(onairos) ...`

If it still crashes *at import time*, it indicates there’s still some iOS-incompatible code being evaluated at module load (we can then binary-search by trimming exports / entrypoints further).

---

## (NEW) Tailwind “host app pollution” test (preflight isolation)

The SDK ships Tailwind utilities for its own UI. However, Tailwind **preflight** (base layer) is a global reset that can unintentionally change the host app’s default element styles (e.g. `h1` margins).

To verify the SDK **does not** reset host styles:

### A) Add a host-style probe UI

In the mock app’s `src/App.jsx`, add a host “probe” that measures default `h1` margin **before and after** importing the SDK.

```jsx
import { useMemo, useRef, useState } from 'react';

export default function App() {
  const h1Ref = useRef(null);
  const [status, setStatus] = useState('idle');
  const [probe, setProbe] = useState({ before: null, after: null });

  const readH1Margin = () => {
    const el = h1Ref.current;
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    return { marginTop: cs.marginTop, marginBottom: cs.marginBottom };
  };

  const testDynamicImport = async () => {
    setStatus('importing...');
    const before = readH1Margin();
    setProbe((p) => ({ ...p, before }));
    console.log('[cap-test] h1 margin BEFORE import(onairos)', before);

    try {
      const mod = await import('onairos');
      console.log('[cap-test] after import(onairos)', Object.keys(mod));
    } catch (e) {
      console.error('[cap-test] import failed', e);
      setStatus('import failed (caught)');
      return;
    }

    const after = readH1Margin();
    setProbe((p) => ({ ...p, after }));
    console.log('[cap-test] h1 margin AFTER import(onairos)', after);
    setStatus('import ok');
  };

  const same =
    probe.before &&
    probe.after &&
    probe.before.marginTop === probe.after.marginTop &&
    probe.before.marginBottom === probe.after.marginBottom;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ border: '2px solid #f97316', padding: 12, borderRadius: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Host UI probe (should NOT change)</div>
        <h1 ref={h1Ref} style={{ background: '#fee2e2' }}>
          Host H1 default margins
        </h1>
        <div style={{ fontSize: 12 }}>
          BEFORE: {probe.before ? JSON.stringify(probe.before) : '—'}<br />
          AFTER: {probe.after ? JSON.stringify(probe.after) : '—'}<br />
          Result: {probe.before && probe.after ? (same ? 'PASS ✅ (unchanged)' : 'FAIL ❌ (changed)') : '—'}
        </div>
      </div>

      <div style={{ height: 12 }} />

      <button onClick={testDynamicImport} style={{ padding: 12, borderRadius: 10 }}>
        Test import('onairos')
      </button>
      <div>Status: {status}</div>
    </div>
  );
}
```

### B) Expected results

- **PASS**: The `h1` margins reported **before/after** import are identical.
- **FAIL**: The margins change after import (classic sign of Tailwind preflight/base being applied globally).

### C) Run on device

Same as above:

```bash
npm run build
npx cap sync ios
npx cap open ios
```


