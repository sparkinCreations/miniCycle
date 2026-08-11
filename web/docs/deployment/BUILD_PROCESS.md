# Build Process (esbuild Release Pipeline)

> **Since v2.294 (July 14 2026)** miniCycle ships a bundled build; **since v2.301–v2.302
> (July 19 2026)** that build is fully **content-hashed** (entry hashing + module map + CSS
> bundle), and v2.302 is the **first VERIFIED bundled production deploy** (see the
> deploy-config discovery below). Plan & history:
> [`docs/archive/BUILD_PIPELINE_PLAN.md`](../archive/BUILD_PIPELINE_PLAN.md).
> This is the operational guide: how it works, how to verify it, and what not to break.

---

## The two worlds

```
DEV   npm start            → python serves web/ — pristine source, ?v= cache-busting,
                              no build step, all tests run against source. UNCHANGED.

PROD  push to main         → Netlify runs the build (per ROOT netlify.toml) and
                              publishes web/dist/ (bundled, minified, hashed)
```

**Nothing about local development changed.** `dist/` is gitignored and only exists on
Netlify (or when you run the build locally to verify). The `?v=` mechanism now exists
**for dev only** — production cache identity comes from content hashes.

---

## ⚠️ Deploy authority: the ROOT netlify.toml (July 19 2026 discovery)

Netlify reads build config **only from the repo root or the site's base directory**.
`web/netlify.toml`'s `[build]` block was silently ignored for months — production was
publishing the **raw `web/` source tree** while that file's `[[headers]]`/`[[redirects]]`
still applied (it ships inside the published folder, where Netlify processes deploy-file
config). That made the setup look healthy (CSP updates went live!) while the build never ran.

The fix and current contract:

- **Repo-root `netlify.toml`** pins `base = "web"`, `publish = "dist"`, and the build
  command with `npm install --include=dev` (esbuild is a devDependency — survives a
  `NODE_ENV=production` site setting). **This file is the build authority. Do not delete it.**
- **`web/netlify.toml`** keeps headers (update-version.sh's CSP stage writes it); the
  build copies it into `dist/` where its `[[headers]]` keep being processed from the
  deploy files. **Its `[[redirects]]` are NOT processed** (July 31 2026 discovery, docs
  subdomain rollout): redirect rules only take effect from **`web/_redirects`**, which
  is the redirect authority — the toml's minicycleapp.com rules only ever worked via
  their `_redirects` duplicates. New redirects go in `_redirects`, forced (`!`) if they
  must beat static files, and **above** the root/SPA catch-all rules (first match wins).
- A source→dist flip (or any change to what gets published) **requires a version+cache
  bump**: at the same version, the new SW precaches different bytes into the SAME cache
  namespace non-atomically, with no version signal for the heal machinery to detect.
- **Verifying a deploy means checking the ARTIFACT SHAPE, not the version number** —
  version.js reads identically on a source deploy and a dist deploy. Real checks:
  the HTML `<script src>` points into `/build/…`, `/build/` files return 200 with
  `cache-control: … immutable`, `package.json`/`scripts/`/`docs/` return **404**
  (they're excluded from dist; if they're reachable, you're serving raw source).

---

## The release rule (unchanged)

**Every push to `main` is a production deploy.** But a deploy is NOT a release:

- A bare `git push` of app code produces a **half-dark deploy** — and post-pipeline it's
  worse than half-dark: changed chunk hashes alter the SW precache list, so the SW updates
  and re-precaches **into the same cache namespace, non-atomically**, with no version
  signal — an undetectable mixed cache if interrupted.
- **App-code changes ship ONLY via** `./scripts/update-version.sh --auto --push --changelog`
  (bumps APP_VERSION + CACHE_VERSION, recomputes CSP hashes, commits, tags, pushes).
- Docs-only commits may be pushed directly — they deploy but change nothing users run.

---

## What `scripts/build-web.cjs` does

`npm run build:web` (or Netlify automatically):

1. **Entry points = EVERY module** (`modules/**/*.js` + `miniCycle-main.js`, ~133) — not
   just dynamic-import targets, because the stable-path shims (below) must cover every
   module the production testing modal imports directly. A dynamic-import specifier scan
   still runs as **validation** (build fails loudly on unresolvable specifiers).
2. **Bundles with esbuild** — `format: esm`, `splitting: true`, `minify: true`,
   `keepNames: true`, `sourcemap: true`, target es2020. **The target lowers
   SYNTAX only — built-ins are never polyfilled**: `Object.hasOwn` or `.at()`
   ships verbatim and throws on browsers the feature gate admits (floor =
   `globalThis`, Chrome 71 / Safari 12.1). `npm run validate:builtins` gates
   this in CI; see `docs/working-on-code/VALIDATION_GATES.md`.
   - **ALL hashed output lands under `dist/build/`**: entries as
     `build/[dir]/[name]-[hash].js`, shared chunks as `build/chunks/chunk-[hash].js`,
     and the CSS bundle as `build/styles/main-[hash].css`. One path prefix drives the
     netlify `immutable` header and the SW's cache-first branch.
   - `splitting` keeps shared code single-instance regardless of entry count.
3. **CSS bundle**: `styles/main.css` + its 44 `@import`s → one hashed file. The build
   strips `?v=` from `@import url()`s so esbuild can resolve them; `url()` assets rebase
   via file loaders with `assetNames: '[dir]/[name]'` (same paths as the static copy —
   no duplication). `critical.css` and `fonts.css` stay separate — see step 6.
4. **Module map**: appends `globalThis.__MC_MODULE_MAP = {…}` (source path → hashed URL)
   to `dist/version.js`, and injects the same map into the dist SW (markers) so the SW's
   **synthetic version.js fallback** carries it. The map is the ONLY indirection —
   importers reference source paths, only the map knows hashes, so there is no hash
   cascade. At runtime, `withV()` (coreBoot) resolves through the map and uses hashed
   URLs **BARE** — matching the SW precache key, which is what killed the `?v=`
   page-fetch vs precache double-fetch.
5. **Stable-path shims**: every module also gets a tiny `export * from '<hashed>'` file
   at its original `/modules/…` path so the **production testing modal's** direct
   source-path imports keep working. Shims are not precached.
6. **HTML rewrites** (dist copy only; inline **script** content byte-identical → CSP
   hashes stay valid):
   - `miniCycle-main.js` script src + all `main.css` hrefs → hashed `/build/` URLs
   - **`critical.css` and `fonts.css` are INLINED** as `<style>` blocks (their fetches
     were the render-blocking chain gating LCP; CSP allows inline styles). Their
     relative `url()`s are rebased to root-absolute.
   - The now-dead `@import`-children preload hints are stripped.
7. **SW injections** between marker comments in the dist copy: `BOOT_CRITICAL` (hashed
   entries + chunks), `CSS_FILES` (the hashed bundle), and `MODULE_MAP`. The hand lists
   in source are the DEV lists — do not remove any markers.

Output: ~133 entries + ~30 chunks + 1 CSS bundle, **3.4MB JS → ~1.47MB minified**.

### Boot-retry freshness (deliberate exception)

`orchestrator.js` keeps its `${vParam}` tail ON TOP of the mapped URL — the boot-retry
teardown depends on distinct URLs yielding fresh module instances. `vParam` is `''` on a
normal map-world boot (bare URLs) and `?v=<ver>.rN` on retries. `withV()` mirrors this
(bare normally; suffixed on retry, including offline retries — hashed files serve
cache-first from the SW regardless of query).

---

## Docs site (`docs.minicycle.app`)

`docs/` is excluded from the blanket static copy and published by a dedicated pass
(`copyDocs()` in `build-web.cjs`). Since July 31 2026 the docsify site is served on
**its own origin, `docs.minicycle.app`** (a host rewrite in `_redirects` maps the
subdomain onto `/docs/`; old `minicycle.app/docs/*` URLs 301 there). The move exists
for storage isolation: docsify's search plugin stores a multi-MB full-text index in
`localStorage`, and on the app origin it competed with user routines for the same
~5MB quota. The app additionally sweeps orphaned `docsify.*` keys at boot (uiBoot).

**Withheld from the published copy** — still in the repo, still on GitHub, just not on the
product domain:

| Withheld | Why |
|---|---|
| `archive/` | historical snapshots — large, deliberately stale |
| `future-work/` | unshipped plans |
| `incidents/` | internal postmortems |
| `DEVELOPER_PROFILE.md` | personal |

Two things make a *partial* publish safe, and both are load-bearing:

1. **The sidebar is filtered.** docsify is client-side — it fetches `_sidebar.md` and every
   `.md` over HTTP at runtime. Copying a subset without filtering nav would render entries
   that 404. Sections left with no children are dropped entirely.
2. **Body links into withheld folders are repointed to GitHub.** Prose links (and the odd
   `../../../LICENSE` that escapes `docs/`) would otherwise dangle. The repo is public, so
   the reader still lands on the real document. ~65 links per build.

A **build gate** then walks every published `.md` and fails the build on any dead relative
link — a published nav entry that 404s is worse than no docs site at all.

> **History:** before July 19 2026 Netlify published the raw `web/` tree, so `/docs` worked
> by accident — the same accident that served `package.json` and `scripts/`. Making the
> build authoritative ended that, and `/docs` 404'd until this pass was added.


## Gotchas — learned the hard way, do not "simplify" these

1. **esbuild does NOT pass template dynamic imports through.** `` import(`./x.js?v=${V}`) ``
   becomes a compiled glob-map lookup that **throws "Module not found in bundle"** at runtime
   when the glob matched nothing (query strings never match files).
2. **`splitting` relocates code into chunks**, so RELATIVE runtime specifiers resolve to the
   wrong place from chunk files.
3. Therefore the build plugin rewrites every runtime specifier to a **root-absolute** path
   wrapped in a `(__MC_MODULE_MAP[abs] || <original form>)` expression — map hit wins, bare;
   miss falls back to the original `?v=` form (dev semantics).
4. **`minify` constant-folds `(0,'x')` and `String('x')` back into literals**, which esbuild
   then tries to bundle-resolve (and fails). Forms verified to survive: property-access
   expressions, templates containing a real `${expr}`, and `['x'].join('')`.
5. `keepNames: true` is mandatory — the DI layer string-matches export/class names.
6. Root-absolute specifiers assume the app is served at the **domain root**.
7. **Font-preload `crossorigin` is REQUIRED even same-origin** (miniCycle.html preloads
   poppins-400/500/600) or the preload is double-fetched and wasted.

---

## Verifying a build locally

```bash
npm run build:web                 # → web/dist/ in ~4s
npm run preview:dist              # serves dist/ on :8081  (or the miniCycle-dist launch config)
```

Then open it on a **fresh origin** (never-visited port or incognito — a previously-visited
origin's SW serves stale files and will gaslight you). Check: app boots, choice screen /
routing works, recurring panel + settings open (facade dynamic-import chains), testing modal
opens AND its direct module imports resolve (shim path — try a statically-only module like
diBase), no console errors, no 404s, **all `/build/` requests are BARE (no `?v=`)**. The
Boot Timing view (Settings → Testing) shows a NETWORK section — a healthy warm run reads
`networked 0 (0KB)`.

Full source test suite is unaffected by the pipeline and must stay green: `npm test`.

---

## Interactions to keep in mind

| System | Interaction |
|---|---|
| `update-version.sh` | Unchanged duties (versions, CSP hashes, tag, push) — but its `?v=` rewrites now matter for DEV only; prod cache identity is the content hash. Its push triggers the Netlify build. |
| CSP | Build never edits inline **script** content — script hashes stay valid. It DOES add inline `<style>` blocks (allowed: style-src has 'unsafe-inline') and rewrite attributes. |
| Service worker | Source SW = dev lists; dist SW = generated lists + MODULE_MAP. `/build/` paths get a cache-first immutable branch (a changed file always has a new name — mixed old/new module graphs are unrepresentable). First-install `controllerchange` does NOT reload (v2.308) — new visitors boot once. |
| Tests in production | `tests/` is copied into dist; direct source-path imports resolve via the stable-path shims. Source-invariant tests that grep un-minified code may fail on dist — known, acceptable. |
| Netlify functions | Untouched (`netlify/functions`, bundled by Netlify itself). |
| lite/ | Copied as-is (frozen, never bundled). |

## Remaining (optional) — see plan doc

Phase 4 `?v=`-guard cleanup in the SW (careful: dev still uses `?v=`) · CSS hand-purge
(~13KiB, risky with vocab-theme runtime classes) · old-device cold-trace re-measure.
