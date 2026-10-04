# HTML Bootstrap Responsibility Reduction Plan

**Status:** PLAN — not started  
**Created:** October 4, 2026  
**Revised:** October 4, 2026 — review pass: added the Phase 0 schema-key gate,
withdrew the `getBuildVersion()` move, split Phase 3, added revert boundaries,
renamed the new file `boot-shell.js` → `preboot-ui.js`  
**Baseline:** miniCycle v2.583  
**Primary file:** [`miniCycle.html`](../../miniCycle.html)

## Decision in one sentence

Reduce `miniCycle.html` by moving **post-parse behavior** behind one tested,
content-hashed classic boot file, while leaving **pre-paint decisions, independent
failure nets, and semantic shell markup** in the HTML.

This is a responsibility reduction, not a line-count exercise. The HTML is large
because it is currently four things at once:

1. the document and accessible application shell;
2. an ordered compatibility/version bootstrap;
3. a first-run controller and backup importer;
4. a collection of runtime utilities and watchdogs.

The first two partly belong there. The last two mostly do not.

## Why this plan exists

The current file is working and heavily defended by production lessons. Its size
alone is not a defect. The problem is change coupling:

- editing any inline script changes the production CSP hashes;
- code above the feature gate must remain ES5-parseable;
- boot order controls whether stale modules enter the browser module map;
- first-run behavior shares a file with cache recovery and old-browser routing;
- inline behavior is outside the normal ESLint/module-test workflow;
- a small onboarding edit therefore carries boot, CSP, release, and offline risk.

At the v2.583 baseline, `miniCycle.html` contains 15 inline script blocks. The two
largest post-gate blocks are the first-run controller and loader-tip controller.
Together they account for roughly 17.5 KB of source JavaScript and are ordinary
DOM behavior, not pre-paint decisions. That is the clearest seam.

### What extraction does NOT fix, and why Phase 0 gained a gate

A worked counterexample, found while scoping this plan (Oct 2026) and fixed at
v2.583: the pre-paint first-run reader asked for `parsed.data.cycles` to decide
whether the user already owns a routine. Schema 2.6 renamed that key to
`data.routine` and `schemaMigration26` **deletes** the old one, so `hasRoutines`
was permanently false for every migrated user from v2.573 onward — silently
disabling the established-user escape hatch that exists because
`firstRunChoiceMade` and `onboardingCompleted` can both fail to write. The
12-line comment arguing for that backstop survived the rename; the code did not.

Three things that bug establishes, and they shape the plan:

1. **It was in a keep-inline block.** This plan would have shipped straight past
   it. Extraction is not a schema-correctness strategy.
2. **Every existing journey stayed green**, because they all seed through the
   choice screen or via "learn" — both of which set the graduation flags, so the
   backstop was never the signal under test.
3. **Extraction concentrates the risk.** Of the nine blocks that survive Phase 3,
   the benign DOM behavior is gone and what remains is version, storage, and
   schema reads. Two of those nine read roughly seven distinct schema paths
   (`settings.darkMode`, `.reducedMotion`, `.highContrast`, `.fontSize`,
   `.customColors.appBg`, `.onboardingCompleted`, `data.routine`) — spelled
   literally, because inline ES5 cannot import the `cycleMode.js` accessors that
   exist precisely so a rename lands in one file.

So the inline region ends this plan *more* concentrated in the one failure class
no gate can currently see. Phase 0 therefore adds a static schema-key gate
(step 5). That gate, not the extraction, is what would have caught the bug above
— and it is the only item here that protects the blocks this plan deliberately
leaves behind.

Existing plans do not cover this boundary:

- [BOOT_PERF_ROADMAP.md](BOOT_PERF_ROADMAP.md) addresses module initialization
  and deferral, not ownership of the HTML bootstrap.
- [LITE_MCYC_IMPORT_AND_ADOPT_PLAN.md](LITE_MCYC_IMPORT_AND_ADOPT_PLAN.md) adds to
  the first-run path, but assumes the current inline controller remains its home.
- [WELCOME_SCREEN_PLAN.md](WELCOME_SCREEN_PLAN.md) records why some first-frame
  decisions must remain pre-paint; it does not plan an extraction.
- [LARGE_MODULE_SPLITS_PLAN.md](LARGE_MODULE_SPLITS_PLAN.md) is closed and explicitly
  says new responsibility drift should open a new plan rather than revive it.

## The boundary: what stays and what moves

### Keep inline in `miniCycle.html`

These blocks earn their place because moving them behind another request would
change first paint, make a failure net depend on the file it is meant to protect,
or violate the ordered version contract.

| Responsibility | Why it stays inline |
|---|---|
| Async main-CSS media swap | Must run beside the stylesheet tag with no extra dependency. |
| iOS standalone class | Must be applied before layout/paint to avoid safe-area movement. |
| Boot-failure counter and emergency cache recovery | Must still run when the normal boot graph or an external boot helper fails. |
| Version-mismatch interstitial | Must stop parsing before modulepreloads can populate the module map with stale URLs. |
| Modulepreload injection | Its position after version recovery and before application boot is load-bearing. |
| Pre-paint settings reader | Prevents dark-mode, accessibility, font-size, and background flashes. |
| Pending-restore applier + first-run decision | Must update storage and apply `html.mc-first-run` before the first frame. |
| ES2020 syntax canary + feature gate | Must remain isolated and parse-safe for the browsers being redirected to Lite. |
| Independent boot watchdog | A last-resort redirect cannot rely solely on an external file loading successfully. |

The goal is not to merge all of these into one large script. Separate failure
domains are useful here: one runtime exception should not suppress every later
guard. The current pre-gate parse contract remains authoritative.

### Move out of `miniCycle.html`

| Responsibility | Proposed owner | Reason |
|---|---|---|
| Loader-tip fetch, rotation, collision measurement, and cleanup | New `preboot-ui.js` | Post-DOM behavior with listeners and timers; independently testable and lintable. |
| First-run choice handlers | New `preboot-ui.js` | Ordinary event handling after the pre-paint decision has already been made. |
| Preboot welcome-splash construction and watchdog | New `preboot-ui.js` initially | Keeps exact early behavior while removing the 13 KB controller from HTML; a later measured pass may share more with `onboardingSplash.js`. |
| First-run backup file reading and format normalization | New `preboot-ui.js`, using a pure helper if tests justify one | Parsing/import behavior is not a pre-paint responsibility. The pending-restore **application** remains inline on the next navigation. |
| Initial About-dialog version/SW query | Delete if characterization confirms the existing `modalManager.setupAboutModal()` path is sufficient | The modal manager already performs the same work when the dialog opens. Closed dialogs do not need an eager SW query. |

`getBuildVersion()` was previously listed here as moving into `version.js`. It is
**withdrawn** — see "Rejected: moving `getBuildVersion()`" below. It stays inline.

### Do not move merely to make the file shorter

- Static landmarks, app chrome, panels, dialogs, and the first-frame loader remain
  declarative HTML unless a separate measurement proves a surface is truly
  deferred and does not need to exist for boot, accessibility, or focus wiring.
- Do not turn visible shell markup into JavaScript strings. That trades readable
  HTML for harder accessibility review and recreates the same responsibility in a
  less appropriate file.
- Do not move pre-paint state reads into the main module graph. A later flash-free
  rewrite would need its own measured design.
- Do not combine this work with semantic-control cleanup (`div[role=button]` to
  native buttons). That is worthwhile, but it changes interaction behavior and
  would make extraction regressions harder to isolate.

### Rejected: moving `getBuildVersion()`

An earlier draft moved the helper's definition into `version.js` on the reasoning
that version infrastructure belongs with the version source. That is tidier and
it is wrong, for a reason the draft's four invariants did not cover.

[`service-worker.js`](../../service-worker.js) carries `versionJsBody()` — a
**synthetic `version.js`**, used by "every fallback path when the real file is
unreachable." It emits `APP_VERSION`, `CACHE_VERSION` and, in the bundled build,
`__MC_MODULE_MAP`. It does not emit `getBuildVersion`.

Both consumers guard for absence, silently:

```js
// boot-sw.js (two call sites) and modules/ui/modalManager.js
const buildVersion = (typeof window.getBuildVersion === 'function')
  ? window.getBuildVersion() : APP_VERSION;
```

So on any synthetic-`version.js` path the helper is undefined, both consumers
fall back to `APP_VERSION` — the service worker's own inlined constant — and the
About dialog and update check begin reporting the network version instead of the
loaded HTML build. That inverts the exact guarantee the helper exists to provide,
in the degraded path that is the only place it matters, with no error and no
warning. It is the same failure shape as the schema bug above: a `typeof` guard
masking a wiring failure rather than surfacing it.

`versionJsBody()` could be taught to emit the helper too, but then its definition
lives in two places that must stay in sync, one of them a string literal inside
the service worker. That is strictly worse than one inline definition.
`preboot-ui.js` is not a better home either: it would make `preboot-ui` /
`boot-sw` document order load-bearing, which is the coupling this plan exists to
reduce.

**Decision:** the helper stays inline in `miniCycle.html`. If it is ever revisited,
the prerequisite is making both consumers fail loudly instead of falling back, so
the next attempt cannot go quiet.

## Target architecture

```text
miniCycle.html
├── metadata, preload/style links, manifest
├── ordered pre-paint/version/compatibility gauntlet (inline)
├── semantic loader + application shell markup
├── tiny first-run latch (only if timing proves it is needed inline)
├── preboot-ui.js (classic, defer, content-hashed in production)
├── boot-sw.js    (classic, defer, content-hashed in production)
└── miniCycle-main.js (module entrypoint)

preboot-ui.js
├── loader-tip controller
├── first-run choice controller
├── preboot splash bridge
└── first-run backup file reader/normalizer
```

`preboot-ui.js` is deliberately a **classic deferred script**, not another
manifest module:

- it must be available before the application module graph finishes booting;
- it must work while first-run `AppState` is intentionally not ready;
- it has no DI dependencies and should not pretend to be a feature module;
- a classic IIFE gives it the same failure isolation as `boot-sw.js`.

It should expose no new public `window.*` API. Coordination remains through the
existing DOM state (`mc-first-run`, `data-awaiting-choice`, session/local storage)
and the `firstrun:choice` event.

## Execution plan

### Phase 0 — Freeze behavior before moving it

1. Record fresh source metrics; do not use this document's v2.583 snapshot as a
   permanent line-count target.
2. Add focused tests for behavior that currently exists only inside the HTML:
   - loader tips use the correct `firstRun` vs `inApp` pool;
   - rotation stops and listeners are removed after `data-app-loaded=true`;
   - every first-run choice disables the choice set, records both handoff flags,
     changes the selected button to its busy label, and dispatches exactly one
     `firstrun:choice` event;
   - create/sample mount or request the preboot splash while learn does not;
   - both supported backup formats normalize to the same allowlisted key map;
   - invalid JSON, unknown formats, and storage failures do not mutate durable data.
3. Keep the existing journey coverage for first-run restore, first-run state
   readiness, factory-reset rearming, and all three first-run destinations.
4. Add a production-build assertion that every classic boot entry named by the
   HTML is content-hashed, self-contained, and precached.
5. **Add a static schema-key gate over the inline blocks** (`validate:inline`
   extension, or `validate:schema-keys` if it reads better standalone). This is
   the one Phase 0 item that is not characterization, and it is the highest-value
   item in the plan — see "What extraction does NOT fix" above for the bug that
   motivated it.
   - Extract every stored-key path read by an inline block: `data.routine`,
     `data.cycles`, `settings.<key>`, `appState.<key>`, and the bare
     `localStorage` / `sessionStorage` key names.
   - Assert each one resolves against the current schema. The fresh-install shape
     in [`migrationManager.js`](../../modules/routine/migrationManager.js)
     (`createInitialSchema25Data`) plus `SCHEMA.CURRENT` are the authority; a path
     present in neither is a failure.
   - Allow a deliberate dual-read (2.5 + 2.6, which the first-run reader needs
     because it runs before migration) only when the block carries an explicit
     marker comment naming why. An unmarked legacy-only read fails.
   - Gate at 0. This cannot be a ratchet: a single stale path is a silently dead
     feature, which is the entire failure mode.
6. Characterize the footer About block's **second** job before Phase 1 deletes it.
   It does two things — the version text and the service worker `GET_VERSION`
   MessageChannel query. The query is almost certainly redundant, but "nothing
   else assumed that channel had been warmed" is an assertion to verify, not to
   assume.

**Exit gate:** the characterization tests fail when each corresponding current
behavior is deliberately disabled. A green test written only after the move is
not enough evidence. For the schema gate specifically, prove it by reverting the
v2.583 `data.routine` read to `data.cycles` and confirming the gate fails.

### Phase 1 — Remove duplication without changing loading

1. Verify the About dialog always refreshes build and SW versions through
   [`modalManager.js`](../../modules/ui/modalManager.js) when it opens.
2. Delete the footer's eager About-version inline block if that test is green
   **and** Phase 0 step 6 confirmed nothing depends on its SW `GET_VERSION` query.
3. Correct stale comments that call body scripts "pre-gate" even though they sit
   below the explicit ES5-region boundary. (The v2.583 first-run reader comment is
   already corrected; the restore handler below it still says "pre-gate".)
4. `getBuildVersion()` stays where it is — see "Rejected: moving
   `getBuildVersion()`". Phase 1 is now a two-item phase; that is fine. Do not
   pad it back out to justify its existence.

**Exit gate:** stale-build recovery tests and About-dialog tests pass with the
footer block absent.

### Phase 2 — Teach the production build about multiple classic boot entries

Do this before extracting behavior. A plain copied `preboot-ui.js?v=...` would
work in development but would violate the production build's content-identity
model.

1. Generalize the dedicated `boot-sw.js` IIFE pass in
   [`build-web.cjs`](../../scripts/build-web.cjs) to a small explicit list of
   classic boot entries: initially `boot-sw.js` and `preboot-ui.js`.
2. Produce a standalone content-hashed IIFE for each entry. Do not allow shared
   static imports between classic entries.
3. Add every classic entry to the module map and generated precache.
4. Rewrite each matching HTML `src` attribute to its hashed production URL.
5. Run the existing parse guard against every generated classic artifact: no
   top-level `import` or `export` may survive.
6. Add the new source file to ESLint and the source service worker's
   `BOOT_CRITICAL` list; let the build keep generating the production list.
7. Assert the production HTML contains no stable or query-versioned request for
   the new file.

**Exit gate:** a clean offline production build boots with both classic files
served from the generated precache, and the source/dev app still uses the normal
readable files.

### Phase 3 — Extract the post-DOM first-run shell

Split into two shipped releases. The two moves differ by an order of magnitude in
blast radius and should not share a revert boundary: the loader-tip controller
touches no storage and no durable state, while the first-run controller writes
graduation flags and stages a restore that overwrites `miniCycleData`. Pushing
them together means a defect in the second is only revertable by also reverting
the first.

#### Phase 3a — loader-tip controller only

1. Move it without rewriting it.
2. Give it one cleanup path for its interval, its deferred swap timeout, and its
   resize/orientation listeners.
3. Ship it. Let it sit through at least one release before 3b.

**Exit gate:** correct pool (`firstRun` vs `inApp`), collision suppression still
re-measures per tip and per viewport change, rotation and listeners stop on
`data-app-loaded=true` unless `data-awaiting-choice=true`.

#### Phase 3b — first-run controller, splash bridge, and restore reader

1. Move choice behavior, splash construction, and backup-file handling without
   changing storage keys, event names, timing, or error copy.
2. The synchronous latch that prevents `uiBoot.hideAppLoader()` from dismissing
   the loader before a pick **is safe by ordering semantics, not by luck** —
   write the argument down rather than relying on a test that could pass on a
   fast machine for the wrong reason:
   - deferred classic scripts all execute *before* `DOMContentLoaded` fires;
   - [`orchestrator.js`](../../modules/boot/orchestrator.js) starts boot *on*
     `DOMContentLoaded` at the earliest (`readyState === 'loading'` →
     `addEventListener('DOMContentLoaded', startOrchestrator)`);
   - `hideAppLoader()` runs in `uiBoot`, boot Phase 3, well after that.
   So a `defer` script placed before the module entry is guaranteed to have run
   before boot begins. Keep a test, but as a regression guard on that reasoning,
   not as the reasoning itself.
3. Only if that reasoning is ever invalidated: keep a tiny inline latch applying
   `first-run-mode` and `data-awaiting-choice=true`. Do not keep the full
   controller inline to avoid a ten-line latch.
4. Give the external controller one cleanup path for intervals, timeouts, resize/
   orientation listeners, file readers, and the preboot splash pointer handler.
5. Keep the pending-restore applier in the head. The extracted file writes the
   normalized handoff; the next navigation's inline pre-paint block applies it.
6. Keep strings hardcoded only where the label system is genuinely unavailable.
   Record those strings in one clearly named section rather than scattering them
   through event handlers.

**Exit gate:** create, sample, learn, reload-before-choice, both restore formats,
factory-reset rearming, slow boot, offline boot, and reduced-motion behavior match
the baseline with no loader flash or duplicate splash.

### Phase 4 — Consolidate the two Lite watchdogs, only with fault injection

The 16-second "boot never started" fallback and 60-second "loader never
finished" fallback are related but intentionally different. Consolidation is
allowed only after tests can independently force and observe both states.

1. Extract their shared forced-full detection into one local helper.
2. Keep two timers and their distinct semantics:
   - 16 seconds: redirect only when boot never started; forced-full opts out;
   - 60 seconds: redirect when loading never finishes, including forced-full.
3. Keep the watchdog inline and dependency-free.
4. Prove that a syntax error or 404 in `preboot-ui.js`, `boot-sw.js`, and the main
   module graph still leaves at least one valid route to Lite.

If fault injection cannot prove those cases, leave the two blocks separate. One
small duplication is cheaper than weakening the last recovery path.

### Phase 5 — Optional static-markup audit

This phase is not required to close the responsibility plan.

Audit only large, initially hidden surfaces that already load their behavior on
demand. Use the existing [`modalTemplates.js`](../../modules/boot/modalTemplates.js)
pattern when—and only when—the surface can be injected before its manager needs
it without changing focus order, accessible relationships, first paint, or
offline behavior.

Likely audit candidates are testing/diagnostic-only surfaces. The main header,
task view, stats shell, navigation, live regions, and first-run choice markup are
not candidates merely because they occupy lines.

### Revert boundaries

Every phase must be revertable in one commit, and the plan must not be entered
without that being true. Push is a production deploy, so a defect that reaches
`main` is live for every user until the next release — there is no staging gate
to catch it and no flag to turn it off.

| Phase | Revert | Notes |
|---|---|---|
| 0 | Trivial | Tests and gates only; no runtime file changes. |
| 1 | One commit | Restore the footer block; its CSP hash returns with it. |
| 2 | One commit | Build-only. Revert before any HTML references a second classic entry, or the revert must also drop that reference. |
| 3a | One commit | Re-inline the loader-tip block. No durable state involved. |
| 3b | One commit | Re-inline the first-run controller. **Check for staged `miniCycle_pendingRestore` payloads written by the extracted version before reverting** — the inline applier reads the same shape, so a revert mid-restore is safe only because the handoff format is unchanged. Never change that format in the same release as the move. |
| 4 | One commit | Watchdogs are self-contained. |
| 5 | Per-surface | Each injected surface reverts independently. |

Any phase that cannot meet this is not ready to ship.

## Coordination with other future work

### Lite import/adoption plan

[LITE_MCYC_IMPORT_AND_ADOPT_PLAN.md](LITE_MCYC_IMPORT_AND_ADOPT_PLAN.md) currently
targets the inline first-run controller.

- If Lite adoption ships first, Phase 0 must characterize the new adopt choice and
  Phase 3 moves it with the rest of the controller.
- If this plan ships first, update the Lite plan's target from
  `miniCycle.html` to `preboot-ui.js`; do not reintroduce a large inline handler.
- The pre-paint decision remains unaware of Lite data unless that plan proves a
  first-frame requirement. Detection for whether to render/enable an adopt action
  belongs in the extracted controller by default.

### Boot performance roadmap

Extraction must be performance-neutral or better. It is not a reason to add an
unhashed request, delay the first-run latch, or move more work onto the main
module critical path. Compare cold and warm results using the methodology in
[BOOT_PERF_ROADMAP.md](BOOT_PERF_ROADMAP.md).

## Validation matrix

Run after every phase that changes runtime files:

```bash
cd web
npm run lint
npm run validate:inline      # incl. the Phase 0 schema-key gate
npm run validate:csp
npm run validate:html
npm run build:web
npm run validate:html:dist
npm run test:sw              # BOOT_CRITICAL drift — every new classic entry
npm run test:journey
npm run test:a11y
npm run test:layout
npm test
```

`validate:csp` will fail on every phase that edits an inline block, by design —
that is the signal the change must ship through
`scripts/update-version.sh`, not a bare push. Treat a *passing* `validate:csp`
after an inline edit as the anomaly.

Also perform these targeted manual/fault checks:

| Scenario | Required result |
|---|---|
| Fresh storage, normal network | Choice screen is present in the first frame; no loader-to-choice shift. |
| Reload before choosing | Choice screen returns; boot-created empty data does not bypass it. |
| Create / sample / learn | Same destination and splash behavior as the baseline. |
| Restore each backup format | One normalized handoff, one reload, restored routines intact. |
| Offline returning launch | Full app boots from cache; no new uncached classic-script dependency. |
| Offline first launch after install | First-run controls work from the precache. |
| Stale HTML + fresh `version.js` | Running build reports the HTML meta version and self-heals once. |
| `preboot-ui.js` blocked | Inline watchdog still reaches an understandable fallback. |
| `boot-sw.js` blocked | Application boot and late fallback behavior remain deterministic. |
| Main module blocked | 16-second/60-second paths retain their distinct behavior. |
| Forced-full user | No 16-second bounce to Lite; 60-second hung-load safety net remains. |
| Reduced motion / dark mode / custom background | No first-frame regression or preference flash. |

## Performance and reliability budgets

The refactor is rejected or revised if it causes any of the following:

- a new production request that is neither content-hashed nor precached;
- a measurable first-run layout shift attributable to late `mc-first-run` or
  `data-awaiting-choice` application;
- an increase in cold `appLoaded` time outside normal run-to-run variance;
- a window where visible first-run buttons have no handler without an explicit
  disabled/loading state;
- loss of the Lite route when any one external boot file fails;
- duplicate first-run events, splashes, timers, or file-import handling;
- a new public global used only to bridge the extracted file back to modules.

## Done means

This plan is complete when:

1. `miniCycle.html` owns document structure, critical pre-paint decisions, ordered
   version/compatibility boot, and independent recovery—not general UI behavior.
2. Loader tips and first-run interaction/restore behavior live in a linted,
   directly tested external file.
3. The eager About-version inline block is gone or has a documented unique job
   that `modalManager` cannot perform.
4. **Every stored-key path read by a surviving inline block is covered by the
   schema-key gate at 0**, and the gate is proven to fail on a deliberately stale
   path. This is the criterion that outlives the extraction: the inline region
   will still read schema keys after this plan closes, and that gate is the only
   thing that can see them.
5. Production rewrites and precaches every classic boot entry by content hash.
6. Existing boot, offline, first-run, restore, layout, and accessibility suites
   pass, plus the new characterization/fault-injection coverage.
7. First-paint and cold-boot measurements show no regression.
8. The file-map banner and architecture docs describe the new ownership model —
   including that `getBuildVersion()` stays inline *deliberately*, with a pointer
   to the rejection rationale. A future reader who finds a six-line helper in the
   head will otherwise re-propose the move that this plan already rejected.

Expected source shrinkage is useful evidence, not the acceptance criterion. At
the v2.583 snapshot, removing the two large post-gate controllers plus duplicated
About/version setup should reduce inline JavaScript substantially. If the final
HTML remains long because its semantic shell is long, that is acceptable.

## Related documentation

- [VALIDATION_GATES.md](../working-on-code/VALIDATION_GATES.md) — inline/CSP/HTML
  gates that must remain green.
- [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md) — content hashing, module map,
  and HTML rewrite contract.
- [PWA_OFFLINE_ARCHITECTURE.md](../deployment/PWA_OFFLINE_ARCHITECTURE.md) — offline
  boot and build-version truth.
- [SERVICE_WORKER_UPDATE_STRATEGY.md](../deployment/SERVICE_WORKER_UPDATE_STRATEGY.md)
  — stale-build recovery constraints.
- [REVIEW_PATTERNS.md](../reference/REVIEW_PATTERNS.md) — verify behavior by running
  it; do not accept a move because the code merely looks equivalent.
