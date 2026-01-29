# Project Stats

> **Single Source of Truth for Volatile Metrics**
>
> This file contains metrics that change frequently (version, counts, etc.).
> All other documentation should reference this file instead of hardcoding these values.

**Last Updated**: January 29, 2026

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **App Version** | 1.877 |
| **Schema Version** | 2.5 |
| **Total Modules** | 102 |
| **Total Tests** | 1693 |
| **Test Pass Rate** | 100% |
| **CSS Files** | 30 |
| **JSDoc Blocks** | 919 |
| **Documentation Files** | 153 |
| **DI Completion** | 100% |
| **Custom window.* Globals (modules)** | 0 |

---

**Note:** `miniCycle.html` exposes a small set of window-scoped helpers (service worker update helpers and feature gate flags). Module code remains zero-globals.

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
| **Total** | **102** | |

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
| Total Tests | 1693 |
| Test Files | 59 |
| Pass Rate | 100% |
| Platforms Tested | Mac, iPad, iPhone |

---

## Architecture Milestones

| Milestone | Status | Date |
|-----------|--------|------|
| Strict DI (no `\|\| window.*` fallbacks) | ✅ Complete | Dec 2025 |
| Zero custom `window.*` globals in modules | ✅ Complete | Jan 2026 |
| Boot file split | ✅ Complete | Dec 2025 |
| CSS modularization | ✅ Complete | Jan 2026 |

---

## How to Update This File

**Automated Updates:**

Most metrics are automatically updated when you run `./scripts/update-version.sh`:
- ✅ App Version
- ✅ Total Modules (counted from `modules/`)
- ✅ Total Tests (counted from `tests/`)
- ✅ CSS Files (counted from `styles/`)
- ✅ JSDoc Blocks (counted from `modules/`)
- ✅ Documentation Files (counted from `docs/`)
- ✅ Last Updated date

**Manual Updates Required:**

These metrics must be updated manually as needed:
1. **Schema Version** - Only changes with data model updates
2. **Test Pass Rate** - Update after test runs (should always be 100%)
3. **DI Completion** - Update when DI migration milestones reached
4. **Custom window.* Globals** - Update if global count changes
5. **Module Breakdown** - Update counts per directory when structure changes
6. **Boot Files table** - Update line counts when boot files significantly change
7. **Test Files count** - Update when test file count changes significantly
8. **Architecture Milestones** - Add new milestones as they're reached

**Manual Count Commands (if needed):**
```bash
# Total modules by directory
find modules/boot -name "*.js" | wc -l       # boot/
find modules/core -name "*.js" | wc -l       # core/
find modules/task -name "*.js" | wc -l       # task/
# ... etc for each directory

# Test file count
find tests -name "*.tests.js" | wc -l

# Boot file line counts
wc -l miniCycle-main.js modules/boot/*.js
```

---

## Why This File Exists

Previously, these metrics were hardcoded in 20+ documentation files. Every version bump or module addition required updating all of them. This file centralizes volatile metrics so other docs can simply reference it.

**Other docs should say:**
> See [PROJECT_STATS.md](./PROJECT_STATS.md) for current metrics.

**Instead of:**
> Version: 1.684 | Modules: 91 | Tests: 1,690+
