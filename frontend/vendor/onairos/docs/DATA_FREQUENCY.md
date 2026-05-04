# Data Frequency (Scheduling) - Developer Notes

This document explains how the new data-sharing frequency selection is sent from the DataRequest page and how to consume it on your backend.

## UI Options

- `once` → One-time only
- `weekly` → Once per week
- `daily` → Once per day

## SDK Behavior

When the user submits the DataRequest:

- The selected frequency is included in the SDK result returned to your `onComplete(...)` callback as `dataFrequency`.
- In production mode, the value is also sent in the request body to the `getAPIurlMobile` endpoint at `Info.dataFrequency`.

Example `onComplete` result snippet:

```json
{
  "appName": "Your App",
  "approvedData": ["basic", "personality"],
  "testMode": false,
  "dataFrequency": "weekly",
  "apiUrl": "https://api2.onairos.uk/getAPIurlMobile",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "success": true
}
```

## Backend Integration

The SDK sends:

```json
POST https://api2.onairos.uk/getAPIurlMobile
{
  "Info": {
    "storage": "local",
    "appId": "<APP_NAME>",
    "account": "<USER_EMAIL>",
    "confirmations": [ ... ],
    "EncryptedUserPin": "pending_pin_integration",
    "proofMode": false,
    "Domain": "<host-domain>",
    "web3Type": "standard",
    "dataFrequency": "weekly"
  }
}
```

## Notes

- Cron jobs for backend handling?
- The frequency selection does not grant additional permissions; it’s purely a scheduling preference.
- Users can update this preference later; your backend should allow reconfiguration.
