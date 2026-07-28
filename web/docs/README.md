# miniCycle Documentation

> **Comprehensive documentation for the miniCycle routine manager.**

For current version, test counts, and other metrics, see **[PROJECT_STATS.md](./PROJECT_STATS.md)**.

Welcome to the miniCycle documentation site! Use the sidebar to navigate through guides, architecture docs, and API references.

---

## 🚀 Start Here

### New to miniCycle?
- **[WHAT_IS_MINICYCLE.md](./start-here/WHAT_IS_MINICYCLE.md)** - Product overview and philosophy (routine manager, not todo app!)
- **[CLAUDE.md](working-on-code/CLAUDE.md)** - Essential guidance for AI assistants and quick onboarding
- **[QUICK_REFERENCE.md](./user-guides/QUICK_REFERENCE.md)** - Fast lookup for common tasks

### Setting Up Development
- **[DEVELOPER_DOCUMENTATION.md](DEVELOPER_DOCUMENTATION.md)** - Complete architecture overview and development guide

---

## 🏗️ Core Architecture & Concepts

### Application Structure
- **[DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md)** - Actual module dependencies and global usage
- **[APPINIT_EXPLAINED.md](./architecture/APPINIT_EXPLAINED.md)** - 2-phase initialization system
- **[SCHEMA_2_5.md](reference/SCHEMA_2_5.md)** - Data structure and schema documentation
- **[MODULE_SYSTEM_GUIDE.md](architecture/MODULE_SYSTEM_GUIDE.md)** - Module patterns and their limitations

### Key Features
- **[STATS_PANEL.md](./features/STATS_PANEL.md)** - Statistics dashboard with milestone tracking
- **[VOCAB_THEME_SYSTEM.md](features/VOCAB_THEME_SYSTEM.md)** - Per-routine vocabulary themes (Habit Tracker, Fitness, Scholar, Cleaning)
- **[THEME_ARCHITECTURE.md](./architecture/THEME_ARCHITECTURE.md)** - Complete three-layer theming system (vocabulary + color + dark mode)
- **[TASK_OPTIONS_CUSTOMIZER.md](./features/TASK_OPTIONS_CUSTOMIZER.md)** - Per-cycle button visibility customization
- **[FEATURE_LIST.md](reference/FEATURE_LIST.md)** - Complete feature list (156+ features)
- **[MODE_MANAGER_ARCHITECTURE.md](./architecture/MODE_MANAGER_ARCHITECTURE.md)** - Mode management system
- **[COMPLETED_TASKS_DROPDOWN.md](./features/COMPLETED_TASKS_DROPDOWN.md)** - Optional completed tasks dropdown
- **[minicycle-recurring-guide.md](reference/RECURRING_SYSTEM_REFERENCE.md)** - Recurring tasks implementation
- **[RECURRING_WATCH_FUNCTION.md](architecture/RECURRING_WATCH_FUNCTION.md)** - Polling-based task scheduling
- **[DRAG_DROP_ARCHITECTURE.md](./architecture/DRAG_DROP_ARCHITECTURE.md)** - Drag & drop system architecture
- **[DRAG_DROP_LONG_PRESS.md](./architecture/DRAG_DROP_LONG_PRESS.md)** - Cross-platform interaction patterns
- **[UNDO_REDO_ARCHITECTURE.md](./architecture/UNDO_REDO_ARCHITECTURE.md)** - Per-cycle undo/redo with IndexedDB persistence
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

### Security & Performance
- **[ERROR_HANDLING_AND_TESTING_SUMMARY.md](archive/ERROR_HANDLING_AND_TESTING_SUMMARY.md)** - Complete error handling improvements
- **[ERROR_HANDLING_IMPROVEMENTS.md](archive/ERROR_HANDLING_IMPROVEMENTS.md)** - Implementation details and safe utility functions
- **[DEVELOPER_DOCUMENTATION.md#-security](DEVELOPER_DOCUMENTATION.md#-security)** - XSS prevention, secure coding patterns

### Code Quality & Reviews
- **[COMPREHENSIVE_CODE_REVIEW_DEC_2025.md](archive/COMPREHENSIVE_CODE_REVIEW_DEC_2025.md)** - Full code review with ratings (8.8/10 overall)
- **[HIDDEN_CODEBASE_INSIGHTS.md](working-on-code/HIDDEN_CODEBASE_INSIGHTS.md)** - Non-obvious patterns and hidden behaviors

---

## 📊 Architecture Status

> **For current metrics (version, module count, test count, etc.), see [PROJECT_STATS.md](./PROJECT_STATS.md).**

### Architecture Achievements

The codebase has **complete strict DI** and **modular CSS**:
- ✅ All modules use strict dependency injection
- ✅ No `|| window.*` fallbacks remain
- ✅ Zero custom `window.*` globals
- ✅ Modules can be tested in isolation
- ✅ Boot files split for debuggability (Dec 2025)
- ✅ CSS modularized (Jan 2026)
- ✅ Comprehensive error handling with multi-tier fallbacks
- ✅ Enterprise-grade DI system rivaling frameworks

See [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) for complete analysis.

### Future Work
- **[MODULAR_OVERHAUL_PLAN.md](archive/MODULAR_OVERHAUL_PLAN.md)** - Plan for true modularization
- **[SCHEMA_2_6_PLAN.md](./future-work/SCHEMA_2_6_PLAN.md)** - Terminology alignment (cycles → routine)

### Completed Initiatives
- ✅ **Vocabulary Theme System** (Feb 2026) - See [THEME_ARCHITECTURE.md](./architecture/THEME_ARCHITECTURE.md) and [VOCAB_THEME_SYSTEM.md](features/VOCAB_THEME_SYSTEM.md)
- ✅ **CSS Modularization** (Jan 2026) - See [archive/CSS_REFACTOR_PLAN_COMPLETED.md](./archive/CSS_REFACTOR_PLAN_COMPLETED.md)

---

## 📖 Documentation by Use Case

### "I want to..."

**...understand how miniCycle works**
→ Start with [WHAT_IS_MINICYCLE.md](./start-here/WHAT_IS_MINICYCLE.md) then [DEVELOPER_DOCUMENTATION.md](DEVELOPER_DOCUMENTATION.md)

**...add a new feature**
→ Read [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) and [TESTING_QUICK_REFERENCE.md](./testing/TESTING_QUICK_REFERENCE.md)

**...work with AI assistants**
→ Point them to [CLAUDE.md](working-on-code/CLAUDE.md)

**...update the app version**
→ Follow [UPDATE-VERSION-GUIDE.md](./deployment/UPDATE-VERSION-GUIDE.md)

**...deploy to production**
→ See [DEPLOYMENT.md](./deployment/DEPLOYMENT.md)

**...understand recurring tasks**
→ See [minicycle-recurring-guide.md](reference/RECURRING_SYSTEM_REFERENCE.md)

**...work with data/storage**
→ Check [SCHEMA_2_5.md](reference/SCHEMA_2_5.md) and [MCYC_FILE_FORMAT.md](reference/MCYC_FILE_FORMAT.md)

**...understand the architecture limitations**
→ Read [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) and [MODULAR_OVERHAUL_PLAN.md](archive/MODULAR_OVERHAUL_PLAN.md)

**...see code quality assessment**
→ Check [COMPREHENSIVE_CODE_REVIEW_DEC_2025.md](archive/COMPREHENSIVE_CODE_REVIEW_DEC_2025.md) and [HIDDEN_CODEBASE_INSIGHTS.md](working-on-code/HIDDEN_CODEBASE_INSIGHTS.md)

**...modify styles or CSS**
→ See `styles/` folder structure in [FOLDER_STRUCTURE.md](./start-here/FOLDER_STRUCTURE.md) and CSS standards in [CODING_STANDARDS.md](working-on-code/CODING_STANDARDS.md)

**...add or modify a vocabulary theme**
→ See [VOCAB_THEME_SYSTEM.md](features/VOCAB_THEME_SYSTEM.md) and [THEME_ARCHITECTURE.md](./architecture/THEME_ARCHITECTURE.md)

---

## 🏛️ Archive

Historical documents and outdated guides are preserved in:
- **[archive/](./archive/)** - Previous iterations, completion summaries, namespace docs, and legacy documentation

---

## 🌐 Live Application

**Official URL:** [minicycleapp.com](https://minicycleapp.com)
- Redirects to: [minicycle.app/pages/product.html](https://minicycle.app/pages/product.html)
- Full App: [minicycle.app/miniCycle.html](https://minicycle.app/miniCycle.html)
- Lite Version: [minicycle.app/lite/miniCycle-lite.html](https://minicycle.app/lite/miniCycle-lite.html)
- Documentation: [minicycle.app/docs](https://minicycle.app/docs)
- Tests: [minicycle.app/tests/module-test-suite.html](https://minicycle.app/tests/module-test-suite.html)

See **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** for complete deployment information.

---

## 🤝 Contributing

When adding new documentation:
1. Use markdown (.md) format
2. Include clear headings and code examples
3. Update this README with a link in the appropriate section
4. Move outdated docs to `archive/` rather than deleting

---

**miniCycle** - Turn Your Routine Into Progress

Built with ❤️ by [sparkinCreations](https://sparkincreations.com) | Official Site: [minicycleapp.com](https://minicycleapp.com)
