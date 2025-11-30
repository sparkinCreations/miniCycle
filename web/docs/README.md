# miniCycle Documentation

> **Comprehensive documentation for the miniCycle routine manager.**

**Version**: 1.284 | **Test Coverage**: 1011/1011 (100%) ✅ | **Platforms**: Mac, iPad, iPhone

Welcome to the miniCycle documentation site! Use the sidebar to navigate through guides, architecture docs, and API references.

---

## 🚀 Start Here

### New to miniCycle?
- **[WHAT_IS_MINICYCLE.md](./user-guides/WHAT_IS_MINICYCLE.md)** - Product overview and philosophy (routine manager, not todo app!)
- **[CLAUDE.md](./developer-guides/CLAUDE.md)** - Essential guidance for AI assistants and quick onboarding
- **[QUICK_REFERENCE.md](./user-guides/QUICK_REFERENCE.md)** - Fast lookup for common tasks

### Setting Up Development
- **[DEVELOPER_DOCUMENTATION.md](./developer-guides/DEVELOPER_DOCUMENTATION.md)** - Complete architecture overview and development guide

---

## 🏗️ Core Architecture & Concepts

### Application Structure
- **[DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md)** - Actual module dependencies and global usage
- **[APPINIT_EXPLAINED.md](./architecture/APPINIT_EXPLAINED.md)** - 2-phase initialization system
- **[SCHEMA_2_5.md](./data-schema/SCHEMA_2_5.md)** - Data structure and schema documentation
- **[MODULE_SYSTEM_GUIDE.md](./developer-guides/MODULE_SYSTEM_GUIDE.md)** - Module patterns and their limitations

### Key Features
- **[TASK_OPTIONS_CUSTOMIZER.md](./features/TASK_OPTIONS_CUSTOMIZER.md)** - Per-cycle button visibility customization
- **[MODE_MANAGER_ARCHITECTURE.md](./architecture/MODE_MANAGER_ARCHITECTURE.md)** - Mode management system
- **[COMPLETED_TASKS_DROPDOWN.md](./features/COMPLETED_TASKS_DROPDOWN.md)** - Optional completed tasks dropdown
- **[minicycle-recurring-guide.md](./features/minicycle-recurring-guide.md)** - Recurring tasks implementation
- **[RECURRING_WATCH_FUNCTION.md](./features/RECURRING_WATCH_FUNCTION.md)** - Polling-based task scheduling
- **[DRAG_DROP_ARCHITECTURE.md](./architecture/DRAG_DROP_ARCHITECTURE.md)** - Drag & drop system architecture
- **[DRAG_DROP_LONG_PRESS.md](./architecture/DRAG_DROP_LONG_PRESS.md)** - Cross-platform interaction patterns
- **[UNDO_REDO_ARCHITECTURE.md](./architecture/UNDO_REDO_ARCHITECTURE.md)** - Per-cycle undo/redo with IndexedDB persistence

---

## 🧪 Testing

- **[TESTING_QUICK_REFERENCE.md](./testing/TESTING_QUICK_REFERENCE.md)** - Complete testing reference (33 modules, 1011/1011 tests - 100% ✅)
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
- **[MCYC_FILE_FORMAT.md](./data-schema/MCYC_FILE_FORMAT.md)** - Import/export file format specification

### Security & Performance
- **[ERROR_HANDLING_AND_TESTING_SUMMARY.md](./security/ERROR_HANDLING_AND_TESTING_SUMMARY.md)** - Complete error handling improvements
- **[ERROR_HANDLING_IMPROVEMENTS.md](./security/ERROR_HANDLING_IMPROVEMENTS.md)** - Implementation details and safe utility functions
- **[DEVELOPER_DOCUMENTATION.md#-security](./developer-guides/DEVELOPER_DOCUMENTATION.md#-security)** - XSS prevention, secure coding patterns

---

## 📊 Architecture Status

### Current State (November 2025)

| Metric | Value |
|--------|-------|
| Main script | ~3,700 lines |
| Modules | 43 files |
| `window.*` globals created | ~68 |
| `window.*` globals consumed | ~748 |
| Test coverage | 1011 tests (100%) |

### The Reality

The codebase has **DI structure but global coupling**:
- ✅ Code is organized into files
- ✅ DI boilerplate exists in constructors
- ❌ Modules can't be tested in isolation
- ❌ Dependencies are invisible (not in imports)
- ❌ Can't reuse modules elsewhere

See [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) for complete analysis.

### Future Work
- **[MODULAR_OVERHAUL_PLAN.md](./future-work/MODULAR_OVERHAUL_PLAN.md)** - Plan for true modularization
- **[SCHEMA_2_6_PLAN.md](./future-work/SCHEMA_2_6_PLAN.md)** - Terminology alignment (cycles → routine)
- **[CSS_REFACTOR_PLAN.md](./future-work/CSS_REFACTOR_PLAN.md)** - CSS organization improvements

---

## 📖 Documentation by Use Case

### "I want to..."

**...understand how miniCycle works**
→ Start with [WHAT_IS_MINICYCLE.md](./user-guides/WHAT_IS_MINICYCLE.md) then [DEVELOPER_DOCUMENTATION.md](./developer-guides/DEVELOPER_DOCUMENTATION.md)

**...add a new feature**
→ Read [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) and [TESTING_QUICK_REFERENCE.md](./testing/TESTING_QUICK_REFERENCE.md)

**...work with AI assistants**
→ Point them to [CLAUDE.md](./developer-guides/CLAUDE.md)

**...update the app version**
→ Follow [UPDATE-VERSION-GUIDE.md](./deployment/UPDATE-VERSION-GUIDE.md)

**...deploy to production**
→ See [DEPLOYMENT.md](./deployment/DEPLOYMENT.md)

**...understand recurring tasks**
→ See [minicycle-recurring-guide.md](./features/minicycle-recurring-guide.md)

**...work with data/storage**
→ Check [SCHEMA_2_5.md](./data-schema/SCHEMA_2_5.md) and [MCYC_FILE_FORMAT.md](./data-schema/MCYC_FILE_FORMAT.md)

**...understand the architecture limitations**
→ Read [DEPENDENCY_MAP.md](./architecture/DEPENDENCY_MAP.md) and [MODULAR_OVERHAUL_PLAN.md](./future-work/MODULAR_OVERHAUL_PLAN.md)

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
