# Build Pipeline (Bundle + Hash + Generated Precache) — Plan

**Status:** PLAN (July 11, 2026). **Supersedes `MINIFICATION_PLAN.md`** (June 15 — per-file terser,
no bundling). Written after the r/website feedback thread (see `FEEDBACK_TODO_2026_07.md` P0) and
the July cold-load measurements. Companion to `BOOT_PERF_ROADMAP.md`.

## Why the June plan is superseded

MINIFICATION_PLAN chose per-file minification *without* bundling to keep the SW precache list and
`ensureModuleLoaded` paths stable. Two later findings change the trade:

1. **The measured problem is round trips, not bytes** (noguchilin's diagnosis, validated in-thread):
   ~74 JS files resolved through serial native import chains, each level adding a round trip.
   Per-file minification shrinks bytes but keeps every round trip — it doesn't fix what users feel.
2. **Measured July 11 (fresh Playwright context + CDP RTT emulation):** 146 JS requests on first
   visit — ~73 page files fetched **twice** (page load + SW precache are separate fetches),
   6.17MB first-visit transfer; app-usable 2.0–2.6s local at +40/80ms RTT, and ~850ms production
   TTFB on top (noguchilin). The June "cold 17s = SW precache storm" instrumentation finding is the
   same phenomenon.

Bundling with **content-hashed filenames** + a **generated precache list** fixes the waterfall AND
the double-fetch AND retires the `?v=` cache-busting mechanism — the root cause of the
versioned-import **split-instance bug class** (boot-retry criticals C1/C2, the labelResolver bare-vs-
versioned trap, the facade sub-module version split). One build step kills a whole bug family.

## Constraints (what the design must preserve)

- **Dev stays no-build.** `npm start` serves pristine source; all dev/debug workflows unchanged.
  The build produces a `dist/` copy for release only (same posture as the June plan).
- **Runtime-computed import specifiers.** `moduleLoader` does `import(withV(manifest.path))` —
  opaque to any bundler's static analysis. Facades (taskCore/taskDOM/settingsManager/
  preferencesManager) dynamically import sub-modules the same way. These paths must keep working.
- **DI name-matching.** The DI layer string-matches export names (`set<Name>Dependencies`,
  `init<Name>`); registries use `constructor.name`. Minify with `keep_names` (esbuild) — same
  rationale as the June plan's terser config.
- **CSP hashes** cover inline HTML scripts only. The build must not rewrite inline script *content*
  (rewriting a `src` attribute is fine — hashes don't cover attributes).
- **Offline/iOS:** hashed immutable files + browser HTTP cache actually *improve* the iOS
  dead-SW offline path (files valid forever; no `?v=` mismatch possible).
- **`version.js` stays** as version display + SW cache-name source (no-store). It stops being a
  cache-buster.
- **Tests** import modules directly with a cache-buster — they run against *source* in dev and CI.
  A dist smoke pass is a build gate (below), not a test-suite rewrite.

## Design

`scripts/build-web.cjs` (esbuild; sibling of `build-chrome-full.cjs`):

1. **Entry points:** `miniCycle-main.js` + every `moduleManifests.js` path + every facade
   sub-module + boot modules imported via computed specifiers (orchestrator's boot imports).
   Generate the entry list *from* `moduleManifests.js` + a small static list — never hand-maintain.
2. **esbuild config:** `format: 'esm'`, `bundle: true`, `splitting: true` (shared code → common
   chunks, imported once), `minify: true`, `keep_names: true`, `entryNames: '[dir]/[name]-[hash]'`,
   `chunkNames: 'chunks/[name]-[hash]'`, source maps on.
3. **Module map:** build emits `module-map.json` (`'../ui/focusTaskPanel.js'` → hashed URL).
   `withV()` gains a map-aware branch: if a build-injected map is present (fetched no-store at
   boot, or inlined into the SW-precached shell), resolve through it; else append `?v=` (dev).
   This is the ONLY runtime code change the pipeline needs.
4. **HTML:** copy as-is except rewriting the `miniCycle-main.js?v=` script src to the hashed entry
   (attribute rewrite — CSP hashes unaffected). All inline scripts byte-identical.
5. **Generated precache:** build walks `dist/` output and injects the file list into the existing
   hand-rolled `service-worker.js` at a `/* __PRECACHE_MANIFEST__ */` placeholder. We keep our SW
   (offline-aware recovery, cache-first nav, verifyVersionFresh) — Workbox's *injectManifest idea*
   without adopting Workbox runtime. Hashed files precache once and never re-download unchanged
   content across versions (the double-fetch becomes browser-cache hits).
6. **Headers (netlify.toml):** hashed patterns (`/chunks/*`, `*-[hash].js`) →
   `Cache-Control: public, max-age=31536000, immutable`. HTML/version.js/SW stay no-store.
   Flip `publish = "dist"`, `command = "npm install && node scripts/build-web.cjs"`.
7. **Untouched:** `lite/` (frozen), `pages/` marketing JS, `netlify/functions/` (esbuild already),
   `tests/` (dev origin), games (small, separate pages — optional later).

```
DEV:   npm start → python over web/ (source, ?v=, unchanged)
PROD:  Netlify → build-web.cjs → dist/ (bundled, hashed, generated precache)
```

## CSS (same pipeline, second phase)

- Bundle the 44 files: `main.css` already `@import`s most — esbuild bundles CSS entries the same
  way (hashed output, HTML link rewrite).
- **Purge only by hand**, using the PurifyCSS report as a map (FEEDBACK_TODO P0 caveat: vocab
  themes/icon swaps/personalization apply classes at runtime — verify every theme + dynamic state).

## Phases & gates

- **Phase 0 — Measure (before any code):** record baselines — PageSpeed on minicycle.app, boot
  timing modal numbers, the July 11 fresh-context measurements, request count + transfer size.
  These are the before/after proof (and the Reddit follow-up post material).
- **Phase 1 — Build to dist, verify locally:** build → serve `dist/` on a fresh origin → app
  boots, SW installs, offline reload works, focus/recurring/settings/themes exercised; full
  Playwright suite against source stays green (unchanged); dist smoke suite (boot + core flows).
- **Phase 2 — CSS bundle** (+ optional hand-purge) with the same gates.
- **Phase 3 — Netlify preview deploy** → verify preview URL (update flow from a *previous* version
  especially: old client + new hashed deploy → version gate → clean upgrade) → flip production.
- **Phase 4 — Measure again**, update PROJECT_STATS, retire `?v=` docs/lessons references, mark
  MINIFICATION_PLAN superseded-and-done, post the follow-up.

## Risks

| Risk | Mitigation |
|---|---|
| Bundler misses a computed-specifier module → 404 at runtime | Entry list generated from manifests + validated: build fails if any `manifest.path` or facade sub-module lacks an output entry |
| Old cached HTML requests old hashed files after deploy | Old hashes stay in the deploy for one release window (build keeps previous manifest's files), or rely on version gate: HTML is no-store, so stale HTML is rare; test explicitly in Phase 3 |
| `keep_names` gap breaks DI string-matching | Same names policy as June plan; dist smoke suite exercises DI wiring at boot (validator warnings = failure) |
| SW placeholder injection drifts from SW edits | Injection is anchored to a marked placeholder; build fails loudly if the marker is missing |
| update-version.sh interplay | Script keeps bumping APP_VERSION/CACHE_VERSION (display + SW cache name); it stops rewriting `?v=` in HTML once the src rewrite is build-owned |

## Explicitly out of scope

SVGO pass, W3C error fixes, hero/concept rework, mobile font default (all tracked in
`FEEDBACK_TODO_2026_07.md`), i18n resource compilation (`I18N_LANGUAGE_PACK_PLAN.md`),
minifying the Chrome/Android shells.
