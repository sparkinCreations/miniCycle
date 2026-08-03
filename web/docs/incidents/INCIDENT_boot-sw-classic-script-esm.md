# INCIDENT — v2.346: boot-sw.js SyntaxError killed SW registration in production

**Date:** Aug 3, 2026 · **Broken release:** v2.346 · **Fixed:** v2.347 (~30 min later)
**Reported by:** MJ, from the live console:
`boot-sw-B6X7N6P7.js:1 Uncaught SyntaxError: Cannot use import statement outside a module`

## Impact

The entire service-worker layer was dead on production page loads: no SW
registration for new visitors (no offline, no precache), no update management,
no `verifyVersionFresh()` healing, no PWA install handler, and the orchestrator
logged `SW ready check failed: SW ready timeout`. The app itself still booted
(boot does not require the SW). Existing installs kept their previously
registered v2.345 worker serving caches, so the blast radius was mostly
new/fresh visitors during the ~30-minute window. Recovery for affected pages is
organic: the next navigation fetches v2.347 HTML (served no-store).

## Root cause

v2.346 extracted the inline SW-registration block into `boot-sw.js`, loaded as
a **classic** `<script defer>`. The build added it to the shared esbuild pass —
which has `keepNames: true` and `splitting: true`. `keepNames` injects a
`__name` helper into every file; `splitting` dedupes that helper into a shared
chunk; therefore **every entry in that pass begins with a static `import`**,
including boot-sw. A classic script cannot parse `import` → SyntaxError at
line 1 → none of the file executed.

## Why the gates missed it

Every existing gate passed honestly — none of them *execute the bundled
artifact in a browser*:

- `node --check` parses the **source** (valid), not the bundled output.
- `test:sw` runs against the **dev tree** (raw source, no bundling).
- The dist inspection checked the tag rewrite, HTTP 200, and SW precache
  membership — presence, not parseability.
- The live boot verification ran on the **dev server**, where boot-sw is served
  as authored and works.

The one check that would have caught it — loading `dist/` in a browser — was
skipped. (Ironically, the "hashed entries can be re-export facades" lesson was
recorded the same day, from a *read* of dist output, without connecting it to
the classic-script tag.)

## Fix (v2.347)

1. **`boot-sw.js` gets its own esbuild pass** in `build-web.cjs`: `bundle` +
   `format: 'iife'`, no splitting — one self-contained hashed file with zero
   chunk dependencies (a boot script should not depend on the chunk graph
   anyway). Its hash feeds the existing module-map → `rewriteHtml` → SW
   precache plumbing unchanged.
2. Its stable path `dist/boot-sw.js` is now the **raw classic source copy**
   (shim generation skips it) — anything loading the stable path classically
   gets working code.

## Prevention

1. **Build-time parse gate:** after the IIFE pass, `build-web.cjs` greps the
   hashed output for leading `import`/`export` statements and **fails the
   build** if any appear — the exact failure shape can no longer ship.
2. **Process rule — execute dist before shipping build-pipeline changes:**
   `npm run build:web`, then `preview` the `miniCycle-dist` config (port 8082)
   and confirm: app boots, `serviceWorker.getRegistrations().length === 1`,
   the four `window.*` SW helpers exist, zero console errors. This is now part
   of the release verification for any change touching `build-web.cjs`,
   `boot-sw.js`, the SW, or the HTML head.

## Lesson

Same family as the review's error log: **every gate verified an artifact
adjacent to the one that broke.** Source parsed, dev executed, dist enumerated
— but the bundled file was never run. When a change alters what the build
*emits*, the emitted thing must be executed, not inspected.
