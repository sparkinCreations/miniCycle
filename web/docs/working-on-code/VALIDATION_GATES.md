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
