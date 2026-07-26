# Full Extension: Build & Differences from the Web App

This document explains how the **full** Chrome extension (`chrome/full/`) relates to the
web app (`web/`): every way it differs, why, how it's built, and how updates/releases flow.

> **The `full/` extension is generated, not hand-written.** It is produced from `web/` by
> `web/scripts/build-chrome-full.cjs`. **Never edit anything in `chrome/full/` by hand** —
> the next build wipes it (`rmrf`) and regenerates it. To change the extension, change the
> web app (or the build script) and rebuild.
>
> The `lite/` extension is a *separate, hand-maintained* port of `web/lite/` and is **not**
> covered here — see [`README.md`](./README.md).

---

## 1. Why an extension differs from the web app at all

Chrome Manifest V3 (MV3) imposes constraints the web app doesn't have, and an extension
runs from a `chrome-extension://<id>/` origin with files bundled locally (no server). The
build is the set of mechanical transforms that bridge those two worlds:

- **No inline scripts.** MV3 extension pages enforce `script-src 'self'` with **no hash/nonce
  exceptions**. Every inline `<script>` must become an external file (or be dropped).
- **No page service worker for caching.** Extensions don't register a page SW; assets ship
  bundled. The PWA's offline/version-gate machinery is irrelevant and is removed.
- **No PWA manifest.** The extension has its own MV3 `manifest.json` (a different schema).
- **Local origin.** Files are served from `chrome-extension://…`, so anything not bundled
  (e.g. `pages/`, `tests/`) must point at the live site instead, and anything that *should*
  stay in-app (e.g. `legal/`) must be bundled.

---

## 2. Web app vs. full extension — complete differences

| Area | Web app (`web/`) | Full extension (`chrome/full/`) | Why |
|---|---|---|---|
| **Entry HTML** | `miniCycle.html` | `index.html` (renamed) | Extension convention |
| **Inline scripts** | Allowed via CSP **SHA-256 hashes** in `netlify.toml` | **Externalized** to `ext-boot/NN.js`, in original order | MV3 forbids inline scripts entirely |
| **Boot-failure cache-clear failsafe** | Present (PWA self-heal) | **Dropped** | No SW cache to clear in an extension |
| **Version-change `document.write` reload** | Present (PWA cache bust) | **Dropped** | No SW cache versioning |
| **Service-worker registration** (~558 lines) | Present (`service-worker.js`) | **Dropped**; the feature-gate block before it is kept | Extensions don't use page SWs |
| **`background.js`** | n/a | MV3 service worker that enables the side panel (`sidePanel.setPanelBehavior`) | Extension UX |
| **Open mode** | Browser tab (served page) | **Side panel** (toolbar click) + in-app "Open in full tab" escape hatch | Mobile-first UI fits the panel; persists alongside the user's work; popups cap at 600px tall |
| **Name** | "miniCycle" (PWA title) | "miniCycle: Routine Checklist Manager" (manifest name) | Keyword-rich Web Store listing |
| **Lite fallback redirect** | 8-second fallback to `lite/miniCycle-lite.html` | **Neutralized** (no-op) | `lite/` isn't bundled; modern Chrome passes the feature gate |
| **PWA manifest** | `manifest.json` (PWA) + `<link rel="manifest">` | MV3 `manifest.json`; PWA link **dropped** | Different manifest schemas; names collide |
| **CSP** | `netlify.toml` / `.htaccess` with per-inline-script hashes | MV3 default page CSP (`script-src 'self'`) — no hashes needed | Inline scripts externalized |
| **Updates / caching** | SW cache-bust + version gate + cache-first navigation | No SW; updates via Web Store (or reload-unpacked) | Different distribution model |
| **`legal/` pages** (privacy/terms/security/accessibility/user-manual) | Linked relatively, served live | **Bundled** into `chrome/full/legal/`; back-links rewritten `../miniCycle.html` → `../index.html` | Keep legal nav inside the extension instead of bouncing users to minicycle.app |
| **Task Order mini-game** (unlocks at 100 cycles) | `games/miniCycle-taskOrder.html` + its 2 scripts | **Bundled** into `chrome/full/games/`; back-link rewritten `../miniCycle.html` → `../index.html` | Otherwise the in-app "Play" button 404s. Only this game ships; `taskGame`/`taskScramble` are dead experiments with inline `<script>` and are excluded |
| **`pages/` + `tests/` links** | Relative | Rewritten to absolute `https://minicycle.app/…` | Not bundled; would 404 from `chrome-extension://` |
| **Automated-test tab** | Visible in the testing modal | Hidden via `ext-overrides.css` | `tests/` isn't bundled; the iframe would 404 |
| **"Open in full tab" button** | n/a | Injected via `ext-boot/open-fulltab.js` (styled in `ext-overrides.css`) | Side-panel escape hatch to the wide layout |
| **Assets** | Full `web/assets/` (~1.1 GB) | Only **referenced** assets (~0.4 MB) + `fonts/` | Keep the package small |
| **Sample-routines listing** | `examples/sample-routines/manifest.json` | Renamed to `index.json` (fetch patched in the copied `routineManager.js`) | The Web Store rejects any package containing **more than one** `manifest.json` |
| **Icons** | Favicon / PWA icons | Blue-background set from `chrome/full-icons/` | Distinct store/toolbar identity |
| **External hosts** | `api.web3forms.com` (feedback) | Same — declared in `host_permissions` | Feedback form only |
| **Permissions** | n/a (web) | `sidePanel` + `host_permissions` for web3forms (no `storage`/`tabs`) | See §5 launcher |
| **Distribution** | Netlify deploy → minicycle.app | `chrome/full-<version>.zip` → Chrome Web Store, or load-unpacked | — |

**Unchanged / shared verbatim:** `version.js`, `miniCycle-main.js`, the entire `modules/`
tree, the entire `styles/` tree, and the runtime-fetched sample routines
(`examples/sample-routines/`, `examples/initial-run/`). The extension ships **byte-identical
module and style code** — only the HTML shell, manifest, and surrounding plumbing change.

---

## 3. The build pipeline

`web/scripts/build-chrome-full.cjs` (Node stdlib only, no deps). It is **idempotent**: it
`rmrf`s `chrome/full/` and regenerates the whole tree each run, so the output never drifts
from `web/`. Inline-block classification is **content-based** (stable substrings), not line
numbers, so it survives edits to `miniCycle.html`.

Order of operations (`main()`):

1. **`rmrf(OUT)` + recreate `ext-boot/`** — wipe and start clean.
2. **`readVersion()`** — parse `APP_VERSION` from `web/version.js` (single source of truth).
3. **`transformHtml()`** — `miniCycle.html` → `index.html`:
   - Drop the `<link rel="manifest">` (PWA manifest).
   - Rewrite `pages/` + `tests/` links → `https://minicycle.app/…` (not bundled).
   - Classify and process each inline `<script>` (see §4).
   - Inject `<link rel="stylesheet" href="ext-overrides.css">` before `</head>`.
   - **Assert** no inline `<script>` survived (fails the build if one does → MV3 would block it).
4. **`copyAppCode()`** — copy `version.js`, `miniCycle-main.js`, `modules/`, `styles/` verbatim.
5. **`copyAssets()`** — copy `fonts/`, then scan output HTML/CSS/JS for `assets/…` refs and copy
   only those files (warns on missing refs).
6. **`copyExamples()`** — copy the runtime-fetched `examples/sample-routines/` + `initial-run/`
   (warns if a module references an `examples/<dir>` that isn't bundled).
7. **`copyLegal()`** — copy `legal/` and rewrite each page's `../miniCycle.html` → `../index.html`
   and `../pages/…` → live site. Sibling legal links and absolute URLs are left as-is.
8. **`writeManifestAndBackground()`** — generate the MV3 `manifest.json`, the launcher
   `background.js`, and copy icons from `chrome/full-icons/`.
9. **`pruneJunk()`** — delete `.DS_Store` / `Thumbs.db` so the Web Store zip stays clean.

Two extension-only safeguards also run: **`dedupeSampleManifest()`** renames the bundled
sample-routines `manifest.json` → `index.json` and patches its one fetch in the copied
`routineManager.js` (the Web Store rejects packages with more than one `manifest.json`), and
**`assertSingleManifest()`** fails the build if more than one `manifest.json` remains in the
output.

### Running it

```bash
cd web
npm run build:chrome-full                       # or: node scripts/build-chrome-full.cjs
./scripts/update-version.sh --auto --chrome     # bump version + rebuild extension
./scripts/update-version.sh --auto --chrome --tag   # …and tag the release commit
```

`--chrome` runs the build **after** the version files are written and **before** the
git-tag commit, so the rebuilt extension is part of the release.

---

## 4. Inline-script handling (the `RULES` table)

Each inline `<script>` body is matched against `RULES` (first match wins):

| Action | Meaning | Applied to |
|---|---|---|
| `drop` | Remove the block, leave an HTML comment marker | boot-failure failsafe, `document.write` version reload, late lite-redirect |
| `split` | Keep only the body **before** a marker, externalize that part | the feature-gate block (SW registration after the marker is dropped) |
| *(default)* | Externalize the whole block to `ext-boot/NN.js` | every other inline block |

So a typical build **externalizes ~9 blocks** to `ext-boot/01.js … 09.js` and **drops 4**.
`version.js` and the `type="module"` entry (`miniCycle-main.js`) are external `src=` refs and
are never touched.

> **If you restructure the inline scripts in `miniCycle.html`,** revisit the `RULES` table —
> the matchers key off substrings like `__miniCycle_bootFails`, `document.write`, and
> `Enhanced Service Worker Registration`. The post-transform assertion will fail the build if
> a block that should have been externalized was missed, but a *miscategorized* block (e.g. an
> SW block that no longer matches its rule) could slip through — verify after big HTML edits.

---

## 5. The launcher (`background.js`) + side panel

The toolbar icon opens miniCycle in the browser **side panel**. The manifest declares the
global panel (`side_panel.default_path: "index.html"`) and the background service worker calls
`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on install/update so the
action click opens it (the setting persists, so that's all the background does). This needs the
benign `sidePanel` permission — **no `storage` or `tabs`** (the previous full-tab launcher used
`storage` to remember a tab id; that's gone).

**Why a side panel, not a tab/popup:** miniCycle's full UI is mobile-first, so it fits the
panel's narrow width; the panel gives full browser height (a popup is capped at 600px) and
persists alongside the user's work — a checklist they can keep in view while doing the tasks.

**Escape hatch:** `ext-boot/open-fulltab.js` injects a small "Open in full tab" button (styled
in `ext-overrides.css`) that calls `chrome.tabs.create({ url: runtime.getURL('index.html') })`
— creating a tab needs no permission. It guards on `chrome.tabs`, so it no-ops outside the
extension.

---

## 6. Output tree

```text
chrome/full/
├── manifest.json        # MV3 manifest (version = APP_VERSION)
├── background.js        # enables the side panel (sidePanel.setPanelBehavior)
├── index.html           # transformed miniCycle.html
├── ext-boot/NN.js       # externalized inline scripts (original order)
├── ext-boot/open-fulltab.js  # "Open in full tab" escape hatch (side panel → wide tab)
├── ext-overrides.css    # extension-only UI overrides (hides automated-test tab; full-tab button)
├── version.js           # verbatim from web/
├── miniCycle-main.js    # verbatim module entry
├── modules/             # verbatim — byte-identical to web/modules/
├── styles/              # verbatim — byte-identical to web/styles/
├── legal/               # bundled privacy/terms/security/accessibility/user-manual
├── examples/            # sample-routines + initial-run (runtime-fetched)
├── assets/              # only referenced assets + fonts/
└── icons/               # from chrome/full-icons/
```

---

## 7. How updates & releases work

- **Single version source.** `web/version.js` (`APP_VERSION`) drives everything: the web
  app, the SW `CACHE_VERSION`, *and* the extension's `manifest.json` version (the build reads
  it). Bump it with `update-version.sh`, never by hand-editing the manifest.
- **Web release:** push to `main` → Netlify deploys; the SW `CACHE_VERSION` bump + version
  gate roll existing clients onto the new version. Inline-script edits require recomputing
  CSP hashes in `netlify.toml` (and `.htaccess` / `nginx-security.conf`).
- **Extension release:** run the build (`--chrome` or `npm run build:chrome-full`), then
  **zip `chrome/full/`** as `chrome/full-<version>.zip` and upload to the Chrome Web Store
  (the store requires a **strictly increasing** version for each upload). For local testing,
  reload-unpacked at `chrome://extensions` instead — unpacked extensions don't auto-update.
  - **No CSP hash step** for the extension: inline scripts are externalized, so MV3's default
    `script-src 'self'` covers it. (This is the opposite of the web app's hashed-CSP flow.)
- **Zip naming:** keep the zip name in sync with the manifest version inside it
  (`full-<version>.zip`). Build artifacts can pick up iCloud `… 2/` / `… 2.zip` duplicates
  on this machine (the repo lives under `~/Documents`); exclude them when zipping
  (`-x "* 2/*" -x "* 2"`) and don't commit them.
- **Always zip fresh.** `zip` *updates* an existing archive (it doesn't remove entries for
  files that no longer exist), so re-zipping over an old `full-<version>.zip` can leave stale
  files inside — e.g. a renamed `manifest.json`. **`rm` the old zip first**, then create it:
  ```bash
  rm -f chrome/full-<version>.zip
  cd chrome/full && zip -rq ../full-<version>.zip . -x "*.DS_Store" -x "__MACOSX*" -x "* 2/*" -x "* 2"
  ```
- **One manifest only.** The build's `assertSingleManifest()` guards this, but the *zip* is
  assembled separately — after zipping, sanity-check with
  `unzip -Z1 chrome/full-<version>.zip | grep 'manifest.json$'` (should print exactly one line).

---

## 8. Maintenance rules

- **Never hand-edit `chrome/full/`** — it's regenerated. Edit `web/` or the build script.
- **Don't add `chrome/full/`'s generated files to any module manifest** or import from
  `web/modules/` directly into hand-written extension code — the CSP/exec context differ.
- **Don't reintroduce inline `<script>` or remote stylesheets** anywhere that reaches the
  extension — MV3 will block them. The build's post-transform assertion guards inline scripts.
- **After restructuring `miniCycle.html` inline scripts,** re-verify the `RULES` table (§4).
- **Keep `chrome/full-icons/`** as the source for the extension icon set (not `lite/icons/`).

---

## See also

- [`README.md`](./README.md) — editions overview, the `lite/` port, permissions, distribution
- `web/scripts/build-chrome-full.cjs` — the build script (authoritative)
- `web/docs/developer-guides/CSS_ARCHITECTURE_GUIDE.md` — the two-tier CSS loading the
  extension inherits verbatim
- `web/docs/security/CSP_AND_HTACCESS_GUIDE.md` — the web app's hashed-CSP flow (which the
  extension does **not** need)
