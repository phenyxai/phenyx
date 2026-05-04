# Onairos SDK v5.8

> **Connect user data to your applications with privacy-first identity sharing**

[![npm version](https://img.shields.io/npm/v/onairos.svg)](https://www.npmjs.com/package/onairos)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

The Onairos SDK enables applications to connect and communicate data with Onairos Identities via user authorization. Integration is seamless for React, Vue, Laravel, Framer, and mobile applications.

---

## ✨ Key Features

- **🔐 Privacy-First Data Sharing** - Users authorize exactly what data to share
- **⚛️ React 18 & 19 Support** - Full compatibility with latest React versions
- **📱 Mobile Ready** - Native Capacitor support for iOS & Android
- **🎨 Laravel Integration** - First-class Blade, Vue, and Vite support
- **🖼️ Framer Support** - No-build CDN integration for Framer projects
- **💬 Telegram Mini Apps** - Build data-connected Telegram bots
- **🔄 AutoFetch** - Automatic API calls after user approval
- **📝 TypeScript** - Full type definitions included
- **🎯 Test Mode** - Development testing without live data

---

## 📦 Installation

```bash
npm install onairos
```

### Peer Dependencies

```bash
# Required
npm install react react-dom

# Optional (for specific features)
npm install tailwindcss  # For styled components
npm install socket.io-client  # For real-time features
```

---

## 🚀 Quick Start

### 1. Create a Developer Account

Register at [onairos.uk/dev-board](https://onairos.uk/dev-board) to get your API key and register your domain.

### 2. Basic Usage (React)

```jsx
import { OnairosButton } from "onairos";

function App() {
  return (
    <OnairosButton
      requestData={["email", "profile", "social"]}
      webpageName="My Application"
      onComplete={(result) => {
        console.log("User data:", result.apiResponse);
        console.log("Token:", result.token);
      }}
    />
  );
}
```

That's it! The button handles authentication, user consent, and data retrieval automatically.

---

## 📖 Component Reference

### OnairosButton

The primary component for data requests.

```jsx
<OnairosButton
  // Required
  requestData={["basic", "personality", "preferences"]}  // Data options shown on consent screen
  webpageName="My App"                 // Your app name (shown to users)
  
  // Data fetching
  autoFetch={true}                     // Auto-fetch after approval (default: true)
  inferenceData={null}                 // Input for AI model (required if using inference + autoFetch)
  
  // Mode settings
  testMode={false}                     // Enable test mode for development
  proofMode={false}                    // Enable verification proofs
  
  // Button customization
  buttonType="pill"                    // "pill" | "icon" | "rectangle"
  buttonText="Connect Data"            // Custom button text
  showIcon={true}                      // Show/hide Onairos logo
  textColor="white"                    // "black" | "white"
  
  // Auto sign-in (optional)
  autoSignIn={false}                   // Set localStorage auth after completion
  signInKey="authenticated"            // localStorage key for auth state
  redirectUrl="/dashboard"             // Redirect after completion
  
  // Callbacks
  onComplete={(result) => {
    // Always available:
    console.log("Token:", result.token);
    console.log("API URL:", result.apiUrl);
    console.log("Approved:", result.approved);
    console.log("User Data:", result.userData);
    
    // Only when autoFetch=true:
    console.log("API Response:", result.apiResponse);
  }}
/>
```

### OnairosReconnectButton

Allow users to manage their connected data sources.

```jsx
import { OnairosReconnectButton } from "onairos";

<OnairosReconnectButton
  buttonText="Manage Data Sources"
  appName="My App"
  buttonClass="custom-button-class"
  
  onComplete={(result) => {
    console.log("Connected accounts:", result.connectedAccounts);
    console.log("User data:", result.userData);
  }}
  
  onNoUserData={() => {
    console.log("No existing user data found");
  }}
/>
```

---

## 📊 requestData & inferenceData

### requestData

Defines what data options appear on the consent screen. Users can toggle these on/off.

| Type | Description |
|------|-------------|
| `basic` | Basic profile information (required, always on) |
| `preferences` | User preferences towards your app |
| `personality` | Personality traits and interests |
| `rawMemories` | Raw LLM data from connected AI apps (ChatGPT, Claude, etc.) |

### inferenceData (for AI-powered recommendations)

If your `requestData` includes inference types (`personality`, `preferences`) AND `autoFetch=true`, you should provide `inferenceData` - the input for the AI model to generate personalized recommendations.

```jsx
// ⚠️ IMPORTANT: If requestData includes inference types AND autoFetch=true,
//    provide inferenceData for AI recommendations

<OnairosButton
  requestData={["basic", "personality", "preferences"]}
  webpageName="My Store"
  autoFetch={true}
  inferenceData={[
    { text: "Wireless Headphones", category: "Electronics" },
    { text: "Running Shoes", category: "Sports" },
    { text: "Coffee Maker", category: "Kitchen" }
  ]}
  onComplete={(result) => {
    // result.apiResponse contains personalized recommendations
    console.log(result.apiResponse);
  }}
/>
```

### autoFetch Behavior

| Scenario | What Happens |
|----------|--------------|
| `autoFetch=true` + `inferenceData` provided | SDK fetches personalized inference results |
| `autoFetch=true` + no `inferenceData` | SDK falls back to traits-only (no inference) |
| `autoFetch=false` | SDK returns `token` + `apiUrl` for you to make your own API call |

### onComplete Result Object

```typescript
{
  token: string;           // JWT for API authentication (always included)
  apiUrl: string;          // API endpoint (always included)
  approved: string[];      // Data types user approved (always included)
  userData: object;        // User data including email, connectedAccounts
  apiResponse?: object;    // Fetched data (only when autoFetch=true)
}
```

### Copy-Paste Templates

**Standard (traits only):**
```jsx
<OnairosButton
  requestData={["basic", "personality"]}
  webpageName="My App"
  autoFetch={true}
  onComplete={(result) => {
    console.log("Traits:", result.apiResponse);
  }}
/>
```

**Inference + autoFetch (AI recommendations):**
```jsx
<OnairosButton
  requestData={["basic", "personality", "preferences"]}
  webpageName="My Store"
  autoFetch={true}
  inferenceData={[
    { text: "Product 1", category: "Category A" },
    { text: "Product 2", category: "Category B" }
  ]}
  onComplete={(result) => {
    console.log("Recommendations:", result.apiResponse);
  }}
/>
```

**Manual fetch (host app makes API call):**
```jsx
<OnairosButton
  requestData={["basic", "personality"]}
  webpageName="My App"
  autoFetch={false}
  onComplete={(result) => {
    // Make your own API call with the token and URL
    fetch(result.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.token}`
      },
      body: JSON.stringify({
        email: result.userData.email,
        approved: result.approved
      })
    });
  }}
/>
```

---

## 🔧 Platform Integrations

### Laravel + Blade

```js
// vite.config.js
import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import { onairosLaravelPlugin } from "onairos/vite-plugin";

export default defineConfig({
  plugins: [
    laravel({
      input: ["resources/css/app.css", "resources/js/app.js"],
      refresh: true,
    }),
    onairosLaravelPlugin({ bladeSupport: true }),
  ],
});
```

```js
// resources/js/app.js
import { initializeOnairosForBlade } from "onairos/blade";

document.addEventListener("DOMContentLoaded", () => {
  initializeOnairosForBlade({
    testMode: import.meta.env.DEV,
    autoDetectMobile: true,
  });
});
```

```blade
{{-- resources/views/dashboard.blade.php --}}
<div id="onairos-button"></div>

<script>
createOnairosButton('onairos-button', {
    requestData: ['email', 'profile'],
    webpageName: 'My Laravel App',
    onComplete: function(result) {
        console.log('Connection successful!', result);
    }
});
</script>
```

### Laravel + Vue

```js
// vite.config.js
import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import vue from "@vitejs/plugin-vue";
import { onairosVuePlugin } from "onairos/vite-plugin";

export default defineConfig({
  plugins: [
    laravel({
      input: ["resources/css/app.css", "resources/js/app.js"],
      refresh: true,
    }),
    vue(),
    onairosVuePlugin(),
  ],
});
```

```vue
<!-- In your Vue component -->
<template>
  <onairos-button
    :request-data="['email', 'profile']"
    webpage-name="Laravel Vue App"
    @complete="handleComplete"
  />
</template>
```

### Capacitor (iOS/Android)

Capacitor requires one-time native setup for Google Sign-In and native ChatGPT import:

```bash
npm install onairos @capgo/capacitor-social-login @onairosofficial/capacitor-llm-onairos
npx cap sync ios
```

Then initialize the SDK before rendering `OnairosButton`:

```jsx
import { initializeApiKey, OnairosButton } from "onairos";

window.onairosOAuthReturnOrigin = "myapp://auth/callback";

await initializeApiKey({
  apiKey: "YOUR_ONAIROS_KEY",
  environment: "production",
  platform: "capacitor-ios",
  googleClientIds: {
    webClientId: "your-web-client-id.apps.googleusercontent.com",
    iosClientId: "your-ios-client-id.apps.googleusercontent.com",
    serverClientId: "your-server-client-id.apps.googleusercontent.com",
  },
});

function MobileApp() {
  return (
    <OnairosButton
      requestData={["email", "profile", "social"]}
      webpageName="My Mobile App"
      onComplete={(result) => {
        console.log("User data:", result.apiResponse);
      }}
    />
  );
}
```

**Mobile Notes:**
- ✅ OAuth flows use mobile-friendly redirects (not popups)
- ✅ Touch interactions fully supported
- ✅ Tested on iOS 13+ and Android 8+

#### iOS URL Schemes

Your iOS app must register two URL schemes in `Info.plist`:

1. The reversed Google iOS client ID scheme for native Google Sign-In
2. Your app callback scheme, which must match `window.onairosOAuthReturnOrigin`

Example:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.1234567890-abcdefg</string>
    </array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

The Onairos callback scheme is not a fixed global scheme. It is your app's own deep-link return path. `onairosevents://auth/callback` is only the sample app value used in `mobile-preview`.

#### Why The Callback Scheme Exists

This is standard for native mobile OAuth flows. After Google Sign-In or a browser-based return step finishes, iOS needs a registered app URL scheme to reopen your app and hand control back to the SDK.

### Vite Configuration

For Vite applications, exclude onairos from optimization:

```ts
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ["onairos"],
  },
});
```

### Framer (No-Build Integration)

Perfect for Framer projects - no package manager needed! Uses CDN loading:

```typescript
import { addPropertyControls, ControlType } from "framer"
import { useEffect, useState } from "react"

export default function OnairosConnect(props) {
    const [OnairosButton, setOnairosButton] = useState(null)

    useEffect(() => {
        const script = document.createElement("script")
        script.src = "https://unpkg.com/onairos@latest/dist/onairos.bundle.js"
        script.onload = () => setOnairosButton(() => window.Onairos.OnairosButton)
        document.head.appendChild(script)
    }, [])

    return (
        <>
            <link rel="stylesheet" href="https://unpkg.com/onairos@latest/dist/onairos.css" />
            {OnairosButton && (
                <OnairosButton
                    requestData={props.requestData}
                    webpageName={props.webpageName}
                    testMode={props.testMode}
                    onComplete={(result) => console.log(result)}
                />
            )}
        </>
    )
}
```

**📖 [Complete Framer Integration Guide →](./FRAMER_INTEGRATION.md)**

**Framer Notes:**
- ✅ No dependencies to install - works with CDN
- ✅ Full property controls in Framer UI
- ✅ Copy-paste ready Code Component
- ✅ Mobile-responsive out of the box

---

## 🔌 Platform Management API

### Disconnect Platforms

```typescript
import { disconnectPlatform, disconnectMultiplePlatforms } from "onairos";

// Disconnect a single platform
const result = await disconnectPlatform("youtube", "user@example.com");
if (result.success) {
  console.log("YouTube disconnected successfully");
}

// Disconnect multiple platforms
const results = await disconnectMultiplePlatforms(
  ["youtube", "reddit", "linkedin"],
  "user@example.com"
);
console.log(`Disconnected ${results.successful.length} platforms`);
```

### Check Platform Support

```typescript
import { getSupportedPlatforms, isPlatformSupported } from "onairos";

const platforms = getSupportedPlatforms();
console.log("Supported platforms:", platforms);

if (isPlatformSupported("youtube")) {
  // YouTube is available
}
```

---

## ⚙️ OAuth Configuration

### Google OAuth

```typescript
import { updateGoogleClientIds, getGoogleClientIds } from "onairos";

// Configure Google OAuth (required for Google Sign-In)
updateGoogleClientIds({
  webClientId: "your-web-client-id.apps.googleusercontent.com",
  iosClientId: "your-ios-client-id.apps.googleusercontent.com",
});

// Get current configuration
const clientIds = getGoogleClientIds();
```

### YouTube OAuth

```typescript
import { updateYoutubeClientId, getYoutubeClientId } from "onairos";

// Configure YouTube OAuth (separate from Google Sign-In)
updateYoutubeClientId("your-youtube-client-id.apps.googleusercontent.com");
```

---

## 🔍 TypeScript Support

Full TypeScript definitions are included:

```typescript
import { 
  OnairosButton, 
  OnairosCompleteData,
  OnairosProps,
  DisconnectPlatformResponse 
} from "onairos";

const handleComplete = (data: OnairosCompleteData) => {
  // TypeScript knows all available properties
  const { token, apiUrl, approvedData, userData } = data;
  
  if (data.apiResponse) {
    // Process API response
  }
};
```

### Key Types

```typescript
interface OnairosCompleteData {
  token: string;              // JWT for authenticated requests
  apiUrl: string;             // API endpoint URL
  userHash?: string;          // Unique user identifier
  approvedData?: string[];    // Approved data types
  apiResponse?: any;          // API response data
  userData?: any;             // User profile data
  success?: boolean;          // Request success status
  error?: string;             // Error message if failed
}
```

---

## 🌐 Browser & Platform Compatibility

| Platform | Version |
|----------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |
| iOS Safari | 13+ |
| Chrome Mobile | Latest |
| Capacitor | iOS 13+ / Android 8+ |
| React | 18.x, 19.x |
| Framer | All versions |
| Tailwind CSS | 3.x, 4.x |

---

## 🐛 Troubleshooting

### Popup Blocked
Ensure popups are allowed for your domain. On mobile, OAuth automatically uses redirects.

### API Calls Failing
- Verify your domain is registered in the [developer portal](https://onairos.uk/dev-board)
- Check that your API key is valid
- Ensure HTTPS is used in production

### Mobile Issues
- OAuth flows automatically convert to redirects on mobile
- Ensure localStorage is enabled in Capacitor configuration

### Tailwind CSS Conflicts
The SDK is compatible with both Tailwind v3 and v4. No special configuration needed.

---

## 📚 Additional Resources

- **Developer Portal**: [onairos.uk/dev-board](https://onairos.uk/dev-board)
- **Homepage**: [onairos.uk](https://onairos.uk)
- **Issues**: [GitHub Issues](https://github.com/zd819/OnairosNPM/issues)

---

## 📄 License

Apache-2.0 © Zion Darko
