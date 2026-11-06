# miniCycle Documentation

> **Comprehensive documentation for the miniCycle routine manager.**

For current version, test counts, and other metrics, see **[PROJECT_STATS.md](./PROJECT_STATS.md)**.

Welcome to the miniCycle documentation site! **Not sure where to start? The [docs index](INDEX.md) routes you by task** — new here, changing code, testing, shipping, debugging. The sidebar is the full map.

**Last verified:** Nov 5 2026

---

## 🚀 Start Here

### New to miniCycle?
- **[WHAT_IS_MINICYCLE.md](./start-here/WHAT_IS_MINICYCLE.md)** - Product overview and philosophy (routine manager, not todo app!)
- **[CLAUDE.md](working-on-code/CLAUDE.md)** - Essential guidance for AI assistants and quick onboarding
- **[QUICK_REFERENCE.md](./user-guides/QUICK_REFERENCE.md)** - Fast lookup for common tasks

### Setting Up Development
- **[GETTING_STARTED.md](./start-here/GETTING_STARTED.md)** - Run the app and the tests locally
- **[INDEX.md](INDEX.md)** - Which guide to read before which change

---

## 🏗️ Core Architecture & Concepts

### Application Structure
- **[DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md)** - Actual module dependencies and global usage
- **[APPINIT_EXPLAINED.md](./architecture/APPINIT_EXPLAINED.md)** - 2-phase initialization system
- **[SCHEMA_2_6.md](reference/SCHEMA_2_6.md)** - Data structure and schema documentation
- **[MODULE_SYSTEM_GUIDE.md](architecture/MODULE_SYSTEM_GUIDE.md)** - Module patterns and their limitations

### Key Features
- **[STATS_PANEL.md](./features/STATS_PANEL.md)** - Statistics dashboard with milestone tracking
- **[VOCAB_THEME_SYSTEM.md](features/VOCAB_THEME_SYSTEM.md)** - Per-routine vocabulary themes (Habit Tracker, Fitness, Scholar, Cleaning)
- **[THEME_ARCHITECTURE.md](./architecture/THEME_ARCHITECTURE.md)** - Complete three-layer theming system (vocabulary + color + dark mode)
- **[TASK_OPTIONS_CUSTOMIZER.md](./features/TASK_OPTIONS_CUSTOMIZER.md)** - Per-routine button visibility customization
- **[FEATURE_LIST.md](reference/FEATURE_LIST.md)** - The full feature list
- **[MODE_MANAGER_ARCHITECTURE.md](./architecture/MODE_MANAGER_ARCHITECTURE.md)** - Mode management system
- **[COMPLETED_TASKS_DROPDOWN.md](./features/COMPLETED_TASKS_DROPDOWN.md)** - Optional completed tasks dropdown
- **[RECURRING_SYSTEM_REFERENCE.md](reference/RECURRING_SYSTEM_REFERENCE.md)** - Recurring tasks implementation
- **[RECURRING_WATCH_FUNCTION.md](architecture/RECURRING_WATCH_FUNCTION.md)** - Polling-based task scheduling
- **[DRAG_DROP_ARCHITECTURE.md](./architecture/DRAG_DROP_ARCHITECTURE.md)** - Drag & drop system architecture
- **[DRAG_DROP_LONG_PRESS.md](./architecture/DRAG_DROP_LONG_PRESS.md)** - Cross-platform interaction patterns
- **[UNDO_REDO_ARCHITECTURE.md](./architecture/UNDO_REDO_ARCHITECTURE.md)** - Per-routine undo/redo with IndexedDB persistence
- **[STORAGE_MANAGEMENT.md](./features/STORAGE_MANAGEMENT.md)** - Storage budget, quota gates, eviction protection (persistence), and system-backup caps
- **[ERROR_RECOVERY.md](working-on-code/ERROR_RECOVERY.md)** - Corrupted-data salvage ladder and manual recovery

---

## 🧪 Testing

- **[TESTING_QUICK_REFERENCE.md](./testing/TESTING_QUICK_REFERENCE.md)** - Complete testing reference
  - Browser-based testing
  - GitHub Actions CI/CD integration
  - localStorage protection patterns
  - Template usage and test creation

Also see: [/tests/README.md](../tests/README.md) for quick start guides

---

## 🛠️ Development Guides

### Common Tasks
- **[UPDATE-VERSION-GUIDE.md](./deployment/UPDATE-VERSION-GUIDE.md)** - Version management with `update-version.sh`
- **[SERVICE_WORKER_UPDATE_STRATEGY.md](./deployment/SERVICE_WORKER_UPDATE_STRATEGY.md)** - PWA updates and cache management
- **[MCYC_FILE_FORMAT.md](reference/MCYC_FILE_FORMAT.md)** - Import/export file format specification

### Security & Error Handling
- **[SECURITY_GUIDE.md](working-on-code/SECURITY_GUIDE.md)** - XSS prevention, secure coding patterns
- **[ERROR_RECOVERY.md](working-on-code/ERROR_RECOVERY.md)** - What the app does with corrupted or missing data
- History (archived): [ERROR_HANDLING_AND_TESTING_SUMMARY.md](archive/ERROR_HANDLING_AND_TESTING_SUMMARY.md), [ERROR_HANDLING_IMPROVEMENTS.md](archive/ERROR_HANDLING_IMPROVEMENTS.md)

### Code Quality & Reviews
- **[REVIEW_PATTERNS.md](reference/REVIEW_PATTERNS.md)** - Known fault lines; read before reviewing or refactoring
- History (archived): [COMPREHENSIVE_CODE_REVIEW_DEC_2025.md](archive/COMPREHENSIVE_CODE_REVIEW_DEC_2025.md) - the Dec 2025 review and its ratings
- **[HIDDEN_CODEBASE_INSIGHTS.md](working-on-code/HIDDEN_CODEBASE_INSIGHTS.md)** - Non-obvious patterns and hidden behaviors

---

## 📊 Architecture Status

> **For current metrics (version, module count, test count, etc.), see [PROJECT_STATS.md](./PROJECT_STATS.md).**

### Architecture Achievements

What holds today, and what keeps it true:
- ✅ Every module dependency is declared and delivered — gated by `npm run validate:di` in CI
- ✅ Required dependencies are never read through `?.` — gated by `npm run validate:chains`
- ⚠️ No custom `window.*` globals in module code — a project rule (CLAUDE.md, mistake #1), but no gate enforces it, and one exception exists today: `modules/boot/orchestrator.js` exposes the boot-timing hook `window.getMiniCycleBootTiming` (found Nov 2026, docs audit round 1)
- ✅ Modules can be tested in isolation — the DI design ([ADR-002](ARCHITECTURE_DECISIONS.md)) and the browser suite (`npm test`) rely on it
- ✅ Boot files split for debuggability (Dec 2025); CSS modularized (Jan 2026)
- ✅ Corrupted or missing data is salvaged rather than reset — see [ERROR_RECOVERY.md](working-on-code/ERROR_RECOVERY.md)

See [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) for complete analysis.

### Future Work
- **[STATE_TRUTH_MIGRATION.md](./future-work/STATE_TRUTH_MIGRATION.md)** - Finish migrating cycle-complete / boot render off the DOM (Gen 1 leftovers)
- Everything else that is planned: the sidebar's *Future Work* section

### Completed Initiatives
- ✅ **Schema 2.6** (v2.573, Sep 2026) - routines keyed by id, priority as a level, one auto-clear map — see [SCHEMA_2_6.md](reference/SCHEMA_2_6.md) (plan archived: [SCHEMA_2_6_PLAN.md](./archive/SCHEMA_2_6_PLAN.md))
- ✅ **Strict DI overhaul** (Dec 2025) - see [DI_PATTERNS.md](working-on-code/DI_PATTERNS.md) (plan archived: [MODULAR_OVERHAUL_PLAN.md](archive/MODULAR_OVERHAUL_PLAN.md))
- ✅ **Vocabulary Theme System** (Feb 2026) - See [THEME_ARCHITECTURE.md](./architecture/THEME_ARCHITECTURE.md) and [VOCAB_THEME_SYSTEM.md](features/VOCAB_THEME_SYSTEM.md)
- ✅ **CSS Modularization** (Jan 2026) - See [archive/CSS_REFACTOR_PLAN_COMPLETED.md](./archive/CSS_REFACTOR_PLAN_COMPLETED.md)

---

## 📖 Documentation by Use Case

Moved to the **[docs index](INDEX.md)**, which routes by task (new here, changing code,
testing, shipping, debugging) and mirrors the repo-root `CLAUDE.md` read-first list.

---

## 🏛️ Archive

Historical documents and outdated guides are preserved in:
- **[archive/](./archive/)** - Previous iterations, completion summaries, namespace docs, and legacy documentation

---

## 🌐 Live Application

**Official URL:** [minicycleapp.com](https://minicycleapp.com)
- Redirects to: [minicycle.app](https://minicycle.app/) — the product page (the site root since Nov 2026)
- Full App: [minicycle.app/app](https://minicycle.app/app) (old `/minicycle` and `/miniCycle.html` links redirect here)
- Lite Version: [minicycle.app/lite/miniCycle-lite.html](https://minicycle.app/lite/miniCycle-lite.html)
- Documentation: [docs.minicycle.app](https://docs.minicycle.app)
- Tests: [minicycle.app/tests/module-test-suite.html](https://minicycle.app/tests/module-test-suite.html)

See **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** for complete deployment information.

---

## 🤝 Contributing

When adding new documentation:
1. Use markdown (.md) format
2. Include clear headings and code examples
3. Add it to `_sidebar.md` in the right section — `npm run validate:docs` fails on a doc the sidebar cannot reach; if it is a guide someone must read before a kind of change, route it from [INDEX.md](INDEX.md) too
4. Move outdated docs to `archive/` rather than deleting (with a one-line `> Archived <date>: <why>` banner)

---

**miniCycle** - Turn Your Routine Into Progress

Built with ❤️ by [sparkinCreations](https://sparkincreations.com) | Official Site: [minicycleapp.com](https://minicycleapp.com)
