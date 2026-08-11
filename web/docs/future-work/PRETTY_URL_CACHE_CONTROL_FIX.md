# Pretty-URL `Cache-Control` Gap — `/minicycle` Cached for a Year

> **Status:** ✅ BOTH PARTS DONE — Part 1 shipped v2.397, Part 2 Aug 2026 · **Severity:** was
> High — stale app shell after every deploy · **Found:** Aug 2026, live production review of
> `minicycle.app` by driving the real app in a browser.
>
> **Part 1 (headers) is done.** `web/netlify.toml` now carries explicit `no-store` blocks for
> `/minicycle`, `/legal/*` and `/blog`. Verified in production after the v2.397 deploy:
>
> ```
> /minicycle       cache-control: no-cache,no-store,must-revalidate
> /legal/privacy   cache-control: no-cache,no-store,must-revalidate
> /blog            cache-control: no-cache,no-store,must-revalidate
> ```
>
> **Part 2 (service-worker `cache: 'reload'`) is now DONE too.** `addAllSafe` builds each
> precache entry as `new Request(url, { cache: 'reload' })` on both the fast and slow paths,
> so install always hits the network and cannot inherit a stale HTTP-cache entry if a header
> ever regresses. `test:sw` passes (online, honest offline, and lying-`navigator.onLine`).
>
> On the redirected-response trap this doc warns about: it is a SEPARATE axis and unchanged
> by Part 2 — `cache: 'reload'` sets the HTTP cache mode, not redirect handling, and
> `./miniCycle.html` has 301'd in production since well before this. If an engine rejects a
> redirected response, the existing per-URL slow path isolates it to that one entry rather
> than failing the whole install. Note `test:sw` runs on localhost, where that URL does not
> redirect, so the production redirect path is not covered by it either way.
>
> The original finding, for the record: `/minicycle` — the URL behind the "Try miniCycle Web"
> CTA and the "Try Now" nav button — was served with `Cache-Control: public, max-age=31536000`.
> The app shell was cached for a **year**, so a returning visitor kept running old HTML against
> new hashed `/build/` output until that entry was evicted.
>
> This is **not a new failure mode**. It is the one already documented in `netlify.toml` on the
> `for = "/"` rule; the fix was applied to `/` and `/pages/*` and never extended to the rest.

---

## Observed on production (v2.396)

The app was running **v2.394 HTML against the v2.396 build**, and had stopped trying to recover:

```
🔄 VERSION MISMATCH: BUILD (HTML) stale: loaded=2.394, server=2.396
⚠️ Version still mismatched after a heal attempt this session — not reloading again
```

On the upgrade boot this also produced a hard CSP failure — the stale document's inline-script
hash (`sha256-640meEnOenpColBQdyAuD707TeH3jPOOM4rKJiXun9k=`) is not in the v2.396 allowlist, so
the script was blocked, the boot was counted as a failure, and the page force-reloaded.

## Evidence

### 1. The header, cache-busted so no CDN or local cache is in play

```bash
for u in / /minicycle; do curl -s -o /dev/null -D - "https://minicycle.app$u?cb=$RANDOM" \
  | grep -iE '^(HTTP/|cache-control)'; done
```

```
/            HTTP/2 200   cache-control: no-cache,no-store,must-revalidate
/minicycle   HTTP/2 200   cache-control: public,max-age=31536000
```

Same `etag`, same body, same app-version — different caching policy.

### 2. Full scope of affected pretty URLs

| URL | `Cache-Control` | Notes |
|-----|-----------------|-------|
| `/minicycle` | `public, max-age=31536000` | **App entry point** — CTA + nav target |
| `/legal/privacy` | `public, max-age=31536000` | linked from app footer |
| `/legal/terms` | `public, max-age=31536000` | linked from app footer |
| `/legal/security` | `public, max-age=31536000` | linked from app footer |
| `/legal/accessibility` | `public, max-age=31536000` | linked from app footer |
| `/legal/user-manual` | `public, max-age=31536000` | |
| `/blog` | `public, max-age=31536000` | |
| `/` | `no-cache, no-store, must-revalidate` | ✅ already fixed |
| `/pages/product`, `/pages/learn_more` | `no-cache, no-store, must-revalidate` | ✅ already fixed |

The `.html` forms are fine (`/legal/privacy.html`, `/blog.html`, `/pages/product.html` all return
`200` + `no-store`) — the `*.html` rule works. The gap is only the extensionless aliases.

### 3. Why it happens

`netlify.toml:57` sets the catch-all:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

`/minicycle` is not in `_redirects` — it is Netlify's automatic pretty URL for `miniCycle.html`.
Netlify matches header rules against the **request path**, and `/minicycle` has no extension, so
the `*.html` rule at `netlify.toml:92` cannot match it and it falls through to `/*`.

The comment already in the file on the `for = "/"` rule (`netlify.toml:98-103`) states this
verbatim:

> Without this, "/" falls through to the "/\*" catch-all and the entry HTML is cached for a YEAR
> — serving stale markup that references old /build/ hashes after a deploy. Same pretty-URL/
> no-extension fix already applied to "/pages/\*" below.

### 4. The service worker locks the stale copy in

`BOOT_CRITICAL` precaches `'./miniCycle.html'` (`service-worker.js:122`). That path **301-redirects
to `/minicycle`** — the one URL carrying the year-long cache:

```
/miniCycle.html   HTTP/2 301   location: /minicycle
```

Precaching runs through `addAllSafe` (`service-worker.js:367`), whose fast path is
`cache.addAll(urls)`. Per spec `Cache.add`/`addAll` fetch with the **default** HTTP cache mode, so
a year-fresh cached copy satisfies the request without revalidating.

`./lite/miniCycle-lite.html` in `LITE_SHELL` (`service-worker.js:335`) 301s the same way.

Navigation is cache-first, so the app cannot then read past its own cache. Measured from inside
the running page — every mode returns the stale copy while `curl` returns the fresh one:

```js
fetch('/minicycle')                         → 2.394
fetch('/minicycle', {cache: 'no-store'})    → 2.394
fetch('/minicycle', {cache: 'reload'})      → 2.394
fetch('/minicycle', {cache: 'force-cache'}) → 2.394
// curl (bypasses SW + browser cache)       → 2.396
```

That is why the self-heal gives up: its freshness re-check goes through the same cache-first SW.

### 5. Competing explanation ruled out

The obvious alternative — that the SW caches were simply never invalidated — does not hold.
`CACHE_VERSION` bumped on every release in the window:

```
v2.393 → 1236    v2.394 → 1237    v2.395 → 1238    v2.396 → 1239
```

The console confirmed the clear ran (`🗑️ Clearing all caches…` → `✅ Cache already cleared for
v2.396`), yet a Cache API dump found the 2.394 body sitting inside the **freshly created**
`miniCycle-static-v1239` and `miniCycle-dynamic-v1239` buckets, while `/` in the same bucket held
2.396. So the stale entry was not a survivor — it was re-fetched during the 2.396 install and a
2.394 body came back.

> **Known limit of the evidence:** from outside, this cannot distinguish a stale body served by
> the browser's disk cache from one served by a CDN edge node that had not rolled over yet. Either
> way, `max-age=31536000` is what removes the revalidation that would have corrected it.

---

## Fix

### Part 1 — headers (required)

Add explicit blocks in `web/netlify.toml`, **after** the `/*` catch-all (last match wins), matching
the existing `for = "/"` and `for = "/pages/*"` blocks:

```toml
# Pretty URLs (no .html extension) cannot match the "*.html" rule and fall through
# to the "/*" catch-all's 1-year cache. Same fix as "/" and "/pages/*" above.
[[headers]]
  for = "/minicycle"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    Pragma = "no-cache"
    Expires = "0"

[[headers]]
  for = "/legal/*"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    Pragma = "no-cache"
    Expires = "0"

[[headers]]
  for = "/blog"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    Pragma = "no-cache"
    Expires = "0"
```

`/minicycle` is the one that matters; the others are correctness/consistency.

> Consider inverting the default instead: make `/*` conservative and opt *into* long caching for
> `/build/*` (already `immutable`), fonts, and images. The current shape means **every new
> extensionless route is stale-by-default**, and this is the second time that has bitten. That is
> a larger change — evaluate separately.

### Part 2 — service worker (belt and braces)

Precache with an explicit reload so the SW can never inherit a stale HTTP-cache entry, even if a
header regresses:

```js
// service-worker.js — addAllSafe
var reqs = urls.map(function (u) { return new Request(u, { cache: 'reload' }); });
return cache.addAll(reqs)
```

Apply to the individual-add slow path too. Note `cache.addAll` **rejects on redirected responses**
in some engines — since `./miniCycle.html` and `./lite/miniCycle-lite.html` both 301, either point
`BOOT_CRITICAL` at the final URLs (`'./minicycle'`, `'./lite/minicycle-lite'`) or keep the existing
`cleanResponse()` handling in the slow path. See the Safari redirected-response note in the
lessons-learned memory.

---

## Verification

1. `curl -s -o /dev/null -D - 'https://minicycle.app/minicycle?cb=1' | grep -i cache-control`
   → must be `no-cache, no-store, must-revalidate`.
2. Deploy a version bump, then hard-load the app in a profile that already visited it: console
   must show `✅ Version verified` with **no** `VERSION MISMATCH: BUILD (HTML) stale`.
3. In DevTools → Application → Cache Storage, confirm the `/minicycle` and `/miniCycle.html`
   entries carry the new `app-version` meta.
4. Add a deploy-time smoke check asserting no HTML response carries `max-age > 0` — this class of
   bug is invisible to every current gate.

## Why the gates missed it

`validate:csp` hashes the **source** HTML, which is correct — the mismatch only exists between a
*cached old* document and *current* headers. No gate inspects live response headers, and
`npm run test:sw` exercises offline boot and precache drift but not cache-control policy. The
deploy-verification guidance in `CLAUDE.md` ("verify by ARTIFACT SHAPE") checks the *newly served*
artifact, which is correct here — the bug is in what returning visitors get.

## Related

- [`BUILD_PROCESS.md`](../deployment/BUILD_PROCESS.md) — content-hashed `/build/` tree; stale HTML
  referencing old hashes is precisely the failure this guards against.
- [`SERVICE_WORKER_UPDATE_STRATEGY.md`](../deployment/SERVICE_WORKER_UPDATE_STRATEGY.md) and
  [`PWA_OFFLINE_ARCHITECTURE.md`](../deployment/PWA_OFFLINE_ARCHITECTURE.md) — the cache-first
  navigation and version-heal behaviour this defeats; update both if Part 2 lands.
- [`MODULE_LOADER_GUIDE.md`](../architecture/MODULE_LOADER_GUIDE.md) — module map rides
  `version.js`, so an HTML/`version.js` split is what surfaces as the mismatch warning.
- Unrelated to caching, but found in the same review: `games/miniCycle- taskGame.html` (note the
  space in the filename) and `games/miniCycle-taskScramble.html` have inline scripts that are
  CSP-blocked in production. These are **not dead code** — they are unpromoted siblings of
  `miniCycle-taskOrder.html`, staged for a future reward tier (all three landed in one commit,
  Nov 2025; only taskOrder has had its JS extracted). The open question is whether they should be
  deployed in their current state, not whether to delete them.
- Also stale, found while checking the above: `robots.txt` still disallows `/miniCycleGames/`, the
  pre-rename folder path. `_redirects` 301s that to `/games/`, which nothing disallows — so the
  games folder is crawlable today.
