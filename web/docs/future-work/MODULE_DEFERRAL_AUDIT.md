# Module Deferral Audit — Moving Modules Off the Critical Boot Path

**Status:** Audit / planning. Not started.
**Created:** June 2026
**Goal:** Reduce time-to-interactive on slow (CPU-bound) devices by not parsing + `init()`-ing modules the user doesn't need at first paint.
**Trigger to act:** Slow-device reading from the testing modal's **Boot Timing** button showing `features_ms` dominates `bootSequence_ms`. (On a fast dev machine, features ≈ 409 of 519 ms — see [[project_load_perf_investigation]].)

---

## The mechanism reality (read this first)

There is currently **no on-demand module loader**. `loadAllModules()` ([moduleLoader.js](../../modules/boot/moduleLoader.js)) loads **every** module in `MODULE_MANIFESTS` eagerly, phase-by-phase, **serially**, and runs each module's `init()` at load time. Therefore:

- **`lazyRequires` does NOT defer a module.** It only defers *dependency wiring* (lets a module declare a dep from a later phase). The module itself still loads eagerly at boot.
- **`optional: true` does NOT defer a module.** It only means "a load failure doesn't abort boot." The module is still fetched + parsed + initialized.
- **Phase reordering alone does NOT reduce work** — all phases complete before the app is interactive, so moving a module to a later phase just changes *when* within boot it parses, not *whether*.

**Consequence:** Real deferral requires building a small new mechanism (see "Proposed mechanism" below). The good news: the DI system already guards cross-module calls through `optionalDeps` (`dep?.()` / `optional()` sentinels), so a deferred provider's consumers keep working (no-op) until it loads. That's what makes most of Tier 1 safe.

---

## Free win — no mechanism needed

### gamesManager boot-time polling
`gamesManager.deferredCheckGamesUnlock()` runs `setInterval(…, 100ms)` up to **150 times (15 s)** polling `AppState.isReady()` on every boot ([gamesManager.js:124](../../modules/ui/gamesManager.js:124)) — even though `gamesManager` already has `appInit` injected.

**Fix:** replace the polling loop with `await appInit.waitForCore()` then call `checkGamesUnlock()` once. Removes a recurring boot-time timer on every load. Pure win, do this regardless of the deferral effort. *(Even better once gamesManager itself is deferred — Tier 1 — but fix the poll either way.)*

---

## Tier 1 — Clean defer (recommended first)

User-interaction-gated, **not** hard-`required` by any eager module, no boot-time side effect. Consumers reach these only via guarded `optionalDeps` or explicit user actions.

| Module | Lines* | Loads on first… | Notes |
|---|---|---|---|
| `testingModal` + `testingModalIntegration` + `backupManager` | large (multi-file) | open of the testing modal | Defer as a **unit** — testingModal hard-requires backupManager. Most users never open it. Button listeners already attach on open (`setupTestButtons`), so on-demand load fits naturally. |
| `basicPluginSystem` | 1,474 | plugin use | `pluginManager` is `optionalDeps` everywhere (taskCore). |
| `gamesManager` | — | open of games panel (menu) | Also apply the polling fix above. |
| `guidedTourManager` | 1,962 | a tour starting | Consumed via `lazyRequires` (onboarding) + `optionalDeps` (`show*TourNotification`) — all guarded. One of the largest files. |
| `helpWindowManager` | — | help window opening | `updateHelpWindow` is optional everywhere. |
| `taskSearch` | — | search invoked | `updateSearchVisibility` is optional (routineLoader). |
| `focusMode` | — | focus mode activated | `activateFocusMode` is optional (menu/onboarding). |

*Line counts from PROJECT_STATS-era data; verify current.

`guidedTourManager` (1,962) + `basicPluginSystem` (1,474) + the testing group + `gamesManager` are collectively a large share of the eager parse for users who never touch those features.

---

## Tier 2 — Defer with a trigger or caveat

Safe to defer, but each needs a small decision or a load-trigger that isn't "pure on-demand."

| Module | Lines | Caveat / trigger |
|---|---|---|
| `settingsManager` | large (+subs) | Opened from menu → defer until settings opens. Its `init()` wires several sub-modules (facade), so deferral moves real work off boot. Provides `exportMiniCycleData`/`downloadBackupFile` — both optional in consumers. |
| `preferencesManager` | 1,957 | Opened from personalization. **Verify first:** does the early inline colors script ([miniCycle.html ~250-327](../../miniCycle.html)) already apply a returning user's saved custom colors at boot? If yes, deferring is clean. If the module is what applies them, deferring causes a flash of default colors → keep a minimal boot color-apply path. `applyCustomColors` is optional in themeManager. |
| `achievementsManager` | — | `checkAchievements` is called on **cycle completion** (cycleCompletion `optionalDeps`). Not needed at first paint, but must be loaded before the first cycle completes. Trigger: `ensureModuleLoaded('achievementsManager')` inside the cycle-completion path before `checkAchievements?.()`, plus on opening the achievements modal. |
| `historyManager` + `clearedTasksManager` | — | **Tradeoff:** `logHistoryEvent` / `recordClearedTask` fire on many actions. Deferring means early events aren't logged until first load. Either accept the gap, or load on the first cycle/clear (reduces the win). Lower priority. |
| `backupReminder` | — | Has a **boot job** (`checkBackupReminderOnBoot`). Don't fully defer; run it from an idle/post-interactive callback (e.g. after `INTERACTIVE` mark) instead of inline boot. |

---

## Tier 3 — Cannot defer without a refactor (keep eager)

Either hard-`required` by an eager module, or needed for first interactive paint.

- **First-paint / first-interaction core:** `taskCore` (add/edit/complete), `taskDOM`, `taskUI`, `taskInteractions`, `uiEffects`, `dragDropManager`, `reminders`, `routineLoader` (loads the cycle), `modeManager`, `routineSwitcher`, `routineManager`, `menuManager`, `themeManager`, `vocabThemes`, `modalRegistry`, `modalManager`, `notificationDialogHost`, `titleManager`, `recurringIntegration`, `dueDates`, `dailyResetManager`, `deviceDetection`, `taskOptionsCustomizer`, `completedTasksManager`, Phase-1 utils.
- **Hard-required by eager modules (blocked):**
  - `cycleCompletion` → `uiOrchestrator` hard-`requires` `updateProgressBar` ([moduleManifests.js:364](../../modules/boot/moduleManifests.js)).
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
