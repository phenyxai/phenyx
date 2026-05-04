# Cross-SDK parity guide (from React Native implementation)

This document describes **behaviors and contracts** implemented in the Onairos **React Native** SDK so **web, iOS, Android, and other** SDKs can match them. It focuses on features that affect host-app integration: props, completion payloads, backend shapes, and polling rules.

For the **web** `OnairosButton` prop map and file locations, see [`ONAIROS_BUTTON_PROPS.md`](./ONAIROS_BUTTON_PROPS.md).

---

## 1. Completion contract: `OnairosResult` / `onComplete`

All first-party SDKs should converge on a single **success callback** shape (RN: `onComplete?: (result: OnairosResult) => void`).

### Core fields (always present when success fires)

| Field | Type | Meaning |
|--------|------|---------|
| `token` | `string` | Bearer token for authenticated calls to `apiUrl` and to `training.statusUrl` when polling. |
| `apiUrl` | `string` | Resolved data/inference URL from the mobile URL-resolution step (not necessarily the raw API base). |
| `approved` | `string[]` | Human-readable / tier ids the user approved (e.g. `basic`, `personality`, …). |
| `userData` | object | `email?`, `username?`, `connectedAccounts` (RN maps from `connectedPlatforms`), `skipped?`. |

### Optional fields (host apps should handle absence)

| Field | Type | Meaning |
|--------|------|---------|
| `apiResponse` | `any` | Populated when **`autoFetch`** successfully loaded user insights/traits after training is ready (or when traits-only path returns data). |
| `platformData` | `Record<string, any>` | Raw per-connector payloads (e.g. ChatGPT conversations/memories) when the flow attaches them. |
| `authorizedData` | `AuthorizedData` | Backend-aligned flags for what was authorized (see §2). |
| `training` | `TrainingStatus` | Training gate + polling hints (see §3–4). |

### Legacy callback

- **`onResolved(apiUrl, token, userData)`** — deprecated; may still fire for backward compatibility after `onComplete`. New integrations should use **`onComplete` only**.

---

## 2. `authorizedData` (backend-aligned)

Other SDKs should use the **same keys** as the backend / JWT payload:

| Key | Meaning |
|-----|---------|
| `basic` | Always `true` when present in a valid authorization. |
| `personality?` | Personality / LLM profile tier. |
| `preferences?` | Inference / sentiment tier. |
| `rawMemories?` | Raw LLM conversation data tier. |
| `fastTraits?` | Fast traits mode (remote flag). |
| `wrappedTraits?` | Wrapped-app-only mode. |

**Parity rule:** Do not rename to older labels (`Small` / `Medium` / `Large`) in API responses; those may still appear in **UI-only** `requestData` in some apps, but **`authorizedData` in `OnairosResult` should match the table above.**

---

## 3. `training` / `TrainingStatus`

Returned from the same resolution step as `apiUrl` (e.g. after `/getAPIurlMobile`-style response is normalized).

```typescript
interface TrainingStatus {
  /** If true, the SDK may fetch from apiUrl immediately (subject to autoFetch). */
  ready: boolean;
  /** When ready is false, host or SDK polls this URL until training is done. */
  statusUrl?: string;
  /** Suggested delay between polls in milliseconds. */
  pollIntervalMs?: number;
}
```

**Example backend fragment (illustrative):**

```json
{
  "apiUrl": "https://api2.onairos.uk/combinedInference",
  "token": "eyJ...",
  "authorizedData": {
    "basic": true,
    "personality": true,
    "preferences": true,
    "rawMemories": false
  },
  "training": {
    "ready": true,
    "statusUrl": "https://api2.onairos.uk/mobile-training/status",
    "pollIntervalMs": 5000
  }
}
```

**Default host:** RN defaults and fallbacks align with **`production` → `api2.onairos.uk`** when no environment is set (see changelog: routing / env).

---

## 4. `autoFetch` + `backgroundLoadData` (training and data loading)

These two booleans control **who waits** for training and **who calls** `apiUrl`.

### Props

| Prop | Default | Purpose |
|------|---------|---------|
| `autoFetch` | `false` | If `true`, after URL resolution the SDK **POSTs** to `apiUrl` with the session token (and inference body when applicable) and merges the result into the completion payload (`apiResponse` / insights). |
| `backgroundLoadData` | `false` | If `true`, when training is **not** ready the SDK **does not** block on the built-in training UI for that branch; it returns **early** so the host can show custom loading and poll **`training.statusUrl`** itself. |

### Decision matrix (normative for parity)

Assume URL resolution returned `training` and `apiUrl` / `token`. Let “traits-only” mean `apiUrl` includes the substring **`traits-only`** (RN skips training wait for that case to align with web).

| `autoFetch` | `backgroundLoadData` | `training.ready` | Expected behavior |
|-------------|------------------------|------------------|-------------------|
| `false` | any | any | Return metadata only: `apiUrl`, `token`, `authorizedData`, `training`. **No** automatic fetch from `apiUrl`. Host fetches when ready. |
| `true` | `false` | `true` | SDK fetches from `apiUrl` (after any in-SDK training UI / socket rules). `apiResponse` populated when successful. |
| `true` | `false` | `false` + `statusUrl` + **not** traits-only | SDK **polls** `statusUrl` (see §5) until ready or timeout, then fetches from `apiUrl`. |
| `true` | `true` | `false` + `statusUrl` + **not** traits-only | SDK **returns immediately** with `data: null` / no `apiResponse`, **`training` unchanged** (`ready: false`). Host polls `statusUrl`, then fetches `apiUrl`. |
| `true` | any | `false` but **traits-only** `apiUrl` | **No** training poll (RN explicitly skips). Proceed to fetch `apiUrl` per inference/traits rules. |

**Parity note:** When `autoFetch=false` and `backgroundLoadData=true`, behavior matches **`autoFetch=false` and `backgroundLoadData=false`**: the host always owns fetching; the second flag mainly changes UX when **`autoFetch=true`** and training is pending.

**Web implementation:** `src/utils/pollTrainingStatus.js` (`pollTrainingStatus`, `normalizeTrainingFromResolution`) and `src/onairosButton.jsx` (`handleDataRequestComplete`, non–special apps only for the training gate).

---

## 5. Polling `training.statusUrl` (contract for all SDKs)

When the host (or the SDK in “blocking” mode) polls **`training.statusUrl`**, behavior should match RN’s `pollTrainingStatus`:

| Rule | RN behavior |
|------|-------------|
| HTTP method | `GET` |
| Headers | `Authorization: Bearer <token>` (same token as `apiUrl` fetch), `Content-Type: application/json`. |
| Interval | Wait **`training.pollIntervalMs`** between attempts; default **5000 ms** if omitted. |
| Max attempts | **60** attempts (~5 minutes at 5s). |
| HTTP 429 | Treat as rate limit: wait **2 × pollIntervalMs** then **retry without counting** as a failed attempt (RN `continue` in loop). |
| Other non-OK | Log, wait one interval, continue. |
| Success conditions | RN treats training as complete if any of: `data.ready === true`, `data.status === 'complete'`, or **heuristics** on `trainingStatus` / `trainingHistory` / `isCurrentlyTraining` / `lastTrainingDate` (see implementation). |
| Exhausted attempts | Returns “not ready”; RN may attach `neverTrained: true` on training object in some failure paths. |

**Parity rule:** Other SDKs should implement the **same URL, headers, interval, backoff, and max attempts**, or document intentional differences. Response JSON shape may evolve; RN already accepts **multiple** “ready” shapes—web should not assume a single field unless backend guarantees one.

---

## 6. `autoFetch` data fetch (correct endpoint flow)

RN **does not** use a hardcoded `/developer/user-data` path for this flow. The normative sequence is:

1. Call mobile URL resolution (e.g. **`/getAPIurlMobile`**) → `{ apiUrl, token, authorizedData?, training? }`.
2. If `autoFetch` and conditions are met, **`POST`** to that **`apiUrl`** with `Authorization: Bearer <token>` and body from **`buildInferenceRequestBody(apiUrl, inferenceData)`** (may be empty/minimal for some URLs).
3. Normalize response for `apiResponse` / insights.

**Parity rule:** Web and native SDKs must use **`apiUrl` from step 1**, not a fixed traits URL, unless the resolved URL is explicitly traits-only.

---

## 7. Related props (configuration parity)

These should exist with the **same names and semantics** on other surface APIs (button, headless flow, etc.):

| Prop | Purpose |
|------|---------|
| `trainingScreenMode` | `'real' \| 'mock'` — mock skips or simulates training UI where applicable. |
| `fastTraits` | Prefer faster trait generation (`traits-only-fast` vs `traits-only` style URLs in RN). |
| `inferenceData` | Host-provided payload for inference POST body; if missing when required, RN may fall back to traits-only with a warning. |
| `allowedPlatforms` / `recommendedPlatforms` | Filter and badge platform list; order preserved for allowlist. |
| `dataUsageDescription` | Custom pre-onboarding explainer copy. |
| `primaryAuthOnly` | Limit flow to primary auth when supported. |
| `useNewWelcomeFlow` | Swap to simplified welcome path (RN: fewer props honored on that path—document per SDK). |
| `apiKey` | Optional per-component init of API key service. |
| `skipApiKeyInitialization` | Test-only gate bypass (RN still checks init on press unless tests mock it). |
| `preferencesMbti` | (Web v7.1.2+) When `true` and `preferences` is in approved tiers, handshake sets `Info.Options.preferencesMbti` and inference POSTs include `preferencesMbti: true` for the server MBTI probe — see `sdk-integration/MBTI_INFERENCE_INPUT_PRESET.md`. |

---

## 8. Initialization and button visibility (RN parity with web)

- **`OnairosButton`** returns **`null`** until SDK auth initialization is **ready** (aligned with web: no tappable button before keys are valid).
- Optional **`apiKey`** on the button triggers **`initializeApiKey`** from the component when the key changes.
- **`skipApiKeyInitialization`** is for automated tests.

Other SDKs should expose the same **gate** behavior or document why (e.g. embedded web always has parent init).

---

## 9. JWT storage compatibility (RN-specific but affects API calls)

RN **`jwtStorageService` / `apiKeyService`** support a transition between **`sdk_jwt_token`** and **`onairos_jwt_token`**: read from the new key, fall back to legacy, mirror writes during migration. PIN and platform flows were updated to accept both.

**Parity rule:** Non-RN SDKs on the same backend should follow the **same key names** the backend expects when storing session JWTs for mobile.

---

## 10. Training completion over socket (RN “Unreleased” / latest behavior)

Changelog (Unreleased): RN **does not** treat early socket events as final completion if they lack **traits-bearing** payloads; it waits for **`personality_analysis_complete`** or a completion payload that includes traits, so **`onComplete` is not fired prematurely** with metadata-only results.

**Parity rule:** Web and other clients using the same socket protocol should apply the **same completion gating** so `onComplete` / `apiResponse` semantics match RN.

---

## 11. PIN / user API guard (RN)

`makeUserApiRequest()` hydrates JWT from persistence when the in-memory user token is missing (before failing auth).

**Parity rule:** Any SDK wrapper around user-authenticated HTTP should **load persisted session** the same way to avoid false “not authenticated” after cold start.

---

## 12. `requestData` consent models (RN)

RN supports flexible **`requestData`** shapes (object, array of objects, array of strings) with defaults for missing descriptions. **`basic`** is always shown; **`rawMemories`** may only appear if allowed in `requestData` **and** the user connected an LLM platform.

**Parity rule:** Consent screens and “which toggles exist” logic should match across SDKs for the same `requestData` input.

---

## 13. Known gaps to fix for parity inside RN

| Area | Issue |
|------|--------|
| **Exported `OnairosButtonProps`** | Re-exported from `src/types.ts`; may be **missing** props that `OnairosButton.tsx` accepts (`useNewWelcomeFlow`, `allowedPlatforms`, `apiKey`, etc.). Types should be unified. |
| **`executeOnairosFlow`** | Only forwards a **subset** of props to `UniversalOnboarding`; does not match the button surface. Headless flows on other platforms should still implement the full matrix in §4–6. |

---

## 14. Reference implementation (React Native)

| Concern | Primary files |
|---------|---------------|
| Result types | `src/components/OnairosButton.tsx` (`OnairosResult`, `TrainingStatus`, `AuthorizedData`) |
| URL resolution, autoFetch, polling | `src/components/UniversalOnboarding.tsx` (`fetchUserDataWithApiUrl`, `pollTrainingStatus`, `buildInferenceRequestBody`) |
| API config / env | `src/config/api.ts`, `src/services/apiKeyService.ts` |
| Changelog narrative | `CHANGELOG.md` (sections: `backgroundLoadData`, Background polling, `autoFetch` fix, AuthorizedData, requestData, Unreleased training/socket) |

---

## Changelog

- **2026-04-26** — Documented web `preferencesMbti` (MBTI inference input preset) for cross-SDK awareness; full contract in `sdk-integration/MBTI_INFERENCE_INPUT_PRESET.md`.
- **2026-04-22** — Added `docs/CROSS_SDK_PARITY.md` consolidating RN contracts for multi-SDK alignment.
- **2026-04-22** — Moved parity + web props docs under `docs/`; web implements `pollTrainingStatus`, `backgroundLoadData`, and related `OnairosButton` props (see `CHANGELOG.md`).
