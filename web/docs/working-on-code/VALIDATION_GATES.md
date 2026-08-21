# Validation Gates

> **What runs, when it runs, and what a failure actually means.**
>
> Every gate here is zero-dependency (Python stdlib or Node already in the project) and
> runs from `web/`. None of them need a dev server except the test suites.

**Last Updated:** August 11, 2026

---

## The gates at a glance

| Gate | Command | Runs automatically | Blocking? |
|------|---------|--------------------|-----------|
| **CSP coverage** | `npm run validate:csp` | `update-version.sh` (pre-push) | 🔴 **Blocks the release** |
| **HTML validity** | `npm run validate:html` | CI — `performance.yml` | 🔴 Fails CI |
| **Docs links + nav** | `npm run validate:docs` | CI — `performance.yml` | 🔴 Fails CI |
| **Lint** | `npm run lint` | CI — `test.yml` | 🔴 Fails CI on any error, or on warnings above the `--max-warnings` ratchet in `package.json` (lower it after cleanup; never raise it) |
| **Module tests** | `npm test` | CI — `test.yml` | 🔴 Fails CI — stalled modules retry once (see below); assertion failures never do |
| **Real-app gates** | `npm run test:layout` · `test:sw` · `test:meta` · `test:journey` | CI — `test.yml` | 🔴 Fails CI |
| **Performance** | `npm run perf` | CI — `performance.yml` | 🔴 Fails CI |
| **DI declarations** | `npm run validate:di` | CI — `test.yml` | 🟡 Partially gated (undeclared=0, nowhere=0, undeliverable=0, unused ratchet; facade advisory) |
| **Inline scripts** | `npm run validate:inline` | CI — `test.yml` | 🔴 Fails CI — empty catch blocks in miniCycle.html inline scripts must carry an intent comment (ESLint's `no-empty` can't see the file — drift-review D-01) |
| **Comment references** | `npm run validate:comments` | CI — `test.yml` | 🔴 Fails CI — an identifier named in a comment must exist somewhere in the code |
| **Accessibility semantics** | `npm run test:a11y` | CI — `test.yml` | 🔴 Fails CI — a focusable element with a click handler must carry an interactive role AND a key handler; every interactive element must have an accessible name |
| **DI wiring gaps (runtime)** | `npm run test:journey` | CI — `test.yml` | 🔴 Fails CI — a `DI access` or `missing required dep` warning from the real app fails the journey that saw it |
| **Required-dep chaining** | `npm run validate:chains` | CI — `test.yml` | 🔴 Fails CI — a dep declared `required()` must never be read as `deps.x?.` outside a `catch` block |
| **ES built-in floor** | `npm run validate:builtins` | CI — `test.yml` | 🔴 Fails CI — no post-es2020 built-ins in shipped code (esbuild transpiles syntax, not built-ins) |
| **appContext API surface + Quick Actions lists** | `npm run validate:api` | CI — `test.yml` | 🔴 Fails CI — every `get*Api()?.member` read must be a key of the object `featureBoot.js` registers. Those `*ApiObj` literals are hand-written allow-lists: a method the manifest genuinely delivers on `deps.<category>` is still dropped unless named there, the optional chain swallows it, and nothing warns because the manifest side succeeded. Also enforces that `ACTION_REGISTRY`, `VALID_ACTION_IDS` and `ACTION_BUTTON_MAP` agree — three hand-maintained lists where a miss means an action is never counted, with nothing thrown |
| **Label registries** | `npm run validate:labels` | CI — `test.yml` | 🔴 Fails CI — every literal `getLabel()` key must resolve in `defaultLabels.js`; every logged history event type must be in historyManager's icon+label maps |
| **Changelog range** | `npm run test:changelog` | CI — `test.yml` | 🔴 Fails CI — a release entry must not re-list commits an earlier release already shipped; the boundary is the previous `## [x.y.z]` heading, NOT the last git tag — `git describe` answers from the local clone, and a clone whose tags lag the remote widens the range to the whole backlog (measured: v2.447–v2.449 shipped from a container stuck at v2.421) |
| **HTML cache headers** | `npm run validate:cache` | CI — `test.yml` | 🔴 Fails CI — no HTML route may be served with a long cache. Netlify serves every `.html` at an EXTENSIONLESS canonical URL (`/games/foo.html` → `/games/foo`), which does not match the `*.html` header rule and falls through to the `/*` catch-all: `max-age=31536000`. One year, on a document. Measured live Aug 2026 — a deployed fix to `/games/minicycle-taskscramble` could not reach users because the route was cached under the catch-all. The server had the fix; the browser would not ask for it |

---

## 🔴 `validate:csp` — the one that stops a release

**Checks:** every inline `<script>` in the shipped HTML has a matching SHA-256 hash in
**all three** deployment configs — `netlify.toml`, `.htaccess`, `nginx-security.conf`.

**Why it blocks:** editing *any* inline script changes its hash. Ship without regenerating
and the browser refuses to execute that block under CSP — which, for the boot scripts, means
a white screen. `update-version.sh` runs this as a hard pre-push gate for exactly that
reason; it regenerates the hashes itself, so the gate is really a check that regeneration
worked.

**If it fails:** you almost certainly edited an inline script and pushed without
`./scripts/update-version.sh`. Re-run the release script rather than hand-editing hashes.

## 🔴 `validate:html` — W3C (Nu) validity

**Checks:** the maintained pages against `validator.w3.org/nu`. Only **errors** gate;
the pages carry a few intentional warnings (trailing slashes on void elements, redundant
landmark roles).

**Note:** this is the one gate that needs network access. `--dist` validates the built
artifacts instead of source.

## 🔴 `validate:docs` — links, nav, and AI routing

**Checks three things** ([scripts/validate-docs.py](../../scripts/validate-docs.py)):

1. **Broken relative links** — every `[text](path)` in `docs/` resolves on disk.
2. **Sidebar orphans** — every `.md` is reachable from `_sidebar.md`. An unlisted doc is an
   invisible doc.
3. **CLAUDE.md routing** — every `web/docs/…md` path in the **repo-root `CLAUDE.md`**
   resolves.

**Check 3 is the important one.** A stale path there fails *silently* — no error, no broken
page. It just routes an AI session to a file that no longer exists and quietly degrades
every change made afterward.

`archive/` and `vendor/` are excluded: historical snapshots are allowed to point at the
world as it was, and "fixing" them would mean editing archived docs, which
[the archive rule](../../../CLAUDE.md) forbids. Source citations (`gamesManager.js:124`),
paths outside the repo, and malformed link text are classified as non-file links rather than
reported as broken — run with `--list` to see them.

**If it fails:** move the doc back, fix the link, or add the missing `_sidebar.md` entry.
See [CONTRIBUTING §Where a new document goes](../project-info/CONTRIBUTING.md) for which
folder a new doc belongs in.

**Why it exists:** the July 2026 reorganization uncovered rot that had built up silently for
months — 60 broken links, 9 dead sidebar entries, and 22 unreachable docs including 7 of the
12 guides the root `CLAUDE.md` mandates reading. Nothing checked, so nothing surfaced.

## 🟡 `validate:di` — partially gated (July 2026)

**Checks:** module DI declarations against actual usage — deps accessed but not declared in
`moduleManifests.js`, declared but never used, accessed-but-resolvable-nowhere, and
declared-but-undeliverable (no loader route can supply it).

**Gated (exit 1) since the July 2026 drift review** (C-23), which cleared the standing
findings first:

- 🔴 **used-but-undeclared** — must be 0 (was already the hard gate)
- ⚪ **resolvable-nowhere** — must be 0. The 5 standing items were cleared, so any new one
  is a freshly-introduced dead dep. Genuinely runtime-wired deps (no static route the
  scanner can see) go in `RUNTIME_WIRED` in `scripts/validate-di-deps.js` **with their
  wiring call site named** — it's an exemption list, not a mute button.
- 🟡 **declared-but-unused** — ratchet: must not exceed `UNUSED_BASELINE` in the script.
  Lower the baseline after real cleanup; never raise it.
- 🟠 **facade forward-through** — still advisory (facades legitimately forward deps).
- 🟣 **declared-but-undeliverable** — must be 0. Gated from introduction (Aug 2026): the
  count was already 0, so the class was closed at zero cost. This is the **supply** side —
  every other check above tests the consumer against the "known deps" set, and that set is
  built *from* the declarations, so declaring a dep certifies itself and none of them can
  see a dep that nothing actually routes. A manifest `provides` entry is a **claim, not a
  route**: the fix is a `depMappings` entry (or getter) in `moduleLoader.js`, or
  `RUNTIME_WIRED` with the call site named.
  **Precedent:** `clearAllUndoHistory` (Mar 2026) was in undoRedoManager's `provides` *and*
  settingsManager's `optionalDeps` with no `depMappings` entry — so the Settings "Clear Undo
  History" button silently did nothing. Verified by reintroducing it: every other gated
  metric still passed (undeclared 0, nowhere 0, unused at baseline); only this one caught it.

**The diff workflow is still the best review habit** when touching DI wiring — capture
output before your change and after, and look only at what you added:

```bash
npm run validate:di > /tmp/di-before.txt
# ...make your change...
npm run validate:di > /tmp/di-after.txt
diff /tmp/di-before.txt /tmp/di-after.txt   # empty = you introduced no new DI findings
```

That is how the July 2026 `menuManager` wiring change was verified — identical output before
and after proved the new dependency was declared correctly at every layer.

## 🔴 `validate:comments` — the checkable slice of comment rot (Aug 2026)

**Checks:** every identifier a comment names — `` `backticked` ``, `_underscored`, or
`camelCase()` followed by a call paren — exists somewhere in real code
(`modules/`, `tests/`, `scripts/`, root JS). Gated at 0 from introduction.

**Why it exists:** docs have `validate:docs`; inline comments had nothing, and they are
the layer that degrades fastest because they sit next to code that changes. Every instance
we have actually hit is this one shape — a comment naming something that isn't there:

| found | what it said | reality |
|-------|--------------|---------|
| `themeManager` (v2.403) | "see `_saveSetting`" | helper never shipped |
| `taskRenderer` (v2.403) | comment on the wrong dep | `updateSearchVisibility` had moved |
| `coreBoot` | "via `appContext.getAppInit()`" | appContext exports no such function |
| `statsPanel` | "let `updateStats()` handle it" | the function is `updateStatsPanel` |

**What it deliberately cannot do:** tell whether a comment is *true*. A comment can name
only real identifiers and still describe the wrong behaviour — the modal focus-restore
comment claimed its branch restored focus when the call was inert. This gate is the
mechanical slice, not the whole problem.

**Precision over recall.** Bare camelCase without a call paren is *not* scanned — too much
prose collides with it. Four exemptions, each because a false positive would otherwise be
guaranteed:

- **JSDoc declaration tags** (`@param`, `@property`, …) declare names rather than reference them
- **`@example` blocks and indented sample code** are illustrations
- **Historical notes** — "X was removed in v2.354" deliberately names dead things, and the
  project writes these on purpose. *But* an imperative pointer overrides the exemption:
  "see X" / "use X" / "via X" is a claim you can act on now. That distinction is load-bearing
  — the real `_saveSetting` tombstone read *"It **was** also the third live-state mutator in
  this file; see `_saveSetting`"*, so a line-level past-tense check alone would have missed it.
- **`EXTERNAL_APIS`** — browser and third-party names the symbol table cannot know
  (`valueAsDate`, `timeOrigin`, `smallIcon`). Add with a reason; it is an exemption list,
  not a mute button.

**If it fails:** fix the name; or, if the comment describes the past, say so explicitly; or
add a genuinely external API to `EXTERNAL_APIS` in
[scripts/validate-comment-refs.js](../../scripts/validate-comment-refs.js).

---

## 🔴 `validate:labels` — the string registries (Aug 2026)

**Checks two mechanical diffs, gated at 0:** every literal `getLabel('a.b.c')` key in
shipped modules resolves in `DEFAULT_LABELS` (to a string, a `{one, other}` plural
object, or a `{touch, pointer}` device-variant object), and every event type passed to
`logHistoryEvent()` — including `?.()`-style DI calls — has entries in BOTH the icon and
label maps in `historyManager.js`. `LENS_SENSITIVE_KEYS` are cross-checked as a bonus.
Dynamic keys (`getLabel(\`x.${y}\`)`) are counted and reported, never gated.

**Why it exists:** an Aug 2026 external review found three shipped string bugs —
unmapped `undo`/`redo` history types rendering `📌 undo`, a stale toggle label, and a
pluralization miss ("Mode changed + 1 changes") — all living in the one registry class no
validator covered. A label miss is SILENT in production: the resolver warns to console
and ships the raw key as UI text. The reviewer's meta-finding ("every valid finding was a
mechanical diff of two lists") is this gate's design brief.

**Mapped-but-never-logged history types are a warning, not a failure** — stored history
events outlive the code that wrote them, so a map entry for a retired type still renders
users' existing data. Never delete one to silence the info line.

**Pedigree note:** the gate's own first draft had 12 false positives (didn't know the
`{touch, pointer}` label shape) and missed the two real bugs (plain `logHistoryEvent(`
regex can't see `logHistoryEvent?.(`). Both fixed by cross-examining its first run —
trust the gate now, but that history is why its output cites file:line for re-checking.

---

## 🔴 `validate:builtins` — the ES built-in floor (Aug 2026)

**Checks:** no **post-es2020 built-in** appears in shipped code (`modules/` minus
`testing/`, `service-worker.js`, `miniCycle-main.js`, `boot-sw.js`, `version.js`).
Three shapes, matched on the acorn AST so comments can never false-positive:
static methods (`Object.hasOwn`, `Promise.any`, …), globals (`WeakRef`,
`AggregateError`, …), and prototype methods by name (`.at()`, `.replaceAll()`,
`.findLast()`, …). Gated at 0 from introduction.

**Why it exists:** the build target is es2020 and the feature gate admits any browser
with `globalThis` (Chrome 71 / Safari 12.1 / Firefox 65) — but esbuild transpiles
**syntax, not built-ins**, so a newer built-in ships verbatim and throws `TypeError`
on browsers the gate deliberately lets in. **No other gate can see this**: lint has no
target awareness, and Playwright runs modern Chromium, so every test passes.
`Object.hasOwn` nearly shipped in v2.408 through the whole routine-creation path;
on its first clean run the gate caught `.at(-1)` in `undoRedoManager`'s snapshot
capture — undo had been silently broken on Safari ≤ 15.3 since it shipped (the
wrapper's try/catch swallowed the throw on every capture).

**The tell that prompted it:** the near-miss introduced the *first* use of that
built-in in ~136 modules. If nothing else in the codebase uses a method, ask why
before assuming it's fine.

**Special cases:**

- **`structuredClone`** is exempt because `coreBoot.js` installs a Phase-1 polyfill
  before any other module code runs — and the script **verifies the polyfill still
  exists**. Delete it and every `structuredClone` call becomes a finding.
- **`Promise.allSettled`** (backupRestoreManager) *is* es2020 and passes, but arrived
  later than `globalThis` in every engine (Chrome 76 vs 71) — a known, accepted
  straggler; it is not boot-critical.
- **`.with()`** is deliberately not scanned — the name is too generic to flag.

**If it fails:** use the es2020-or-older equivalent
(`Object.prototype.hasOwnProperty.call` for `Object.hasOwn`, `arr[arr.length - 1]`
for `.at(-1)`, a `/g`-regex `.replace` for `.replaceAll`). If the call is genuinely
guarded (`typeof X === 'function'`) or the receiver is a project object whose method
merely shares the name, append `// es2020-ok: <reason>` to the line — after
verifying, not before.

---

## 🔴 `validate:cache` — no HTML route served with a year-long cache

**What it checks:** every deployed `.html` route resolves to a `no-cache` header rule.

**Why it exists — the failure is invisible from the server side.** Netlify serves each `.html` file
at an extensionless canonical URL: `/games/foo.html` is reachable as `/games/foo`. That
extensionless form does **not** match a `*.html` header rule, so unless some rule names it
explicitly it falls through to the `/*` catch-all — which sets `public, max-age=31536000`.

Measured on live `minicycle.app`, Aug 2026: a fix deployed to `/games/minicycle-taskscramble` never
reached users, because the route had already been cached for a year under the catch-all. Nothing was
broken on the server. The browser simply had no reason to ask again — and for a year, wouldn't.

`netlify.toml` no-caches six HTML scopes by hand (`*.html`, `/`, `/pages/*`, `/minicycle`,
`/legal/*`, `/blog`). The failure mode is adding a **seventh** HTML route somewhere those six don't
reach, which is silent: the page works, deploys fine, and only stops updating.

**Also runs against a live deploy** — `python3 scripts/validate-cache-headers.py --live https://minicycle.app`
checks the headers a real request receives, rather than what the config says it should.

**When it fails:** add a header rule naming the new route's scope in `web/netlify.toml`. Do not fix
it by renaming the file.

---

## 🔁 `npm test` retries stalls — and only stalls

A module occasionally produces **no Results line at all** and is reported as
`0/1`. That is not a failing test — it means nothing ran. It has been landing on
a different module every run (Aug 2026: `modalManager`, `keyboardNav`,
`taskValidation`, `basicPluginSystem`, `notificationDialogHost` and others, each
passing standalone), and it once turned a docs-only PR red.

The runner now retries such a module **once**, on a fresh page, with the
cold-start budget.

**What is never retried:** a module that RAN and had assertions fail. Those
return normally with counts and never reach the retry path, so a real regression
cannot be papered over by re-running. The retry is keyed strictly on Playwright's
`TimeoutError`.

**Retries are never silent.** The module's summary row is tagged `🔁 retried`, and
a block after the table names each retried module and its first-attempt error. A
green run that needed retries is visibly different from a healthy one.

**If you see `🔁` in CI:** the run is green and the code is fine, but the
environment stalled. Repeated retries on the *same* module mean something real —
that module is genuinely slow or hanging, and its budget or its test setup needs
looking at, not another retry.

---

## 🔴 Real-app gates — the four suites `npm test` doesn't run

`npm test` runs the module suites against `tests/module-test-suite.html`. CI runs four
more, and each spawns **its own server on its own port** — they need no `npm start`:

| Suite | Guards |
|-------|--------|
| `test:sw` | Offline boot (honest offline + lying-`navigator.onLine` circuit breaker) and **precache drift** |
| `test:layout` | Centred-panel overlap + measured-var (`--header-total-height`) publish guard, across 7 viewports |
| `test:meta` | Static: every local `test()` harness awaits async bodies; every test asserts (or declares no-throw in its name) |
| `test:journey` | End-to-end on the real app: add tasks → reload → complete a cycle → offline reload |

### The precache drift guard — run `test:sw` whenever you add a module file

It walks the boot graph and fails if a reachable module is missing from `BOOT_CRITICAL` in
`service-worker.js`, or an `@import`ed stylesheet from `CSS_FILES`.

**The rule:** a **static** import from anything already boot-critical makes the new file
boot-critical too. The browser fetches it during boot, so if it isn't precached, an offline
boot goes to the network for it. `PRECACHE_EXEMPT` is only for genuinely lazy modules —
dynamic `import()` behind a user interaction.

**Why this needs saying:** nothing else catches it. Adding a module passes `npm test`,
`lint`, and every `validate:*` gate while leaving offline boot broken.

**Precedent (Aug 2026):** `modules/utils/styleValidators.js` shipped green through the full
3056-test browser suite and all five `validate:*` gates, then failed CI here — it was a
static import of `routineLoader.js`, itself `BOOT_CRITICAL`. Fixed in v2.384.

---

## Running everything locally

```bash
cd web
npm run validate:csp && npm run validate:html && npm run validate:docs && npm run lint
npm run validate:di && npm run validate:legacy && npm run validate:inline
```

The module suite needs a server; the four real-app suites start their own:

```bash
npm start        # separate terminal — port 8080
npm test
npm run test:sw && npm run test:layout && npm run test:meta && npm run test:journey
```

## Related

- [MAKING_CODE_CHANGES.md](MAKING_CODE_CHANGES.md) — the 4-layer DI pipeline `validate:di` inspects
- [CONTRIBUTING.md](../project-info/CONTRIBUTING.md) — where a new doc goes
- [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md) — what the release script does
- [TESTING_GUIDE.md](TESTING_GUIDE.md) — the test suites in depth
