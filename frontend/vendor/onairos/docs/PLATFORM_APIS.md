# Platform Connector APIs Reference

Quick reference for all platform data sources, APIs, authentication, and token management.

---

## Sephora

**Platform ID:** `mobile-sephora`  
**Data Type:** E-commerce / Beauty

### Authentication

| Key | Storage | Format |
|-----|---------|--------|
| `seph-access-token` | localStorage | JSON: `{ data: "JWT...", expiry: "timestamp" }` |
| `x-api-key` | Header | `nQc7BFt78yJBvfYDKtle9APd5RrX984i` |

**Token Expiry:** ~150 days (expiry is Unix timestamp in seconds)

### APIs

| API | Endpoint | Method | Data Retrieved |
|-----|----------|--------|----------------|
| **Profile** | `/gapi/users/profiles/{profileId}/current/full` | GET | Name, email, VIB status, Beauty Insider points, skin/hair/makeup preferences, preferred store |
| **Basket** | `/api/shopping-cart/basket` | GET | Cart items, subtotal, BI points, shipping info |
| **Loves** | `/gway/v1/dotcom/users/profiles/{profileId}/lists/skus/all` | GET | Wishlist products with ratings, categories, prices, images |
| **Purchases** | `/api/bi/profiles/{profileId}/purchases` | GET | Purchase history with products, dates, order IDs |

### Profile API Params
```
?skipApis=targetersResult
&includeApis=profile,basket,loves,shoppingList,segments
```

### Loves API Params
```
?itemsPerPage=100
&currentPage=1
&listShortNameLength=20
&skipProductDetails=false
&includeInactiveSkus=true
&fetchAllLovesList=true
&sortBy=recently
&includeCategories=true
```

### Purchases API Params
```
?sortBy=recently
&itemsPerPage=100
&groupBy=none
&excludeSamples=true
&excludeRewards=true
```

### Data Extracted

**Profile:**
- `profileId`, `firstName`, `lastName`, `email`
- `vibStatus` (BI, VIB, Rouge)
- Beauty Insider: points, segment, spending, birthday gift eligibility
- Preferences: skin concerns, hair concerns, makeup preferences
- Preferred store info

**Basket:**
- Items with SKU ID, product ID, name, brand, price, quantity, size, image

**Loves:**
- Products with ratings, reviews, categories, stock status, sale info

**Purchases:**
- Order history with product details, dates, quantities

### Token Extraction

```javascript
function getSephoraToken() {
  var tokenKeys = ['seph-access-token', 'sephoraAccessToken', 'accessToken'];
  
  // Try localStorage
  for (var i = 0; i < tokenKeys.length; i++) {
    var token = localStorage.getItem(tokenKeys[i]);
    if (token) {
      try {
        var parsed = JSON.parse(token);
        if (parsed && parsed.data) return parsed.data;
      } catch (e) {
        return token; // Not JSON, use as-is
      }
    }
  }
  
  // Try cookies
  var cookieMatch = document.cookie.match(/seph-access-token=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];
  
  // Try window state
  if (window.__PRELOADED_STATE__ && window.__PRELOADED_STATE__.user) {
    return window.__PRELOADED_STATE__.user.accessToken;
  }
  
  return null;
}
```

### Profile ID Extraction

The `profileId` is needed for most Sephora APIs. Extract from:

```javascript
function getProfileId() {
  // Method 1: From token (JWT payload)
  var token = getSephoraToken();
  if (token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.sub) return payload.sub;
    } catch (e) {}
  }
  
  // Method 2: From localStorage
  var profileId = localStorage.getItem('biAccountId') || 
                  localStorage.getItem('profileId');
  if (profileId) return profileId;
  
  // Method 3: From window state
  if (window.__PRELOADED_STATE__ && window.__PRELOADED_STATE__.user) {
    return window.__PRELOADED_STATE__.user.profileId;
  }
  
  // Method 4: From basket API (doesn't require profileId)
  // Call /api/shopping-cart/basket first, extract profileId from response
  
  return null;
}
```

### Token Expiry Check

```javascript
function isTokenExpired() {
  var tokenData = localStorage.getItem('seph-access-token');
  if (!tokenData) return true;
  
  try {
    var parsed = JSON.parse(tokenData);
    var expiry = parseInt(parsed.expiry, 10);
    var now = Math.floor(Date.now() / 1000);
    return now >= expiry;
  } catch (e) {
    return true;
  }
}
```

---

## Instagram

**Platform ID:** `mobile-instagram` (data connector) / `instagram` (OAuth)  
**Data Type:** Social

### Authentication

| Key | Storage | Notes |
|-----|---------|-------|
| `csrftoken` | Cookie | CSRF token for POST requests |
| `sessionid` | Cookie | Session authentication |
| `X-IG-App-ID` | Header | `936619743392459` |
| `__bkv` | URL param | Bloks version: `cc4d2103131ee3bbc02c20a86f633b7fb7a031cbf515d12d81e0c8ae7af305dd` |

**Token Expiry:** Session-based (tied to browser session cookie)

### APIs

| API | Endpoint | Method | Data Retrieved |
|-----|----------|--------|----------------|
| **Liked Media (Bloks)** | `/async/wbloks/fetch/` | POST | Liked posts via Bloks framework |
| **Saved Posts** | `/api/v1/feed/saved/posts/` | GET | Saved posts with media, captions, owner info |
| **Timeline (GraphQL)** | `/graphql/query` | POST | Feed timeline with media, captions, engagement |

### Bloks API (Liked Media)

**Endpoint:**
```
POST https://www.instagram.com/async/wbloks/fetch/?appid=com.instagram.privacy.activity_center.liked_media_screen&type=app&__bkv={bloksVersionId}
```

**Request Body:** `application/x-www-form-urlencoded`
```
params=%7B%7D
```

**Response Format:**
```javascript
for (;;);{"__ar":1,"rid":"...","payload":{"layout":{"bloks_payload":{"data":[
  {"id":"440463611_0","type":"gs","data":{...}},
  ...
]}}}}
```

**Note:** Response has `for (;;);` prefix (anti-JSON hijacking) that must be stripped before JSON.parse()

**Parsing the Bloks payload:**
```javascript
function parseLikedMedia(data) {
  var likes = [];
  if (data && data.payload && data.payload.layout && data.payload.layout.bloks_payload) {
    var bloksData = data.payload.layout.bloks_payload.data || [];
    bloksData.forEach(function(item, idx) {
      // Bloks items have varying structures
      if (item.type === 'media' || item.type === 'ig' || item.data) {
        likes.push({
          id: item.id || 'like_' + idx,
          type: 'like',
          rawData: item.data,
          bloksType: item.type
        });
      }
    });
  }
  return likes;
}
```

**⚠️ Bloks Caveat:** The Bloks payload structure is complex and may vary. The `data` array contains UI component definitions, not clean media objects. You may need to recursively parse to extract actual media IDs.

### Saved Posts API

**Endpoint:**
```
GET https://www.instagram.com/api/v1/feed/saved/posts/
```

**Response Format:**
```javascript
{
  "items": [
    {
      "media": {
        "id": "...",
        "pk": "...",
        "code": "...",
        "media_type": 1,
        "caption": { "text": "..." },
        "user": { "pk": "...", "username": "..." },
        "like_count": 123,
        "comment_count": 45,
        "taken_at": 1706123456,
        "image_versions2": { "candidates": [{ "url": "..." }] }
      }
    }
  ],
  "more_available": true,
  "next_max_id": "..."
}
```

### GraphQL API (Timeline)

**Endpoint:**
```
POST https://www.instagram.com/graphql/query
```

**Request Body:** `application/x-www-form-urlencoded`
```
doc_id=8845758582119845&variables={"first":12,"after":null}
```

**Response Format:**
```javascript
{
  "data": {
    "xdt_api__v1__feed__timeline__connection": {
      "pagination_source": null,
      "edges": [
        {
          "node": {
            "media": {
              "id": "3820598654428293407_10139962",
              "pk": "3820598654428293407",
              "code": "...",
              "media_type": 1,
              "caption": { "text": "..." },
              "user": { "pk": "...", "username": "..." },
              "like_count": 123,
              "comment_count": 45,
              "taken_at": 1706123456,
              "image_versions2": { "candidates": [{ "url": "..." }] }
            }
          }
        }
      ]
    }
  }
}
```

### Required Headers

```javascript
{
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-CSRFToken': csrfToken,
  'X-IG-App-ID': '936619743392459',
  'X-Requested-With': 'XMLHttpRequest',
  'X-ASBD-ID': '129477',
  'Content-Type': 'application/x-www-form-urlencoded'
}
```

### Data Extracted

**Liked Media:**
- Post IDs
- Bloks payload data (varies by content type)

**Saved Posts:**
- `id`, `pk`, `code` (shortcode for URL)
- `mediaType` (1=image, 2=video, 8=carousel)
- `caption` text
- `owner` (user info: id, username, full name)
- `likeCount`, `commentCount`
- `takenAt` (Unix timestamp)
- `imageUrl` (best quality candidate)

**Timeline:**
- `id`, `pk`, `code` (shortcode for URL)
- `mediaType` (1=image, 2=video, 8=carousel)
- `caption` text
- `owner` (user info: id, username, full name)
- `likeCount`, `commentCount`
- `takenAt` (Unix timestamp)
- `imageUrl` (best quality candidate)

### User ID Extraction

Instagram requires the user's ID for some operations. Extract from page state:

```javascript
function getUserId() {
  // Method 1: window._sharedData (older pages)
  if (window._sharedData && window._sharedData.config) {
    return window._sharedData.config.viewerId;
  }
  
  // Method 2: window.__initialData (newer pages)
  if (window.__initialData && window.__initialData.data && window.__initialData.data.user) {
    return window.__initialData.data.user.id;
  }
  
  // Method 3: Script tag parsing (fallback)
  var scripts = document.querySelectorAll('script');
  for (var i = 0; i < scripts.length; i++) {
    var text = scripts[i].textContent || '';
    var match = text.match(/"userId":"(\d+)"/);
    if (match) return match[1];
    match = text.match(/"viewerId":"(\d+)"/);
    if (match) return match[1];
  }
  
  return null;
}
```

### Bloks Version ID

The `__bkv` parameter is a hash that may change with Instagram updates.

**Current value:** `cc4d2103131ee3bbc02c20a86f633b7fb7a031cbf515d12d81e0c8ae7af305dd`

**To find current value:**
1. Open Instagram DevTools → Network tab
2. Navigate to Your Activity → Likes
3. Look for requests to `/async/wbloks/fetch/`
4. Copy `__bkv` value from URL

### Pagination

**Saved Posts:**
```javascript
// First request
GET /api/v1/feed/saved/posts/

// Subsequent requests (if more_available: true)
GET /api/v1/feed/saved/posts/?max_id={next_max_id}
```

**GraphQL Timeline:**
```javascript
// First request
doc_id=8845758582119845&variables={"first":12,"after":null}

// Subsequent requests
doc_id=8845758582119845&variables={"first":12,"after":"{end_cursor}"}
```

The `end_cursor` comes from `pageInfo.end_cursor` in the response.

### Cookie Extraction Helper

```javascript
function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// Usage
var csrfToken = getCookie('csrftoken');
var sessionId = getCookie('sessionid');
```

---

## Hinge

**Platform ID:** `mobile-hinge`  
**Data Type:** Dating

### Authentication

| Key | Storage | Notes |
|-----|---------|-------|
| `auth_token` | Cookie/localStorage | TBD - need to confirm |
| `hinge_auth_token` | Cookie | Fallback |

### APIs

| API | Endpoint | Data Retrieved |
|-----|----------|----------------|
| TBD | TBD | Matches, messages |

### Data Extracted
- Matches (profiles)
- Messages/chat history

---

## Token Expiry Reference

| Platform | Token Lifetime | Refresh Mechanism |
|----------|---------------|-------------------|
| **Sephora** | ~150 days | Auto-refresh on site visit, `refreshToken` in localStorage |
| **Instagram** | Session-based | Tied to browser `sessionid` cookie, refreshes on site activity |
| **Hinge** | TBD | TBD |

---

## Common Request Headers

All platforms require:
```javascript
{
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'credentials': 'include'  // for cookies
}
```

Platform-specific headers are added per connector.

---

## Onairos Backend Endpoint

All extracted data is sent to:
```
POST https://api2.onairos.uk/platform-data/store
```

With headers:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <onairos_user_token>'
}
```

Payload structure:
```javascript
{
  platform: 'mobile-sephora',  // platform ID
  dataType: 'ecommerce',       // data category
  data: { ... },               // extracted data
  summary: { ... },            // quick stats
  mobileMetadata: {
    platform: 'web',
    source: 'bookmarklet-api',
    extractedAt: 'ISO timestamp',
    tokenExpiry: { ... }       // token expiry info
  }
}
```

---

## Rate Limits & Best Practices

### General Guidelines

| Platform | Rate Limit | Recommendation |
|----------|------------|----------------|
| **Sephora** | Unknown (generous) | Max 10 requests per extraction |
| **Instagram** | Strict (anti-bot) | Max 3-5 requests, add delays |
| **Hinge** | TBD | TBD |

### Implementation Tips

1. **Parallel requests** - Use `Promise.all()` for independent API calls
2. **Error handling** - Gracefully handle 401/403 (re-auth needed), 429 (rate limited)
3. **Credentials** - Always include `credentials: 'include'` for cookie-based auth
4. **CORS** - These APIs work from same-origin (bookmarklet on the site), not cross-origin

### Response Parsing

**Instagram Bloks (strip prefix):**
```javascript
function parseBloksResponse(text) {
  if (text.startsWith('for (;;);')) {
    text = text.substring(9);
  }
  return JSON.parse(text);
}
```

**Sephora (standard JSON):**
```javascript
var data = await response.json();
```

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse response |
| 401 | Unauthorized | Token expired, prompt re-login |
| 403 | Forbidden | Blocked/banned, try later |
| 429 | Rate Limited | Wait and retry |
| 500+ | Server Error | Retry with backoff |

---

## Quick Implementation Checklist

For each platform connector:

- [ ] Verify user is on correct domain
- [ ] Show consent popup
- [ ] Extract auth token(s)
- [ ] Check token validity/expiry
- [ ] Call APIs with proper headers
- [ ] Parse responses
- [ ] Build normalized payload
- [ ] Send to Onairos backend
- [ ] Show success/error message

