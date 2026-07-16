# Build Process (esbuild Release Pipeline)

> **Since v2.294 (July 14 2026)** miniCycle deploys a **bundled build**, not raw source.
> Plan & history: [`docs/future-work/BUILD_PIPELINE_PLAN.md`](../future-work/BUILD_PIPELINE_PLAN.md).
> This is the operational guide: how it works, how to verify it, and what not to break.

---

## The two worlds

```
DEV   npm start            → python serves web/ — pristine source, ?v= cache-busting,
                              no build step, all tests run against source. UNCHANGED.

PROD  push to main         → Netlify runs: npm install && node scripts/build-web.cjs
                              → publishes web/dist/  (bundled, minified, ~25s build)
```

**Nothing about local development changed.** `dist/` is gitignored and only exists on
Netlify (or when you run the build locally to verify).

---

## ⚠️ The release rule (post-pipeline)

**Every push to `main` is a production deploy.** But a deploy is NOT a release:

- A bare `git push` of app code produces a **half-dark deploy** — new visitors get the new
  build, while every existing user's service worker (CACHE_VERSION unchanged) keeps serving
  the old one. The version gate sees no APP_VERSION change, so installed clients never update.
- **App-code changes ship ONLY via** `./scripts/update-version.sh --auto --push --changelog`
  (bumps APP_VERSION + CACHE_VERSION, recomputes CSP hashes, commits, tags, pushes).
- Docs-only commits may be pushed directly — they deploy but change nothing users run.

---

## What `scripts/build-web.cjs` does

`npm run build:web` (or Netlify automatically):

1. **Collects entry points** (~107) — never hand-maintained:
   - every `path:` in `moduleManifests.js` (the manifest-loaded modules)
   - every dynamic-import specifier found by scanning `modules/**/*.js` + `miniCycle-main.js`
     (facade sub-modules, boot chain, utility lazy-loads) — comments stripped so JSDoc
     `import('./types.js')` typedefs don't count
   - build **fails loudly** if any specifier doesn't resolve to a real file
2. **Bundles with esbuild** — `format: esm`, `splitting: true`, `minify: true`,
   `keepNames: true`, `sourcemap: true`, target es2020:
   - **Entries keep their real paths** (`modules/ui/statsPanel.js` stays at that URL) so the
     ~60 runtime-computed `import(withV(…))` specifiers keep resolving — zero runtime changes
   - **Shared code goes to content-hashed chunks** (`modules/chunks/chunk-[hash].js`),
     served with `Cache-Control: immutable` (rule already in netlify.toml)
3. **Rewrites runtime import specifiers** (build-time plugin; source untouched) — see gotchas
4. **Copies everything else** (HTML byte-identical → CSP hashes stay valid; styles, assets,
   tests, lite/, examples/, plus non-JS files under modules/ like `loading-tips.json`)
5. **Regenerates the SW precache list**: replaces the `BOOT_CRITICAL` array between the
   `__BUILD_JS_PRECACHE_START__` / `__BUILD_JS_PRECACHE_END__` markers in the **dist copy**
   of service-worker.js with the actual built entries + chunks. The hand list in source is
   the DEV list — do not remove the markers.

Output: ~107 entries + ~18 chunks, **3.4MB JS → 1.43MB minified**.

---

## Gotchas — learned the hard way, do not "simplify" these

1. **esbuild does NOT pass template dynamic imports through.** `` import(`./x.js?v=${V}`) ``
   becomes a compiled glob-map lookup that **throws "Module not found in bundle"** at runtime
   when the glob matched nothing (query strings never match files). This would have killed all
   ~53 `?v=` imports.
2. **`splitting` relocates code into chunks**, so RELATIVE runtime specifiers
   (`'./coreBoot.js'` from code now living in `modules/chunks/`) resolve to the wrong place.
3. Therefore the build plugin rewrites every runtime specifier to a **root-absolute** path
   (`/modules/…`) — location-independent — in a **fold-proof wrapper**, because:
4. **`minify` constant-folds `(0,'x')` and `String('x')` back into literals**, which esbuild
   then tries to bundle-resolve (and fails). The only forms verified to survive minification
   as runtime imports: templates containing a real `${expr}`, and `['x'].join('')`.
5. `keepNames: true` is mandatory — the DI layer string-matches export/class names
   (`set<Name>Dependencies`, `constructor.name`).
6. Root-absolute specifiers assume the app is served at the **domain root** (true for
   Netlify, the Apache mirror, and all dev servers).

---

## Verifying a build locally

```bash
npm run build:web                 # → web/dist/ in ~3s
npm run preview:dist              # serves dist/ on :8081
```

Then open it on a **fresh origin** (never-visited port or incognito — a previously-visited
origin's SW serves stale files and will gaslight you). Check: app boots, choice screen /
routing works, recurring panel + settings open (facade dynamic-import chains), testing modal
opens (deferred module), no console errors, no 404s. The Boot Timing view
(Settings → Testing) shows a NETWORK section — a healthy warm run reads `networked 0 (0KB)`.

Full source test suite is unaffected by the pipeline and must stay green: `npm test`.

---

## Interactions to keep in mind

| System | Interaction |
|---|---|
| `update-version.sh` | Unchanged duties (versions, CSP hashes, tag, push). The push it makes triggers the Netlify build. |
| CSP | Build never edits HTML content, only copies it — inline-script hashes stay valid. |
| Service worker | Source SW = dev precache list; dist SW = generated list. SW logic itself is identical. |
| Tests in production | `tests/` is copied into dist; behavioral tests run against bundled entries. Source-invariant tests that grep un-minified code may fail on dist — known, acceptable. |
| Netlify functions | Untouched (`netlify/functions`, bundled by Netlify itself). |
| lite/ | Copied as-is (frozen, never bundled). |

## Not done yet (see plan doc)

CSS bundling (90 files still individual) · full entry-hashing (kills the `?v=` page-fetch vs
bare-precache double-fetch) · old-device warm-boot work (per-request SW overhead, pre-boot
window) — all tracked in `BUILD_PIPELINE_PLAN.md`.
