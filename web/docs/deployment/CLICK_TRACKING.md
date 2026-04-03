# CTA Click Tracking

## Overview

miniCycle uses a self-hosted Netlify Function to count CTA button clicks on the product and learn more landing pages. No personal data is collected — only button names and running totals.

## Architecture

```
User clicks CTA button
  → JS sends POST to /.netlify/functions/track
  → Netlify Function increments counter in Netlify Blobs
  → Response: { ok: true }
```

### Files

| File | Purpose |
|------|---------|
| `netlify/functions/track.js` | Serverless function (POST to count, GET to read) |
| `pages/product.js` | Tracks clicks on product page CTAs |
| `pages/learn_more.js` | Tracks clicks on learn more page CTAs |
| `netlify.toml` | Functions directory config + CSP update |
| `legal/privacy.html` | Privacy policy (v2.2) documents this feature |

### Event Naming Convention

Events are auto-generated from the button text:

| Button | Page | Event Name |
|--------|------|------------|
| Get Started | Product | `product-get-started` |
| Learn More | Product | `product-learn-more` |
| Try Now | Product (header) | `product-try-now` |
| Try miniCycle Now | Product (bottom CTA) | `product-try-minicycle-now` |
| Read User Manual | Product (bottom CTA) | `product-read-user-manual` |
| Get Started | Learn More | `learn-more-get-started` |
| Try Now | Learn More (header) | `learn-more-try-now` |
| Read User Manual | Learn More (bottom CTA) | `learn-more-read-user-manual` |

Format: `{page}-{button-text-lowercased-hyphenated}`

## API

### POST — Record a click

```
POST /.netlify/functions/track
Content-Type: application/json

{ "event": "product-get-started" }
```

Response: `{ "ok": true }`

- Event names are sanitized to alphanumeric, hyphens, and underscores only
- Max 100 characters
- Fails silently on the client — tracking is non-critical

### GET — View all counts (protected)

```
GET /.netlify/functions/track?secret=YOUR_SECRET
```

Response:
```json
{
  "counts": {
    "product-get-started": 42,
    "product-learn-more": 18,
    "learn-more-try-now": 7
  }
}
```

Returns `401` if the secret is missing or incorrect.

## Environment Variables

| Variable | Where to Set | Purpose |
|----------|-------------|---------|
| `TRACK_SECRET` | Netlify Dashboard → Project configuration → Environment variables | Protects the GET endpoint from public access |

## How to Check Your Counts

Visit this URL (replace with your actual secret):

```
https://minicycle.app/.netlify/functions/track?secret=miniCycle2007
```

## Cost

Runs entirely on Netlify's free tier:
- **125,000 function invocations/month** (free)
- **Netlify Blobs** storage (free, included)
- Typical landing page traffic uses a tiny fraction of these limits

## Privacy

- No cookies
- No IP addresses stored
- No personal data collected
- No browser fingerprinting
- Only runs on landing pages — never inside the miniCycle app
- Documented in `legal/privacy.html` (v2.2, Third-Party Services section)

## Scope

Tracking is **only** on:
- `pages/product.html` (via `product.js`)
- `pages/learn_more.html` (via `learn_more.js`)

The main miniCycle app (`miniCycle.html`) has **zero** tracking of any kind.
