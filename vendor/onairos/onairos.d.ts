declare module 'onairos' {
    /**
     * Inference formatting options (v6.1.0)
     * Passed to inference endpoints to control result sorting and formatting
     */
    export interface InferenceFormattingOptions {
      sortResults?: 'desc' | 'asc' | false; // Sort results by score
      includeRank?: boolean; // Add rank (1, 2, 3...) to results
      topK?: number; // Return only top K results
      groupByScore?: { precision: number }; // Group items with same score
      responseFormat?: string; // Output structure (e.g., 'ranked', 'grouped')
      includeOriginalIndex?: boolean; // Keep original input index in results
    }

    /**
     * Data returned when the Onairos flow completes successfully
     */
    export interface OnairosCompleteData {
      // Core response fields
      token: string;                    // JWT token for authenticated API calls
      apiUrl: string;                   // Backend API endpoint URL
      
      // Request metadata
      userHash?: string;                // Unique user identifier
      appName?: string;                 // Name of the requesting application
      approvedData?: string[];          // Array of approved data types (e.g., ['basic', 'personality'])
      testMode?: boolean;               // Whether running in test mode
      timestamp?: string;               // ISO timestamp of the request
      
      // API response data
      apiResponse?: any;                // Raw API response with personality/inference data
      authorizedData?: any;             // Data that was authorized for sharing
      /** Training gate from URL resolution (`ready`, `statusUrl`, `pollIntervalMs`). */
      training?: { ready: boolean; statusUrl?: string; pollIntervalMs?: number; neverTrained?: boolean };
      usage?: any;                      // API usage information
      
      // User data
      userData?: any;                   // Complete user profile and session data
      
      // Enhanced formatting (added by logFormattedUserData)
      userDataSummary?: {               // Structured summary of user data
        requestInfo?: any;
        userProfile?: any;
        connectedAccounts?: any;
        aiData?: any;
        status?: any;
      };
      prettyPrint?: string;             // Pretty-printed version for console logging
      connectedSources?: string[];      // Normalized platform/source names (Ascend-friendly)
      ascendContext?: {
        schemaVersion: string;
        generatedAt: string;
        requestData: string[];
        approvedData: string[];
        connectedSources: string[];
        signalSummary: {
          accountsCount: number;
          dataConnectionsCount: number;
          llmInteractionsCount: number;
          hasBehaviorSignals: boolean;
        };
        backendHints: {
          protocol: string;
          authHeader: string;
          preferredEndpoint: string;
          requiredFields: string[];
        };
      };
      
      // Status indicators
      success?: boolean;                // Whether the request was successful
      simulated?: boolean;              // Whether data is simulated (test mode)
      error?: string;                   // Error message if request failed
      cancelled?: boolean;              // Whether user cancelled the flow
      
      // v6.1.0 - Inference formatting metadata (present when formatting options are used)
      formattingApplied?: {
        sortResults?: 'desc' | 'asc';
        includeRank?: boolean;
        topK?: number;
        groupByScore?: { precision: number };
        responseFormat?: string;
        includeOriginalIndex?: boolean;
        originalCount?: number;         // Original result count before topK
        returnedCount?: number;         // Actual returned count after topK
      };
      
      [key: string]: any;               // Allow additional properties
    }

    export interface OnairosProps {
      requestData: any; // Consider using a more specific type or interface for request data.
      webpageName: string;
      inferenceData?: any;
      fastTraits?: boolean;
      onComplete?: (data: OnairosCompleteData, error?: Error) => void;
      alwaysCallOnComplete?: boolean;
      preserveForceRegenerateOnPolling?: boolean;
      autoFetch?: boolean; // Default: true - automatically makes API calls after data approval
      testMode?: boolean;
      proofMode?: boolean;
      textLayout?: 'right' | 'left' | 'below' | 'none';
      textColor?: 'black' | 'white';
      login?: boolean,
      loginReturn?:(data: any, error?: Error) => void;
      loginType?: string;
      visualType?: string;
      buttonType?: 'pill' | 'icon' | 'rectangle';
      appIcon?: string | null;
      dataRequestTitle?: string | null;
      priorityPlatform?: string | null;
      rawMemoriesOnly?: boolean;
      rawMemoriesConfig?: any;
      topicFilter?: string | null;
      allowedPlatforms?: string[] | null;
      time?: boolean;
      showIcon?: boolean; // v5.1.4 - Show/hide the Onairos logo on the button (default: true)
      buttonText?: string; // v5.1.4 - Custom button text (overrides default "Connect Data")
      // v5.2.3 - Auto sign-in and redirect props for seamless integration
      redirectUrl?: string; // URL to redirect to after completion (e.g., '/dashboard', '/home')
      autoSignIn?: boolean; // If true, sets localStorage auth key after completion (default: false)
      signInKey?: string; // The localStorage key to set for authentication (default: 'authenticated')
      // v6.1.0 - Inference result formatting options
      // Passed to inference endpoints (inferenceNoProof, mobileInferenceNoProof, combinedInference, combined-training-inference)
      sortResults?: 'desc' | 'asc' | false; // Sort results by score
      includeRank?: boolean; // Add rank (1, 2, 3...) to results
      topK?: number; // Return only top K results
      groupByScore?: { precision: number }; // Group items with same score (precision: decimal places)
      inferenceResponseFormat?: string; // Output structure (e.g., 'ranked', 'grouped')
      includeOriginalIndex?: boolean; // Keep original input index in results
      /** v7.1.2+ — server MBTI 16-type probe when `preferences` is approved; see MBTI_INFERENCE_INPUT_PRESET.md */
      preferencesMbti?: boolean;
      backgroundLoadData?: boolean;
      /**
       * v8.0.0 — `'mock' | 'fast' | 'real' | 'none'`. Defaults to `'fast'`,
       * or `'none'` when `backgroundLoadData` is `true` and the prop is unset.
       * Replaces v7.x `'real'` (now `'fast'`) and `'full'` (now `'real'`).
       */
      trainingScreenMode?: 'mock' | 'fast' | 'real' | 'none';
      /**
       * v8.0.0+ — when `true` (default), the modal closes immediately after
       * consent is accepted. SDK keeps polling /training/status and POSTing
       * apiUrl in the background; `onComplete` fires when the fetch resolves.
       * Set to `false` to keep the modal open until the SDK has the full
       * response (legacy behaviour). No effect on wrapped/valentine/lunar/
       * ascend apps which own their own loading UX.
       */
      closeOnConsent?: boolean;
      recommendedPlatforms?: string[] | null;
      preferredPlatform?: string | null;
      primaryAuthOnly?: boolean;
      useNewWelcomeFlow?: boolean;
      preCheck?: (() => boolean | Promise<boolean>) | null;
      returnLink?: string | null;
      onRejection?: ((reason?: string) => void) | null;
    }

    export interface TrainingPollResult {
      ready: boolean;
      neverTrained?: boolean;
      lastPayload?: unknown;
    }

    export function pollTrainingStatus(params: {
      statusUrl: string;
      token: string;
      pollIntervalMs?: number;
    }): Promise<TrainingPollResult>;

    export function normalizeTrainingFromResolution(training: unknown): {
      ready: boolean;
      statusUrl?: string;
      pollIntervalMs: number;
      neverTrained?: boolean;
    };

    /**
     * Creates an Onairos component with various configuration options for fetching and displaying user data.
     */
    export function Onairos(props: OnairosProps): JSX.Element;

    export interface PopupHandlerOptions {
      autoFetch?: boolean;
      onApiResponse?: (response: any) => void;
    }

    // Popup handler functions
    export function openDataRequestPopup(data?: any): Window | null;
    export function closeDataRequestPopup(windowRef: Window): void;
    export function sendDataToPopup(windowRef: Window, data: any): Promise<void>;
    export function listenForPopupMessages(
      callback: (data: any) => void, 
      options?: PopupHandlerOptions
    ): () => void;

    export function OnairosButton(props: OnairosProps): JSX.Element;
    export default OnairosButton;

    /**
     * Data returned when reconnection is complete
     */
    export interface OnairosReconnectCompleteData {
      connectedAccounts: string[];          // Array of connected platform names
      userData: any;                        // Updated user data object
      timestamp: string;                    // ISO timestamp of the reconnection
    }

    /**
     * Props for the OnairosReconnectButton component
     */
    export interface OnairosReconnectButtonProps {
      buttonText?: string;                  // Text to display on the button (default: "Reconnect Data Sources")
      buttonClass?: string;                 // Custom CSS classes for the button
      buttonStyle?: React.CSSProperties;    // Custom inline styles for the button
      appIcon?: string;                     // Icon URL for the app (optional)
      appName?: string;                     // Name of the app (default: "Your App")
      onComplete?: (data: OnairosReconnectCompleteData) => void; // Callback when connection changes are complete
      onNoUserData?: () => void;            // Callback when no user data is found
      priorityPlatform?: string;            // Platform to prioritize (e.g., 'gmail', 'pinterest', 'linkedin')
      rawMemoriesOnly?: boolean;            // Show only LLM connections when true (default: false)
      rawMemoriesConfig?: any;              // Configuration for RAW memories collection
    }

    /**
     * OnairosReconnectButton - A button that allows users to reconnect or change their data sources
     * 
     * This button checks if user Onairos data is stored and opens the data connection page
     * to allow users to modify their connected accounts/data sources.
     * 
     * @example
     * ```tsx
     * import { OnairosReconnectButton } from 'onairos';
     * 
     * function MyComponent() {
     *   return (
     *     <OnairosReconnectButton 
     *       buttonText="Manage Data Sources"
     *       appName="My App"
     *       onComplete={(result) => {
     *         console.log('Updated connections:', result.connectedAccounts);
     *       }}
     *       onNoUserData={() => {
     *         console.log('No user data found');
     *       }}
     *     />
     *   );
     * }
     * ```
     */
    export function OnairosReconnectButton(props: OnairosReconnectButtonProps): JSX.Element;

    // ===============================================
    // Platform Disconnect & Destruct API
    // ===============================================

    /**
     * Response from disconnectPlatform
     */
    export interface DisconnectPlatformResponse {
      success: boolean;
      platform: string;
      message: string;
      error?: string;
      data?: any;
    }

    /**
     * Response from disconnectMultiplePlatforms
     */
    export interface DisconnectMultiplePlatformsResponse {
      successful: string[];
      failed: Array<{ platform: string; error: string }>;
      total: number;
    }


    /**
     * Disconnect a platform from user's account
     * Removes OAuth tokens and platform data
     * 
     * @param platform - Platform name (e.g., 'youtube', 'reddit', 'gmail')
     * @param username - User's email or username
     * @returns Promise resolving to disconnect response
     * 
     * @example
     * ```typescript
     * import { disconnectPlatform } from 'onairos';
     * 
     * const result = await disconnectPlatform('youtube', 'user@example.com');
     * if (result.success) {
     *   console.log('YouTube disconnected successfully');
     * }
     * ```
     */
    export function disconnectPlatform(
      platform: string,
      username: string
    ): Promise<DisconnectPlatformResponse>;

    /**
     * Disconnect multiple platforms at once
     * 
     * @param platforms - Array of platform names
     * @param username - User's email or username
     * @returns Promise resolving to results for all platforms
     * 
     * @example
     * ```typescript
     * import { disconnectMultiplePlatforms } from 'onairos';
     * 
     * const result = await disconnectMultiplePlatforms(
     *   ['youtube', 'reddit', 'linkedin'],
     *   'user@example.com'
     * );
     * console.log(`Disconnected ${result.successful.length} platforms`);
     * ```
     */
    export function disconnectMultiplePlatforms(
      platforms: string[],
      username: string
    ): Promise<DisconnectMultiplePlatformsResponse>;

    /**
     * Update localStorage after disconnecting a platform
     * Removes the platform from connectedAccounts array
     * 
     * @param platform - Platform name that was disconnected
     */
    export function updateLocalStorageAfterDisconnect(platform: string): void;

    /**
     * Check if user has authentication token
     * @returns True if token exists in localStorage
     */
    export function hasAuthToken(): boolean;

    /**
     * Get list of all supported platforms for disconnection
     * @returns Array of platform names
     */
    export function getSupportedPlatforms(): string[];

    /**
     * Check if a platform is supported for disconnection
     * @param platform - Platform name
     * @returns True if platform is supported
     */
    export function isPlatformSupported(platform: string): boolean;

    // ===============================================
    // Google OAuth Configuration
    // ===============================================

    /**
     * Configure Google OAuth client IDs for all platforms
     * 
     * IMPORTANT FOR CAPACITOR APPS:
     * Capacitor apps MUST provide their own Google OAuth credentials because:
     * 1. Google does not allow `capacitor://` scheme in redirect URIs
     * 2. Google blocks OAuth in embedded WebViews (disallowed_useragent)
     * 3. Native apps require platform-specific client IDs (iOS bundle ID, Android package + SHA-1)
     * 
     * To create your credentials:
     * 1. Go to Google Cloud Console (https://console.cloud.google.com)
     * 2. Create OAuth 2.0 credentials for each platform:
     *    - Web application (for web browsers)
     *    - iOS (with your bundle identifier)
     *    - Android (with your package name and SHA-1 fingerprint)
     * 
     * @param clientIds - Object containing platform-specific client IDs
     * @returns Updated client IDs object
     * 
     * @example
     * ```typescript
     * import { updateGoogleClientIds } from 'onairos';
     * 
     * // For Capacitor apps - provide YOUR OWN client IDs
     * updateGoogleClientIds({
     *   webClientId: 'your-web-client-id.apps.googleusercontent.com',
     *   iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
     *   androidClientId: 'your-android-client-id.apps.googleusercontent.com',
     *   serverClientId: 'your-server-client-id.apps.googleusercontent.com' // For backend token verification
     * });
     * ```
     */
    export function updateGoogleClientIds(clientIds: {
      webClientId?: string;
      iosClientId?: string;
      androidClientId?: string;
      serverClientId?: string;
    }): { 
      webClientId: string | null; 
      iosClientId: string | null;
      androidClientId: string | null;
      serverClientId: string | null;
    };

    /**
     * Get currently configured Google OAuth client IDs
     */
    export function getGoogleClientIds(): {
      webClientId: string | null;
      iosClientId: string | null;
      androidClientId: string | null;
      serverClientId: string | null;
    };

    // ===============================================
    // Capacitor Native Google Sign-In
    // ===============================================

    /**
     * Check if native Google Auth plugin is available (Capacitor only).
     * Returns true if @codetrix-studio/capacitor-google-auth or similar is installed.
     */
    export function isNativeGoogleAuthAvailable(): boolean;

    /**
     * Perform native Google Sign-In using Capacitor plugin.
     * 
     * REQUIREMENTS:
     * 1. Install @codetrix-studio/capacitor-google-auth: `npm install @codetrix-studio/capacitor-google-auth`
     * 2. Configure with YOUR OWN Google OAuth Client IDs
     * 3. Set up native platform config (Info.plist for iOS, google-services.json for Android)
     * 
     * @returns Promise with sign-in result
     * 
     * @example
     * ```typescript
     * import { performNativeGoogleSignIn, isNativeGoogleAuthAvailable } from 'onairos';
     * 
     * if (isNativeGoogleAuthAvailable()) {
     *   const result = await performNativeGoogleSignIn();
     *   if (result.success) {
     *     console.log('User:', result.user);
     *     console.log('ID Token:', result.idToken);
     *   }
     * }
     * ```
     */
    export function performNativeGoogleSignIn(): Promise<{
      success: boolean;
      user?: {
        email: string;
        name: string;
        familyName?: string;
        id: string;
        imageUrl?: string;
      };
      idToken?: string;
      serverAuthCode?: string;
      rawResponse?: any;
      error?: string;
    }>;

    /**
     * Sign out from native Google Auth
     */
    export function performNativeGoogleSignOut(): Promise<{
      success: boolean;
      error?: string;
    }>;

    // ===============================================
    // YouTube OAuth Configuration
    // ===============================================

    /**
     * Configure YouTube OAuth client ID (separate from Google Sign-In)
     * @param clientId - YouTube-specific Google OAuth client ID
     * @returns Updated client ID
     * 
     * @example
     * ```typescript
     * import { updateYoutubeClientId } from 'onairos';
     * 
     * updateYoutubeClientId('your-youtube-client-id.apps.googleusercontent.com');
     * ```
     */
    export function updateYoutubeClientId(clientId: string): string | null;

    /**
     * Get currently configured YouTube OAuth client ID
     */
    export function getYoutubeClientId(): string | null;
}
  
