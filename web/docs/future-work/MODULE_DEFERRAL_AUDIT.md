# Module Deferral Audit — Moving Modules Off the Critical Boot Path

**Status:** Mechanism BUILT + batches shipped & verified (deferred set now 5 modules as of v2.412). Still paused for real-device measurement — that remains the continuation trigger. (Continuation point below.)
**Created:** June 2026 · **Last updated:** August 2026
**See also:** [BOOT_PERF_ROADMAP.md](./BOOT_PERF_ROADMAP.md) — the successor roadmap that carries the remaining deferral/init-split backlog forward (post build-pipeline)
**Goal:** Reduce time-to-interactive on slow (CPU-bound) devices by not parsing + `init()`-ing modules the user doesn't need at first paint.
**Trigger to continue:** Slow-device reading from the testing modal's **Boot Timing** button showing `features_ms` dominates `bootSequence_ms`. (On a fast dev machine, features is too noisy — 264–634 ms across runs — to show the win; the deterministic signal is boot JS file count, ~131 → ~116.)

---

## ⏸️ CONTINUATION POINT (read this first when resuming)

### What's DONE and verified
- **Mechanism built** (`moduleLoader.js`): `deferred: true` manifest flag (skipped in `loadPhase`), `ensureModuleLoaded(name)` on-demand loader (idempotent; resolves deferred prerequisites first; re-runs `runPostInitInjections`), `findDeferredProvider()`, `deferredInvoke(moduleName, resolve, args)` (loads-then-calls for DI-triggered entry points). Boot context captured in module-level `_bootDeps`/`_bootCoreResult` at the top of `loadAllModules`.
- **Wiring**: `featureBoot.js` exposes `deps.core.ensureModuleLoaded` from the **versioned** moduleLoader instance (a static import would be a separate instance with null boot context). `uiBoot.js` has `setupDeferredFeatureTriggers(deps)` for DOM-button triggers.
- **Deferred & verified**: `testingModal` + `testingModalIntegration` (+ ~7 statically-imported sub-modules) via `#open-testing-modal` delegation stub; `basicPluginSystem` (no trigger — inert, no plugins registered at boot); `gamesManager` via `.menu-button` delegation + `unlockMiniGame` deferredInvoke; and (since this audit) `focusTaskPanel` (`deferred: true` in its moduleManifests.js entry). **Deferred set as of v2.412: 5 manifests** — gamesManager, focusTaskPanel, testingModal, testingModalIntegration, basicPluginSystem.
- **Free win — ✅ shipped**: `gamesManager` 15s boot poll replaced; it now awaits `appInit.waitForApp()`.
- **Boot JS files**: ~131 → ~116. Lint 0 errors. `version.js` at baseline 2.234.

### Hard-won gotchas (don't relearn these)
1. **DOM stubs MUST use document-level event delegation (capture phase), not node-bound listeners.** The settings modal (`#open-testing-modal`) is re-rendered after boot, so a node-bound listener ends up detached. See `setupDeferredFeatureTriggers`.
2. **Keep `backupManager` eager** — used by `settingsManager` export AND the uiBoot session backup (uiBoot ~line 968).
3. **`deferredInvoke` only for genuine user-intent moments**, never boot-time/hot-path calls (e.g. `checkGamesUnlock` is called once at boot by `menuManager.setupMainMenu` — making it deferredInvoke would force an eager load; leave it a plain no-op).
4. **Verifying in the dev preview**: cache-clear + SW-unregister is enough for fresh modules — do NOT bump `version.js`. Use real `element.click()` in `preview_eval` (not `preview_click`) for buttons inside closed dialogs (they're invisible; preview_click can't dispatch a propagating event).

### What's LEFT (next sessions) — see corrected tiers below
- **Refactor-tier** (need init-split, NOT plain defer): `taskSearch` (render-path wired at boot via `featureBoot.js` ~line 291), `guidedTourManager` (1,962 lines — boot-scheduled new-user tour), `helpWindowManager` (always-on ambient help: MutationObserver + 6 listeners + boot welcome), `focusMode` (creates its own button + restores persisted focus state at boot).
- **Big parse wins still on the table**: `guidedTourManager` (1,962), `preferencesManager` (1,957), `settingsManager` — all need the boot-essential-vs-lazy init split.
- **Before more work**: measure this batch on a real slow device (testing modal → Boot Timing). This is still the gating trigger as of Aug 2026 — the deferral backlog now continues in [BOOT_PERF_ROADMAP.md](./BOOT_PERF_ROADMAP.md), which supersedes the tiering below for prioritization.

---

## The mechanism reality (original analysis — now implemented)

> **UPDATE:** the on-demand loader described as "to build" below has since been **built** (`ensureModuleLoaded` + `deferred: true` — see the Continuation Point above). This section is kept for the original reasoning about why `lazyRequires`/`optional` weren't enough.

Originally there was **no on-demand module loader**. `loadAllModules()` ([moduleLoader.js](../../modules/boot/moduleLoader.js)) loaded **every** module in `MODULE_MANIFESTS` eagerly, phase-by-phase, **serially**, running each module's `init()` at load time. Therefore:

- **`lazyRequires` does NOT defer a module.** It only defers *dependency wiring* (lets a module declare a dep from a later phase). The module itself still loads eagerly at boot.
- **`optional: true` does NOT defer a module.** It only means "a load failure doesn't abort boot." The module is still fetched + parsed + initialized.
- **Phase reordering alone does NOT reduce work** — all phases complete before the app is interactive, so moving a module to a later phase just changes *when* within boot it parses, not *whether*.

**Consequence:** Real deferral requires building a small new mechanism (see "Proposed mechanism" below). The good news: the DI system already guards cross-module calls through `optionalDeps` (`dep?.()` / `optional()` sentinels), so a deferred provider's consumers keep working (no-op) until it loads. That's what makes most of Tier 1 safe.

---

## Free win — ✅ SHIPPED

### gamesManager boot-time polling
`gamesManager.deferredCheckGamesUnlock()` used to run `setInterval(…, 100ms)` up to **150 times (15 s)** polling `AppState.isReady()` on every boot — even though `gamesManager` already had `appInit` injected.

**Shipped:** the polling loop was replaced — it now awaits `appInit.waitForApp()` and calls the unlock check once. (gamesManager itself is also deferred now, so this only runs on first games-panel open.)

---

## Tier 1 — Clean defer (recommended first)

User-interaction-gated, **not** hard-`required` by any eager module, no boot-time side effect. Consumers reach these only via guarded `optionalDeps` or explicit user actions.

| Module | Lines* | Loads on first… | Notes |
|---|---|---|---|
| `testingModal` + `testingModalIntegration` + `backupManager` | large (multi-file) | open of the testing modal | Defer as a **unit** — testingModal hard-requires backupManager. Most users never open it. Button listeners already attach on open (`setupTestButtons`), so on-demand load fits naturally. |
| `basicPluginSystem` | 415 | plugin use | `pluginManager` is `optionalDeps` everywhere (taskCore). *(An earlier revision said 1,474 lines — actual is ~415 (`modules/other/basicPluginSystem.js`), so its defer was hygiene, not a big parse win.)* |
| `gamesManager` | — | open of games panel (menu) | Polling fix shipped (see Free win above). |
| `guidedTourManager` | 1,962 | a tour starting | Consumed via `lazyRequires` (onboarding) + `optionalDeps` (`show*TourNotification`) — all guarded. One of the largest files. |
| `helpWindowManager` | — | help window opening | `updateHelpWindow` is optional everywhere. |
| `taskSearch` | — | search invoked | `updateSearchVisibility` is optional (routineLoader). |
| `focusMode` | — | focus mode activated | `activateFocusMode` is optional (menu/onboarding). |

*Line counts from PROJECT_STATS-era data; verify current.

`guidedTourManager` (~1,960) + the testing group + `gamesManager` are collectively a large share of the eager parse for users who never touch those features. (`basicPluginSystem` is only ~415 lines — negligible parse, deferred anyway since it's inert at boot.)

---

## Tier 2 — Defer with a trigger or caveat

Safe to defer, but each needs a small decision or a load-trigger that isn't "pure on-demand."

| Module | Lines | Caveat / trigger |
|---|---|---|
| `settingsManager` | ~610-line facade (+subs) as of v2.412 | Opened from menu → defer until settings opens. The facade file itself is modest — the payoff is its `init()`, which wires several sub-modules, so deferral moves the whole sub-tree off boot. Provides `exportMiniCycleData`/`downloadBackupFile` — both optional in consumers. |
| `preferencesManager` | 1,957 | Opened from personalization. **Verify first:** does the early inline colors script ([miniCycle.html ~250-327](../../miniCycle.html)) already apply a returning user's saved custom colors at boot? If yes, deferring is clean. If the module is what applies them, deferring causes a flash of default colors → keep a minimal boot color-apply path. `applyCustomColors` is optional in themeManager. |
| `achievementsManager` | — | `checkAchievements` is called on **cycle completion** (cycleCompletion `optionalDeps`). Not needed at first paint, but must be loaded before the first cycle completes. Trigger: `ensureModuleLoaded('achievementsManager')` inside the cycle-completion path before `checkAchievements?.()`, plus on opening the achievements modal. |
| `historyManager` + `clearedTasksManager` | — | **Tradeoff:** `logHistoryEvent` / `recordClearedTask` fire on many actions. Deferring means early events aren't logged until first load. Either accept the gap, or load on the first cycle/clear (reduces the win). Lower priority. |
| `backupReminder` | — | Has a **boot job** (`checkBackupReminderOnBoot`). Don't fully defer; run it from an idle/post-interactive callback (e.g. after `INTERACTIVE` mark) instead of inline boot. |

---

## Tier 3 — Cannot defer without a refactor (keep eager)

Either hard-`required` by an eager module, or needed for first interactive paint.

- **First-paint / first-interaction core:** `taskCore` (add/edit/complete), `taskDOM`, `taskUI`, `taskInteractions`, `uiEffects`, `dragDropManager`, `reminders`, `routineLoader` (loads the cycle), `modeManager`, `routineSwitcher`, `routineManager`, `menuManager`, `themeManager`, `vocabThemes`, `modalRegistry`, `modalManager`, `notificationDialogHost`, `titleManager`, `recurringIntegration`, `dueDates`, `dailyResetManager`, `deviceDetection`, `taskOptionsCustomizer`, `completedTasksManager`, Phase-1 utils.
- **Hard-required by eager modules (blocked):**
  - `cycleCompletion` → `uiOrchestrator` hard-`requires` `updateProgressBar` (the `uiOrchestrator` manifest's `requires` array in [moduleManifests.js](../../modules/boot/moduleManifests.js) — search `uiOrchestrator:`; earlier line pins have drifted).
  - `statsPanel` → `uiOrchestrator` hard-`requires` `updateStatsPanel`. **Also one of the heaviest `init()`s** (~5–10 `querySelectorAll`, several listeners, injects feature buttons). Deferring requires making that `require` optional + guarding all `updateStatsPanel` call sites — a real refactor, but high value given the init cost.
  - `undoRedoManager` → `titleManager` hard-`requires` `captureStateSnapshot` / `enableUndoSystemOnFirstInteraction`.
  - `uiOrchestrator` itself (drives the render pipeline).
- **Borderline / low-value:** `pullToRefresh`, `taskViewLayoutManager`, `gesturePanelManager`, `quickActionsManager` — small, gesture/tracking; defer only if trivial.

---

## Proposed mechanism

1. **Manifest flag:** add `deferred: true` to a module manifest. `loadAllModules()` **skips** deferred modules during boot (they don't fetch/parse/init).
2. **On-demand loader:** export `ensureModuleLoaded(name)` from `moduleLoader.js` that runs the same `import → findSetDependenciesFunction → init` path, idempotent via the existing `loadedModules` / `moduleInstances` caches (so it fetches at most once and never re-fetches). Returns the instance.
3. **Wire triggers:** at each feature's entry point (menu item, modal open, gesture, tour start, cycle-completion hook), `await ensureModuleLoaded('<name>')` before first use. Consumers that call via `optionalDeps` keep no-op'ing safely until then.
4. **Caches already support this** — `loadedModules`/`moduleInstances` persist; `destroyAllModules()`/`clearLoadedModules()` only run on boot retry, so a deferred module loaded once stays loaded.

**Validation per deferred module:** confirm none of its `provides` appears in another eager module's `requires` (hard) array — only `optionalDeps` / `lazyRequires` / user-action call sites are safe. The Tier 1 list has been checked against the manifest; re-check if manifests change.

---

## Suggested order of execution

1. gamesManager polling fix (free, do now).
2. Build the `deferred` + `ensureModuleLoaded` mechanism with **one** Tier-1 module (testing group is the cleanest, lowest-risk pilot).
3. Roll the rest of Tier 1 through the mechanism.
4. Measure on a real slow device via Boot Timing after each batch — stop when `features_ms` is no longer the bottleneck.
5. Tackle Tier 2 case-by-case; only attempt `statsPanel` (Tier 3) if measurements justify the refactor.

**Always `log()` what was deferred** so a regression (feature feels slow on first use) is traceable to its lazy load, not a bug.
