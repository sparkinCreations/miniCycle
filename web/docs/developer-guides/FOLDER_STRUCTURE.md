# miniCycle Folder Structure

**Last Updated:** December 11, 2025
**Status:** All 46 modules use strict DI | Boot files split (Dec 2025)

---

## 📋 Table of Contents

- [Philosophy](#philosophy)
- [Design Principles](#design-principles)
- [Complete Structure](#complete-structure)
- [Top-Level Directories](#top-level-directories)
- [Modules Organization](#modules-organization)
- [Key Directories Explained](#key-directories-explained)
- [Evolution History](#evolution-history)
- [Navigation Guide](#navigation-guide)

---

## Philosophy

> **"Organization should serve the developer, not complicate deployment."**

miniCycle's folder structure evolved through three major phases:

### 1. **Modularization First** (Oct 2025)
The monolithic 15,677-line script was broken into 33 focused modules (12,003 lines extracted). This achieved a 74.8% reduction while maintaining 100% test coverage.

### 2. **Logical Grouping** (Nov 2025)
Modules were organized into domain-based subfolders (`core/`, `task/`, `cycle/`, etc.) to improve discoverability and reduce cognitive load.

### 3. **Clean Root** (Nov 2025)
Marketing pages, legal documents, and archived code were moved into dedicated folders, leaving the root clean and deployment-ready.

**Result:** A structure that's easy to navigate, test, and deploy without breaking URLs or requiring build tools.

---

## Design Principles

### ✅ Zero Deployment Complexity
- No build step required
- Works with existing Netlify setup
- All files deploy as-is from `web/`

### ✅ Domain-Driven Organization
- Modules grouped by business domain (task, cycle, recurring)
- Not by technical pattern (controllers, services, utils)
- Makes onboarding and feature work faster

### ✅ Future-Ready Structure
- Prepared for desktop/mobile expansion
- Shared code infrastructure ready but empty
- Can grow without restructuring

### ✅ Test-Friendly Layout
- Tests mirror module structure
- Easy to find corresponding tests
- 1458/1458 tests passing ✅

### ✅ Clear Separation of Concerns
- Application code in `modules/`
- Developer docs in `docs/`
- User-facing pages in `pages/`, `legal/`, `lite/`
- Historical work in `archive/`

---

## Complete Structure

```
web/
│
├── 📄 miniCycle.html                    # Main PWA entry point
├── 📄 miniCycle-main.js                 # Entrypoint (~133 lines) - loads orchestrator
├── 📄 miniCycle-styles.css              # Application styles
├── 📄 service-worker.js                 # PWA service worker
├── 📄 version.js                        # Single source of truth for versions
├── 📄 manifest.json                     # PWA manifest (full version)
├── 📄 manifest-lite.json                # PWA manifest (lite version)
├── 📄 package.json                      # Dependencies & scripts
├── 📄 _redirects                        # Netlify redirects for URL compatibility
│
├── 📁 modules/                          # ES6 application modules (46 modules, all strict DI)
│   ├── boot/                            # Boot sequence modules (Dec 2025 split)
│   │   ├── orchestrator.js              # DI wiring hub (~1,883 lines)
│   │   ├── coreBoot.js                  # Core state & init (~673 lines)
│   │   ├── featureBoot.js               # Feature module loading (~1,470 lines)
│   │   └── uiBoot.js                    # UI event handlers (~406 lines)
│   ├── core/                            # Essential system modules
│   ├── task/                            # Task management system (7 modules)
│   ├── cycle/                           # Cycle management system (5 modules)
│   ├── recurring/                       # Recurring tasks system (3 modules)
│   ├── ui/                              # UI coordination (6 modules)
│   ├── features/                        # Optional/pluggable features (4 modules)
│   ├── utils/                           # Shared utilities (4 modules)
│   ├── testing/                         # Testing infrastructure (5 modules)
│   └── other/                           # Experimental/plugin examples (3 modules)
│
├── 📁 pages/                            # Marketing & product pages
│   ├── product.html
│   └── learn_more.html
│
├── 📁 legal/                            # Legal & user documentation
│   ├── privacy.html
│   ├── terms.html
│   ├── user-manual.html
│   └── user-manual-styles.css
│
├── 📁 lite/                             # ES5 legacy version
│   ├── miniCycle-lite.html
│   ├── miniCycle-lite-scripts.js        # ES5 compatible version
│   └── miniCycle-lite-styles.css
│
├── 📁 miniCycleGames/                   # Hidden mini-games
│   ├── miniCycle-taskOrder.html         # Whack-a-Order game (unlocks at 100 cycles)
│   ├── miniCycle-taskScramble.html
│   └── miniCycle-taskGame.html
│
├── 📁 docs/                             # Developer documentation (Docsify)
│   ├── index.html                       # Docsify configuration
│   ├── README.md                        # Documentation hub
│   ├── _sidebar.md                      # Navigation sidebar
│   ├── DEVELOPER_DOCUMENTATION.md       # Complete dev guide
│   ├── FOLDER_STRUCTURE.md              # This file!
│   ├── CLAUDE.md                        # AI assistant guide
│   ├── [architecture docs]
│   └── archive/                         # Historical/completed docs
│
├── 📁 tests/                            # Test suite (1458 tests, 100% passing)
│   ├── module-test-suite.html           # Browser test runner
│   ├── automated/                       # Playwright automation
│   ├── [33 module test files]
│   └── MODULE_TEMPLATE.tests.js         # Template for new tests
│
├── 📁 assets/                           # Static assets
│   ├── images/                          # Images, logos, onboarding
│   └── videos/                          # Tutorial videos
│
├── 📁 scripts/                          # Build & utility scripts
│   ├── version.js                       # Version sync (symlink to root)
│   ├── update-version.sh                # Automated version updater
│   └── backup/                          # Timestamped backups
│
├── 📁 examples/                         # Example code & references
│   ├── routines/                        # Example .mcyc files
│   └── pwa-reference/                   # PWA implementation examples
│
├── 📁 archive/                          # Legacy & backup files
│   ├── backup/                          # Manual backups
│   └── TTO/                             # "The Takeout" legacy code
│
├── 📁 blog/                             # Blog system (optional)
│   ├── index.html
│   ├── posts/                           # Blog posts
│   ├── scripts/                         # Blog app logic
│   └── styles/                          # Blog styles
│
└── 📁 backup/                           # Automatic backups from update-version.sh
    └── [timestamped backups]
```

---

## Top-Level Directories

### `/modules/` - Application Code
**Purpose:** All ES6 application modules organized by domain
**Philosophy:** Domain-driven organization beats technical layering
**Why this matters:** Developers think in features (tasks, cycles), not abstractions (services, controllers)

### `/docs/` - Developer Documentation
**Purpose:** Comprehensive documentation powered by Docsify
**Philosophy:** Docs should live with code, be searchable, and versioned
**Why this matters:** GitHub renders Markdown beautifully, Docsify adds navigation

### `/tests/` - Test Suite
**Purpose:** 1458 automated tests mirroring module structure
**Philosophy:** Tests are first-class citizens, not afterthoughts
**Why this matters:** 100% passing tests = confidence to refactor fearlessly

### `/pages/` - Marketing Pages
**Purpose:** Product pages separate from the application
**Philosophy:** Marketing evolves independently from core product
**Why this matters:** Designers can edit marketing without touching app code

### `/legal/` - Legal Documents
**Purpose:** Privacy policy, terms, user manual
**Philosophy:** Legal compliance should be organized and accessible
**Why this matters:** GDPR, accessibility, and user trust

### `/lite/` - Legacy Browser Support
**Purpose:** ES5 version for older devices
**Philosophy:** Progressive enhancement, not graceful degradation
**Why this matters:** iPad 3 users deserve task cycling too

### `/miniCycleGames/` - Hidden Games
**Purpose:** Easter egg mini-games (unlock rewards)
**Philosophy:** Delight users, encourage engagement
**Why this matters:** 100 cycles is a milestone worth celebrating

### `/assets/` - Static Files
**Purpose:** Images, videos, fonts that rarely change
**Philosophy:** Binary files separate from code
**Why this matters:** Faster deploys, better caching

### `/scripts/` - Build Utilities
**Purpose:** Version management, backups, automation
**Philosophy:** Scripts should be discoverable and documented
**Why this matters:** `./update-version.sh` prevents human error

### `/examples/` - Reference Material
**Purpose:** Example routines, PWA references, learning resources
**Philosophy:** Show, don't just tell
**Why this matters:** Developers learn by example

### `/archive/` - Legacy Code
**Purpose:** Historical implementations, migration artifacts
**Philosophy:** Never delete history, just organize it
**Why this matters:** Sometimes you need to reference "the old way"

### `/backup/` - Automatic Backups
**Purpose:** Timestamped backups from version updates
**Philosophy:** Always have an escape hatch
**Why this matters:** `update-version.sh` creates restore points automatically

### `/blog/` - Blog System
**Purpose:** Marketing blog with static generation
**Philosophy:** Own your content, keep it simple
**Why this matters:** No external CMS dependencies

---

## Modules Organization

The `/modules/` directory contains 46 ES6 modules organized into 11 logical groups. **All modules use strict dependency injection with no `|| window.*` fallbacks.**

### `boot/` - Boot Sequence Modules (Dec 2025)
**Purpose:** Application boot orchestration split into focused files
**When to add here:** Only boot-related code (initialization, DI wiring, UI setup)

- `orchestrator.js` (1,883 lines) - DI wiring hub, coordinates boot sequence
- `coreBoot.js` (673 lines) - Core state, AppState, migration, sets `window.AppBootStarted`
- `featureBoot.js` (1,470 lines) - Feature module loading and DI wiring
- `uiBoot.js` (406 lines) - UI event handlers, loader helpers, device detection

**Philosophy:** Split from monolithic `miniCycle-scripts.js` for better debuggability. Each file can be uploaded independently for AI-assisted debugging.

**Load Order:**
```
miniCycle-main.js (entrypoint)
  → modules/boot/orchestrator.js
      → modules/boot/coreBoot.js (sets AppBootStarted immediately)
      → modules/boot/featureBoot.js (DI wiring)
      → modules/boot/uiBoot.js (UI handlers)
```

---

### `core/` - Essential System Modules
**Purpose:** Foundation modules required for app initialization
**When to add here:** Never. Core is frozen - only appState, appInit, and constants belong here.

- `appState.js` (415 lines) - Centralized state management with localStorage persistence
- `appInit.js` (186 lines) - Two-phase initialization system
- `appGlobalState.js` (266 lines) - Global runtime state and feature flags
- `constants.js` - Application constants

**Philosophy:** Core modules are special - they initialize before everything else and are dependency-injected into other modules.

---

### `task/` - Task Management System (7 modules)
**Purpose:** Everything related to individual task lifecycle
**When to add here:** Task creation, validation, rendering, events, drag-drop

- `taskCore.js` (778 lines) - CRUD operations and business logic
- `taskDOM.js` (1,108 lines) - DOM coordination and composition
- `taskRenderer.js` (333 lines) - DOM element creation and rendering
- `taskEvents.js` (427 lines) - Event handling (clicks, inputs, focus)
- `taskValidation.js` (215 lines) - Input validation and sanitization
- `taskUtils.js` (370 lines) - Helper functions and utilities
- `dragDropManager.js` (695 lines) - Drag & drop with Safari compatibility

**Philosophy:** Task system split by responsibility, not by implementation detail. DOM coordination (`taskDOM.js`) orchestrates rendering (`taskRenderer.js`) and events (`taskEvents.js`).

**Reasoning:** A 3,000-line monolith was impossible to test. Seven focused modules each have clear contracts and 100% test coverage.

---

### `cycle/` - Cycle Management System (5 modules)
**Purpose:** Cycle lifecycle from creation to switching to migration
**When to add here:** Cycle operations, mode changes, data migration

- `cycleLoader.js` (273 lines) - Data loading and file import/export
- `cycleManager.js` (445 lines) - Cycle creation and management
- `cycleSwitcher.js` (677 lines) - Cycle switching with modal UI
- `modeManager.js` (380 lines) - Auto/Manual/Todo mode management
- `migrationManager.js` (850 lines) - Schema migrations and data upgrades

**Philosophy:** Cycles are first-class entities with complex state machines. Each module handles one phase of the cycle lifecycle.

**Reasoning:** Cycle switching involves 20+ steps. Breaking it into loader → manager → switcher made it testable and debuggable.

---

### `recurring/` - Recurring Tasks System (3 modules)
**Purpose:** Template-based recurring task generation
**When to add here:** Recurring logic, scheduling, UI

- `recurringCore.js` (927 lines) - Business logic and scheduling
- `recurringPanel.js` (2,219 lines) - Complex UI for recurring settings
- `recurringIntegration.js` (361 lines) - Integration with task system

**Philosophy:** Recurring is a feature layer on top of tasks. It generates tasks from templates based on schedules.

**Reasoning:** Recurring panel is the most complex UI in miniCycle. Keeping it isolated prevents contaminating simpler modules.

---

### `ui/` - UI Coordination (7 modules)
**Purpose:** Application-level UI that coordinates multiple systems
**When to add here:** Modals, menus, settings, onboarding, undo/redo, customization

- `modalManager.js` (383 lines) - Modal lifecycle and stacking
- `menuManager.js` (546 lines) - Settings menu and navigation
- `settingsManager.js` (952 lines) - Settings panel and persistence
- `onboardingManager.js` (291 lines) - First-time user experience
- `undoRedoManager.js` (463 lines) - Per-cycle undo/redo with IndexedDB
- `gamesManager.js` (195 lines) - Mini-game unlock and panel
- `taskOptionsCustomizer.js` (635 lines) - Per-cycle button visibility customization (v1.357+)

**Philosophy:** UI modules don't contain business logic - they coordinate other modules and present data.

**Reasoning:** Settings panel needs to interact with themes, notifications, recurring, etc. It orchestrates, doesn't implement.

---

### `features/` - Optional/Pluggable Features (4 modules)
**Purpose:** Features that enhance core experience but aren't required
**When to add here:** New optional features that can be disabled

- `dueDates.js` (233 lines) - Task due date management
- `reminders.js` (621 lines) - Custom reminder system
- `themeManager.js` (856 lines) - Dynamic theming with unlockables
- `statsPanel.js` (1,047 lines) - Statistics and achievements

**Philosophy:** Features should be optional and independently testable. The app works without them.

**Reasoning:** Not all users need due dates or themes. Keeping them optional reduces bundle size for minimal installs.

---

### `utils/` - Shared Utilities (4 modules)
**Purpose:** Reusable utilities with no business logic dependencies
**When to add here:** Pure functions, platform detection, logging

- `globalUtils.js` (490 lines) - Pure utility functions
- `notifications.js` (1,036 lines) - Toast notification system
- `deviceDetection.js` (353 lines) - Platform and capability detection
- `consoleCapture.js` (415 lines) - Console logging for debugging

**Philosophy:** Utils are stateless, dependency-free, and reusable across modules.

**Reasoning:** Utilities should be boring and predictable. No surprises, just reliable helpers.

---

### `testing/` - Testing Infrastructure (5 modules)
**Purpose:** Test-related modules that shouldn't pollute production modules
**When to add here:** Test helpers, mocks, test UI

- `testing-modal.js` (891 lines) - In-app testing modal
- `testing-modal-integration.js` (156 lines) - Test runner integration
- `testing-modal-modifications.js` (89 lines) - Test-specific modifications
- `testing-modal-tab-html.html` - Test UI HTML
- `automated-tests-fix.js` (42 lines) - Test automation fixes

**Philosophy:** Testing is important enough to deserve its own space.

**Reasoning:** Test modules clutter the main module namespace. Isolating them makes production imports cleaner.

---

### `other/` - Experimental & Plugin Examples (3 modules)
**Purpose:** Example code and experimental features
**When to add here:** Plugins, prototypes, proof-of-concepts

- `basicPluginSystem.js` (329 lines) - Plugin architecture proof-of-concept
- `exampleTimeTrackerPlugin.js` (254 lines) - Example plugin implementation
- `pluginIntegrationGuide.js` (187 lines) - Plugin integration documentation

**Philosophy:** Examples should be runnable code, not just docs.

**Reasoning:** If we add official plugin support, these examples show how to build them.

---

## Key Directories Explained

### Why `modules/` instead of `utilities/`?
**Old name:** `utilities/`
**New name:** `modules/`
**Reason:** "Utilities" implies helpers. These are full modules with state, dependencies, and complex logic. The rename happened in commit `bd373e2` on Nov 10, 2025.

### Why domain folders (task/, cycle/) instead of technical layers (services/, controllers/)?
**Traditional approach:** Group by pattern (all services together)
**Our approach:** Group by domain (all task stuff together)
**Reason:** When working on tasks, you want task files together. Finding "which service handles this task operation" is cognitive overhead we don't need.

### Why is `archive/` at the root instead of in `docs/archive/`?
**Separation:** Code archives vs. doc archives
**Purpose:** `web/archive/` contains legacy code and old implementations. `web/docs/archive/` contains completed documentation.
**Reason:** Different audiences. Developers debug old code. Readers browse old docs.

### Why both `examples/` and `docs/`?
**Examples:** Runnable code you can import and test
**Docs:** Markdown explaining concepts
**Reason:** "Show me an example routine" vs "Explain how recurring tasks work" are different needs.

### Why `miniCycleGames/` instead of `games/`?
**Namespacing:** Consistent with `miniCycle.html`, `miniCycle-main.js`
**Reason:** If we add other games or features, the naming convention is established.

---

## Evolution History

### Phase 1: Modularization (Oct 2025)
- **Before:** 15,677-line monolithic `miniCycle-scripts.js`
- **After:** 3,674-line orchestrator + 33 modules (12,003 lines extracted)
- **Impact:** 74.8% reduction, 100% test coverage maintained
- **Key commits:** `1a45ec8` → `bd373e2` (40+ commits)

### Phase 2: Module Subfolders (Nov 10, 2025)
- **Before:** 33 modules in flat `modules/` directory
- **After:** 9 domain-based subfolders
- **Impact:** Easier navigation, clearer organization
- **Key commits:** `3cdb9d6`, `532fdf6`

### Phase 3: Root Cleanup (Nov 10, 2025)
- **Before:** 10+ HTML files in web root
- **After:** Only essential files in root, organized into `pages/`, `legal/`, `lite/`
- **Impact:** Cleaner deploys, better URL structure
- **Key commits:** `c77da31`, `6dbd703`

### Phase 4: Documentation Archive (Nov 10, 2025)
- **Before:** 87 markdown files mixed together in `docs/`
- **After:** Active docs in `docs/`, completed work in `docs/archive/`
- **Impact:** Easier to find current vs historical docs
- **Key commits:** `ec40148`

### Phase 5: Boot File Split (Dec 11, 2025)
- **Before:** 3,800-line monolithic `miniCycle-scripts.js` in root
- **After:** 4 focused boot files in `modules/boot/`:
  - `orchestrator.js` (1,883 lines) - DI wiring coordination
  - `coreBoot.js` (673 lines) - Core state & init
  - `featureBoot.js` (1,470 lines) - Feature module loading
  - `uiBoot.js` (406 lines) - UI event handlers
- **Entrypoint:** `miniCycle-main.js` (133 lines) in root
- **Impact:** Better debuggability, each file uploadable for AI debugging
- **Key docs:** `docs/future-work/BOOT_FILE_SPLIT_PLAN.md`

---

## Navigation Guide

### "I want to understand how tasks work"
1. Start with `docs/DEVELOPER_DOCUMENTATION.md` for high-level overview
2. Read `modules/task/README.md` (if exists) for task system guide
3. Browse `modules/task/` files:
   - `taskCore.js` - Start here for business logic
   - `taskDOM.js` - How tasks render
   - `taskEvents.js` - How user interactions work

### "I want to add a new feature"
1. Decide if it's core, optional, or experimental
2. **Core:** Probably doesn't belong - core is frozen
3. **Optional:** Add to `modules/features/`
4. **Experimental:** Start in `modules/other/`, graduate to `features/` later

### "I need to fix a bug"
1. Check `tests/` for failing tests (or write a failing test first)
2. Find the corresponding module (tests mirror structure)
3. Fix in module, verify test passes
4. Run full suite: `npm test`

### "I want to understand the folder structure"
**You're here!** This document explains the what, why, and how.

### "I need to see how it used to work"
- **Code:** Check `archive/` for old implementations
- **Docs:** Check `docs/archive/` for historical documentation
- **Git:** `git log --oneline --all` and search for relevant commits

### "I want to deploy"
- **Production:** Push to `main`, Netlify auto-deploys `web/` folder
- **Testing:** Netlify deploy previews for all pull requests
- **Version:** Run `./update-version.sh` before deploying

---

## Reasoning Behind Key Decisions

### Decision: Keep everything in `web/` folder
**Alternative considered:** Split into `public/`, `web/`, `shared/`
**Chosen approach:** Everything in `web/`
**Reasoning:**
- Netlify deploys `web/` folder directly
- No build step required
- URLs work immediately
- Can restructure later when multi-platform actually happens

**Trade-off:** Harder to share code with desktop/mobile (but they don't exist yet)

---

### Decision: Domain-based module organization
**Alternative considered:** Technical layers (services/, components/, utils/)
**Chosen approach:** Domain folders (task/, cycle/, recurring/)
**Reasoning:**
- Features are developed vertically (task creation touches core, DOM, events, validation)
- Finding "all task-related files" is easier than "all service files"
- Mirrors how developers think ("I'm working on tasks" not "I'm working on services")

**Trade-off:** Some utilities are shared across domains (acceptable with `utils/`)

---

### Decision: Separate `features/` from core modules
**Alternative considered:** Mix everything together
**Chosen approach:** Optional features in dedicated folder
**Reasoning:**
- Clear boundary between "must have" and "nice to have"
- Enables future code splitting (load themes only if user has unlocked them)
- Makes minimal installs possible

**Trade-off:** More folders to navigate (acceptable with clear naming)

---

### Decision: Keep `testing/` modules separate
**Alternative considered:** Inline testing code with modules
**Chosen approach:** Dedicated `testing/` folder
**Reasoning:**
- Test UI shouldn't pollute production module namespace
- Testing infrastructure is complex enough to deserve isolation
- Easier to exclude from production builds (if we add a build step)

**Trade-off:** Testing modules are less discoverable (acceptable - they're not production code)

---

### Decision: Archive completed docs, keep them accessible
**Alternative considered:** Delete old docs
**Chosen approach:** Move to `docs/archive/` with dedicated sidebar section
**Reasoning:**
- Historical context matters for debugging
- Learning resource for similar future projects
- Institutional knowledge preservation

**Trade-off:** More files to maintain (but they're archived, not actively updated)

---

### Decision: Use descriptive folder names over abbreviations
**Alternative considered:** `mod/` instead of `modules/`, `tst/` instead of `tests/`
**Chosen approach:** Full words
**Reasoning:**
- Clarity over brevity
- Easier for new developers
- Modern IDEs autocomplete anyway

**Trade-off:** Longer paths (negligible with autocomplete)

---

## Migration Notes

### From utilities/ to modules/
**Date:** November 10, 2025
**Commit:** `bd373e2`
**Impact:** All imports changed from `./utilities/` to `./modules/`
**Migration:** Automated with `sed` find-replace

### From flat modules/ to subfolders
**Date:** November 10, 2025
**Commits:** `3cdb9d6`, `532fdf6`
**Impact:** Module paths changed (e.g., `state.js` → `core/appState.js`)
**Migration:** Manual updates to all imports, verified with tests

### From root to pages/legal/lite/
**Date:** November 10, 2025
**Commit:** `c77da31`
**Impact:** Marketing and legal pages moved, URLs redirected
**Migration:** Added `_redirects` file for Netlify compatibility

---

## Future Considerations

### Multi-Platform Expansion
When desktop or mobile development starts:
1. Create `shared/` folder for truly shared code
2. Move business logic from `modules/` to `shared/business-logic/`
3. Keep platform-specific UI in respective folders
4. Maintain URL compatibility with redirects

### Build Process Addition
If we add a build step (Vite, Rollup, etc.):
1. Keep source in current structure
2. Output to `dist/` or `build/`
3. Update Netlify to deploy build folder
4. Maintain dev server for unbundled development

### Code Splitting
To reduce initial bundle size:
1. Features already isolated in `features/`
2. Dynamic imports already used in boot files (`modules/boot/`)
3. Could load themes, stats, games on-demand
4. Service worker already handles caching

---

**Questions? Improvements?**

This structure evolved through iteration and developer feedback. If something isn't clear or could be better organized, open an issue!

---

**miniCycle** - Turn Your Routine Into Progress
Built by [sparkinCreations](https://sparkincreations.com) | [minicycle.app](https://minicycle.app)
