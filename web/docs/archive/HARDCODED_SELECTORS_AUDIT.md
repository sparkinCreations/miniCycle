# Hardcoded Selectors Audit

## Status: COMPLETE (Mar 2026)

### classList operations: 100% migrated
520 hardcoded classList strings replaced with `DOM_CLASSES` constants across 55+ modules. ~45 new `DOM_CLASSES` constants added. Zero remaining in executable code.

### querySelector/closest/matches operations: 93% migrated
165 hardcoded selector strings replaced with `DOM_SELECTORS`/`DOM_IDS` constants across 25+ modules. ~45 new `DOM_SELECTORS`/`DOM_IDS` constants added. 11 remaining — all compound selectors or pseudo-class patterns.

### Overall: 685 → 11 (98.4% reduction)

## Remaining (11 compound selectors — intentionally left)

These are compound/pseudo-class selectors where creating constants provides diminishing returns:

| File | Selector | Reason |
|------|----------|--------|
| `modalManager.js` | `.onboarding-modal:not([style*="display: none"])` | Pseudo-class compound |
| `routineManager.js` | `.sample-item` | One-off modal element |
| `modeManager.js` | `.mode-badge` | One-off child lookup |
| `dueDates.js` | `.task` closest | Should use DOM_SELECTORS.TASK — minor miss |
| `achievementsManager.js` | `.badge-detail-popup` | One-off popup element |
| `reminders.js` | `.enable-task-reminders.reminder-active` | Compound of two existing selectors |
| `testing-modal-storage-viewer.js` | `.storage-modal-header` | Testing-only module |
| `testing-modal-integration.js` | `#close-test-runner` | Testing-only module |
| `taskDOM.js` | `.task.hover-enabled` | Compound selector |
| `taskCycleReset.js` | `.task input` | Compound selector |
| `taskRenderer.js` | `#taskList .task` | Compound of two constants |

## What Was Done

- **Phase 1 (classList):** 520 replacements across 55+ modules, ~45 new `DOM_CLASSES` constants
- **Phase 2 (querySelector):** 154 replacements across 25+ modules, ~45 new `DOM_SELECTORS`/`DOM_IDS` constants
- **Total new constants added:** ~90
- **All modified files pass `node -c` syntax validation**

## Related Docs

- `CLAUDE.md` — Rule #4: Always Use DOM_IDS, DOM_SELECTORS, DATA_SELECTORS from constants.js
- `docs/archive/HARDCODED_SELECTORS_AUDIT_CLASSLIST_COMPLETE.md` — original audit doc
