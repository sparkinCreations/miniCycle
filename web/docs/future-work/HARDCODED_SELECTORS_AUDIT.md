# Hardcoded Selectors Audit

## Status

**classList operations: COMPLETE** (Mar 2026) — 520 hardcoded classList strings migrated to `DOM_CLASSES` constants across 55+ modules. Zero remaining in executable code. Archived: `docs/archive/HARDCODED_SELECTORS_AUDIT_CLASSLIST_COMPLETE.md`

**querySelector/closest/matches operations: NOT STARTED** — hardcoded selector strings in `querySelector`, `querySelectorAll`, `closest`, and `matches` calls still exist across the codebase.

## Remaining Work

Hardcoded CSS selector strings passed to `querySelector`, `querySelectorAll`, `closest`, and `matches` calls should be migrated to `DOM_IDS`, `DOM_SELECTORS`, or `DATA_SELECTORS` from `constants.js`.

### Examples of Remaining Violations

```javascript
// These should use DOM_SELECTORS or DOM_IDS constants:
querySelector('.tour-back')           // → DOM_SELECTORS.TOUR_BACK
querySelector('.filter-chip')         // → DOM_SELECTORS.FILTER_CHIP
querySelector('.onboarding-step-indicator')
querySelectorAll('.menu-link-button')
closest('.quick-actions-slots')
element.matches('.move-up, .move-down')  // already done in dragDropManager
```

### Modules with Known Violations

| Module | Approx. Count | Examples |
|--------|---------------|----------|
| `guidedTourManager.js` | 3+ | `'.tour-back'`, `'.tour-skip'`, `'.tour-next'` |
| `onboardingManager.js` | 5+ | `'.onboarding-step-indicator'`, `'.onboarding-try-btn'` |
| `quickActionsManager.js` | 5+ | `'.quick-actions-slots'`, `'.quick-actions-nav'` |
| `menuManager.js` | 3+ | `'.menu-link-button'` |
| `taskSearch.js` | 4+ | `'.filter-chip'`, `'.sort-chip'`, `'.filter-chip-group'` |
| `settingsUIManager.js` | 2+ | `'.settings-section-header.collapsible'` |
| `preferencesPresets.js` | 3+ | `'.preferences-preset-item'` |
| Other modules | Various | Scattered instances |

## Approach

### Phase 1: Add Constants
Add missing selectors to `constants.js`:
- `DOM_SELECTORS` — for class-based selectors (`.className`)
- `DATA_SELECTORS` — for `[data-*]` attribute selectors (use factory functions)

### Phase 2: Replace Per Module
For each module:
1. Import the needed constants
2. Replace hardcoded selector strings
3. Verify syntax (`node -c`)
4. Test the affected feature

### Phase 3: Lint Rule (Optional)
Consider an ESLint rule or grep-based CI check to flag new hardcoded selectors.

## Priority

**P2 — Maintainability debt, not a bug source.** Address opportunistically when touching these modules.

## What's Done

- **classList operations** — 100% migrated to `DOM_CLASSES` (520 replacements, 55+ files, ~45 new constants added)
- **dragDropManager.js** — fully migrated including querySelector calls (Mar 2026)
- **Z_INDEX constants** — 100% compliant, zero violations
- **getLabel() for strings** — 100% compliant, zero violations

## Related Docs

- `CLAUDE.md` — Rule #4: Always Use DOM_IDS, DOM_SELECTORS, DATA_SELECTORS from constants.js
- `docs/archive/HARDCODED_SELECTORS_AUDIT_CLASSLIST_COMPLETE.md` — original audit doc (classList portion complete)
