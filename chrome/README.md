# Chrome Extension

This folder contains miniCycle's Chrome (and Chromium-based: Edge, Brave, Arc) browser extension(s), built on **Manifest V3**.

## Editions

| Folder            | Status        | What it is                                                                                |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------- |
| [`lite/`](./lite) | ✅ Working v1 | MV3 popup wrapping the lite version of miniCycle (ES5, self-contained, no service worker) |
| `full/`           | ✅ Generated  | Complete app, built from `web/` by the build script — full-tab launcher                   |

The lite-based extension ships the lightweight tier of miniCycle inside a 400×600 popup. It's a coherent product on its own — "lightweight version, right in your toolbar" — not a degraded fallback.

The **full** extension is the entire miniCycle app, opened in a normal browser tab from the toolbar icon (the full-screen UI doesn't fit a popup). Unlike `lite/` (a hand-maintained port), `full/` is **generated** by `web/scripts/build-chrome-full.cjs` so it never drifts from the actively-developed app. Regenerate on every release:

```bash
cd web
npm run build:chrome-full      # web/ → chrome/full/
```

### What the build does

MV3 extension pages forbid all inline `<script>` (`script-src 'self'`, no hashes) and don't use page service workers. The transform (content-based, not line-numbers, so it survives HTML edits):

- **Drops** the PWA-only inline blocks: boot-failure cache-clear failsafe, version-change `document.write` reload, and the ~558-line service-worker registration/update machinery.
- **Externalizes** every remaining inline block to `full/ext-boot/NN.js`, replaced in-place so execution order and DOM position are preserved exactly. `version.js` and the `miniCycle-main.js` module entry stay as external refs.
- **Neutralizes** the lite-version fallback redirects (`lite/` isn't bundled; modern Chrome always passes the feature gate anyway).
- **Rewrites** unbundled info links (`legal/`, `pages/`, `tests/`) to absolute `https://minicycle.app/…` URLs so they open the live pages instead of 404ing.
- **Copies** `version.js`, `miniCycle-main.js`, `modules/`, `styles/` verbatim, plus only the **referenced** assets (~0.4 MB of the 1.1 GB `web/assets/`).
- **Generates** the MV3 `manifest.json` + `background.js` (the launcher) and copies icons from `lite/icons/`.

Only runtime external host is `api.web3forms.com` (feedback form) — covered by `host_permissions`. The default MV3 page CSP suffices otherwise.

## Technology

- **Manifest V3** - required for new Chrome Web Store submissions
- **Vanilla JS** (ES5 in the lite popup, intentionally — matches the lite app's compatibility floor)
- **No build step** - load-unpacked development; zip the folder for Web Store upload
- **No background service worker yet** - the popup is fully self-contained
- **Inline SVG icons** - no Font Awesome (CSP would block the CDN anyway)

## Loading for Development

1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Pick `chrome/lite/` (the folder containing `manifest.json`)
5. Pin the extension via the puzzle-piece toolbar icon
6. Click the icon to open the popup

To pick up code changes, click the reload arrow on the extension card at `chrome://extensions`. To reset state, right-click popup → Inspect → Application → Storage → Clear.

## What `lite/` Contains

```text
chrome/lite/
├── manifest.json                   # MV3 manifest, v1.0, popup action
├── miniCycle-lite.html             # Popup HTML (CSP-clean, inline scripts extracted)
├── miniCycle-lite-scripts.js       # Main app logic (ES5, ~4,300 lines)
├── miniCycle-lite-styles.css       # Shared lite stylesheet
├── popup.css                       # Popup-specific overrides (size, focus mode, etc.)
├── popup-notifications.js          # Toast helper (extracted from the inline script)
├── icons/                          # Extension toolbar/store icons
└── assets/                         # Logo files used by the popup
```

## What's Different from `web/lite/`

The `lite/` folder is a **port** of `web/lite/`, not a copy. Specifically:

- All inline `<script>` blocks removed (MV3 CSP forbids them)
- All inline event handlers (`onerror=`, etc.) removed
- Font Awesome CDN removed (CSP would block it; replaced with inline SVG icons in the menu and on the priority indicator)
- PWA service-worker registration deleted (extensions don't use page SWs)
- Asset paths flattened from `../assets/images/logo/...` to `assets/...`
- "Try Full Version" rewritten to open `https://minicycleapp.com` in a new tab via `window.open`
- Empty state copy reframed for the extension context (no auto-redirect language)
- Help window header simplified
- Footer link points to `https://minicycleapp.com`
- Version display: "Chrome Edition v1.0" in the footer; manifest `version: "1.0"` plus `version_name: "Chrome Edition v1.0"`

`popup.css` adds extension-specific styling on top of the shared lite stylesheet:

- Fixed popup dimensions (400×600) with `zoom: 0.85` for compactness
- Custom Tasks/Stats segmented pill (replaces round nav dots)
- z-index fixes so the bottom-bar buttons (Tasks/Stats, Undo, help, dark toggle) actually receive clicks (the lite app's `#task-view` overlay was eating them)
- A **focus mode** that hides the chrome (header, mode selector, corner toggles, Add Tasks button, Tasks/Stats pill, Undo) and lets the task list span the full popup. Toggled via a corner button; state persists to `localStorage`.
- Stats panel polish (no scrollbars when not needed, tighter spacing)

## Manifest Permissions

- `host_permissions: ["https://api.web3forms.com/*"]` - allows the feedback form's XHR to bypass CORS

That's it. No `tabs`, `storage`, `notifications`, or other elevated permissions yet — the popup is a self-contained app that uses `localStorage` for persistence.

## Roadmap

Short-term:

- Web Store submission (requires $5 one-time developer fee)
- Edge Add-ons submission (free)

Possible v1.x additions (decide before implementing):

- Toolbar icon badge showing pending task count (needs `chrome.action.setBadgeText` from a service worker)
- `chrome.alarms` + `chrome.notifications` for recurring task reminders
- Keyboard shortcut to open popup (`chrome.commands`)
- Context menu: "Add to miniCycle" on selected text

Future `full/` edition (separate folder when started):

- Full miniCycle data model (multi-cycle, recurring, due dates, themes)
- Dynamically-imported modules like the web version
- IndexedDB storage with optional sync to the live PWA via a content script on miniCycle.app
- Side panel surface (Chrome 114+) as an alternative to the popup

## Distribution

- **Chrome Web Store** - $5 one-time developer fee, primary channel
- **Edge Add-ons** - free, separate submission required
- **Unpacked** - load from `chrome://extensions` for development and side-loading

## Don't

- Don't import from `web/modules/` - the extension's CSP and execution context differ from the PWA
- Don't reintroduce inline `<script>` blocks or remote stylesheets - MV3 CSP will block them
- Don't keep the lite popup in sync with `web/lite/` automatically - the lite app is intentionally frozen; cherry-pick only what's needed
