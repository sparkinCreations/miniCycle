# Deployment Guide

> **For current version and metrics, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

**Last Updated:** March 2026

---

## Live URLs

### Official URL
**[minicycleapp.com](https://minicycleapp.com)** — Official branded URL for miniCycle

- Redirects (301) to: `https://minicycle.app/product.html`
- Use this URL for all marketing, sharing, and promotional materials

### Direct Access URLs
All content is hosted at **minicycle.app** via **Netlify**:

| Resource | URL |
|----------|-----|
| **Product Page** | [minicycle.app/product.html](https://minicycle.app/product.html) |
| **Full App** | [minicycle.app/miniCycle.html](https://minicycle.app/miniCycle.html) |
| **Lite Version** | [minicycle.app/miniCycle-lite.html](https://minicycle.app/miniCycle-lite.html) ⚠️ Static fallback, not maintained |
| **Documentation** | [minicycle.app/docs](https://minicycle.app/docs) |

---

## Hosting: Netlify

miniCycle is deployed on **Netlify** with automatic Git-based deploys.

### How It Works
```
git push origin main
       ↓
Netlify detects push → builds from repo root
       ↓
Site published to minicycle.app CDN
```

- **No build step** — the app is vanilla JS/HTML/CSS, served as static files
- **Publish directory:** `.` (repo root, configured in `netlify.toml`)
- **Auto-deploy:** Every push to `main` triggers a deploy
- **Preview deploys:** Pull requests get preview URLs automatically

### Domain Setup
```
minicycleapp.com → 301 redirect → minicycle.app/product.html
```
Redirects are configured in `netlify.toml` (not DNS-level).

---

## File Structure

```
web/
├── miniCycle.html                 # Main PWA entry point
├── service-worker.js              # Offline caching, precache, update logic
├── version.js                     # APP_VERSION + CACHE_VERSION (single source of truth)
├── manifest.json                  # PWA manifest
├── netlify.toml                   # Netlify config: headers, redirects, CSP
├── product.html                   # Landing page (redirect target)
├── modules/                       # 114 ES6 modules (strict DI, zero window.* fallbacks)
│   ├── boot/                      # orchestrator → coreBoot → featureBoot → uiBoot
│   ├── core/                      # appState, appContext, appInit, diBase, constants
│   ├── task/                      # Task CRUD, DOM, events, rendering, drag-drop
│   ├── ui/                        # Modals, menus, settings, onboarding, gestures
│   ├── recurring/                 # Scheduling, matching, panel, settings
│   ├── features/                  # Themes, stats, achievements, history, reminders
│   ├── routine/                   # Routine lifecycle, switching, migration
│   ├── labels/                    # defaultLabels.js (~600 keys) + labelResolver.js
│   ├── utils/                     # Notifications, device detection, globalUtils
│   ├── storage/                   # backupManager (IndexedDB)
│   ├── progress/                  # Cycle completion tracking
│   └── other/                     # Plugin system
├── styles/                        # 38 CSS files, token-based (variables.css foundation)
├── tests/                         # 1,500+ Playwright tests
│   └── *.tests.js
├── lite/                          # Static frozen fallback (not maintained)
├── scripts/                       # update-version.sh, utilities
└── docs/                          # Documentation (Docsify-powered)
```

---

## Deployment Process

### 1. Update Version
```bash
./scripts/update-version.sh
# Enter new version number (e.g., 2.057)
# Script updates version.js, service-worker.js, manifests, HTML meta tags
```

### 2. Run Tests
```bash
npm start          # Start local server (required for tests)
npm test           # Run all Playwright tests
```

### 3. Deploy
```bash
git add -A
git commit -m "v2.057: description of changes"
git push origin main
```
Netlify auto-deploys on push to `main`. No manual upload needed.

### 4. Verify
- Visit https://minicycleapp.com → should redirect to product page
- Visit https://minicycle.app/miniCycle.html → app loads
- Check browser console for errors
- Test service worker update (should appear within 60 seconds)
- **Test offline** — see checklist below

---

## PWA Update Strategy

### Version Synchronization

**`version.js`** is the single source of truth:
```javascript
globalThis.APP_VERSION = '2.056';
globalThis.CACHE_VERSION = 895;
```

Files that reference the version (all updated by `update-version.sh`):
1. `version.js` — source of truth
2. `service-worker.js` — inlined APP_VERSION and CACHE_VERSION
3. `miniCycle.html` — meta tags and inline script cache busters
4. `manifest.json` — version field
5. All module imports — use versioned URLs via `withV()` helper

### Cache Invalidation
On version increment, the new service worker activates, deletes the old cache, and precaches all files fresh. Users see an update notification within 60 seconds.

For full details, see [SERVICE_WORKER_UPDATE_STRATEGY.md](./SERVICE_WORKER_UPDATE_STRATEGY.md).

---

## Cache Headers (netlify.toml)

Netlify uses **last-match-wins** ordering. Critical files must come AFTER general rules.

| File Pattern | Cache-Control | Why |
|---|---|---|
| `/*` (default) | `public, max-age=31536000` | Long cache for static assets |
| `*.html` | `no-cache, no-store, must-revalidate` | Safari fix — `no-store` required |
| `*.js`, `modules/**/*.js` | `public, max-age=86400` | 24-hour cache for offline support |
| `*.css` | `public, max-age=86400` | Same — offline support |
| `/version.js` | `no-cache, no-store, must-revalidate` | Must never be cached |
| `/service-worker.js` | `no-cache, no-store, must-revalidate` | Must never be cached |

**Why JS/CSS have 24-hour cache:** iOS kills the PWA's service worker when the app is backgrounded. If the user reopens offline and the SW hasn't restarted, the browser's HTTP cache is the only fallback. Without `max-age`, the browser tries to revalidate with the server (impossible offline) and fails. See [PWA_OFFLINE_ARCHITECTURE.md](./PWA_OFFLINE_ARCHITECTURE.md).

---

## Security

### HTTPS
Required for PWA features and service workers. Handled automatically by Netlify.

### Content Security Policy

CSP uses **SHA-256 hashes** for inline scripts — no `'unsafe-inline'`. Configured in two places for defense in depth:

1. **`<meta>` tag** in `miniCycle.html`
2. **HTTP headers** in `netlify.toml`

Both must stay in sync. If you modify ANY inline `<script>` in miniCycle.html, you must:
1. Compute the new SHA-256 hash
2. Update the `<meta>` tag in miniCycle.html
3. Update the `Content-Security-Policy` header in `netlify.toml`

**Local dev won't catch CSP mismatches** — the Python server doesn't send CSP headers. This only breaks in production on Netlify.

### Other Security Headers (netlify.toml)
- `X-Frame-Options: DENY` — clickjacking protection
- `Strict-Transport-Security` — HSTS for 1 year
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables geolocation, microphone, camera, payment

---

## Testing After Deployment

### Basic Functionality
- [ ] App loads without console errors
- [ ] Tasks can be created, edited, deleted
- [ ] Routines can be switched
- [ ] Data persists after refresh
- [ ] Service worker installs correctly

### PWA / Offline
- [ ] "Install App" prompt appears
- [ ] Go offline (DevTools → Network → Offline) → reload → app boots from cache
- [ ] No "Clear Cache" button shown when offline
- [ ] Go back online → reload → normal boot, caches intact
- [ ] Service worker update appears within 60 seconds of deploy

### iOS Offline (Critical)
- [ ] Open app on iPhone → confirm it loads
- [ ] Enable airplane mode
- [ ] Force-close the app (swipe up from app switcher)
- [ ] Reopen the app → should boot from cache
- [ ] Repeat close/reopen 3 times → should still work every time
- [ ] Disable airplane mode → reload → normal boot, caches intact

### Cross-Platform
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari
- [ ] Mobile Safari (iPhone/iPad)
- [ ] Mobile Chrome (Android if available)

---

## Common Deployment Issues

### Service Worker Not Updating
**Symptoms:** Users stuck on old version after deployment

**Solutions:**
1. Verify `update-version.sh` was run (check `version.js` has new version)
2. Verify `CACHE_VERSION` was incremented in `service-worker.js`
3. Hard refresh (Cmd+Shift+R) to bypass cache
4. Unregister old SW in DevTools → Application → Service Workers

### 404 on Module Imports
**Symptoms:** Console errors like `Failed to load module`

**Solutions:**
1. Verify the deploy completed successfully on Netlify dashboard
2. Check that the file exists in the repo (Netlify deploys from Git)
3. Verify the server returns `text/javascript` MIME type for `.js` files

### App Doesn't Work Offline After Deploy
**Symptoms:** Blank screen or boot error when offline

**Solutions:**
1. Load the app online first (precache needs one successful online boot)
2. Check DevTools → Application → Cache Storage → verify entries exist
3. Check the service worker is active and controlling the page
4. See [PWA_OFFLINE_ARCHITECTURE.md](./PWA_OFFLINE_ARCHITECTURE.md) for full diagnosis

### CSP Blocking Inline Script
**Symptoms:** Boot failsafe doesn't run; app shows blank screen on error

**Solutions:**
1. Compute the SHA-256 hash of the inline script that changed
2. Update both `miniCycle.html` meta tag AND `netlify.toml`
3. Redeploy

---

## Deployment Checklist

### Before Every Deployment
- [ ] Run `./scripts/update-version.sh` to increment version
- [ ] Run `npm test` — ensure tests pass
- [ ] Test locally at http://localhost:8080
- [ ] Test offline locally (DevTools → Network → Offline → reload)

### Deploy
- [ ] Commit changes with version number in message
- [ ] Push to `main` — Netlify auto-deploys
- [ ] Check Netlify dashboard for successful deploy

### After Deployment
- [ ] Visit https://minicycleapp.com (verify redirect)
- [ ] Visit https://minicycle.app/miniCycle.html (verify app loads)
- [ ] Check browser console for errors
- [ ] Verify service worker updates within 60 seconds
- [ ] Test offline boot (especially on iOS if possible)
- [ ] Verify CSP isn't blocking anything (check console for CSP violations)

---

## Related Documentation

- **[PWA_OFFLINE_ARCHITECTURE.md](./PWA_OFFLINE_ARCHITECTURE.md)** — Full offline architecture, caching layers, iOS issues, FAQ
- **[SERVICE_WORKER_UPDATE_STRATEGY.md](./SERVICE_WORKER_UPDATE_STRATEGY.md)** — SW update mechanics and versioning strategy
- **[UPDATE-VERSION-GUIDE.md](./UPDATE-VERSION-GUIDE.md)** — Version management procedures

---

**miniCycle** — Turn Your Routine Into Progress

Built with ❤️ by [MJ](https://sparkincreations.com) | Official Site: [minicycleapp.com](https://minicycleapp.com)
