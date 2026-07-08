# Boot Pipeline Audit — July 2026

**Date:** July 7, 2026
**Scope:** orchestrator.js, coreBoot.js, featureBoot.js, uiBoot.js, moduleLoader.js, moduleManifests.js, modalTemplates.js (~7,300 lines)
**Method:** 3 parallel reviewers (orchestrator / DI wiring / phases 1–3), each verifying findings by reading both sides of every claim (destroy implementations, consumers, providers). DI findings were additionally script-verified: all 51 manifests cross-checked against every resolution path in `buildModuleDependencies()`.
**Related:** `docs/architecture/UNDO_REDO_ARCHITECTURE.md` (March 2026 `clearAllUndoHistory` incident — the bug class that motivated the DI sweep), `DIRECT_DOM_AUDIT.md`, `LARGE_MODULE_SPLITS_PLAN.md`

---

## Key insight: the truthy-closure trap

A `depMappings` closure whose inner path never resolves (wrong deps group, missing `provides`, missing `provideInstance`) is **worse than a missing entry**: the closure itself is truthy, so consumer guards like `if (this.deps.x)` PASS, and the call inside silently no-ops via `?.`. The guard is defeated by the very wiring layer it's guarding against. Several findings below survived precisely because of this.

---

## CRITICAL — retry machinery (NOT yet fixed; needs focused design pass)

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
| M4 | Deferred-feature capture listeners bypass `replaceStoredEventListener` — anonymous per-boot closures on `document` duplicate on retry and capture a dead attempt-1 `ensureModuleLoaded` | uiBoot.js:999–1018 | Open (fix alongside C1/C2) |
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

## Fix plan / status

- **(a) Retry machinery (C1+C2+C3+M4):** OPEN — needs a focused design pass. Version-suffix-independent registries (event-bridge pattern) + attempt-generation guard. Boot-critical; regression risk high; do as its own change with full suite + manual retry testing (DevTools throttling to force a phase timeout).
- **(b) DI silent no-ops (D1–D8):** ✅ DONE July 7, 2026 (this audit's session).
- **(c) UI trio (M1 shimmer ✅ done; M2 modal labels, M3 menu leak):** M2/M3 open — independent, medium size each.
- **(d) M5/M6 offline/error-path hardening:** open — small, testable.
- **(e) Low bucket:** opportunistic.
