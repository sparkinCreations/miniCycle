# Content Security Policy & .htaccess Guide

> **Audience:** Anyone working on miniCycle — no security background needed.
> **Last Updated:** February 26, 2026
> **Applies to:** All HTML pages served from minicycle.app

---

## What Problem Does This Solve?

Imagine someone finds a way to sneak a malicious script into your website — maybe through a form, an imported file, or a browser extension. That script could steal user data, redirect people to fake pages, or do other harmful things.

**Content Security Policy (CSP)** is a set of rules that tells the browser: *"Only run scripts and load resources that I explicitly trust."* If anything tries to run that isn't on the approved list, the browser blocks it immediately.

miniCycle's CSP is like a bouncer at the door — it has a guest list, and if your name isn't on it, you're not getting in.

---

## The Two Key Files

### `.htaccess` — The Rule Book

**Location:** `web/.htaccess`

This is an Apache web server configuration file. When someone visits any page on minicycle.app, the server reads `.htaccess` and attaches security rules to the response. Think of it as a set of instructions the server follows every time it serves a page.

**Key point:** `.htaccess` applies to **every single page** on the entire domain — not just `miniCycle.html`, but also the product page, legal pages, game pages, docs, everything.

### `miniCycle.html` — The Main App

The main app has a few small inline scripts (code written directly in the HTML file rather than in a separate `.js` file). These are the only inline scripts allowed on the entire site, and each one has a unique fingerprint (called a SHA-256 hash) registered in `.htaccess`.

---

## How miniCycle's CSP Works

Here's the CSP from `.htaccess`, broken down rule by rule:

### `default-src 'self'`

**What it means:** By default, only load things from our own domain (minicycle.app).

**In plain English:** "If we didn't host it ourselves, don't load it." This blocks any attempt to pull in scripts, images, or other resources from random external websites.

### `script-src 'self' 'sha256-...' 'sha256-...' ...`

**What it means:** JavaScript can only come from two places:
1. **External `.js` files** hosted on minicycle.app (`'self'`)
2. **Specific inline scripts** whose exact content matches one of the listed SHA-256 hashes

**In plain English:** "Run our own script files freely. For inline scripts (code written directly in HTML), only run them if they match a known fingerprint."

The hashes are fingerprints of the inline scripts in `miniCycle.html` and `miniCycle-lite.html`. If even one character of those scripts changes, the fingerprint changes and the browser will block them until the hash is updated.

> **Exception — `tests/module-test-suite.html`:** the test runner is served on the separate
> test origin under a path-scoped `/tests/*` CSP that uses `script-src 'unsafe-inline'`
> (see `netlify.toml`). Its inline script therefore needs **no** hash, and editing it does
> **not** require recomputing CSP hashes. This is safe because that origin holds no user data.

**This is why new pages must never use inline scripts** — their fingerprints aren't in the list, so the browser will block them.

### `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`

**What it means:** CSS stylesheets can come from our domain, from Google Fonts, and inline styles (like `style="color: red"`) are allowed.

**In plain English:** "Styles are fine from our files, from Google Fonts, or written directly on elements." Inline styles are lower risk than inline scripts, so we allow them for convenience.

### `font-src 'self' https://fonts.gstatic.com`

**What it means:** Fonts can come from our domain or from Google's font CDN (fonts.gstatic.com).

**In plain English:** "We host our own fonts, and we also load fonts from Google Fonts (served from fonts.gstatic.com)."

### `img-src 'self' data: blob:`

**What it means:** Images can come from our domain, from data URLs (images embedded directly in code), or from blob URLs (images generated in memory).

**In plain English:** "Our images, plus images the app creates on the fly (like generated icons)."

### `connect-src 'self' https://api.web3forms.com`

**What it means:** The app can make network requests to our domain and to the Web3Forms API.

**In plain English:** "The only external service we talk to is Web3Forms — that's the feedback form. Nothing else."

### `frame-ancestors 'self'`  (app)  /  `frame-ancestors 'self' https://minicycle.app`  (test origin)

**What it means:** The app (`minicycle.app`) can only be embedded by itself — no third
party can frame it (clickjacking protection). The separate **test origin**
(`test.minicycle.app`, which serves `/tests/*`) additionally allows `https://minicycle.app`
to frame it, so the in-app testing modal can embed the hermetic test runner.

**In plain English:** "Nobody can put our app inside their website to trick users — but our
own app is allowed to embed the test runner that lives on the test subdomain."

The app side also sets `frame-src 'self' https://test.minicycle.app` (and `child-src`) so it
is *permitted* to load that cross-origin iframe. See
[TESTING_MODAL.md](../testing/TESTING_MODAL.md) for why the runner is on a separate origin.

> **Note:** The authoritative production headers live in `netlify.toml` (the live host is
> Netlify). `.htaccess` is a legacy Apache fallback.

### `base-uri 'self'`

**What it means:** The `<base>` HTML tag can only point to our own domain.

**In plain English:** Prevents an attacker from redirecting all relative URLs on the page to a malicious site.

### `form-action 'self' https://api.web3forms.com`

**What it means:** Forms can only submit to our domain or to Web3Forms.

**In plain English:** "The feedback form can send data to Web3Forms. No other form submissions are allowed to go anywhere else."

### `upgrade-insecure-requests`

**What it means:** If any resource tries to load over HTTP (insecure), automatically upgrade it to HTTPS (secure).

**In plain English:** "Always use the secure version of a connection, even if someone accidentally wrote `http://` instead of `https://`."

---

## Other Security Headers in .htaccess

Beyond CSP, `.htaccess` sets several other protective headers:

| Header | What It Does | Plain English |
|--------|-------------|---------------|
| `X-Frame-Options` — **not set on Netlify** | Framing is controlled by CSP `frame-ancestors` instead. `X-Frame-Options` can only say `SAMEORIGIN`/`DENY`, which **cannot** allow the app to frame the separate test-runner origin (`test.minicycle.app`). `frame-ancestors` can name a specific allowed origin, so it replaces it. | "We let CSP decide who can frame what, because the old header couldn't say 'allow our test subdomain'." (`.htaccess` may still send `SAMEORIGIN` for the legacy Apache path.) |
| `X-Content-Type-Options: nosniff` | Prevents browsers from guessing file types | "If we say it's CSS, treat it as CSS — don't try to run it as JavaScript" |
| `X-XSS-Protection: 1; mode=block` | Legacy XSS filter for older browsers | Extra protection for browsers that don't support CSP |
| `Referrer-Policy: strict-origin-when-cross-origin` | Controls what URL info is sent when clicking links | "When leaving our site, only share the domain name, not the full page URL" |
| `Permissions-Policy` | Disables hardware features we don't use | "We don't need your camera, microphone, GPS, or payment info — block all of it" |

---

## The Golden Rule for New Pages

> **All new HTML pages MUST use external `.js` files. Never write inline `<script>` blocks or inline event handlers.**

### What's allowed

```html
<!-- GOOD — external script file -->
<script src="my-page.js"></script>
```

External scripts from our domain are covered by `'self'` in the CSP. No hash needed.

### What's blocked

```html
<!-- BLOCKED — inline script -->
<script>
    document.getElementById('year').textContent = new Date().getFullYear();
</script>

<!-- BLOCKED — inline event handler -->
<button onmouseover="this.style.color='red'">Hover me</button>
```

Inline scripts need a SHA-256 hash in `.htaccess` to work. Inline event handlers (`onclick`, `onmouseover`, etc.) **cannot** be allowed with hashes at all — they require `unsafe-inline`, which weakens security.

### The fix is always the same

1. Create an external `.js` file next to your HTML file
2. Move all JavaScript into that file
3. Replace `<script>...</script>` with `<script src="your-file.js"></script>`
4. Replace inline handlers with `addEventListener` in the JS file

### Current page setup

| Page | Script File | Notes |
|------|------------|-------|
| `miniCycle.html` | Inline (hashed in CSP) | Main app — uses inline scripts with registered hashes |
| `miniCycle-lite.html` | Inline (hashed in CSP) | Lite version — also has registered hashes |
| `tests/module-test-suite.html` | Inline under relaxed `/tests/*` CSP | Test runner on the separate origin — `script-src 'unsafe-inline'`, **no hash needed** |
| `pages/product.html` | `pages/product.js` | Carousel, changelog, hover effects |
| `pages/learn_more.html` | `pages/learn_more.js` | FAQ accordion, smooth scroll |
| `legal/privacy.html` | `legal/legal-footer.js` | Shared year footer |
| `legal/accessibility.html` | `legal/legal-footer.js` | Shared year footer |
| `legal/security.html` | `legal/legal-footer.js` | Shared year footer |
| `legal/terms.html` | `legal/legal-footer.js` | Shared year footer |
| `legal/user-manual.html` | None needed | Pure HTML + CSS, no JavaScript |
| `games/miniCycle-taskOrder.html` | `games/miniCycle-taskOrder-init.js` + `games/miniCycle-taskOrder.js` | Init script in head (dark mode detection), game logic at end of body |
| `docs/index.html` | `docs/docsify-config.js` | Docsify configuration |

---

## What Happens When CSP Blocks Something

When the browser blocks a script, you'll see a red error in the browser console (DevTools > Console) that looks like this:

```
Refused to execute inline script because it violates the following
Content Security Policy directive: "script-src 'self' 'sha256-...'"
```

**What this tells you:**
- An inline script tried to run
- Its fingerprint doesn't match any hash in the CSP
- The browser blocked it to protect the user

**How to fix it:**
- Move the inline script to an external `.js` file (see the golden rule above)

---

## How SHA-256 Hashes Work (For miniCycle.html Only)

The main app (`miniCycle.html`) uses inline scripts for critical boot-time operations (like dark mode detection that must run before the page paints). Each inline script has a SHA-256 hash — a unique fingerprint of its exact content.

### How hashes are computed

```bash
# Take the exact content between <script> and </script>
# Compute its SHA-256 hash and encode as base64
echo -n 'SCRIPT_CONTENT_HERE' | openssl dgst -sha256 -binary | openssl base64
```

The result looks like: `sha256-598+MlUQwZnsi4Bl2TqCLwtrDbSviEHUuCw5e2zjclo=`

### Where the hashes live (three config files)

The **same** CSP — and therefore the same `script-src` hash list — is served by **three** config files, one per deployment target. They must stay in sync:

| File | Server / target |
|------|-----------------|
| `web/netlify.toml` | **Production** (Netlify HTTP headers) |
| `web/.htaccess` | Apache (multi-line `\` continuation format) |
| `web/nginx-security.conf` | nginx (single-line `add_header`) |

> The non-`script-src` directives may legitimately differ between these files (e.g. Netlify allows `formspree`/`blob:`, nginx is a leaner policy). It's specifically the **`script-src` hash list** that must be identical across all three.

### When you need to update hashes

**Only** if you change an inline script in `miniCycle.html` or `lite/miniCycle-lite.html`. (The `tests/module-test-suite.html` runner is **exempt** — it loads under the relaxed `/tests/*` CSP with `'unsafe-inline'`, so it needs no hash.)

**The easy way (recommended) — let the tooling do it:**

```bash
cd web
./scripts/update-version.sh --auto      # bumps version AND re-syncs CSP hashes in all 3 files
```

The `CSP HASH AUTO-UPDATE` step in that script recomputes every inline-script hash and rewrites the `script-src` directive in **all three** config files (each in its native format), adding new hashes and removing stale ones. It's idempotent — if nothing changed, it leaves the files untouched. This step runs on every release, so in practice you rarely touch hashes by hand.

**The manual way** (only if you can't run the script):

1. Make your change to the inline script
2. Copy the exact content between `<script>` and `</script>` (not including the tags)
3. Run the hash command above on that content
4. Replace the old hash with the new one in **all three** files — `netlify.toml`, `.htaccess`, **and** `nginx-security.conf`
5. Deploy

**If you change even one space or newline, the hash changes.** Always recompute after any edit. (Editing an inline script in the extension build is different — see note below.)

> **Chrome extension:** the `chrome/full/` build externalizes every inline script into `ext-boot/*.js`, so it runs under MV3's default `script-src 'self'` with **no hashes at all**. Inline-script edits there need a rebuild (`npm run build:chrome-full`), not a hash update.

### When you do NOT need to update hashes

- Adding or editing external `.js` files — these are covered by `'self'`
- Adding new HTML pages with external scripts
- Changing CSS, images, or other non-script resources
- Editing the `.htaccess` file itself (unless changing CSP hashes)

---

## Common Mistakes and How to Avoid Them

### Mistake 1: "I'll just add a quick inline script"

**Problem:** You add `<script>alert('test')</script>` to a new page. It works on localhost (no `.htaccess` there) but breaks in production.

**Fix:** Always use external `.js` files for new pages. Test with a local Apache server if you want to verify CSP.

### Mistake 2: "I'll use onclick handlers for simplicity"

**Problem:** You write `<button onclick="doSomething()">`. CSP blocks it because inline event handlers are treated as inline scripts.

**Fix:** Use `addEventListener` in your external JS file:
```javascript
document.getElementById('myBtn').addEventListener('click', doSomething);
```

### Mistake 3: "I changed an inline script in miniCycle.html but forgot to update the hash"

**Problem:** The app's inline script runs fine on localhost but gets blocked in production. Users see a broken page.

**Fix:** Run `./scripts/update-version.sh --auto` after editing any inline script — it recomputes the hash and syncs all three config files. (Doing it by hand? Update `netlify.toml`, `.htaccess`, **and** `nginx-security.conf` — not just one.)

### Mistake 4: "I need to load a script from a CDN"

**Problem:** You add `<script src="https://cdn.example.com/library.js">`. CSP blocks it because `cdn.example.com` isn't in the `script-src` list.

**Fix:** miniCycle self-hosts all dependencies. Download the library, put it in your project, and reference it locally. If you absolutely must use a CDN, add its domain to `script-src` in `.htaccess` — but self-hosting is preferred.

### Mistake 5: "It works on localhost so it's fine"

**Problem:** Your local Python dev server (`npm start`) doesn't send CSP headers. Everything works locally, then breaks when deployed to Apache.

**Fix:** Remember that CSP is only sent by the deployed server — `netlify.toml` in production (Netlify), or `.htaccess`/`nginx-security.conf` on Apache/nginx deploys. The local Python dev server sends none. If something works locally but fails in production, check the browser console for CSP errors first.

---

## Quick Reference

| I want to... | Do this |
|--------------|---------|
| Add JS to a new page | Create an external `.js` file, reference with `<script src="...">` |
| Add a click handler | Use `addEventListener` in your `.js` file — never use `onclick=""` |
| Change a miniCycle.html inline script | Run `./scripts/update-version.sh --auto` — it re-syncs hashes in all 3 configs |
| Load an external library | Self-host it. Put the file in your project and reference locally |
| Debug a CSP error | Open browser DevTools > Console. Look for "Content Security Policy" errors |
| Add a new external service | Add its domain to the relevant CSP directive in **all three** config files |

---

## File Locations

| File | Path | Purpose |
|------|------|---------|
| CSP rules (production) | `web/netlify.toml` | Security headers served by Netlify |
| CSP rules (Apache) | `web/.htaccess` | Same CSP for Apache deploys |
| CSP rules (nginx) | `web/nginx-security.conf` | Same CSP for nginx deploys |
| Hash sync tool | `web/scripts/update-version.sh` | Recomputes + syncs `script-src` hashes across all 3 configs |
| Main app | `web/miniCycle.html` | Has hashed inline scripts |
| Lite app | `web/lite/miniCycle-lite.html` | Also has hashed inline scripts |
| Test runner | `web/tests/module-test-suite.html` | Separate origin; relaxed `/tests/*` CSP — **no** hash |
| This guide | `web/docs/security/CSP_AND_HTACCESS_GUIDE.md` | You're reading it |

---

*This guide was created February 2026 after fixing CSP violations across 7 pages (product, learn more, privacy, accessibility, security, terms, task order game, and docs). All inline scripts were extracted to external files to comply with the site-wide CSP.*
