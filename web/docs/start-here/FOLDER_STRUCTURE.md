# miniCycle Folder Structure

**Last verified:** Nov 5 2026
**Status:** Live reference | Boot files split (Dec 2025) | CSS modularized (Jan 2026)

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

miniCycle's folder structure evolved through four major phases:

### 1. **Modularization First** (Oct 2025)
The monolithic 15,677-line script was broken into 33 focused modules (12,003 lines extracted, Oct 2025). This achieved a 74.8% reduction of the monolith.

### 2. **Logical Grouping** (Nov 2025)
Modules were organized into domain-based subfolders (`core/`, `task/`, `routine/`, etc.) to improve discoverability and reduce cognitive load.

### 3. **Clean Root** (Nov 2025)
Marketing pages, legal documents, and archived code were moved into dedicated folders, leaving the root clean and deployment-ready.

### 4. **CSS Modularization** (Jan 2026)
The monolithic 8,000+ line `miniCycle-styles.css` was refactored into 30 focused CSS files (Jan 2026) organized by purpose: base styles, components, layout, utilities, and themes.

**Result:** A structure that's easy to navigate, test, and deploy without breaking URLs, with no build step in development (deploys have been bundled since v2.294 — see below).

---

## Design Principles

### ✅ No Build Step in Development
- No build step to develop — `npm start` serves pristine source
- Deploys via a deploy-time bundling step (since v2.294): Netlify runs
  `scripts/build-web.cjs` and publishes `web/dist/` — see
  [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md)

### ✅ Domain-Driven Organization
- Modules grouped by business domain (task, routine, recurring)
- Not by technical pattern (controllers, services, utils)
- Makes onboarding and feature work faster

### ✅ Multi-Platform Without Restructuring
- The desktop (Electron, `desktop/`), mobile (Capacitor, `mobile/`) and Chrome
  extension (`chrome/`) shells sit beside `web/` at the repo root; each
  generates its payload from `web/` (`web/scripts/build-capacitor-www.cjs` and
  its per-platform shims, `web/scripts/build-chrome-full.cjs`)
- Repo-root `shared/` is still empty by design (see its README)
- `web/` did not have to be restructured for any of them

### ✅ Test-Friendly Layout
- Test files are named after the module they cover (`moduleName.tests.js`), flat in `tests/` (not every module has one)
- Easy to find corresponding tests
- See [PROJECT_STATS.md](../PROJECT_STATS.md) for current test counts

### ✅ Clear Separation of Concerns
- Application code in `modules/`
- Developer docs in `docs/`
- User-facing pages in `pages/`, `legal/`, `lite/`
- Historical work in `archive/` (local-only, gitignored — see below)

---

## Complete Structure

Main files and folders of `web/` (not every file is listed; generated `dist/` and `node_modules/` are left out):

```
web/
│
├── 📄 miniCycle.html                    # Main PWA entry point
├── 📄 miniCycle-main.js                 # Entrypoint - imports the orchestrator
├── 📄 service-worker.js                 # PWA service worker
├── 📄 boot-sw.js                        # Service-worker registration, updates, PWA install
├── 📄 netlify.toml                      # Headers/redirects/CSP only (build authority is the repo-root netlify.toml)
├── 📄 mcyc.schema.json                  # Current .mcyc JSON Schema (pinned versions in schema/)
│
├── 📁 styles/                           # Modular CSS architecture (see PROJECT_STATS.md for count)
│   ├── main.css                         # Entry point - imports all modules
│   ├── base/                            # Foundation styles
│   │   ├── variables.css                # CSS custom properties & theme variables
│   │   ├── reset.css                    # CSS reset & normalization
│   │   ├── critical.css                 # Critical above-the-fold styles (linked by miniCycle.html, not main.css)
│   │   ├── background.css               # Background patterns, images & overlays
│   │   ├── typography.css               # Font styles & text utilities
│   │   ├── accessibility.css            # High contrast & accessibility styles
│   │   └── animations.css               # Keyframe animations
│   ├── layout/                          # Page structure
│   │   ├── app-container.css            # Main app container & views
│   │   ├── header.css                   # Header & navigation bar
│   │   └── safe-areas.css               # iOS safe area handling
│   ├── components/                      # UI components
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
│   │   ├── games.css                    # Mini-games UI
│   │   ├── achievements.css             # Achievements/badges UI
│   │   ├── first-run-welcome.css        # First-run welcome screen
│   │   ├── focus-mode.css               # Focus mode chrome hiding
│   │   ├── focus-task-panel.css         # One-task-at-a-time focus panel
│   │   ├── guided-tour.css              # Guided tour spotlight overlay
│   │   ├── history.css                  # History modal
│   │   ├── icons.css                    # Inline SVG icon styles
│   │   ├── long-press-hint.css          # Long-press hints for icon-only controls
│   │   ├── quick-actions.css            # Quick actions panel
│   │   ├── task-view-layout.css         # Desktop drag-customize layout
│   │   ├── testing.css                  # Testing modal
│   │   ├── themes-modal.css             # Themes modal
│   │   └── title-screen.css             # Welcome Screen (titleScreen.js)
│   ├── utilities/                       # Utility styles
│   │   ├── dark-mode.css                # Dark mode overrides
│   │   ├── helpers.css                  # Helper classes & navigation dots
│   │   └── responsive.css               # Media queries
│   └── themes/                          # Theme system
│       ├── themes.css                   # Color theme styles
│       ├── theme-manager.js             # JSON theme validation + custom theme import/export
│       ├── theme-schema.json            # Theme definition schema
│       └── definitions/                 # Theme definition files
├── 📄 version.js                        # Single source of truth for versions
├── 📄 manifest.json                     # PWA manifest (full version)
├── 📄 manifest-lite.json                # PWA manifest (lite version)
├── 📄 package.json                      # Dependencies & scripts
├── 📄 _redirects                        # Netlify redirects for URL compatibility
├── 📁 schema/                           # Pinned .mcyc schemas (mcyc-2.5, mcyc-2.6)
├── 📁 netlify/functions/                # Netlify functions (track.js — CTA/pageview tracking)
│
├── 📁 modules/                          # ES6 application modules (see PROJECT_STATS.md for counts)
│   ├── boot/                            # Boot sequence, orchestration, module loading
│   │   ├── orchestrator.js              # Pure sequence controller
│   │   ├── coreBoot.js                  # Core state & init
│   │   ├── featureBoot.js               # DI wiring hub
│   │   ├── moduleLoader.js              # Dynamic module loader
│   │   ├── moduleManifests.js           # Module dependency manifests
│   │   ├── modalTemplates.js            # HTML templates for large modals
│   │   └── uiBoot.js                    # UI event handlers
│   ├── core/                            # AppState, appInit, appContext, DI base, constants
│   ├── task/                            # Task CRUD, DOM, events, drag-drop, validation
│   ├── routine/                         # Routine management, switching, migration
│   ├── recurring/                       # Recurring task scheduling, panel, activation
│   ├── ui/                              # Modals, menus, settings, onboarding, gestures
│   ├── features/                        # Themes, stats, achievements, history, reminders
│   ├── labels/                          # Label system (all user-facing strings + resolver)
│   │   ├── defaultLabels.js             # Pure data: all user-facing strings
│   │   ├── labelResolver.js             # getLabel() with pluralization & interpolation
│   │   ├── themes.js                    # Vocabulary theme definitions & manager
│   │   ├── themeWords.js                # Active vocab theme's words for label sentences
│   │   └── loading-tips.json            # Loading tips (tip archive, Welcome Screen)
│   ├── utils/                           # Notifications, device detection, utilities
│   ├── storage/                         # Backup manager, backup folder, storage persistence
│   ├── progress/                        # Cycle completion tracking
│   ├── platform/                        # capacitorBridge + desktopBridge (shell detection; no-op on web)
│   ├── testing/                         # Test infrastructure
│   └── other/                           # Plugins, experimental
│
├── 📁 pages/                            # Marketing & product pages
│   ├── product.html
│   ├── learn_more.html
│   ├── mcyc-format.html                 # .mcyc format page
│   └── dashboard.html                   # CTA/pageview tracking dashboard (noindex)
│
├── 📁 legal/                            # Standalone static pages (outside the app shell)
│   ├── privacy.html
│   ├── terms.html
│   ├── security.html
│   ├── accessibility.html
│   ├── user-manual.html                 # End-user manual (not a legal doc — see note)
│   ├── legal-footer.js                  # Shared footer injected into each page
│   └── static-page-styles.css           # Shared stylesheet for ALL pages above
│
├── 📁 lite/                             # ⚠️ STATIC fallback (NOT maintained)
│   ├── miniCycle-lite.html              # Frozen ES5 version for old devices
│   ├── miniCycle-lite-scripts.js        # ES5 compatible - intentionally not updated
│   └── miniCycle-lite-styles.css        # Simplified styles for older browsers
│
├── 📁 games/                            # Hidden mini-games (each .html has a matching .js)
│   ├── miniCycle-taskOrder.html         # Whack-a-Order game (unlock: MILESTONES.TASK_ORDER_GAME global cycles)
│   ├── miniCycle-taskScramble.html
│   └── miniCycle- taskGame.html         # (sic — the filename contains a space)
│
├── 📁 docs/                             # Developer documentation (Docsify)
│   ├── index.html                       # Docsify entry page
│   ├── docsify-config.js                # Docsify configuration
│   ├── README.md                        # Documentation hub
│   ├── INDEX.md                         # Task router ("start here by task")
│   ├── PROJECT_STATS.md                 # Generated counts (modules, tests, lines)
│   ├── _sidebar.md                      # Navigation sidebar
│   ├── DEVELOPER_DOCUMENTATION.md       # Developer documentation hub
│   ├── start-here/FOLDER_STRUCTURE.md   # This file!
│   ├── working-on-code/CLAUDE.md        # AI assistant guide
│   ├── [architecture docs]
│   └── archive/                         # Historical/completed docs
│
├── 📁 tests/                            # Test suite (see PROJECT_STATS.md for counts)
│   ├── module-test-suite.html           # Browser test runner
│   ├── automated/                       # Playwright runners (browser, journey, layout, a11y, contrast, …)
│   ├── helpers/                         # Shared test helpers
│   ├── security/                        # XSS tests
│   ├── [module test files — see PROJECT_STATS.md]
│   └── MODULE_TEMPLATE.tests.js         # Template for new tests
│
├── 📁 assets/                           # Static assets
│   ├── fonts/                           # Self-hosted Poppins + fonts.css
│   ├── images/                          # Images, logos, background patterns, screenshots
│   └── videos/                          # Sample routine videos (samples/)
│
├── 📁 scripts/                          # Build, release & validation scripts
│   ├── update-version.sh                # Automated version updater (run from web/)
│   ├── build-web.cjs                    # esbuild release bundler (Netlify runs this)
│   ├── build-*-www.cjs, build-chrome-full.cjs  # Platform shell payloads generated from web/
│   └── validate-*.{js,py}               # Validation gates (see VALIDATION_GATES.md)
│
├── 📁 examples/                         # Example routines & references
│   ├── initial-run/                     # "Your First Routine" — loaded by the app on first run
│   ├── sample-routines/                 # Create New Routine samples + manifest.json (read by the app)
│   ├── routines/                        # Example .mcyc files
│   └── pwa-reference/                   # PWA implementation examples
│
├── 📁 blog/                             # Blog system (index page is web/blog.html)
│   ├── posts/                           # Blog posts (Markdown + built HTML)
│   ├── docs/                            # Post template
│   ├── scripts/                         # Blog build + page logic
│   └── styles/                          # Blog styles
│
├── 📁 archive/                          # Local-only legacy code (gitignored; not in the repo)
│
└── 📁 backup/                           # Local backups from update-version.sh (gitignored)
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
- `components/` - UI components (one file per feature; total CSS file count in [PROJECT_STATS.md](../PROJECT_STATS.md))
- `utilities/` - Dark mode, helpers, responsive breakpoints
- `themes/` - Dynamic theme system

**Entry Point:** `main.css` imports every stylesheet in order except `base/critical.css`, which `miniCycle.html` links directly (the release build inlines it into the HTML)

### `/modules/` - Application Code
**Purpose:** All ES6 application modules organized by domain
**Philosophy:** Domain-driven organization beats technical layering
**Why this matters:** Developers think in features (tasks, cycles), not abstractions (services, controllers)

### `/docs/` - Developer Documentation
**Purpose:** Comprehensive documentation powered by Docsify
**Philosophy:** Docs should live with code, be searchable, and versioned
**Why this matters:** GitHub renders Markdown beautifully, Docsify adds navigation

### `/tests/` - Test Suite
**Purpose:** Automated tests, each file named after the module it covers (see [PROJECT_STATS.md](../PROJECT_STATS.md) for counts)
**Philosophy:** Tests are first-class citizens, not afterthoughts
**Why this matters:** A green suite is what makes refactoring safe — and `npm test` is only part of it; CI runs further suites (see [VALIDATION_GATES.md](../working-on-code/VALIDATION_GATES.md))

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

### `/games/` - Hidden Games
**Purpose:** Easter egg mini-games (unlock rewards)
**Philosophy:** Delight users, encourage engagement
**Why this matters:** Reaching `MILESTONES.TASK_ORDER_GAME` global cycles (`core/constants.js`) is a milestone worth celebrating

### `/assets/` - Static Files
**Purpose:** Images, videos, fonts that rarely change
**Philosophy:** Binary files separate from code
**Why this matters:** Faster deploys, better caching

### `/scripts/` - Build Utilities
**Purpose:** Version management, backups, automation
**Philosophy:** Scripts should be discoverable and documented
**Why this matters:** `./scripts/update-version.sh` (run from `web/`) prevents human error

### `/examples/` - Reference Material
**Purpose:** Example routines, PWA references, learning resources. Not all of it is reference-only: `initial-run/` and `sample-routines/` are fetched by the app at runtime (`routine/routineManager.js`)
**Philosophy:** Show, don't just tell
**Why this matters:** Developers learn by example

### `/archive/` - Legacy Code
**Purpose:** Historical implementations, migration artifacts
**Philosophy:** Never delete history, just organize it
**Why this matters:** Sometimes you need to reference "the old way"
**Note:** `web/archive/` is local-only — the repo-root `.gitignore` excludes it, so it is not in a clone

### `/backup/` - Automatic Backups
**Purpose:** Timestamped backups from version updates
**Philosophy:** Always have an escape hatch
**Why this matters:** `update-version.sh` creates restore points automatically (keeps the newest 3; the folder is gitignored)

### `/blog/` - Blog System
**Purpose:** Marketing blog with static generation (Markdown → HTML via `blog/scripts/build.mjs`; index page `web/blog.html`)
**Philosophy:** Own your content, keep it simple
**Why this matters:** No external CMS dependencies

---

## Modules Organization

The `/modules/` directory holds the ES6 modules, organized into the domain folders below (see [PROJECT_STATS.md](../PROJECT_STATS.md) for live counts). **Modules receive their dependencies by injection** — `createDIModule()` from `core/diBase.js`, with a few early boot modules (`appState.js`, `globalUtils.js`) still on the legacy `_deps` setter. A grep on Nov 5 2026 found no `|| window.*` fallbacks in `modules/`; no gate enforces that (`validate:di` gates DI *declarations*).

### `boot/` - Boot Sequence Modules
**Purpose:** Application boot orchestration split into focused files
**When to add here:** Only boot-related code (initialization, DI wiring, UI setup)

- `orchestrator.js` - Pure sequence controller: boot UI, retries, early coordination
- `coreBoot.js` - Core state, AppState, migration
- `featureBoot.js` - Feature module loading and DI wiring
- `moduleLoader.js` - Dynamic module loader with dependency resolution
- `moduleManifests.js` - Module dependency manifests and metadata
- `modalTemplates.js` - HTML templates for large modals, injected at boot
- `uiBoot.js` - UI event handlers, loader helpers, device detection

**Philosophy:** Split from monolithic `miniCycle-scripts.js` for better debuggability. Each file can be uploaded independently for AI-assisted debugging.

**Load Order:**
```
miniCycle-main.js (entrypoint)
  → modules/boot/orchestrator.js
      → modules/boot/coreBoot.js (AppState, GlobalUtils, migration)
      → modules/boot/featureBoot.js (DI wiring)
      → modules/boot/uiBoot.js (UI handlers)
```

---

### `core/` - Essential System Modules
**Purpose:** Foundation modules required for app initialization
**When to add here:** Never. Core is frozen - critical infrastructure only.

- `appState.js` - Centralized state management with localStorage persistence
- `appInit.js` - Two-phase initialization system
- `appGlobalState.js` - Global runtime state and feature flags
- `appContext.js` - Centralized module registry for cross-module access
- `constants.js` - Application constants
- `dataAccess.js` - Legacy data access wrapper (new code uses AppState directly)
- `diBase.js` - Dependency injection base utilities
- `types.js` - Central JSDoc type definitions for Schema 2.6

**Philosophy:** Core modules are special - they initialize before everything else and are dependency-injected into other modules.

---

### `task/` - Task Management System
**Purpose:** Everything related to individual task lifecycle
**When to add here:** Task creation, validation, rendering, events, drag-drop

- `taskCore.js` - Facade for task operations; delegates to `taskCRUD.js`, `taskCompletion.js`, `taskCycleReset.js`
- `taskCRUD.js` - Task create, read, update, delete operations
- `taskDOM.js` - DOM coordination and composition
- `taskDOMPatch.js` - DOM patching without full re-renders
- `taskRenderer.js` - DOM element creation and rendering
- `taskButtons.js` - Task button containers and individual buttons
- `taskEvents.js` - Event handling (clicks, inputs, focus)
- `taskCompletion.js` - Task completion logic
- `taskCycleReset.js` - Cycle reset and task state management
- `dailyResetManager.js` - Per-routine "Auto-uncheck Daily" soft reset
- `taskValidation.js` - Input validation and sanitization
- `taskUtils.js` - Helper functions and utilities
- `dragDropManager.js` - Drag & drop with Safari compatibility

**Philosophy:** Task system split by responsibility, not by implementation detail. DOM coordination (`taskDOM.js`) orchestrates rendering (`taskRenderer.js`) and events (`taskEvents.js`).

**Reasoning:** A 3,000-line monolith was impossible to test. Focused modules each have clear contracts and their own test file.

---

### `routine/` - Routine Management System
**Purpose:** Routine lifecycle from creation to switching to migration
**When to add here:** Routine operations, mode changes, data migration

- `routineLoader.js` - Loads and renders the active routine from AppState (tasks, UI state, theme)
- `routineManager.js` - Routine creation and management (also fetches the first-run and sample routines from `examples/`)
- `routineCopy.js` - The one definition of a routine copy (Duplicate)
- `routineSwitcher.js` - Routine switching with modal UI (facade; statically imports the `routineSwitcher*`, `routineBrowser*` and `modePicker.js` modules)
- `routineSwitcherActions.js` - Switcher delete / duplicate / download / rename
- `routineSwitcherListTransforms.js` - Pure sort/filter transforms for the switcher list
- `routineSwitcherPreview.js` - Routine preview inside the switcher
- `routineSwitcherRepair.js` - Normalises a routine's stored shape before switching into it
- `routineSwitcherThemePicker.js` - Per-routine vocab-theme picker in the switcher
- `routineBrowser.js` - Browse Routines: full-screen, read-only routine browser
- `routineBrowserRender.js` - Pure DOM builders for the browser's cards and tiles
- `modeManager.js` - Auto/Manual/Todo mode management
- `modePicker.js` - Home View header mode control (menu button over `#mode-selector`)
- `migrationManager.js` - Boot entry (`initAppWithAutoMigration`) and fresh-install data shape
- `schemaMigration26.js` - The one-time Schema 2.5 → 2.6 migration

**Philosophy:** Routines are first-class entities with complex state machines. Each module handles one phase of the routine lifecycle.

**Reasoning:** Routine switching involves 20+ steps. Breaking it into loader → manager → switcher made it testable and debuggable.

---

### `recurring/` - Recurring Tasks System
**Purpose:** Template-based recurring task generation
**When to add here:** Recurring logic, scheduling, UI

- `recurringCore.js` - Business logic and scheduling
- `recurringActivation.js` - Recurring task activation logic
- `recurringBoot.js` - Lightweight boot-time recurring UI helpers (heavy panel deferred)
- `recurringCalculators.js` - Date calculation utilities
- `recurringDateUtils.js` - Date parsing and formatting
- `recurringIntegration.js` - Integration with task system
- `recurringMatcher.js` - Pattern matching for recurring rules
- `recurringPanel.js` - Complex UI for recurring settings
- `recurringPanelAddTask.js` - "Add existing tasks to recurring" flow
- `recurringPanelEvents.js` - Panel event handlers
- `recurringPanelForm.js` - Panel form components
- `recurringPanelGrids.js` - Panel grid layouts
- `recurringPanelSetup.js` - Panel initialization
- `recurringPanelSummary.js` - Summary display components
- `recurringSettings.js` - Settings management
- `recurringSettingsApplicator.js` - Apply settings to tasks
- `recurringTemplate.js` - Single definition of a `recurringTemplates[taskId]` record
- `recurringWatcher.js` - Watch for recurring task triggers

**Philosophy:** Recurring is a feature layer on top of tasks. It generates tasks from templates based on schedules.

**Reasoning:** Recurring panel is the most complex UI in miniCycle. Keeping it isolated and well-modularized prevents contaminating simpler modules.

---

### `ui/` - UI Coordination
**Purpose:** Application-level UI that coordinates multiple systems
**When to add here:** Modals, menus, settings, onboarding, undo/redo, customization

- `modalManager.js` - Modal lifecycle and stacking
- `modalRegistry.js` - Centralized modal element lookup with caching
- `modalUtils.js` - Pure modal backdrop utilities
- `menuManager.js` - Settings menu and navigation
- `settingsManager.js` - Settings panel and persistence
- `settingsUIManager.js` - Settings UI components
- `preferencesManager.js` - Personalization modal (colors, backgrounds)
- `preferencesBgImage.js` - Background image preferences (facade sub-module)
- `preferencesPresets.js` - Color preset preferences (facade sub-module)
- `shareManager.js` - Routine sharing (.mcyc)
- `onboardingManager.js` - First-time user experience (facade; statically imports the three below)
- `onboardingSplash.js` - First-run splash screen
- `onboardingDemo.js` - First-run interactive demo
- `onboardingCarousel.js` - First-run welcome carousel
- `guidedTourManager.js` - Opt-in guided tour with spotlight overlay
- `guidedTourDefinitions.js` - Pure data: the built-in tour definitions
- `undoRedoManager.js` - Per-routine undo/redo
- `undoIndexedDB.js` - Durable undo/redo history (IndexedDB)
- `undoSnapshotUtils.js` - Pure snapshot validation, sanitisation, identity
- `undoTransactionDiff.js` - Turns a snapshot diff into the undo/redo notification line
- `gamesManager.js` - Mini-game unlock and panel
- `taskOptionsCustomizer.js` - Per-routine button visibility customization
- `completeAllButton.js` - Complete Cycle / Clear Completed button content
- `backupRestoreManager.js` - Backup and restore functionality
- `completedTasksManager.js` - Completed tasks display
- `cycleExportManager.js` - Routine export to .mcyc
- `cycleImportManager.js` - Routine import from .mcyc
- `helpWindowManager.js` - Help window display
- `titleScreen.js` - Welcome Screen: full-screen branded surface with the app's primary destinations, restored at boot if the user parked there
- `pullToRefresh.js` - Pull-to-refresh gesture
- `taskInteractions.js` - Task interaction handlers
- `taskSearch.js` - Task search functionality
- `taskUI.js` - Task UI utilities
- `taskViewLayoutManager.js` - Desktop drag-customize for the Task View region
- `titleManager.js` - Page title management
- `uiEffects.js` - UI animations and effects
- `uiOrchestrator.js` - UI coordination and orchestration
- `gesturePanelManager.js` - Multi-platform gesture handling for panel navigation
- `panelCarousel.js` - Ordered, indexed main-view panel carousel
- `panelVisibilityHelpers.js` - Shared Help Window / Quick Actions visibility logic
- `focusMode.js` - Distraction-free view (hides UI chrome)
- `focusTaskPanel.js` - One-task-at-a-time card for focus view
- `quickActionsManager.js` - Quick actions panel with switchable views
- `actionUsage.js` - Quick Actions usage tracking (recent/frequent)
- `headerLayoutManager.js` - Measures fixed chrome, publishes CSS custom properties
- `notificationDialogHost.js` - Keeps notifications interactive over native dialogs

**Philosophy:** UI modules don't contain business logic - they coordinate other modules and present data.

**Reasoning:** Settings panel needs to interact with themes, notifications, recurring, etc. It orchestrates, doesn't implement.

---

### `features/` - Optional/Pluggable Features
**Purpose:** Features that enhance core experience but aren't required
**When to add here:** New optional features that can be disabled

- `dueDates.js` - Task due date management
- `reminders.js` - Custom reminder system
- `themeManager.js` - Dynamic theming with unlockables
- `statsPanel.js` - Statistics panel and view switching
- `statsPanelGestures.js` - Stats panel gesture handling (facade sub-module)
- `statsPanelRewards.js` - Stats panel rewards/unlocks (facade sub-module)
- `achievementsManager.js` - Achievement/badge system with OR-based unlocking
- `historyManager.js` - Per-routine activity logging and history modal
- `clearedTasksManager.js` - Cleared task tracking (To-Do mode + cycle reset auto-removes)
- `tipArchive.js` - Browsable carousel of every loading tip (Help & Support)
- `backupReminder.js` - Periodic backup reminder prompts
- `uxRatings.js` - Star rating inside the feedback modal

**Philosophy:** Features should be optional and independently testable. The app works without them.

**Reasoning:** Not all users need due dates or themes. Keeping them optional (`optional: true` in `moduleManifests.js`) means a feature that fails to load does not take the app down (`utils/featureAvailability.js` tracks which ones failed).

---

### `labels/` - Label System
**Purpose:** Centralized user-facing string management
**When to add here:** Label data, resolver logic, vocabulary themes

- `defaultLabels.js` - Pure data module with all user-facing strings, organized by category
- `labelResolver.js` - `getLabel()` function with DI, pluralization, and interpolation
- `themes.js` - Vocabulary theme definitions + manager (per-routine label/color overrides)
- `themeWords.js` - The active vocab theme's words (tasks, cycles, Complete/Clear buttons) for labels that name them in a sentence
- `loading-tips.json` - Loading-tip data (read by `tipArchive.js`, `titleScreen.js`, `miniCycle.html`)

**Philosophy:** Centralizing strings enables contextual lenses (e.g., "task" becomes "workout" in the Fitness vocabulary theme) and provides a single source of truth for all user-facing text.

**Reasoning:** `defaultLabels.js` is a pure data module (no DI, no imports) — importable anywhere at any boot phase. `labelResolver.js` has DI wiring for theme-aware resolution.

---

### `utils/` - Shared Utilities
**Purpose:** Reusable utilities with no business logic dependencies
**When to add here:** Pure functions, platform detection, logging, validation

- `globalUtils.js` - Pure utility functions
- `notifications.js` - Toast notification system (statically imports and re-exports `educationalTips.js`)
- `educationalTips.js` - Teaching-moment tips shown inside notifications
- `announce.js` - Single entry point for screen-reader announcements
- `cycleMode.js` - State accessors and routine-mode helpers (`getActiveRoutine()`, `getRoutine()`, `getAutoClear()`, …)
- `priorityLevel.js` - Task priority as a level (`getPriorityLevel()`, `hasPriority()`, …)
- `schemaVersion.js` - Is a stored document current, older or newer than this build?
- `dueDateUtils.js` - What a task's due date means, and the line that shows it
- `taskSort.js` - The one comparator behind the task-search sort chips
- `collapsibleSections.js` - Shared accordion helpers
- `longPressHint.js` - Long-press hints for icon-only controls
- `motionPreference.js` - The one answer to "should this animate?"
- `readableText.js` - Readable text colours over a painted background
- `styleValidators.js` - Validators for values that reach `style.setProperty()`
- `landOnTasks.js` - Brings the user to tasks created elsewhere (History / Cleared Tasks → Recreate)
- `updateCheck.js` - "Check for Updates", per platform
- `userManualLink.js` - Where the user manual is, and how to open it
- `deviceDetection.js` - Platform and capability detection
- `consoleCapture.js` - Console logging for debugging
- `dataSanitizer.js` - Data sanitization utilities
- `dataValidator.js` - Data validation utilities
- `dataRecovery.js` - Best-effort salvage of corrupted localStorage data
- `debugMode.js` - Debug mode utilities
- `errorHandler.js` - Error handling utilities
- `featureAvailability.js` - Tracks optional modules that failed to load
- `nameUtils.js` - Name/string utilities
- `storageUtils.js` - localStorage utilities and quota management
- `mcycPayload.js` - Single payload builder for .mcyc share/export/download
- `icons.js` - Inline SVG icon registry
- `iconInit.js` - Icon replacement on page load
- `keyboardNav.js` - Roving-tabindex keyboard navigation helpers
- `dialogClose.js` - Animated dialog close utility
- `popoverUtils.js` - Popover utilities
- `liteVersion.js` - Single entry point for navigating to the lite version

**Philosophy:** Utils are reusable across modules, and most are stateless pure helpers. Some hold state and take injected dependencies (e.g. `notifications.js`, `globalUtils.js`, `storageUtils.js`).

**Reasoning:** Utilities should be boring and predictable. No surprises, just reliable helpers.

---

### `testing/` - Testing Infrastructure
**Purpose:** Test-related modules that shouldn't pollute production modules
**When to add here:** Test helpers, mocks, test UI

- `testing-modal.js` - In-app testing modal
- `testing-modal-integration.js` - Test runner integration
- `testing-modal-core.js`, `testing-modal-ui.js`, `testing-modal-analysis.js`, `testing-modal-backup.js`, `testing-modal-debug.js`, `testing-modal-diagnostics.js`, `testing-modal-storage-viewer.js` - Testing modal sub-modules

**Philosophy:** Testing is important enough to deserve its own space.

**Reasoning:** Test modules clutter the main module namespace. Isolating them makes production imports cleaner.

---

### `storage/` - Storage & Backup
**Purpose:** Storage management, backup, and durability
**When to add here:** Backup, export, storage quota management, eviction protection

- `backupManager.js` - Backup creation and management
- `backupFolder.js` - Daily backup file written to a folder on the device (desktop, Android, iPhone)
- `storagePersistence.js` - Requests durable (non-evictable) origin storage via `navigator.storage.persist` (see [STORAGE_MANAGEMENT.md](../features/STORAGE_MANAGEMENT.md) → Storage Persistence)

**Philosophy:** Storage concerns are isolated from business logic.

---

### `progress/` - Cycle Completion (1 module)
**Purpose:** Cycle completion tracking and progress
**When to add here:** Cycle completion, progress tracking, animations

- `cycleCompletion.js` - Cycle completion logic and animations

**Philosophy:** Progress tracking deserves isolation for clear responsibility.

---

### `platform/` - Native Platform Bridge (2 modules)
**Purpose:** Shell integration for the packaged builds — Capacitor (iOS/Android) and Electron (desktop)
**When to add here:** Platform-specific bridging code

- `capacitorBridge.js` - Capacitor native shell bridge (no-op on web)
- `desktopBridge.js` - Electron desktop shell detection (no-op on web)

**Philosophy:** Platform-specific code is isolated so the web app stays platform-agnostic.

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
**Purpose:** `web/archive/` contains legacy code and old implementations (local-only: gitignored, so not in a clone). `web/docs/archive/` contains completed documentation and is tracked.
**Reason:** Different audiences. Developers debug old code. Readers browse old docs.

### Why both `examples/` and `docs/`?
**Examples:** Runnable code you can import and test
**Docs:** Markdown explaining concepts
**Reason:** "Show me an example routine" vs "Explain how recurring tasks work" are different needs.

### Why `games/` for the mini-games?
**Naming:** The folder is `games/`; the game files themselves keep the `miniCycle-` prefix (`miniCycle-taskOrder.html`, etc.), consistent with `miniCycle.html`, `miniCycle-main.js`. (One file is currently named `miniCycle- taskGame.html`, with a space.)
**Reason:** Short folder name, namespaced filenames — the naming convention is established if we add more games.

---

## Evolution History

> History, Oct 2025 – Jan 2026: every figure below is as it stood at the time. Current structure is above; current counts are in [PROJECT_STATS.md](../PROJECT_STATS.md).

### Phase 1: Modularization (Oct 2025)
- **Before:** 15,677-line monolithic `miniCycle-scripts.js`
- **After (Oct 2025):** 3,674-line orchestrator + 33 modules (12,003 lines extracted)
- **Impact:** 74.8% reduction of the monolith
- **Key commits:** `1a45ec8` → `bd373e2` (40+ commits)

### Phase 2: Module Subfolders (Nov 10, 2025)
- **Before (Nov 2025):** 33 modules in flat `modules/` directory
- **After:** 9 domain-based subfolders
- **Impact:** Easier navigation, clearer organization
- **Key commits:** `3cdb9d6`, `532fdf6`

### Phase 3: Root Cleanup (Nov 10, 2025)
- **Before:** 10+ HTML files in web root
- **After:** Only essential files in root, organized into `pages/`, `legal/`, `lite/`
- **Impact:** Cleaner deploys, better URL structure
- **Key commits:** `c77da31`, `6dbd703`

### Phase 4: Documentation Archive (Nov 10, 2025)
- **Before (Nov 2025):** 87 markdown files mixed together in `docs/`
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
- **Key docs:** [BOOT_FILE_SPLIT_PLAN.md](../archive/BOOT_FILE_SPLIT_PLAN.md) (archived)

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
- **Original file:** Archived to `archive/miniCycle-styles.css` (local-only `web/archive/`, not in the repo)

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
2. Browse `modules/task/` files:
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
2. Find the corresponding module (test files are named after modules)
3. Fix in module, verify test passes
4. Run `npm test` (browser suite) — it is not the full set; CI also runs `test:sw`, `test:layout`, `test:meta`, `test:journey` and more (see [VALIDATION_GATES.md](../working-on-code/VALIDATION_GATES.md))

### "I want to understand the folder structure"
**You're here!** This document explains the what, why, and how.

### "I need to see how it used to work"
- **Code:** Check `archive/` for old implementations (local-only; not in a clone)
- **Docs:** Check `docs/archive/` for historical documentation
- **Git:** `git log --oneline --all` and search for relevant commits

### "I want to deploy"
- **Production:** Push to `main`, Netlify builds and publishes the bundled `web/dist/` (root `netlify.toml` is the build authority)
- **Testing:** Netlify deploy previews for pull requests (per [DEPLOYMENT.md](../deployment/DEPLOYMENT.md); a Netlify site setting, not in `netlify.toml`)
- **Version:** App-code changes ship via `cd web && ./scripts/update-version.sh --auto --push --changelog` (version + cache bump + CSP hashes + tag + push) — see [BUILD_PROCESS.md](../deployment/BUILD_PROCESS.md)

---

## Reasoning Behind Key Decisions

### Decision: Keep everything in `web/` folder
**Alternative considered:** Split into `public/`, `web/`, `shared/`
**Chosen approach:** Everything in `web/`
**Reasoning:**
- Netlify builds from `web/` (publishes bundled `web/dist/` since v2.294)
- No build step for development — source structure IS the runtime structure in dev
- URLs work immediately
- Multi-platform did happen without a restructure: the desktop, mobile and Chrome shells live beside `web/` at the repo root and generate their payloads from it

**Trade-off:** Other platforms share `web/` by generated copy (build scripts), not by a shared source folder — repo-root `shared/` is still empty

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
- Could be excluded from production builds — though the build step that now exists (v2.294) deliberately still ships them: the in-app testing modal works in production (`scripts/build-web.cjs` generates stable-path shims for it)

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
Desktop (`desktop/`, Electron), mobile (`mobile/`, Capacitor) and the Chrome extension (`chrome/`) now exist as repo-root shells that generate their payloads from `web/`. If real code sharing is ever needed beyond that:
1. Use the repo-root `shared/` folder (exists, empty by design) for truly shared code
2. Move business logic from `modules/` to `shared/business-logic/`
3. Keep platform-specific UI in respective folders
4. Maintain URL compatibility with redirects

### Build Process Addition
This happened (v2.294, Jul 2026 — esbuild, deploy-time only):
1. Source kept in current structure
2. Output goes to `web/dist/` (content-hashed under `/build/` since v2.301)
3. Netlify publishes the build folder (root `netlify.toml`)
4. Dev server still serves unbundled source — development never needs the build

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
