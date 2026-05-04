# Onairos SDK - Developer Updates

This file contains concise update summaries for developers integrating the Onairos SDK.

---

## v6.2.1 - Inference Result Formatting Options

**Release Date:** April 4, 2026

### What's New

You can now control how inference results are sorted, ranked, and filtered directly from the SDK.

### New Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sortResults` | `'desc'` \| `'asc'` \| `false` | Sort results by score (descending or ascending) |
| `includeRank` | `boolean` | Add rank numbers (1, 2, 3...) to each result |
| `topK` | `number` | Return only the top K results |
| `groupByScore` | `{ precision: number }` | Group items with the same score (precision = decimal places) |
| `inferenceResponseFormat` | `string` | Output structure (e.g., `'ranked'`, `'grouped'`) |
| `includeOriginalIndex` | `boolean` | Preserve the original input index in results |

### Supported Endpoints

These parameters work with all inference endpoints:
- `/inferenceNoProof`
- `/mobileInferenceNoProof`
- `/combinedInference`
- `/combined-training-inference`

### Usage Examples

**Get top 5 highest-scoring items, sorted descending:**
```jsx
<OnairosButton
  webpageName="MyApp"
  inferenceData={eventTags}
  sortResults="desc"
  topK={5}
  includeRank={true}
  onComplete={(data) => console.log(data)}
/>
```

**Group items by score with 1 decimal precision:**
```jsx
<OnairosButton
  webpageName="MyApp"
  inferenceData={items}
  inferenceResponseFormat="grouped"
  groupByScore={{ precision: 1 }}
  onComplete={(data) => console.log(data)}
/>
```

### Response Metadata

When formatting options are used, the response includes `formattingApplied`:

```json
{
  "formattingApplied": {
    "sortResults": "desc",
    "topK": 5,
    "includeRank": true,
    "originalCount": 100,
    "returnedCount": 5
  }
}
```

### Backward Compatibility

✅ **No breaking changes** - Existing integrations work without modification.

### Update Instructions

```bash
npm install onairos@6.2.1
```

---

## Previous Updates

### v6.2.0 - Security Hardening & Native Packaging
- Pinned axios to 1.14.0 for security
- Added Capacitor native Google Sign-In support
- ChatGPT export fetches up to 30 conversations

### v5.8.23 - Cross-Site Session Detection
- Cross-site SSO for partner apps
- Seamless authentication across domains

### v5.8.22 - Session Persistence Fix
- Fixed cached login persistence
- Data Request UI improvements

---

*For full changelog, see [CHANGELOG.md](./CHANGELOG.md)*
