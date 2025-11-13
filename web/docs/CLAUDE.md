# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Modularization Status

**✅ COMPLETE!** miniCycle modularization is technically complete as of October 27, 2025.

- **Main script:** 3,674 lines (down from 15,677 lines)
- **Reduction:** 74.8% achieved
- **Modules:** 33 modules (12,003 lines extracted)
- **Core functions:** 14 (orchestration only)
- **Test coverage:** 100% (1011/1011 tests passing) ✅
- **Version:** 1.352 (November 13, 2025)
- **Cross-platform:** All tests pass on Mac, iPad, iPhone

**Optional work:** See `REMAINING_EXTRACTIONS_ANALYSIS.md` for 19 optional functions (~1,167 lines) that could reduce the main script to ~2,500 lines (additional 31.8% reduction).

## Essential Commands

### Development Server
```bash
npm start                    # Starts Python HTTP server on port 8080
# Alternative: python3 -m http.server 8080
```

### Version Management
```bash
./update-version.sh          # Interactive version updater for app and service worker
                            # Updates all files with version references (including package.json)
                            # Creates automatic timestamped backups
                            # Validates changes after completion
```

### Testing
```bash
npm test                    # Run automated tests (1011 tests)
npm run test:watch          # Run Jest tests in watch mode
npm run test:coverage       # Generate Jest coverage report
```

### Blog System (Optional)
```bash
npm run blog:install        # Install blog dependencies
npm run blog:build          # Build static blog from markdown posts
```

### CI/CD
```bash
# GitHub Actions runs automatically on push/PR
# Workflow: .github/workflows/test.yml
# Tests on Node.js 18.x and 20.x
# Manual trigger available in GitHub Actions UI
```

### File Access
- **Main App**: http://localhost:8080/miniCycle.html (full version)
- **Lite Version**: http://localhost:8080/lite/miniCycle-lite.html (ES5 compatible)
- **Test Suite**: http://localhost:8080/tests/module-test-suite.html (browser tests)

### Mobile/Cross-Platform Testing
miniCycle can be tested on iPad/iPhone over WiFi for cross-platform validation:
```bash
# Find Mac IP: ifconfig | grep "inet " | grep -v 127.0.0.1
# On iPad/iPhone (same WiFi): http://YOUR_IP:8080/miniCycle.html
# Tests: http://YOUR_IP:8080/tests/module-test-suite.html
```

## Architecture Overview

### Core Philosophy
miniCycle implements **task cycling** - a methodology where task lists persist and only completion status resets, enabling routine building rather than traditional to-do management. This is fundamentally different from standard task apps.

### Dual Version System
- **miniCycle.html + miniCycle-scripts.js**: Full ES6+ version with all features
- **miniCycle-lite.html + miniCycle-lite-scripts.js**: ES5 compatible version for older browsers

### Modular ES6 Architecture ✅ COMPLETE!
**Status:** All major systems have been extracted into 33 focused modules (12,003 lines).

The main application (`miniCycle-scripts.js`) now serves purely as an orchestrator (3,674 lines, down 74.8%):

```javascript
// CRITICAL: version.js provides single source of truth for APP_VERSION
// Loaded first in HTML before any scripts execute
// Available as window.APP_VERSION in browser, self.APP_VERSION in service worker

// Core module loading pattern with cache-busting
const withV = (path) => `${path}?v=${window.APP_VERSION}`;

// Exception: appInit must load WITHOUT version to maintain singleton
const { appInit } = await import('./utilities/appInitialization.js');

// All other modules use versioned imports for proper cache invalidation
const { MiniCycleNotifications } = await import(withV('./utilities/notifications.js'));
const { StatsPanelManager } = await import(withV('./utilities/statsPanel.js'));
const { MiniCycleState } = await import(withV('./utilities/state.js'));
```

**Main systems extracted:**
- Task System (7 modules)
- Cycle System (5 modules)
- UI Coordination (6 modules)
- Recurring System (3 modules)
- Testing System (4 modules)
- Support Services (8 modules)

### Key Architectural Components

#### State Management (`modules/core/appState.js`)
- Centralized state management with event subscription
- Event-driven architecture with `cycle:ready` events
- Automatic localStorage persistence with migration system
- Schema version 2.5 with backward compatibility

#### Undo/Redo System (`modules/ui/undoRedoManager.js`)
- **Per-cycle history:** Each cycle maintains independent undo/redo stacks
- **IndexedDB persistence:** History survives page reloads
- **20 snapshots per cycle:** Full state snapshots, not deltas
- **Smart deduplication:** Prevents duplicate snapshots with signature caching
- **Throttled capture:** 300ms minimum interval between snapshots
- **Debounced writes:** Batches IndexedDB writes every 3 seconds
- **Lifecycle integration:** Automatic cycle switching, creation, deletion, rename
- **73/73 tests passing:** Comprehensive test coverage
- **See:** [UNDO_REDO_ARCHITECTURE.md](./UNDO_REDO_ARCHITECTURE.md) for complete architecture details

#### Module System (`utilities/`)
- **notifications.js**: Advanced notification system with drag support and educational tips
- **statsPanel.js**: Statistics panel with swipe navigation and achievement system
- **deviceDetection.js**: Platform-specific feature detection and optimization
- **themeManager.js**: Dynamic theming system with unlockable themes
- **cycle/cycleLoader.js**: Data loading, migration, and file import/export (.mcyc format)
- **cycle/cycleManager.js**: Cycle creation, onboarding, and management
- **cycle/cycleSwitcher.js**: Cycle switching with modal UI
- **cycle/modeManager.js**: Auto/Manual/Todo mode management

#### Completed Tasks Dropdown (v1.352+)
- **Optional feature:** Separates completed tasks into a collapsible dropdown section
- **Settings toggle:** Enable/disable via Settings → "Show Completed Tasks in Dropdown"
- **Persistence:** Completion state saved to AppState/localStorage (survives refresh)
- **Cycle reset integration:** Tasks from both active and completed lists reset properly
- **Recurring task integration:** Recurring system respects completed tasks in dropdown
- **DOM structure:** Uses `#taskList` (active) and `#completedTaskList` (completed)
- **Implementation:**
  - `miniCycle-scripts.js`: `organizeCompletedTasks()`, `handleTaskListMovement()`
  - `modules/task/taskCore.js`: `handleTaskCompletionChange()` saves state to AppState
  - `modules/ui/settingsManager.js`: Settings UI and state management

#### Global State Management
```javascript
window.AppGlobalState = {
  // Drag and touch interaction state
  draggedTask: null,
  isDragging: false,

  // Undo/redo system (per-cycle, IndexedDB-backed)
  activeUndoStack: [],           // Current cycle's undo snapshots
  activeRedoStack: [],           // Current cycle's redo snapshots
  activeCycleIdForUndo: null,    // Which cycle owns current stacks
  isPerformingUndoRedo: false,   // Flag to prevent recursive snapshots
  isSwitchingCycles: false,      // Flag to block snapshots during cycle switch
  isInitializing: true,          // Flag to skip snapshots during app init
  lastSnapshotSignature: null,   // For deduplication
  lastSnapshotTs: 0,             // For throttling

  // UI state tracking
  advancedVisible: false,

  // Feature flags
  hasInteracted: false
};
```

### Data Schema (Version 2.5)
```javascript
{
  schemaVersion: 2.5,
  cycles: {
    [cycleId]: {
      name: string,
      tasks: Task[],
      cycleCount: number,
      autoReset: boolean,        // Auto Cycle Mode
      deleteCheckedTasks: boolean // To-Do Mode
    }
  },
  appState: {
    activeCycleId: string,
    currentMode: 'auto-cycle' | 'manual-cycle' | 'todo-mode'
  },
  settings: {
    showCompletedDropdown: boolean,    // v1.352+: Enable completed tasks dropdown
    completedTasksExpanded: boolean,   // UI state for dropdown visibility
    // ... other settings
  }
}
```

### PWA Implementation
- **service-worker.js**: Cache-first strategy with versioned updates
- **manifest.json / manifest-lite.json**: PWA configuration for both versions
- Offline functionality with background sync capabilities

## Critical Development Patterns

### Event-Driven Initialization
The app uses a sophisticated initialization system to ensure modules load after data is ready:

```javascript
// Wait for data before initializing UI components
document.addEventListener('cycle:ready', () => {
  // Safe to access cycle data and update UI
});
```

### Version Synchronization & Cache Busting
**CRITICAL:** All modules must use versioned imports to prevent cache issues.

**version.js** - Single Source of Truth:
```javascript
// Auto-generated by update-version.sh
self.APP_VERSION = '1.330';
```

**Why This Matters:**
- Without versioned imports, modules cache with different URLs causing duplicates
- Example: `notifications.js` (un-versioned) AND `notifications.js?v=1.330` (versioned)
- Service worker caches both, users stuck on old cached versions
- Incrementing version forces cache invalidation: `?v=1.330` → `?v=1.331`

**Critical Pattern:**
```javascript
// ✅ CORRECT - Version helper for cache busting
const withV = (path) => `${path}?v=${window.APP_VERSION}`;
await import(withV('./utilities/module.js'));  // module.js?v=1.330

// ❌ WRONG - Un-versioned import creates cache duplicates
await import('./utilities/module.js');  // Will cache separately!

// ⚠️ EXCEPTION - appInit stays un-versioned (singleton requirement)
const { appInit } = await import('./utilities/appInitialization.js');
```

**Use `./update-version.sh`** to synchronize across all files:
- version.js (single source of truth)
- HTML meta tags and cache-busters
- Service worker CACHE_VERSION and APP_VERSION
- Manifest files
- Module @version JSDoc annotations

### Module Communication Pattern
Modules communicate through dependency injection rather than global state:

```javascript
const statsPanel = new StatsPanelManager({
  showNotification: notifications.show.bind(notifications),
  loadMiniCycleData: window.loadMiniCycleData
});
```

### Data Migration Strategy
Always preserve backward compatibility when modifying data schema:
- Increment schema version
- Add migration logic in `cycle/cycleLoader.js`
- Test with legacy data files
- Create backup before migration

## Task Cycling Core Concepts

### Three Operational Modes
1. **Auto Cycle Mode**: Tasks reset automatically when all completed
2. **Manual Cycle Mode**: User controls when to reset via "Complete Cycle"
3. **To-Do Mode**: Traditional behavior - completed tasks are deleted

### Persistent vs Disposable Tasks
- **Cycles**: Persistent task lists that reset completion status (routines, procedures)
- **To-Do**: Disposable tasks that get deleted when completed (one-time actions)

This distinction is fundamental to understanding miniCycle's value proposition and should be preserved in any modifications.

## File Structure Significance

### Backup System
- `backup/`: Automatic timestamped backups created by update-version.sh
- Each backup includes restore.sh script for easy rollback
- Maintains last 3 backups automatically

### Data Files
- `data/*.mcyc`: Sample cycle files demonstrating the .mcyc export format
- Used for testing import/export functionality

### Legacy Code
- `TTO/`: Contains older development artifacts and merge scripts
- Generally safe to ignore for current development

## PWA and Performance Considerations

### Service Worker Updates
When modifying core files, increment both app version and cache version to trigger proper PWA updates:
- Users receive update prompts automatically
- Cache invalidation prevents stale content
- Offline functionality remains intact

### Memory Management
- Large task lists (>100 tasks) may impact performance
- localStorage has browser-imposed limits
- Modular loading reduces initial bundle size

## Testing and Validation

### Automated Testing (100% Pass Rate) ✅
- **958 tests** across 30 modules
- **GitHub Actions** CI/CD on every push/PR
- **Node.js 18.x and 20.x** compatibility testing
- **Browser-based tests** via Playwright
- **Jest tests** with coverage reporting

### Built-in Testing Modal
Access via Settings → App Diagnostics & Testing:
- Health checks for data integrity
- Browser compatibility validation
- Debug information export

### Manual Testing Checklist
1. Test both full and lite versions
2. Verify PWA installation and offline functionality
3. Test data migration with legacy files
4. Validate undo/redo functionality (per-cycle history, IndexedDB persistence)
5. Check stats panel updates after data loading
6. Test cycle switching preserves undo history

### GitHub Actions Workflow
Location: `.github/workflows/test.yml`
- Runs on push to `main` or `develop` branches
- Runs on all pull requests
- Manual trigger available via Actions tab
- Results visible in commit status checks

## Important Notes for AI Assistants

### Modularization is Complete ✅
As of October 27, 2025, modularization is **technically complete**:
- Main script reduced from 15,677 → 3,674 lines (74.8% reduction)
- 33 modules extracted (12,003 lines)
- 14 core orchestration functions remain
- 100% test coverage achieved (958/958 tests) ✅

**Optional work:** `REMAINING_EXTRACTIONS_ANALYSIS.md` documents 19 optional functions (~1,167 lines) that could be extracted for additional optimization. This is NOT required.

### Conceptual Understanding
miniCycle is NOT a traditional task manager. It's a routine management system where:
- Tasks represent steps in repeatable procedures
- Completion status cycles, but task structure persists
- The goal is habit formation and process consistency

### Common Misconceptions to Avoid
- Don't treat cycles as disposable to-do lists
- Don't assume completed tasks should be deleted by default
- The cycling mechanism is the core value proposition, not an edge case
- Don't assume modularization is incomplete - it's done!

### When Making Changes
- Understand that modularization is complete (don't propose unnecessary extractions)
- Use the update-version.sh script for version changes (now updates package.json too)
- Preserve the modular architecture and async loading patterns
- Maintain backward compatibility with existing .mcyc files
- Optional extractions are documented but not required

### Cross-Platform Considerations (November 2025 Fixes)
When working with browser APIs, be aware of Safari/iOS differences:
- **Always use Boolean()** for browser API checks (`Boolean(navigator.connection && ...)`)
- **Safari lacks support** for `navigator.connection`, `navigator.hardwareConcurrency` may be undefined
- **Test on actual devices** - iPad/iPhone testing over WiFi catches platform-specific bugs
- **Test isolation** - Clear localStorage before each test to prevent environment pollution

**Recent Fixes (v1.341):**
- DeviceDetection: Fixed boolean type errors on Safari
- Reminders: Added missing state properties and interval management
- ConsoleCapture: Fixed test environment isolation