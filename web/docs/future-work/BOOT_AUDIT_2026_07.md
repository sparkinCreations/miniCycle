# Boot Pipeline Audit — July 2026

**Date:** July 7, 2026
**Scope:** orchestrator.js, coreBoot.js, featureBoot.js, uiBoot.js, moduleLoader.js, moduleManifests.js, modalTemplates.js (~7,300 lines)
**Method:** 3 parallel reviewers (orchestrator / DI wiring / phases 1–3), each verifying findings by reading both sides of every claim (destroy implementations, consumers, providers). DI findings were additionally script-verified: all 51 manifests cross-checked against every resolution path in `buildModuleDependencies()`.
**Related:** `docs/architecture/UNDO_REDO_ARCHITECTURE.md` (March 2026 `clearAllUndoHistory` incident — the bug class that motivated the DI sweep), `DIRECT_DOM_AUDIT.md`, `LARGE_MODULE_SPLITS_PLAN.md`

---

## Key insight: the truthy-closure trap

A `depMappings` closure whose inner path never resolves (wrong deps group, missing `provides`, missing `provideInstance`) is **worse than a missing entry**: the closure itself is truthy, so consumer guards like `if (this.deps.x)` PASS, and the call inside silently no-ops via `?.`. The guard is defeated by the very wiring layer it's guarding against. Several findings below survived precisely because of this.

---

## CRITICAL — retry machinery — ✅ ALL FIXED July 7, 2026 (same-day follow-up pass)

**Fixes applied (see sections below for the original findings):**
- **C1:** `loadedModules`/`moduleInstances` now live on `globalThis.__miniCycleModuleRegistry` — one registry per page, shared across every moduleLoader instance regardless of `?v=` suffix (same cross-instance strategy as featureBoot's HTML event bridge; deliberate boot-infrastructure exception to the no-globals rule). Verified end-to-end in the live app: a `?v=X.r2`-imported instance's `destroyAllModules()` destroyed attempt-1 modules (dailyResetManager `initialized` flipped false) and `clearLoadedModules()` emptied the shared maps.
- **C2:** orchestrator bumps `globalThis.__miniCycleBootGeneration` at the start of every `runBootSequence()` attempt (BEFORE imports, so the zombie halts ASAP). moduleLoader checkpoints: per-module in `loadPhase` Stage 2, between phases in `loadAllModules`, and in `ensureModuleLoaded` (a stale instance must not wire deferred modules with outdated `_bootDeps`). `assertBootGenerationCurrent()` is exported and contract-pinned by tests; all checks no-op when the global is undefined (unit-test contexts). Residual exposure: one in-flight module init between checkpoints — acceptable.
- **C3:** the no-init branch of `initializeModule` now (a) registers `provideInstance` (previously init-fn-branch only), and (b) registers any provided singleton exposing `destroy()` into `moduleInstances` (composite wrapper if several) — so destroy-on-retry reaches no-init modules like dailyResetManager.
- **M4:** the two deferred-feature capture stubs in `uiBoot.setupDeferredFeatureTriggers` now use `replaceStoredEventListener` (keyed on `document`) — no duplication on retry, and only the newest boot's `ensure` closure is ever attached.

Original findings preserved below for context.

## CRITICAL — retry machinery (original findings)

### C1. `destroyAllModules()` on boot retry targets the wrong moduleLoader instance

- **Where:** `orchestrator.js:655, 669–674` + `moduleLoader.js:102–103, 1731–1750`
- On retry, `vParam` changes (`?v=X.rN` online, `''` offline), so `import('./moduleLoader.js' + vParam)` loads a **fresh ES module instance** whose `loadedModules`/`moduleInstances` maps are empty. Attempt 1's modules were registered in the `?v=X` instance (featureBoot/coreBoot import moduleLoader via `withV()` with the attempt-1 suffix). `destroyAllModules()` therefore iterates an empty map and destroys nothing: attempt 1's DOM listeners and timers survive, attempt 2 re-adds everything → duplicated handlers, orphaned intervals. The "CRITICAL FIX" comments at orchestrator.js:668–707 describe cleanup that structurally cannot happen. (The `deps.core.AppState.destroy()` at :684 DOES work — `deps` persists across attempts.)
- This is the versioned-import split-instance bug class (see lessons-learned) in a new disguise: two *different version suffixes* instead of versioned-vs-bare.
- **Fix direction:** persist the module registries somewhere version-suffix-independent — the featureBoot HTML event bridge (featureBoot.js:31–105) is the proven in-repo pattern (mutable object on `document`/`globalThis`, dataset once-guard). Confirmed independently by all 3 reviewers.

### C2. Timed-out phase is never cancelled; zombie attempt races the retry on the shared `deps` container

- **Where:** `orchestrator.js:274–284` (withTimeout), `:661–708` (deps deliberately reused), `:938–939` (retry 2s later)
- `withTimeout` rejects but cannot cancel the phase; there is no abort flag or generation counter anywhere. A Phase 2 that times out at 30s keeps running; the retry begins repopulating the same `deps` object at ~32s; the zombie's late writes land **over** attempt 2's fresh instances (last-writer-wins), and its module `init()`s add a second listener set. Compounded by C1. Matches the slow-device failure class from the load-perf investigation.
- **Fix direction:** attempt-generation counter checked at each phase boundary + before any `deps` write; fix together with C1.

### C3. `destroyAllModules` can't see no-init-function modules

- **Where:** `moduleLoader.js:399–441, 1731`
- `moduleInstances` is only populated in the init-fn branch. Modules with no `init*` export (dailyResetManager*, backupManager, errorHandler, consoleCapture, routineLoader, taskUI, uiEffects, taskInteractions, modalRegistry, backupReminder, …) never enter the map, so their `destroy()` is never called on retry. dailyResetManager HAS timers and a `destroy()` — silently skipped. Also: `provideInstance` is only registered in the init-fn branch — a future no-init module with `provideInstance` would silently never register.
  - *dailyResetManager actually exports an init — verify the current no-init list when fixing; the structural gap is what matters.
- Moot while C1 makes the whole destroy pass a no-op; becomes live the moment C1 is fixed. **Fix together with C1.**

---

## HIGH — silent DI no-ops (March bug class) — ✅ ALL FIXED July 7, 2026

| # | Dep | Defect | User impact | Fix applied |
|---|-----|--------|-------------|-------------|
| D1 | `syncRecurringStateToDOM` | Exported by taskDOM (:1802) but missing from manifest `provides` → mapping resolved undefined; consumer guard defeated by truthy closure (recurringSettingsApplicator.js:160) | After applying recurring settings, task DOM recurring state never synced | Added to taskDOM `provides` |
| D2 | `hideTaskButtons` | Mapped to `deps.task` but taskUI registers under `api: 'ui'` | Touch drag never force-hides sibling task option buttons (dragDropManager.js:293) | Mapping → `deps.ui` |
| D3 | `DataValidator` | Injected as lazy *accessor function*, consumed as *class* → `DataValidator?.validateTask` undefined → guard fails | **`.mcyc` import validation via DataValidator silently skipped** (fallback sanitize still ran) | `resolveDataValidator()` unwrap helper in cycleImportManager (both sites); tolerates class-or-accessor |
| D4 | `setupDueDateButtonInteraction` | Mapping reads `deps.features.dueDates.…` but dueDates manifest had no `provideInstance` | After mode change rebuilds task buttons, due-date open/close interaction never re-attached (modeManager.js:220) | Added `provideInstance: 'dueDates'` |
| D5 | `createInitialSchema25Data` | Mapping probed `deps.utils`/`deps.cycle`; real value registered at `deps.core` (coreBoot.js:283) | routineLoader's missing-data repair path dead (first-run unaffected — appInit has own copy) | Mapping probes `deps.core` first |
| D6 | `generateHashId` | In CORE_DEPS but never registered in `deps.utils` (coreBoot registered `generateId` only) | notifications fell back to internal hash; warning suppressed for future consumers | Registered in coreBoot next to `generateId`; depMappings fallback to `GlobalUtils` |
| D7 | `toggleHoverTaskOptions` | 3 of 4 pipeline layers missing (not in taskDOM provides, no depMappings entry, not in settingsManager manifest optionalDeps) | Hover-task-options settings toggle never invoked taskDOM's live toggle | All 3 layers added |

### D8. The systemic gap — ✅ FIXED (partially)

Both boot-time validators skipped `optional: true` modules (`moduleLoader.js:1405, 1422`) — the safety net built after the March incident never fired for exactly the modules where these bugs lived.
- ✅ **Fixed:** the `WARN_ON_UNMAPPED_DECLARED_DEPS` DI-gap check now runs for optional modules too (declarations are static regardless of module optionality).
- ⏸️ **Left as-is (deliberate):** the required-dep-undefined warning still skips optional modules — optional modules may legitimately be absent along with their providers.
- 💡 **Future hardening:** a validator that detects *unmapped-path closures* (mapping exists but its deps-group path is never populated) would catch the truthy-closure variant (D2, D4, D5 were this kind). Requires provider-registration introspection — design needed.

### Known warnings the fixed validator now surfaces (triage needed — features are dead, not bugs introduced)

- `pullToRefresh` declares `checkRecurringTasksNow` and `promptServiceWorkerUpdate` — **no provider exists anywhere**. The pull-to-refresh SW-update prompt and forced recurring check are dead features. Decide: implement providers or remove the declarations + guarded call sites (pullToRefresh.js:439/476 guard real `undefined`, so no crash).
- `basicPluginSystem` declares `getCurrentCycle` — no provider; falls back internally. Same decision.

---

## MEDIUM — phase & UI bugs

| # | Finding | Where | Status |
|---|---------|-------|--------|
| M1 | First-time shimmer dismissal permanently broken — `DOM_SELECTORS.QUICK_ACTIONS_BTN` doesn't exist (key lives in `DOM_IDS`) → `getElementById(undefined)`; modeManager.js:769 documents this path as guaranteed | uiBoot.js:172 | ✅ **FIXED** — `DOM_IDS.QUICK_ACTIONS_BTN` |
| M2 | Vocab themes never reach the 3 boot-injected modals — modalTemplates evaluates `getLabel()` at import time (after Phase 1, before Phase 2 wires `getActiveLens`), so recurring/settings/preferences templates bake default vocabulary; `refreshThemeLabels()` only refreshes main-screen elements; duplicate-injection guard discards themed re-imports | modalTemplates.js (module-level template consts), orchestrator.js:745–761 | Open |
| M3 | Main-menu document listeners leak + focus-stealing — every menu-item click path calls `hideMainMenu()` which only removes the `visible` class; document-level Escape + click-outside handlers accumulate one per open/close; stale click-outside handler later calls `menu._previousFocus?.focus()` mid-interaction | uiBoot.js:306–336, menuManager.js:456–462 | Open |
| M4 | Deferred-feature capture listeners bypass `replaceStoredEventListener` — anonymous per-boot closures on `document` duplicate on retry and capture a dead attempt-1 `ensureModuleLoaded` | uiBoot.js:999–1018 | ✅ **FIXED** (with C1/C2) |
| M5 | Offline + stale constants.js = permanent splash screen — `initCoreBoot` returns null whether or not cache recovery could run; offline recovery refuses (correctly) but no retry/error screen follows. appInit's stale path has a continue-anyway flag; constants path doesn't | coreBoot.js:231–236 | Open |
| M6 | `loadDependencies()` failure bypasses retry/cache-recovery entirely — `startOrchestrator()`'s catch only logs; the signature stale-cache failure gets a 60s spinner + Lite redirect instead of one-shot cache recovery. Related: `initApp()` crashes on non-Error rejection (`error.message` without `?.`) at orchestrator.js:914 | orchestrator.js:206–218, 914, 1015–1020 | Open |

---

## LOW (noted, not scheduled)

- Version-gate reload ping-pong when a CDN serves stale HTML while version.js fetches fresh — gate's `justCleared` marker overwritten by the inline early-version check (miniCycle.html:196–216); bounded by the FAIL_KEY failsafe (~2–4 reloads + SW nuke). orchestrator.js:559–565.
- Fallback `BOOT_TIMEOUTS` objects (orchestrator.js:185–192, 209–216) omit `VERSION_GATE` (gate silently disabled if fallback used — fail-open, so safe) and drift from constants.js (PHASE_2 20s vs 30s, RETRY_DELAY 1s vs 2s).
- `waitForServiceWorker`: `timeoutMs = 3000` param is dead (`Math.max(timeoutMs, 8000)` always wins); browsers that never activate a SW pay the full 8s every boot. orchestrator.js:949–996.
- Facade sub-module version split on retry: taskCore imports sub-modules with `?v=${APP_VERSION}` while featureBoot re-imports taskCRUD via retry-suffixed `withV` → two taskCRUD instances after a retry; featureBoot's wiring lands on the one the facade doesn't use. taskCore.js:118–120 vs featureBoot.js:304.
- Stale depMappings entries: `remindOverdueTasks` (moduleLoader.js:1188 — dueDates doesn't provide it), `appendToTestResults` (moduleLoader.js:1128 — never registered; consoleCapture's declared dep permanently dead, dev-only).
- Stale manifest entry: taskUI `provides: ['refreshTaskListUI']` is unreachable via DI (mapping reads taskDOM's `deps.task` copy) and `buildProviderMap` last-writer-wins records taskUI as *the* provider, masking taskDOM. Similar benign collisions: statsPanel duplicating historyManager/clearedTasksManager/achievementsManager modal-open provides.
- taskCRUD wiring bundled inside taskSearch's try/catch (featureBoot.js:284–316) — a taskSearch import failure silently strips notifications/history-logging/reminders-start from task CRUD.
- `ensureModuleLoaded`/`deferredInvoke` have no in-flight-promise dedup (moduleLoader.js:625/687) — two near-simultaneous triggers can double-init a deferred module.
- `finalizeUI` fire-and-forget `initModeSelector()` makes the "refreshThemeLabels runs last" comment structurally false (uiBoot.js:908–943); benign today because setupModeSelector writes via getLabel().
- `completedTasksManager` accessor/object mismatch masked by featureBoot's manual re-wire (moduleLoader.js:1083 vs routineLoader.js:168) — latent trap if the manual wiring is removed.
- launchQueue file-open handler imports cycleImportManager with `?v=${APP_VERSION}` even when boot succeeded via the offline bare-suffix path (orchestrator.js:862–864) — .mcyc file-open may fail exactly in the offline scenario the bare-suffix strategy serves.
- Style: hardcoded notification string (featureBoot.js:171), hardcoded element IDs (uiBoot.js:129/137/845/853–861).
- Boot-error screen cosmetics: willRetry HTML destroys `.loader-bar`; diagnostics overwritten by first retry progress message (~2s window). orchestrator.js:436–445.
- Boot-timing: zombie attempt-1 measures can mix into a retry's `getBootTiming()` (diagnostic-only; last-entry-wins).

---

## Verified clean (don't re-audit)

- **Phase ordering:** every eager `requires` script-checked against its provider's phase — zero later-phase providers. `validateCrossPhaseDeps` + within-phase topological sort are sound.
- **Instance-method mappings:** all ~30 verified to exist on their providers.
- **XSS:** every dynamic value in boot error UI passes `escapeHtml`; modalTemplates interpolates only `getLabel()` output and `DOM_IDS`.
- **withTimeout rejections:** `Promise.race` consumes the losing promise — no unhandled-rejection storms; timer cleared via `.finally`.
- **Import failures:** non-optional import failures reject `Promise.all` → boot aborts → retry UI. Optional failures mark `featureAvailability` and continue. No silent catch of non-optional failures.

**Notably well-done (protect these):** the fail-open version gate (bounded no-store fetch raced against timeout, overlapped with Phase 1, never-resolving promise after navigation); offline-aware recovery (never clears caches offline — coreBoot.js:575, error screen hides destructive button offline); `replaceStoredEventListener` (uiBoot.js:88–97 — solves versioned-reimport function identity); the featureBoot HTML event bridge (once-guarded document listeners with retry-refreshed targets — the architecture C1's fix should copy); orchestrator's AppState teardown discipline (destroy + immediately null so ~287 `AppState?.get()` guards see the no-op path).

---

## Remaining Work — Fix Designs (added July 8, 2026)

Everything below is OPEN. Each design was written against the current code (post-v2.284); re-verify line numbers before implementing.

### M2 — vocab themes never reach the three boot-injected modals

**Current behavior:** `modalTemplates.js` evaluates `getLabel()` inside module-level template consts at import time (orchestrator imports it after Phase 1, *before* Phase 2 wires `getActiveLens` into labelResolver) — so the recurring panel, settings modal, and preferences modal bake default vocabulary permanently. `refreshThemeLabels()` → `_refreshLiveLensLabels()` (themeManager.js) only refreshes main-screen elements. The duplicate-injection guard correctly discards re-imports, so themed re-injection is not a path.

**Fix — attribute sweep (recommended):**
1. In `modalTemplates.js`, add `data-label-key="<key>"` to every element whose text is a **pure** `getLabel()` value that appears in `LENS_SENSITIVE_KEYS` (e.g. `recurring.title`, `recurring.addToRecurring`, `prefs.tasksCheckboxes`, `prefs.taskBackground`, `prefs.taskText`, `prefs.completeCycle`, `settings.backupAll`, `settings.restoreAll`, `settings.scrollToNew`, `settings.scrollToLast`). Skip elements with interpolation/counts — the sweep must never clobber dynamic text.
2. In `themeManager._refreshLiveLensLabels()`, add a generic sweep: `document.querySelectorAll('[data-label-key]')` → `el.textContent = getLabel(el.dataset.labelKey)`. Runs on every theme/routine change AND in `uiBoot.finalizeUI()`'s boot-time `refreshThemeLabels()` call, which also fixes the boot-time staleness.
3. Do NOT convert templates to lazy functions — injection happens before Phase 2 by design (modules query these elements during init), so laziness alone can't fix it.

**Verify:** Fitness theme → open recurring panel / settings / preferences → themed strings; back to Classic → defaults; new-user boot with a themed default routine shows themed modal labels without reopening.
**Risk:** low-medium. The sweep is additive and key-scoped; main risk is tagging an element whose textContent includes markup/counts — audit each tagged element.

### M3 — main-menu document listeners leak + focus-stealing

**Current behavior (verified against code):**
- `closeMenuOnClickOutside` (uiBoot.js:526) is a stable module-level function attached via `replaceStoredEventListener` → does NOT stack. BUT it stays attached after any non-uiBoot close path (`menuManager.hideMainMenu()` — every menu-item click, menuManager.js:456 only removes the `visible` class). The next outside click then runs the close logic on an already-hidden menu and calls `menu._previousFocus?.focus()` — **focus steal mid-interaction**.
- `menu._escHandler` (uiBoot.js:309) is a fresh closure per open attached with plain `addEventListener`. After a `hideMainMenu()` close, reopening overwrites `menu._escHandler` without removing the old one → **one orphaned document keydown handler per open/hideMainMenu cycle**, each firing the close logic + focus steal on Escape.
- The toggle-close branch (uiBoot.js:327–336) removes esc + trap but NOT click-outside (bounded to one stale handler, but it still focus-steals on the next outside click).

**Fix:**
1. **Self-healing guard** at the top of BOTH document handlers: if `!menu.classList.contains(DOM_CLASSES.VISIBLE)` → remove esc + click-outside + trap listeners and `return` WITHOUT touching focus. Converts every stale handler into silent cleanup; kills the focus steal.
2. **Single teardown helper** `closeMainMenu(menu, menuButton, { restoreFocus })` used by esc, click-outside, and the toggle-close branch — always removes all three listeners (esc, click-outside, trap) so no path leaves a partial set.
3. **Esc handler keyed**: attach via `replaceStoredEventListener(document, 'keydown', '__miniCycleUiBootMenuEscHandler', …)` so reopen replaces instead of orphaning.
4. Optional (nicer, cross-module): `hideMainMenu()` dispatches `CustomEvent('main-menu:closed')` on the menu; uiBoot listens and runs the teardown immediately instead of lazily. The self-healing guard alone is sufficient — do this only if the lazy window (stale handlers until the next click/Escape) matters.

**Verify:** open menu → click a menu item → click a task: focus stays on the task; repeat open/menu-item-close ×5 → press Escape once: no focus jump, no multiple handler fires; Tab-trap (July 2026 a11y work) still cycles inside the open menu; legitimate closes (Escape, outside click, toggle) still restore focus to `_previousFocus`.
**Risk:** medium — interacts with the custom Tab-trap and a11y focus restore; test with keyboard-only navigation.

### M5 — offline + stale constants.js = permanent splash screen

**Current behavior:** `coreBoot.js:231–236` — on a stale-constants detection, `handleStaleCacheRecovery()` is called and `initCoreBoot` returns `null` regardless of whether recovery could run. Offline, `attemptCacheRecovery` correctly refuses to clear caches and returns false → banner shows, boot returns false, no retry, no error screen, `hideAppLoader` never runs → splash screen forever (every offline launch).

**Fix:** mirror the appInit stale path's `_staleAppInitForgiven` continue-anyway flag: when recovery was NOT initiated (offline or already-attempted), log prominently and **continue boot with the stale constants** instead of returning null. Stale constants are additive in practice; a booted app on slightly-old constants beats a dead splash screen. Keep returning null only when recovery WAS initiated (reload is coming).
**Verify:** unit test the branch — mock `attemptCacheRecovery` → false + `navigator.onLine` → false, assert `initCoreBoot` returns a usable coreResult; existing stale-cache tests still pass (recovery-initiated path unchanged).
**Risk:** low.

### M6 — loadDependencies() failure bypasses retry/error machinery (+ non-Error rejection crash)

**Fix (two small patches):**
1. `orchestrator.js:1015–1020` (`startOrchestrator`'s catch): route through the existing machinery instead of only logging — `if (isCacheError(error)) attemptCacheRecovery()` fast-path, else `showBootError('Dependency load', error)`. This gives the signature stale-cache failure a one-shot recovery instead of a 60s spinner + Lite redirect.
2. `orchestrator.js:914` (`initApp` catch): `error.message.includes(...)` → `(error?.message || '').includes(...)` — a non-Error rejection (string/undefined) currently throws inside the catch, skipping the error screen and retry entirely. Match the `getErrorDetails`/`showBootError` pattern which already guard with `error?.message ||`.

**Verify:** unit-test `initApp`'s catch with `Promise.reject('string reason')`; manually break a boot-dep import URL locally and confirm the error screen (not the 60s spinner) appears.
**Risk:** low.

### Decision needed — dead declared deps (surfaced by the fixed validator at every boot)

- **`pullToRefresh` → `checkRecurringTasksNow`**: no provider exists. Recommendation: **implement** — a pull-to-refresh SHOULD catch up recurring tasks; wire it to the recurring system's existing check entry point (verify what recurringWatcher/recurringCore exports — likely the watcher's check function) via a depMappings entry + provider registration.
- **`pullToRefresh` → `promptServiceWorkerUpdate`**: no provider exists. Recommendation: **remove** the declaration and its guarded call (pullToRefresh.js:~476) — SW updates are now handled by the version gate + verifyVersionFresh flow; a manual prompt path would fight it.
- **`basicPluginSystem` → `getCurrentCycle`**: no provider; module is deferred/inert with an internal fallback. Recommendation: **remove** the declaration.

Until decided, these warn once per boot (by design — they are real gaps, and silencing them re-creates the bug class this audit exists to kill).

### Low bucket — triage

**Worth batching into one small PR:**
- `orchestrator.js:914`-adjacent fallback `BOOT_TIMEOUTS` drift (add `VERSION_GATE`, sync PHASE_2/RETRY_DELAY with constants.js) — pairs naturally with M6.
- Stale depMappings entries (`remindOverdueTasks`, `appendToTestResults`) and taskUI's stale `provides: ['refreshTaskListUI']` — deletions; also fixes the provider-map masking.
- taskCRUD wiring moved OUT of taskSearch's try/catch (featureBoot.js:284–316) — 10-line reshuffle, removes a silent half-init path.
- Hardcoded notification string (featureBoot.js:171 → label key) + four hardcoded IDs in uiBoot (129/137/845/853–861 → DOM_IDS).

**Leave until touched for other reasons:**
- Version-gate reload ping-pong (needs CDN-stale precondition; bounded by FAIL_KEY).
- `waitForServiceWorker` dead 3000ms param / 8s floor (boot-perf territory — fold into the load-perf investigation).
- Facade sub-module version split after retry (only matters after a retry AND a facade re-wire; revisit if retry telemetry shows real-world retries are common).
- `ensureModuleLoaded` in-flight dedup (low likelihood; add if a double-init is ever observed).
- `completedTasksManager` accessor/object mismatch (masked by featureBoot's manual re-wire; fix if that wiring is ever removed).
- launchQueue offline `?v=` import; boot-error screen cosmetics; boot-timing zombie measures (diagnostic-only).

---

## Fix plan / status

- **(a) Retry machinery (C1+C2+C3+M4):** ✅ DONE July 7, 2026 — shared registries + boot-generation guard + no-init destroy registration + keyed stubs. Verified: 17/17 moduleLoader tests (3 new regression tests), all boot suites green, live cross-instance destroy simulation in the browser.
- **(b) DI silent no-ops (D1–D8):** ✅ DONE July 7, 2026.
- **(c) UI trio (M1 shimmer ✅ done; M2 modal labels, M3 menu leak):** M2/M3 open — fix designs above, independent, medium size each.
- **(d) M5/M6 offline/error-path hardening:** open — fix designs above, small, testable.
- **(e) Low bucket:** triaged above into one batchable PR + leave-until-touched items.
- **(f) Dead-deps decision (pullToRefresh/basicPluginSystem):** recommendations above — implement `checkRecurringTasksNow`, remove the other two declarations.
