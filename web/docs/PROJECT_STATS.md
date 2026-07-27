# Project Stats

> **Single Source of Truth for Volatile Metrics**
>
> This file contains metrics that change frequently (version, counts, etc.).
> All other documentation should reference this file instead of hardcoding these values.

**Last Updated**: July 27, 2026

---

## Quick Reference

| Metric | Value |
|--------|-------|
| **App Version** | 2.333 |
| **Lite Version** | 2.092 (frozen) |
| **Schema Version** | 2.5 |
| **Total Modules** | 133 |
| **Total Tests** | 3101 |
| **Test Pass Rate** | 100% |
| **CSS Files** | 44 |
| **JSDoc Blocks** | 1312 |
| **Documentation Files** | 238 |
| **DI Completion** | 100% |
| **Custom window.* Globals (modules)** | 0 |

---

**Note:** `miniCycle.html` exposes a small set of window-scoped helpers (service worker update helpers and feature gate flags). Module code remains zero-globals.

## Module Breakdown

| Directory | Count | Purpose |
|-----------|-------|---------|
| `boot/` | 7 | Boot sequence, orchestration, module loading |
| `core/` | 9 | AppState, appInit, appContext, DI base, constants |
| `task/` | 13 | Task CRUD, DOM, events, drag-drop, validation |
| `routine/` | 5 | Routine management, switching, migration |
| `recurring/` | 16 | Recurring task scheduling, panel, activation |
| `ui/` | 37 | Modals, menus, settings, onboarding, gestures |
| `features/` | 9 | Themes, stats, achievements, history, reminders |
| `utils/` | 18 | Notifications, device detection, utilities |
| `labels/` | 3 | Default labels + label resolver |
| `storage/` | 2 | Backup manager (IndexedDB), storage persistence (eviction protection) |
| `progress/` | 1 | Cycle completion tracking |
| `testing/` | 9 | Test infrastructure |
| `other/` | 3 | Plugins, experimental |
| **Total** | **133** | |

---

## Boot Files

| File | Lines | Purpose |
|------|-------|---------|
| `miniCycle-main.js` | ~49 | Entrypoint |
| `modules/boot/orchestrator.js` | ~1219 | Sequence control + boot UI + early coordination |
| `modules/boot/coreBoot.js` | ~785 | Core state & init |
| `modules/boot/featureBoot.js` | ~617 | DI wiring hub |
| `modules/boot/uiBoot.js` | ~1173 | UI handlers |
| **Total** | **~3843** | |

---

## Test Coverage

| Category | Tests |
|----------|-------|
| Total Tests | 3101 |
| Test Files | 124 |
| Pass Rate | 100% |
| Platforms Tested | Mac, iPad, iPhone |

> **Note:** Test file count is `.tests.js` files only. The `tests/` directory also contains 5 helper/utility files (testHelpers.js, testContext.js, performance.benchmark.js, etc.).

---

## Architecture Milestones

| Milestone | Status | Date |
|-----------|--------|------|
| Strict DI (no `\|\| window.*` fallbacks) | ✅ Complete | Dec 2025 |
| Zero custom `window.*` globals in modules | ✅ Complete | Jan 2026 |
| Boot file split | ✅ Complete | Dec 2025 |
| CSS modularization | ✅ Complete | Jan 2026 |

> **DI breakdown:** Most modules use `diBase.js` (`createDIModule`), a small number of core/boot/testing modules use custom `set*Dependencies()` functions, and the remainder are pure utilities/constants that don't require DI. The key guarantee: **zero modules use `|| window.*` fallbacks**.

### Boot Fallback Safety Nets

| Fallback | Trigger | Location |
|----------|---------|----------|
| **8-second late fallback** | Feature gate needs lite OR boot never started within 8s | `miniCycle.html` (late fallback IIFE) |
| **60-second load timeout** | App loader still visible after 60s → redirect to lite | `miniCycle.html` (load timeout IIFE) |
| **Boot failure counter** | 2+ consecutive boot failures → cache clear | `miniCycle.html` (boot failsafe IIFE) |
| **Phase timeouts** | 15s/20s/15s per boot phase | `modules/core/constants.js` |

---

## How to Update This File

**Automated Updates:**

All volatile metrics are automatically updated when you run `./scripts/update-version.sh`:
- ✅ App Version
- ✅ Lite Version (read from `lite/miniCycle-lite-scripts.js`)
- ✅ Total Modules (counted from `modules/`)
- ✅ Module Breakdown per directory (counted per `modules/*/`)
- ✅ Total Tests (counted from `tests/`)
- ✅ Test Files (`.tests.js` files counted from `tests/`)
- ✅ CSS Files (counted from `styles/`)
- ✅ JSDoc Blocks (counted from `modules/`)
- ✅ Documentation Files (counted from `docs/`)
- ✅ Boot Files line counts (via `wc -l`)
- ✅ Last Updated date

**Manual Updates Required:**

These metrics must be updated manually as needed:
1. **Schema Version** - Only changes with data model updates
2. **Test Pass Rate** - Update after test runs (should always be 100%)
3. **DI Completion** - Update when DI migration milestones reached
4. **Custom window.* Globals** - Update if global count changes
5. **Architecture Milestones** - Add new milestones as they're reached

---

## Why This File Exists

Previously, these metrics were hardcoded in 20+ documentation files. Every version bump or module addition required updating all of them. This file centralizes volatile metrics so other docs can simply reference it.

**Other docs should say:**
> See [PROJECT_STATS.md](./PROJECT_STATS.md) for current metrics.

**Instead of:**
> Version: 1.684 | Modules: 91 | Tests: 1,690+
