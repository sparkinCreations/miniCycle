# miniCycle Folder Structure

**Last Updated:** January 9, 2026
**Status:** All modules use strict DI | Boot files split (Dec 2025) | CSS modularized (Jan 2026)

> **For current module counts and line counts, see [PROJECT_STATS.md](../PROJECT_STATS.md).**

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
Modules were organized into domain-based subfolders (`core/`, `task/`, `routine/`, etc.) to improve discoverability and reduce cognitive load.

### 3. **Clean Root** (Nov 2025)
Marketing pages, legal documents, and archived code were moved into dedicated folders, leaving the root clean and deployment-ready.

### 4. **CSS Modularization** (Jan 2026)
The monolithic 8,000+ line `miniCycle-styles.css` was refactored into 30 focused CSS files organized by purpose: base styles, components, layout, utilities, and themes.

**Result:** A structure that's easy to navigate, test, and deploy without breaking URLs or requiring build tools.

---

## Design Principles

### ✅ Zero Development Complexity
- No build step to develop — `npm start` serves pristine source
- Deploys via a deploy-time bundling step (since v2.294): Netlify runs
  `scripts/build-web.cjs` and publishes `web/dist/` — see
  [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md)

### ✅ Domain-Driven Organization
- Modules grouped by business domain (task, routine, recurring)
- Not by technical pattern (controllers, services, utils)
- Makes onboarding and feature work faster

### ✅ Future-Ready Structure
- Prepared for desktop/mobile expansion
- Shared code infrastructure ready but empty
- Can grow without restructuring

### ✅ Test-Friendly Layout
- Tests mirror module structure
- Easy to find corresponding tests
- See [PROJECT_STATS.md](../PROJECT_STATS.md) for current test counts

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
├── 📄 miniCycle-main.js                 # Entrypoint (~56 lines) - loads orchestrator
├── 📄 service-worker.js                 # PWA service worker
│
├── 📁 styles/                           # Modular CSS architecture (31 files)
│   ├── main.css                         # Entry point - imports all modules
│   ├── base/                            # Foundation styles
│   │   ├── variables.css                # CSS custom properties & theme variables
│   │   ├── reset.css                    # CSS reset & normalization
│   │   ├── background.css               # Background patterns, images & overlays
│   │   ├── typography.css               # Font styles & text utilities
│   │   └── animations.css               # Keyframe animations
│   ├── layout/                          # Page structure
│   │   ├── app-container.css            # Main app container & views
│   │   ├── header.css                   # Header & navigation bar
│   │   └── safe-areas.css               # iOS safe area handling
│   ├── components/                      # UI components (18 files)
│   │   ├── task-list.css                # Task items & list container
│   │   ├── task-input.css               # Task input field
│   │   ├── task-options.css             # Task option buttons
│   │   ├── buttons.css                  # Button styles & undo/redo
│   │   ├── modals.css                   # Modal dialogs
│   │   ├── menu.css                     # Settings menu
│   │   ├── settings.css                 # Settings panel
│   │   ├── recurring.css                # Recurring task UI
│   │   ├── stats-panel.css              # Statistics panel
│   │   ├── progress-bar.css             # Progress indicators
│   │   ├── mode-selector.css            # Cycle/Todo mode selector
│   │   ├── routine-switcher.css         # Routine switching modal
│   │   ├── notifications.css            # Toast notifications
│   │   ├── onboarding.css               # Onboarding flow
│   │   ├── forms.css                    # Form elements
│   │   ├── footer.css                   # Footer styles
│   │   ├── storage.css                  # Storage indicator
│   │   └── games.css                    # Mini-games UI
│   ├── utilities/                       # Utility styles
│   │   ├── dark-mode.css                # Dark mode overrides
│   │   ├── helpers.css                  # Helper classes & navigation dots
│   │   └── responsive.css               # Media queries
│   └── themes/                          # Theme system
│       └── theme-manager.js             # Dynamic theme application
├── 📄 version.js                        # Single source of truth for versions
├── 📄 manifest.json                     # PWA manifest (full version)
├── 📄 manifest-lite.json                # PWA manifest (lite version)
├── 📄 package.json                      # Dependencies & scripts
├── 📄 _redirects                        # Netlify redirects for URL compatibility
│
├── 📁 modules/                          # ES6 application modules (see PROJECT_STATS.md for counts)
│   ├── boot/                            # Boot sequence, orchestration, module loading
│   │   ├── orchestrator.js              # Pure sequence controller
│   │   ├── coreBoot.js                  # Core state & init
│   │   ├── featureBoot.js               # DI wiring hub
│   │   ├── moduleLoader.js              # Dynamic module loader
│   │   ├── moduleManifests.js           # Module dependency manifests
│   │   └── uiBoot.js                    # UI event handlers
│   ├── core/                            # AppState, appInit, appContext, DI base, constants
│   ├── task/                            # Task CRUD, DOM, events, drag-drop, validation
│   ├── routine/                         # Routine management, switching, migration
│   ├── recurring/                       # Recurring task scheduling, panel, activation
│   ├── ui/                              # Modals, menus, settings, onboarding, gestures
│   ├── features/                        # Themes, stats, achievements, history, reminders
│   ├── labels/                          # Label system (566 keys, resolver)
│   │   ├── defaultLabels.js             # Pure data: all user-facing strings
│   │   └── labelResolver.js             # getLabel() with pluralization & interpolation
│   ├── utils/                           # Notifications, device detection, utilities
│   ├── storage/                         # Backup manager, storage persistence
│   ├── progress/                        # Cycle completion tracking
│   ├── testing/                         # Test infrastructure
│   └── other/                           # Plugins, experimental
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
├── 📁 lite/                             # ⚠️ STATIC fallback (NOT maintained)
│   ├── miniCycle-lite.html              # Frozen ES5 version for old devices
│   ├── miniCycle-lite-scripts.js        # ES5 compatible - intentionally not updated
│   └── miniCycle-lite-styles.css        # Simplified styles for older browsers
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
├── 📁 tests/                            # Test suite (see PROJECT_STATS.md for counts)
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

### `/styles/` - Modular CSS Architecture
**Purpose:** All application styles organized by purpose
**Philosophy:** Component-based CSS with clear separation of concerns
**Why this matters:** Finding "task list styles" is easier than searching 8,000 lines

**Structure:**
- `base/` - Foundation (variables, reset, background, typography, animations)
- `layout/` - Page structure (app container, header, safe areas)
- `components/` - UI components (18 files for specific features)
- `utilities/` - Dark mode, helpers, responsive breakpoints
- `themes/` - Dynamic theme system

**Entry Point:** `main.css` imports all modules in correct order

### `/modules/` - Application Code
**Purpose:** All ES6 application modules organized by domain
**Philosophy:** Domain-driven organization beats technical layering
**Why this matters:** Developers think in features (tasks, cycles), not abstractions (services, controllers)

### `/docs/` - Developer Documentation
**Purpose:** Comprehensive documentation powered by Docsify
**Philosophy:** Docs should live with code, be searchable, and versioned
**Why this matters:** GitHub renders Markdown beautifully, Docsify adds navigation

### `/tests/` - Test Suite
**Purpose:** Automated tests mirroring module structure (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
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

### `/lite/` - Static Fallback Version
**Purpose:** FROZEN ES5 version for older devices and slow connections
**Philosophy:** Provide the core concept to everyone, not feature parity
**Why this matters:** Users on old devices or slow connections can still use miniCycle's basic routine-tracking concept

> ⚠️ **IMPORTANT: This version is intentionally STATIC and NOT meant to be maintained.**
>
> It exists as a permanent fallback that provides the basic miniCycle concept without advanced features. Do NOT:
> - Add new features from the main app
> - Try to keep it in sync with the full version
> - Modernize the JavaScript (ES5 is intentional)
>
> The lite version is frozen (see [PROJECT_STATS.md](../PROJECT_STATS.md) for version) and serves users whose browsers can't run the full app or who prefer a simpler experience.

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

The `/modules/` directory contains 91 ES6 modules organized into 12 logical groups. **All modules use strict dependency injection with no `|| window.*` fallbacks.**

### `boot/` - Boot Sequence Modules (6 modules)
**Purpose:** Application boot orchestration split into focused files
**When to add here:** Only boot-related code (initialization, DI wiring, UI setup)

- `orchestrator.js` - DI wiring hub, coordinates boot sequence
- `coreBoot.js` - Core state, AppState, migration
- `featureBoot.js` - Feature module loading and DI wiring
- `moduleLoader.js` - Dynamic module loader with dependency resolution
- `moduleManifests.js` - Module dependency manifests and metadata
- `uiBoot.js` - UI event handlers, loader helpers, device detection

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

### `core/` - Essential System Modules (8 modules)
**Purpose:** Foundation modules required for app initialization
**When to add here:** Never. Core is frozen - critical infrastructure only.

- `appState.js` - Centralized state management with localStorage persistence
- `appInit.js` - Two-phase initialization system
- `appGlobalState.js` - Global runtime state and feature flags
- `appContext.js` - Centralized module registry for cross-module access
- `constants.js` - Application constants
- `dataAccess.js` - Data access layer abstractions
- `diBase.js` - Dependency injection base utilities
- `migrationFacade.js` - Schema migration facade

**Philosophy:** Core modules are special - they initialize before everything else and are dependency-injected into other modules.

---

### `task/` - Task Management System (10 modules)
**Purpose:** Everything related to individual task lifecycle
**When to add here:** Task creation, validation, rendering, events, drag-drop

- `taskCore.js` - CRUD operations and business logic
- `taskCRUD.js` - Task create, read, update, delete operations
- `taskDOM.js` - DOM coordination and composition
- `taskRenderer.js` - DOM element creation and rendering
- `taskEvents.js` - Event handling (clicks, inputs, focus)
- `taskCompletion.js` - Task completion logic
- `taskCycleReset.js` - Cycle reset and task state management
- `taskValidation.js` - Input validation and sanitization
- `taskUtils.js` - Helper functions and utilities
- `dragDropManager.js` - Drag & drop with Safari compatibility

**Philosophy:** Task system split by responsibility, not by implementation detail. DOM coordination (`taskDOM.js`) orchestrates rendering (`taskRenderer.js`) and events (`taskEvents.js`).

**Reasoning:** A 3,000-line monolith was impossible to test. Ten focused modules each have clear contracts and 100% test coverage.

---

### `routine/` - Routine Management System (5 modules)
**Purpose:** Routine lifecycle from creation to switching to migration
**When to add here:** Routine operations, mode changes, data migration

- `routineLoader.js` (273 lines) - Data loading and file import/export
- `routineManager.js` (445 lines) - Routine creation and management
- `routineSwitcher.js` (677 lines) - Routine switching with modal UI
- `modeManager.js` (380 lines) - Auto/Manual/Todo mode management
- `migrationManager.js` (850 lines) - Schema migrations and data upgrades

**Philosophy:** Routines are first-class entities with complex state machines. Each module handles one phase of the routine lifecycle.

**Reasoning:** Routine switching involves 20+ steps. Breaking it into loader → manager → switcher made it testable and debuggable.

---

### `recurring/` - Recurring Tasks System (15 modules)
**Purpose:** Template-based recurring task generation
**When to add here:** Recurring logic, scheduling, UI

- `recurringCore.js` - Business logic and scheduling
- `recurringActivation.js` - Recurring task activation logic
- `recurringCalculators.js` - Date calculation utilities
- `recurringDateUtils.js` - Date parsing and formatting
- `recurringIntegration.js` - Integration with task system
- `recurringMatcher.js` - Pattern matching for recurring rules
- `recurringPanel.js` - Complex UI for recurring settings
- `recurringPanelEvents.js` - Panel event handlers
- `recurringPanelForm.js` - Panel form components
- `recurringPanelGrids.js` - Panel grid layouts
- `recurringPanelSetup.js` - Panel initialization
- `recurringPanelSummary.js` - Summary display components
- `recurringSettings.js` - Settings management
- `recurringSettingsApplicator.js` - Apply settings to tasks
- `recurringWatcher.js` - Watch for recurring task triggers

**Philosophy:** Recurring is a feature layer on top of tasks. It generates tasks from templates based on schedules.

**Reasoning:** Recurring panel is the most complex UI in miniCycle. Keeping it isolated and well-modularized prevents contaminating simpler modules.

---

### `ui/` - UI Coordination (21 modules)
**Purpose:** Application-level UI that coordinates multiple systems
**When to add here:** Modals, menus, settings, onboarding, undo/redo, customization

- `modalManager.js` - Modal lifecycle and stacking
- `menuManager.js` - Settings menu and navigation
- `settingsManager.js` - Settings panel and persistence
- `settingsUIManager.js` - Settings UI components
- `onboardingManager.js` - First-time user experience
- `undoRedoManager.js` - Per-cycle undo/redo with IndexedDB
- `gamesManager.js` - Mini-game unlock and panel
- `taskOptionsCustomizer.js` - Per-cycle button visibility customization
- `backupRestoreManager.js` - Backup and restore functionality
- `completedTasksManager.js` - Completed tasks display
- `cycleExportManager.js` - Cycle export functionality
- `cycleImportManager.js` - Cycle import functionality
- `helpWindowManager.js` - Help window display
- `pullToRefresh.js` - Pull-to-refresh gesture
- `taskInteractions.js` - Task interaction handlers
- `taskSearch.js` - Task search functionality
- `taskUI.js` - Task UI utilities
- `titleManager.js` - Page title management
- `uiEffects.js` - UI animations and effects
- `uiOrchestrator.js` - UI coordination and orchestration
- `gesturePanelManager.js` - Multi-platform gesture handling for panel navigation

**Philosophy:** UI modules don't contain business logic - they coordinate other modules and present data.

**Reasoning:** Settings panel needs to interact with themes, notifications, recurring, etc. It orchestrates, doesn't implement.

---

### `features/` - Optional/Pluggable Features (7 modules)
**Purpose:** Features that enhance core experience but aren't required
**When to add here:** New optional features that can be disabled

- `dueDates.js` (233 lines) - Task due date management
- `reminders.js` (621 lines) - Custom reminder system
- `themeManager.js` (950 lines) - Dynamic theming with unlockables
- `statsPanel.js` (1,841 lines) - Statistics panel and view switching
- `achievementsManager.js` (1,018 lines) - Achievement/badge system with OR-based unlocking
- `historyManager.js` (984 lines) - Per-routine activity logging and history modal
- `clearedTasksManager.js` (675 lines) - Cleared task tracking (To-Do mode + cycle reset auto-removes)

**Philosophy:** Features should be optional and independently testable. The app works without them.

**Reasoning:** Not all users need due dates or themes. Keeping them optional reduces bundle size for minimal installs.

---

### `labels/` - Label System (2 modules)
**Purpose:** Centralized user-facing string management
**When to add here:** Label data, resolver logic, future contextual lenses

- `defaultLabels.js` (566 keys) - Pure data module with all user-facing strings across 32 categories
- `labelResolver.js` - `getLabel()` function with DI, pluralization, and interpolation

**Philosophy:** Centralizing strings enables future contextual lenses (e.g., "task" becomes "habit" in a Habit Tracker lens) and provides a single source of truth for all user-facing text.

**Reasoning:** `defaultLabels.js` is a pure data module (no DI, no imports) — importable anywhere at any boot phase. `labelResolver.js` has DI wiring for future lens support.

---

### `utils/` - Shared Utilities (10 modules)
**Purpose:** Reusable utilities with no business logic dependencies
**When to add here:** Pure functions, platform detection, logging, validation

- `globalUtils.js` - Pure utility functions
- `notifications.js` - Toast notification system
- `deviceDetection.js` - Platform and capability detection
- `consoleCapture.js` - Console logging for debugging
- `dataSanitizer.js` - Data sanitization utilities
- `dataValidator.js` - Data validation utilities
- `debugMode.js` - Debug mode utilities
- `errorHandler.js` - Error handling utilities
- `nameUtils.js` - Name/string utilities
- `storageUtils.js` - localStorage utilities and quota management

**Philosophy:** Utils are stateless, dependency-free, and reusable across modules.

**Reasoning:** Utilities should be boring and predictable. No surprises, just reliable helpers.

---

### `testing/` - Testing Infrastructure (3 modules)
**Purpose:** Test-related modules that shouldn't pollute production modules
**When to add here:** Test helpers, mocks, test UI

- `testing-modal.js` - In-app testing modal
- `testing-modal-integration.js` - Test runner integration
- `automated-tests-fix.js` - Test automation fixes

**Philosophy:** Testing is important enough to deserve its own space.

**Reasoning:** Test modules clutter the main module namespace. Isolating them makes production imports cleaner.

---

### `storage/` - Storage & Backup (2 modules)
**Purpose:** Storage management, backup, and durability
**When to add here:** Backup, export, storage quota management, eviction protection

- `backupManager.js` - Backup creation and management
- `storagePersistence.js` - Requests durable (non-evictable) origin storage via `navigator.storage.persist` (see [STORAGE_MANAGEMENT.md](../features/STORAGE_MANAGEMENT.md) → Storage Persistence)

**Philosophy:** Storage concerns are isolated from business logic.

---

### `progress/` - Cycle Completion (1 module)
**Purpose:** Cycle completion tracking and progress
**When to add here:** Cycle completion, progress tracking, animations

- `cycleCompletion.js` - Cycle completion logic and animations

**Philosophy:** Progress tracking deserves isolation for clear responsibility.

---

### `other/` - Experimental & Plugin Examples (3 modules)
**Purpose:** Example code and experimental features
**When to add here:** Plugins, prototypes, proof-of-concepts

- `basicPluginSystem.js` - Plugin architecture proof-of-concept
- `exampleTimeTrackerPlugin.js` - Example plugin implementation
- `pluginIntegrationGuide.js` - Plugin integration documentation

**Philosophy:** Examples should be runnable code, not just docs.

**Reasoning:** If we add official plugin support, these examples show how to build them.

---

## Key Directories Explained

### Why `modules/` instead of `utilities/`?
**Old name:** `utilities/`
**New name:** `modules/`
**Reason:** "Utilities" implies helpers. These are full modules with state, dependencies, and complex logic. The rename happened in commit `bd373e2` on Nov 10, 2025.

### Why domain folders (task/, routine/) instead of technical layers (services/, controllers/)?
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

### Phase 6: CSS Modularization (Jan 9, 2026)
- **Before:** 8,000+ line monolithic `miniCycle-styles.css`
- **After:** 30 focused CSS files in `styles/` folder:
  - `base/` (5 files) - Variables, reset, background, typography, animations
  - `layout/` (3 files) - App container, header, safe areas
  - `components/` (18 files) - UI component styles
  - `utilities/` (3 files) - Dark mode, helpers, responsive
  - `themes/` (1 file) - Theme manager
- **Entry point:** `styles/main.css` imports all modules
- **Impact:** Easier maintenance, clearer organization, component-based architecture
- **Original file:** Archived to `archive/miniCycle-styles.css`

---

## Navigation Guide

### "I want to modify styles"
1. Find the relevant component in `styles/components/`
2. Check `styles/base/variables.css` for CSS custom properties
3. For dark mode changes, edit `styles/utilities/dark-mode.css`
4. For responsive adjustments, check `styles/utilities/responsive.css`
5. Entry point is `styles/main.css` - imports are ordered by dependency

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
- Netlify builds from `web/` (publishes bundled `web/dist/` since v2.294)
- No build step for development — source structure IS the runtime structure in dev
- URLs work immediately
- Can restructure later when multi-platform actually happens

**Trade-off:** Harder to share code with desktop/mobile (but they don't exist yet)

---

### Decision: Domain-based module organization
**Alternative considered:** Technical layers (services/, components/, utils/)
**Chosen approach:** Domain folders (task/, routine/, recurring/)
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
