# Landing-Page Tracking

## Overview

miniCycle counts page views and button clicks on its landing pages with a self-hosted
Netlify Function. It stores hit counts only: an event name, a running total, and
pre-bucketed time aggregates. Nothing recorded identifies a visitor, a session, a device
or where they came from, and nothing runs inside the app itself.

A private dashboard at `/pages/dashboard` reads the counts back.

## Architecture

```
Visitor opens a landing page, or clicks a link or button on it
  → page script sends POST to /.netlify/functions/track
  → the function increments that event's record in Netlify Blobs
  → Response: { ok: true }

Owner opens /pages/dashboard and enters the secret
  → dashboard sends GET with "Authorization: Bearer <secret>"
  → the function returns every record
```

### Files

| File | Purpose |
|------|---------|
| `netlify/functions/track.js` | Serverless function (POST to count, GET to read) |
| `pages/product.js` | Tracks the product page (also served at the site root) |
| `pages/learn_more.js` | Tracks the Learn More page |
| `pages/mcyc-format.js` | Tracks the `.mcyc` format page |
| `pages/dashboard.html`, `pages/dashboard.js` | The private dashboard |
| `legal/privacy.html` | Privacy policy section "Anonymous Counter on Landing Pages" |

### Event names

Each page tracks every `<a>` and `<button>` through one delegated click listener, and
sends one page view per browser session (skipped for announced bots).

- A click is named `{page}-{label}`. The label is the element's `data-track` attribute if
  it has one, otherwise its `aria-label` or text, otherwise `href-{host-and-path}`.
  Labels are lowercased and hyphenated.
- Add `data-track-skip` to an element to leave it out.
- A page view is named after the page alone: `product`, `learn-more`, `mcyc-format`.

| Example | Meaning |
|---------|---------|
| `product` (type `view`) | A product page view |
| `product-app-launch` | An "open the app" button on the product page |
| `product-app-launch-footer` | The same action from the footer |
| `learn-more-read-user-manual` | "Read User Manual" on the Learn More page |
| `mcyc-format-schema-download` | The schema download on the format page |

The dashboard treats any click whose label is `app-launch` or starts with `app-launch-`
as an **app launch**, which is the conversion the launch rate is built on. Give a new
"open the app" button `data-track="app-launch"` (or `app-launch-<where>`) so it counts.

## API

### POST — record a hit

```
POST /.netlify/functions/track
Content-Type: application/json

{ "event": "product-app-launch", "type": "click" }
```

Response: `{ "ok": true }`

- `type` is `click` (the default) or `view`.
- Event names are reduced to letters, digits, hyphens and underscores, 100 characters at most.
- The page scripts ignore failures: tracking never blocks the page.

### GET — read every record (protected)

```
GET /.netlify/functions/track
Authorization: Bearer <TRACK_SECRET>
```

The secret travels in the `Authorization` header only. It is never accepted in the query
string, because query strings end up in hosting access logs and browser history.

Response:

```json
{
  "timezone": "America/Chicago",
  "generatedAt": "2026-11-15T18:04:11.000Z",
  "events": {
    "product-app-launch": {
      "total": 412,
      "daily": { "2026-11-14": 9, "2026-11-15": 4 },
      "hourly": { "2026-11-15": { "9": 1, "14": 3 } },
      "hours": [0, 0, 1, "…24 values"],
      "weekdays": [41, 66, "…7 values, Sunday first"],
      "recent": ["2026-11-15T17:58:02.113Z"]
    }
  },
  "pageviews": { "product": { "…": "same shape" } }
}
```

- `total` is a lifetime count. `daily` keeps the newest 400 days.
- `hourly` holds each day's count per hour of day (only hours with a hit) for the newest
  92 days. It was added in November 2026, so days recorded before then have no entry.
- `hours` and `weekdays` are lifetime histograms.
- `recent` holds the newest 50 timestamps per event.
- Returns `401` if the secret is missing or wrong.

## Environment variables

Set both in Netlify → Project configuration → Environment variables.

| Variable | Purpose |
|----------|---------|
| `TRACK_SECRET` | Protects the GET endpoint and the dashboard. Never write its value in the repo. |
| `TRACK_TIMEZONE` | IANA zone used to bucket days and hours (for example `America/Chicago`). Defaults to UTC. |

## The dashboard

Open `https://minicycle.app/pages/dashboard` and enter `TRACK_SECRET`. "Remember on this
device" keeps it in that browser's local storage; "Sign out" removes it.

- **Filters** — a date range (7, 30 or 90 days, or all time) and a page. Both apply to
  everything below them, with two exceptions that the panels say outright. The recent
  feed is the newest hits regardless of range. The hour-of-day chart follows the range
  only when `hourly` accounts for every hit in it; otherwise it shows all time and says
  so (expect that for 90 days until three months after `hourly` shipped). The weekday
  chart always follows the range, since it is worked out from the daily counts.
- **Tiles** — page views, clicks, app launches, launch rate (launches ÷ views) and today's
  views, each compared with the previous period of the same length.
- **Highlights** — plain-language lines on what changed: traffic and launch rate against
  the previous period, the busiest day, the best-converting page, the buttons rising and
  falling most, and the peak time. A page that had views and has recorded none for seven
  days is flagged, since that usually means its tracking broke.
- **Activity** — views, clicks and launch rate over time; by day up to about three
  months, by week beyond that. "Show as table" lists the same numbers and "Download CSV"
  saves one row per day and page.
- **Goals** — outcomes rather than buttons (app launches, Chrome extension clicks, user
  manual opens, schema downloads), split by page. Defined in `GOALS` in `dashboard.js`.
- **Pages** — each page's views, clicks, clicks per view, app launches, launch rate and
  the time of its last recorded hit.
- **Top clicks** (each with a trend line) and **Recent activity**.

Pages are data-driven: any new page view name appears as a page, and clicks are assigned
to the page whose name prefixes theirs. A new tracked page needs no dashboard change
(add it to `KNOWN_PAGES` in `dashboard.js` only to give it a nicer label and a fixed colour).

Every rate is hits divided by hits. Because no visitor is identified, none of them is a
per-person conversion rate.

## Cost

Runs on Netlify's free tier: function invocations and Netlify Blobs storage are both
included, and landing-page traffic uses a small fraction of the limits.

## Privacy

- No cookies, no IP addresses, no referrers, no device or browser details
- No identifier that links one hit to another
- Only on the landing pages listed above — the app (`miniCycle.html`) has no tracking at all
- Documented in `legal/privacy.html`

Do not add a field to the function that would break these promises without revising the
privacy policy first.
