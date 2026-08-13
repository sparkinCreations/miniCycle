# Routine Switcher Modal Refactor Plan

> **✅ ARCHIVED 2026-08-13** — work verified shipped in the tree at v2.412. 6 of 7 phases done; Phase 3 (handler rename to `_on{Event}Handler`) was deliberately dropped as cosmetic churn. The Phase 8+ module-split idea lives on in `docs/future-work/LARGE_MODULE_SPLITS_PLAN.md`.

## Context

The routine switcher modal (`routineSwitcher.js`, 2,466 lines) was built incrementally over time — features added one at a time without stepping back to consolidate. While fully functional with 22+ features, it has redundant deselection handlers across two files, inconsistent event handler naming, no cleanup on modal close, large monolithic methods, and two separate rename flows. This plan brings it up to par with the rest of the app's quality standards without changing any user-facing behavior.

---

## Phase 1: Remove redundant uiBoot deselection handler
**Risk: LOW | Files: uiBoot.js**

Remove `handleGlobalClickForSwitchModal()` (~55 lines) from `uiBoot.js` and its registration in `attachGlobalEventListeners`. Its own comment says "Deselection is now handled by routineSwitcher._clickHandler." The routineSwitcher version is strictly better — it calls `_deselectRoutine()` (clean single method) and handles theme picker cleanup via `closeThemePicker()`.

**Verify:** Select → click empty space deselects. Theme picker closes on outside click. Modal closes on backdrop click. ESC works.

---

## Phase 2: Add modal close cleanup
**Risk: LOW-MEDIUM | Files: routineSwitcher.js**

Add `_cleanup()` method that removes accumulated event listeners on modal close. Call from `hideSwitchMiniCycleModal()` and the dialog `close` event. Follow `FocusMode.destroy()` pattern.

Remove on close:
- `switchModal._touchmoveGuard` (touchmove on dialog)
- `switchModalContent._clickHandler` (click inside modal)
- Button handlers (null references so guards recreate on next open)

Keep alive (has early-return guard when modal not open):
- `document` level `_clickOutsideHandler`

**Verify:** Open/close modal 10x rapidly — no handler accumulation. ESC cleanup works. All features work after reopen.

---

## Phase 3: Standardize handler naming
**Risk: LOW | Files: routineSwitcher.js**

Rename all handler storage properties to consistent convention. Currently uses 4 patterns (`_clickHandler`, `_touchmoveGuard`, `_clickGuard`, `_chipHandlers`). Standardize to `_on{Event}Handler` / `_on{Event}Handlers` (array).

Mechanical find-and-replace within single file. No external consumers depend on these property names.

**Verify:** Full smoke test of all features. No console errors.

---

## Phase 4: Persist sort/filter preferences
**Risk: LOW | Files: routineSwitcher.js**

Save `_sortMode`, `_sortDirection`, `_filterMode` to `state.settings.routineSwitcherPrefs` on change. Read on modal open. Defaults match current behavior (`'alpha'`, `'asc'`, `'all'`).

Uses `AppState.update(..., false)` (deferred save) — same pattern as other preference persistence.

**Verify:** Change sort/filter → close → reopen → preferences preserved. Reload page → still preserved. Fresh profile → defaults work.

---

## Phase 5: Extract loadMiniCycleListActual into smaller methods
**Risk: MEDIUM | Files: routineSwitcher.js**

Split ~260 line method into:
- `_renderRecentlyUsed(sortedCycles, activeCycleId, miniCycleList)` — recently used chip section
- `_renderListItem(cycleKey, cycleData, index, activeCycleId, miniCycleList)` — single list item with all handlers
- `_getFilteredSortedCycles(cycles)` — filter + sort orchestration

`loadMiniCycleListActual` becomes ~40-line orchestrator. Depends on Phase 3 naming.

**Verify:** Test with 1, 3, 5, 10+ routines. All sort/filter modes. Search. Double-tap. Keyboard nav. Recently used chips.

---

## Phase 6: Consolidate preview paths
**Risk: MEDIUM | Files: routineSwitcher.js**

Merge `updatePreview()` + `_updateDesktopPreview()` → single `_renderPreview(cycleData, cycleName)`. Merge `_resetDesktopPreview()` → `_resetPreview()`. Build task HTML once, write to both mobile and desktop containers. CSS already handles visibility per viewport.

**Verify:** Mobile: inline preview shows tasks + date. Desktop: right panel shows tasks + title + date + hint. Deselect resets both. Double-click opens review modal.

---

## Phase 7: Consolidate rename flow
**Risk: MEDIUM-HIGH | Files: routineSwitcher.js**

Split `_finishInlineEdit` into:
- `_teardownInlineEdit(input, titleSpan)` — removes input, restores title, removes overlay
- `_commitRename(listItem, oldKey, newName, titleSpan)` — validation, collision check, AppState update, refresh

Mobile modal path calls `_commitRename` directly instead of creating a throwaway DOM input. Desktop inline path calls both `_teardownInlineEdit` + `_commitRename`.

**Verify:** Desktop: rename → Enter, rename → Escape, rename collision, rename active routine. Mobile: same via dialog. Undo after rename.

---

## Phase Order & Dependencies

```
Phase 1 (uiBoot cleanup) ──────────────────────────────── Independent
Phase 2 (modal close cleanup) ─────┐
Phase 3 (handler naming) ──────────┤── Sequential
Phase 4 (sort/filter persist) ─────┤── Independent (can parallel with 2-3)
Phase 5 (extract list rendering) ──┤── After 3
Phase 6 (consolidate preview) ─────┤── After 5
Phase 7 (consolidate rename) ──────┘── After 2
```

## Critical Files
- `/web/modules/routine/routineSwitcher.js` — main refactor target (2,466 lines)
- `/web/modules/boot/uiBoot.js` — remove redundant handler (Phase 1)
- `/web/tests/routineSwitcher.tests.js` — run after each phase
- `/web/modules/ui/focusMode.js` — reference for destroy() pattern (Phase 2)

## Versioning, Cache Busting & Boot Sequence

**Both `routineSwitcher.js` and `uiBoot.js` are precached in the service worker as BOOT_CRITICAL files.** Any modification requires a version bump for cache invalidation.

### After all phases complete:
1. Run `./scripts/update-version.sh --auto` — bumps `APP_VERSION` in `version.js`, updates `CACHE_VERSION` in `service-worker.js`, updates `?v=` params across `miniCycle.html` and `main.css`
2. The new version propagates through the boot chain:
   - `version.js` → `globalThis.APP_VERSION`
   - `coreBoot.js` creates `withV = (path) => path?v=${APP_VERSION}`
   - `moduleLoader.js` loads manifests and modules with versioned imports
   - `routineSwitcher.js` internal dynamic imports (`storageUtils`, `nameUtils`, `undoRedoManager`) also use `APP_VERSION`
3. Service worker detects version mismatch via `verifyVersionFresh()` and triggers cache refresh

### Boot sequence impact:
- **Phase 1 (removing uiBoot handler):** `attachGlobalEventListeners()` registers 6 handlers — removing `handleGlobalClickForSwitchModal` only affects the switch modal deselection. The 5 other handlers (task buttons, keydown, notifications, touch, reset) are unaffected.
- **Phases 2-7 (routineSwitcher changes):** Module loads in **CYCLE phase** (Phase 5 of 8), after `routineManager` and `onboardingManager`. No boot sequence changes — same manifest entry, same phase, same dependencies.
- **No manifest changes needed** — the module's `requires`, `provides`, and `api` are unchanged.

### Per-phase deployment:
Phases can be deployed individually or batched. Each deployment needs one `update-version.sh` run. Batching all 7 phases into a single version bump is more efficient — one cache invalidation cycle instead of seven.

## Verification
After each phase: run `npm test -- routineSwitcher` + `npm test -- uiBoot` + manual smoke test of all 22 features. After all phases: full `npm test` suite + `update-version.sh --auto`.

## Future Work
This is Phase 0 cleanup. The sub-module extraction plan at `/web/docs/future-work/LARGE_MODULE_SPLITS_PLAN.md` (splitting into routineSwitcherThemePicker.js, routineSwitcherPreview.js, routineSwitcherSearch.js) becomes Phase 8+ and is much safer to execute after these seven phases establish clean boundaries.
