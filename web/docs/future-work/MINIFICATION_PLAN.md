# Minification (Deploy-Time Release Step) — Plan

> ⚠️ **SUPERSEDED (July 2026) by `BUILD_PIPELINE_PLAN.md`.** This plan chose per-file
> minification without bundling; the r/website feedback + July cold-load measurements showed the
> real cost is import-chain round trips and the SW precache double-fetch, which only bundling +
> content-hashed filenames fix. The DI-safety analysis below (keep-names, what must not be touched)
> still applies and is referenced by the successor plan.

**Status:** PLAN (June 15 2026). The high-ceiling structural lever from `BOOT_PERF_ROADMAP.md` —
cuts parse cost across **every** boot phase (~3.4 MB unminified JS) with no per-feature regression
surface. Bonus: obfuscation aligns with the proprietary license.

## Constraint that shapes everything

miniCycle is **no-build / source = deployed**. Current Netlify config (`web/netlify.toml`):
`[build] command = "npm install"`, `publish = "."`, base = `web/`. So minification must be a
**deploy-time step that produces a minified COPY** — dev keeps serving pristine source
(`npm start` / python over `web/`), Netlify publishes the minified copy. We never minify in place.

## Design

A `scripts/build-web.cjs` (sibling of `build-chrome-full.cjs`) that:
1. Copies `web/` → `web/dist/` (preserving the exact directory structure, so every relative
   `import './x.js'` and dynamic `import('./x.js?v=V')` still resolves).
2. **Minifies** `dist/modules/**/*.js` + `dist/miniCycle-main.js` per-file with terser
   (NOT bundled — the SW precache list + `ensureModuleLoaded` rely on stable per-file paths).
3. **Leaves untouched:** all `*.html` (and their inline scripts → **CSP hashes stay valid**),
   `version.js` + `service-worker.js` (no-store, version source of truth — minify later if ever),
   `*.json`, `assets/`, `styles/` (v1 = JS only; CSS minification is a cheap follow-up), the
   `lite/` tree (frozen), `netlify/functions/` (esbuild handles those), `pages/` marketing JS.

Then `web/netlify.toml`: `command = "npm install && node scripts/build-web.cjs"`,
`publish = "dist"`. `dist/` is gitignored (regenerated on every deploy).

```
DEV:   npm start → python over web/ (pristine source, unchanged)
PROD:  Netlify → npm install → build-web.cjs → publish web/dist (minified)
```

## terser config — MUST be conservative (DI safety)

The DI system discovers functions by **export name string-matching** (`set<Name>Dependencies`,
`init<Name>`, `findSetDependenciesFunction`) and the codebase uses class/function names at runtime
(registries, debug markers, `constructor.name`). So:

```js
terser.minify(code, {
  module: true,            // ES module in/out; preserves import/export + tree-shapes safely
  compress: { /* defaults; drop_console: false (boot logs are diagnostic) */ },
  mangle: { /* locals only */ },
  keep_classnames: true,   // registries / constructor.name rely on these
  keep_fnames: true,       // DI string-matches export/function names
  format: { comments: false }
})
```
This still removes whitespace + comments + mangles **local** vars (the bulk of the 3.4 MB) while
keeping every name the DI/registry layer depends on. Start safe; tighten later only with proof.

## Why the module graph survives

- Per-file minify → paths unchanged → static `import './x.js'` resolves in `dist/`.
- Dynamic `import('./x.js?v=V')` — terser never rewrites the specifier string; `dist/x.js` is
  minified at the same path. ✓
- SW precaches whatever's served (minified in prod) — content-agnostic. ✓
- CSP hashes are for **inline HTML scripts**, which build-web.cjs does NOT touch. ✓
- `?v=` cache-busting + `update-version.sh` unaffected (it edits source; Netlify minifies the copy).

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| terser mangles a name the DI string-matches | `keep_classnames` + `keep_fnames` (config above); verify with the full test suite against `dist/` |
| Broken build ⇒ broken DEPLOY (publish flips to `dist/`) | **Build + serve `dist/` LOCALLY and pass the full Playwright suite BEFORE touching netlify.toml.** The netlify flip is the LAST step. |
| Prod console errors hard to trace (no source maps) | v1: skip source maps (pristine source is in git). Follow-up: emit `.map` + `//# sourceMappingURL`. |
| `dist/` accidentally served in dev | gitignore `dist/`; dev path never references it |
| Netlify build time / `npm install` already runs | terser is fast (per-file, ~106 files); negligible added build time |

## Verification (gating, in order)

1. `node scripts/build-web.cjs` → inspect `dist/` (structure mirrors `web/`, modules minified, HTML/inline-scripts byte-identical).
2. Serve `dist/` (`cd dist && python3 -m http.server 8081`) → app boots, recurring/panel/settings work, version gate fires, SW registers, Boot Timing modal works.
3. **Full Playwright suite against `dist/`** (point the runner at :8081) — all green.
4. Measure: Boot Timing on `dist/` vs source — confirm Features/parse drop.
5. ONLY THEN: flip `netlify.toml` (`command` + `publish`), deploy to a **branch/preview** first if possible, verify the Netlify preview URL, then merge.

## Rollout steps

1. `npm i -D terser` (web/package.json devDep) + `"build:web": "node scripts/build-web.cjs"` + `"preview:dist": "cd dist && python3 -m http.server 8081"`.
2. Write `scripts/build-web.cjs` (copy + per-file terser, skip-list above).
3. `.gitignore` → `dist/`.
4. Local verify (steps 1–4 above).
5. Flip `netlify.toml`; deploy to preview; verify; merge.

## Out of scope (follow-ups)
- CSS minification (csso/clean-css) — smaller win, JS parse is the target.
- Source maps for prod debugging.
- Minifying `service-worker.js` / the chrome-full build.
- Mangling export names (needs a DI-name allowlist; risky — only with measured proof).
