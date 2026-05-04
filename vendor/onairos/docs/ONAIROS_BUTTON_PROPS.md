# OnairosButton — props reference (web / npm package)

This document describes the public surface of **`OnairosButton`** in the **web** SDK (`onairos` npm). The **source of truth for runtime behavior** is `src/onairosButton.jsx` (props forwarded to `src/components/UniversalOnboarding.jsx`, `src/components/TrainingScreen.jsx`, and helpers such as `src/utils/pollTrainingStatus.js`).

For **cross-platform contracts** (training polling, `autoFetch` + `backgroundLoadData` matrix, `authorizedData`, completion shape), see [`CROSS_SDK_PARITY.md`](./CROSS_SDK_PARITY.md).

---

## Migration from v7.x → v8.0.0

Two breaking changes consolidate the training props.

| Old | New |
| --- | --- |
| `enableTraining={false}` | `backgroundLoadData={true}` (host owns lifecycle) **or** `trainingScreenMode="none"` (returning users only) |
| `trainingScreenMode="real"` (was the default — fast traits-only completion) | `trainingScreenMode="fast"` |
| `trainingScreenMode="full"` | `trainingScreenMode="real"` |

`enableTraining` is removed entirely. The `'real'` value now means the slow
full-model-train mode (was `'full'`). The new default is `'fast'` (was `'real'`'s
behaviour). When `backgroundLoadData={true}` and `trainingScreenMode` is unset,
the SDK auto-resolves to `'none'` so no loading screen renders after PIN.

---

## Entry points

| Entry | Role |
|--------|------|
| **`<OnairosButton />`** | Renders the touch target; opens onboarding modals (`UniversalOnboarding` / `TrainingScreen` / explainer steps). |
| **`ref.trigger()`** | Same path as a tap (`handlePress` → modal). |
| **`initializeApiKey`** | From `src/services/apiKeyService.js` — must succeed before the button is interactive (unless `skipApiKeyInitialization` or inline `apiKey` init applies). |

---

## Result type: `onComplete(result)`

The modern callback is **`onComplete?: (result) => void`**.

| Field | Meaning |
|--------|---------|
| `token` | Bearer token for `apiUrl` and `training.statusUrl` polling |
| `apiUrl` | Backend URL for follow-up API calls |
| `approved` | String list of approved data tiers / scopes |
| `userData` | `{ email?, username?, connectedAccounts, skipped? }` |
| `apiResponse?` | Fetched traits/insights when `autoFetch` populated them |
| `platformData?` | Raw per-platform payloads |
| `authorizedData?` | Flags aligned with backend (see parity doc §2) |
| `training?` | `{ ready, statusUrl?, pollIntervalMs? }` after URL resolution |

**Legacy:** `onResolved(apiUrl, token, userData)` may still fire after `onComplete` for backward compatibility.

**`onPress`:** Fires after a successful flow when completion runs (not on the initial tap).

---

## Parity props (data / training / OAuth)

| Prop | Default | Web behavior |
|------|---------|----------------|
| `autoFetch` | `false` | After resolution, POST to resolved `apiUrl` when training is ready (or traits-only path); merges into `apiResponse`. |
| `backgroundLoadData` | `false` | When `autoFetch` and training not ready (non–special app, non–traits-only URL), skip blocking fetch: set `skipResolutionFetch`, return with `training` for host polling. Also drives the `trainingScreenMode` auto-default — when `true` and `trainingScreenMode` is not set, `'none'` is used so no loading screen renders after PIN. |
| `trainingScreenMode` | `'fast'` (or `'none'` when `backgroundLoadData=true`) | One of `'mock' \| 'fast' \| 'real' \| 'none'`. `'mock'` — 5 s fake animation, no socket. `'fast'` — real socket, completes when personality traits land (~30 s – 1 min). `'real'` — real socket, waits for full MIND1 model train (~2 – 3 min). `'none'` — `TrainingScreen` does not render; intended for already-trained users or `backgroundLoadData=true` flows. |
| `preCheck` | — | If returns `false` or throws, flow stops and `onRejection` is called. |
| `onRejection` | — | Called when `preCheck` fails. |
| `returnLink` | — | On mobile/Capacitor OAuth, used as OAuth `returnUrl` when non-empty (normalized; onairos OAuth params stripped). |
| `recommendedPlatforms` | — | Platforms listed first in onboarding UI order (then remainder). |
| `preferredPlatform` | — | Same as RN `preferredPlatform`; merged with `priorityPlatform` as `effectivePriorityPlatform`. |
| `primaryAuthOnly` | `false` | Combined with `authOnly`: immediate exit after auth when either is true. |
| `useNewWelcomeFlow` | `false` | New users skip `dataExplainer` → go to `onboarding` (Valentine/Lunar/default new-user detection unchanged). |
| `preferencesMbti` | `false` | When `true` and the user approved **`preferences`**: set `Info.Options.preferencesMbti` on `/getAPIurlMobile` and send `preferencesMbti: true` on inference POSTs (server MBTI 16-type probe; optional/absent `Input` when the preset is in the token). Backend **3.9.35+**; see `sdk-integration/MBTI_INFERENCE_INPUT_PRESET.md`. |

---

## Other props (summary)

Styling, `AppName`, `requestData`, `allowedPlatforms`, `dataUsageDescription`, `fastTraits`, `inferenceData`, `debug`, `testMode`, `skipApiKeyInitialization`, `apiKey`, `authOnly`, `priorityPlatform`, `enableLogging`, etc. follow existing web wiring in `onairosButton.jsx` and `UniversalOnboarding.jsx`.

---

## Implementation map (web files)

| Concern | File |
|---------|------|
| Button, resolution, `authorizedData` / `training` on result | `src/onairosButton.jsx` |
| Platform list, OAuth return URL, explainer | `src/components/UniversalOnboarding.jsx` |
| Training UI + `trainingScreenMode === 'mock'` | `src/components/TrainingScreen.jsx` |
| Status URL polling (RN parity) | `src/utils/pollTrainingStatus.js` (also exportable from package `src/index.js`) |

---

## Change log

- **2026-04-22** — Web parity props and docs; moved from `sdk-integration/` to `docs/`.
