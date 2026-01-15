# Project Stats

> **Single Source of Truth for Volatile Metrics**
>
> This file contains metrics that change frequently (version, counts, etc.).
> All other documentation should reference this file instead of hardcoding these values.

**Last Updated**: January 14, 2026

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **App Version** | 1.733 |
| **Schema Version** | 2.5 |
| **Total Modules** | 103 |
| **Total Tests** | 1,693 |
| **Test Pass Rate** | 100% |
| **CSS Files** | 30 |
| **JSDoc Blocks** | 896 |
| **Documentation Files** | 149 |
| **DI Completion** | 100% |
| **Custom window.* Globals** | 0 |

---

## Module Breakdown

| Directory | Count | Purpose |
|-----------|-------|---------|
| `boot/` | 6 | Boot sequence, orchestration, module loading |
| `core/` | 9 | AppState, appInit, appContext, DI base, constants |
| `task/` | 12 | Task CRUD, DOM, events, drag-drop, validation |
| `routine/` | 5 | Routine management, switching, migration |
| `recurring/` | 15 | Recurring task scheduling, panel, activation |
| `ui/` | 22 | Modals, menus, settings, onboarding, gestures |
| `features/` | 7 | Themes, stats, achievements, history, reminders |
| `utils/` | 12 | Notifications, device detection, utilities |
| `storage/` | 1 | Backup manager |
| `progress/` | 1 | Cycle completion tracking |
| `testing/` | 10 | Test infrastructure |
| `other/` | 3 | Plugins, experimental |
| **Total** | **103** | |

---

## Boot Files

| File | Lines | Purpose |
|------|-------|---------|
| `miniCycle-main.js` | ~56 | Entrypoint |
| `modules/boot/orchestrator.js` | ~402 | Pure sequence controller |
| `modules/boot/coreBoot.js` | ~905 | Core state & init |
| `modules/boot/featureBoot.js` | ~516 | DI wiring hub |
| `modules/boot/uiBoot.js` | ~761 | UI handlers |
| **Total** | **~2,640** | |

---

## Test Coverage

| Category | Tests |
|----------|-------|
| Total Tests | 1,693 |
| Test Files | 59 |
| Pass Rate | 100% |
| Platforms Tested | Mac, iPad, iPhone |

---

## Architecture Milestones

| Milestone | Status | Date |
|-----------|--------|------|
| Strict DI (no `\|\| window.*` fallbacks) | ✅ Complete | Dec 2025 |
| Zero custom `window.*` globals | ✅ Complete | Dec 2025 |
| Boot file split | ✅ Complete | Dec 2025 |
| CSS modularization | ✅ Complete | Jan 2026 |

---

## How to Update This File

When metrics change, update this file:

1. **Version changes**: Run `./update-version.sh` (updates `version.js`), then update the version here
2. **Module count**: `find modules -name "*.js" -type f | wc -l`
3. **Test count**: `grep -r "test(" tests --include="*.js" | wc -l`
4. **CSS files**: `find styles -name "*.css" -type f | wc -l`
5. **JSDoc blocks**: `grep -r "^/\*\*" modules --include="*.js" | wc -l`
6. **Boot file lines**: `wc -l miniCycle-main.js modules/boot/*.js`

---

## Why This File Exists

Previously, these metrics were hardcoded in 20+ documentation files. Every version bump or module addition required updating all of them. This file centralizes volatile metrics so other docs can simply reference it.

**Other docs should say:**
> See [PROJECT_STATS.md](./PROJECT_STATS.md) for current metrics.

**Instead of:**
> Version: 1.684 | Modules: 91 | Tests: 1,690+
