# Hardcoded Selectors Audit

## Problem

~137 hardcoded CSS selector strings are used directly in `querySelector`, `querySelectorAll`, `closest`, and `matches` calls across 20+ modules. Per CLAUDE.md, all selectors should use `DOM_IDS`, `DOM_SELECTORS`, `DOM_CLASSES`, or `DATA_SELECTORS` from `constants.js`.

## Impact

- **Maintainability** — renaming a CSS class requires a multi-file search instead of a single constant change
- **Consistency** — some selectors are already in constants but still hardcoded in certain modules
- **Review blind spots** — hardcoded selectors bypass the selector checklist and are easy to miss in reviews

## Scope

**Estimated instances:** ~137 across 20+ modules

### Modules with Highest Counts

| Module | Approx. Instances | Examples |
|--------|-------------------|----------|
| `guidedTourManager.js` | 3+ | `'.tour-back'`, `'.tour-skip'`, `'.tour-next'` |
| `onboardingManager.js` | 9+ | `'.onboarding-step-indicator'`, `'.onboarding-try-btn'` |
| `routineSwitcher.js` | 10+ | `'.cycle-item-title'`, `'.mini-cycle-switch-item'` |
| `quickActionsManager.js` | 8+ | `'.quick-actions-slots'`, `'.quick-actions-nav'` |
| `menuManager.js` | 5+ | `'.menu-link-button'`, `'#taskList .task'` |
| `taskSearch.js` | 6+ | `'.filter-chip'`, `'.sort-chip'`, `'.filter-chip-group'` |
| `settingsUIManager.js` | 4+ | `'.settings-section-header.collapsible'` |
| `focusMode.js` | 3+ | `'.progress-container'` |
| `completedTasksManager.js` | 2+ | `'#completed-tasks-header .toggle-icon'` |
| `achievementsManager.js` | 5+ | `'.badge'`, `'.achievements-modal'` |
| `historyManager.js` | 5+ | `'.history-modal'`, `'.history-entry'` |
| `clearedTasksManager.js` | 5+ | `'.cleared-tasks-modal'`, `'.cleared-entry'` |
| `taskCRUD.js` | 4+ | `'.task-edit-input'`, `'.miniCycle-prompt-input'` |
| `preferencesPresets.js` | 3+ | `'.preferences-preset-item'` |
| `taskOptionsCustomizer.js` | 4+ | `'.task-option-item'` |
| Other modules | ~10+ | Various scattered instances |

## Approach

### Phase 1: Add Constants
Add missing selectors to `constants.js` in the appropriate section:
- `DOM_IDS` — for ID-based selectors
- `DOM_SELECTORS` — for class-based selectors (`.className`)
- `DOM_CLASSES` — for `classList.add/remove/contains/toggle` calls
- `DATA_SELECTORS` — for `[data-*]` attribute selectors (use factory functions)

### Phase 2: Replace Per Module
Work through modules one at a time, replacing hardcoded strings with constants. Each module should:
1. Import the needed constants (`DOM_IDS`, `DOM_SELECTORS`, `DOM_CLASSES`)
2. Replace all hardcoded selector strings
3. Verify syntax (`node -c`)
4. Test the affected feature

### Phase 3: Lint Rule (Optional)
Consider adding an ESLint rule or grep-based CI check to flag new hardcoded selectors in `querySelector`/`querySelectorAll`/`closest`/`matches` calls.

## Priority

**P2 — Maintainability debt, not a bug source.** No user-facing impact. Address opportunistically when touching these modules for other reasons, or as a dedicated cleanup sprint.

## What's Already Done Right

- `dragDropManager.js` — fully migrated (Mar 2026)
- `taskCRUD.js` — edit-focus classes migrated to `DOM_CLASSES` (Mar 2026)
- `routineSwitcher.js` — edit-focus classes migrated to `DOM_CLASSES` (Mar 2026)
- `taskSearch.js` — search overlay classes use `DOM_CLASSES` (Mar 2026)
- All `z-index` values use `Z_INDEX` constants — zero violations
- All notification strings use `getLabel()` — zero violations

## Related Docs

- `CLAUDE.md` — Rule #4: Always Use DOM_IDS, DOM_SELECTORS, DATA_SELECTORS from constants.js
- `docs/future-work/CODE_CONSISTENCY_AUDIT.md` — broader code consistency tracking
