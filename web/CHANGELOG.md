# Changelog

All notable changes to miniCycle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.373] - 2025-11-23

### Changed
- **Task Options Customizer**: Enhanced UI refresh handling for task options and mode changes
- **Mode Manager**: Improved in-place UI refresh without page reload when switching modes
- **Testing**: Added dark mode toggle and module filtering to test suite
- **Performance**: Optimized task button refresh with debouncing (150ms delay)

### Fixed
- **Mode Manager**: Fixed mode syncing from AppState data (CRITICAL FIX at modeManager.js:248-250)
- **Task Options**: Improved recurring button visibility updates when switching modes
- **Mode Manager**: Re-attach due date listeners after button refresh to prevent broken interactions
- **Mode Manager**: Pass currentCycle context to task button refresh for recurring handler

---

## [1.372] - 2025-11-22

### Added
- **Task Options Customizer**: Real-time saving - changes apply immediately without save button
- **Task Options Customizer**: Reopen after reload - automatically restores customizer if user was editing
- **Task Options Customizer**: Enhanced reminders integration - start/stop reminders when checkbox changes
- **Task Options Customizer**: Mobile tap preview - shows option details when tapping on mobile
- **Mode Manager**: Mode restoration after reload via sessionStorage

### Changed
- **Task Options Customizer**: Uses `refreshAllTaskButtons()` for consistent state updates
- **Task Options Customizer**: Better UI sync between settings panel, reminders modal, and customizer
- **Task Options Customizer**: Module file expanded to 703 lines
- **Mode Manager**: Enhanced `refreshTaskButtonsForModeChange()` with better error handling

---

## [1.370] - 2025-11-18

### Added
- **Delete When Complete**: New button option for auto-removing tasks during reset
- **Task Options Customizer**: Integration with deleteWhenComplete system
- **Global Utils**: Added `deleteWhenComplete` utilities (`validateDeleteSettings`, `syncTaskDeleteWhenCompleteDOM`, `syncAllTasksWithMode`)

### Changed
- **Task Options**: Added `deleteWhenComplete` button configuration to BUTTON_CONFIG array

---

## [1.352] - 2025-11-13

### Added
- **Completed Tasks Dropdown Feature** - Optional UI feature to separate completed tasks into collapsible dropdown
  - Enable via Settings → "Show Completed Tasks in Dropdown"
  - Tasks move to completed section when checked
  - Badge counter shows number of completed tasks
  - Dropdown expands/collapses on click
  - State persists across page refreshes
  - Tasks return to active list on cycle reset
- **Comprehensive Documentation** - Added 17+ documentation files
  - USER_GUIDE.md - End-user documentation
  - COMPLETED_TASKS_DROPDOWN.md - Feature architecture
  - CHANGELOG.md - Version history (this file)
  - 6 new architecture documents indexed

### Fixed
- **Critical: Task completion state not persisted** - `task.completed` now saves to AppState/localStorage
  - Completed tasks now survive page refreshes
  - Recurring tasks correctly recognize completed status
  - Undo/redo system properly tracks completion state
- **Critical: Cycle reset ignores completed dropdown** - Reset now processes tasks from both active and completed lists
  - All tasks properly reset to incomplete
  - Recurring tasks removed from both lists
  - No tasks "stuck" in completed section
- **Critical: Completed tasks not moved after reset** - Tasks now explicitly move back to active list
  - UI properly reflects unchecked state
  - Completed count badge updates correctly
  - Smooth transition animation

### Changed
- Test suite expanded from 958 to 1011 tests (100% passing)
- Documentation expanded from 11 to 17+ indexed documents
- INDEX.md updated to version 2.0 with comprehensive coverage

---

## [1.348] - 2025-11-10

### Added
- Performance benchmarking framework
  - 12 comprehensive performance tests
  - DOM manipulation benchmarks
  - Cycle operation benchmarks
  - Search/filter performance tests
  - JSON operation benchmarks
  - All tests passing with 9-125x performance margins
- Folder structure documentation

### Changed
- Updated FOLDER_STRUCTURE.md with current production structure

---

## [1.341] - 2025-11-09

### Added
- Developer documentation updates
- Quick reference guide updates
- Deployment guide

### Changed
- Service Worker version 82
- Schema 2.5 stabilization
- Documentation version synchronization

---

## [1.330] - 2025-01

### Added
- **.mcyc File Format** - Standardized export/import format
  - JSON-based cycle export
  - Schema 2.5 compatibility
  - Import validation
  - Data portability between installations

### Changed
- Version system standardization
- Cache busting improvements
- Service Worker update strategy documentation

---

## [1.0.0] - 2025-10-27 (Modularization Complete)

### Added
- **Modularization Complete ✅** - 74.8% code reduction achieved
  - Main script: 15,677 → 3,674 lines
  - 33 focused modules extracted (12,003 lines)
  - 14 orchestration functions remain
  - 100% test coverage maintained

### Major Systems Extracted
- **Task System** (7 modules)
  - taskCore.js - CRUD operations
  - taskDOM.js - DOM rendering
  - taskEvents.js - Event handling
  - taskRenderer.js - UI rendering
  - taskUtils.js - Utility functions
  - taskValidation.js - Input validation
  - dragDropManager.js - Drag & drop

- **Cycle System** (5 modules)
  - cycleLoader.js - Data loading
  - cycleManager.js - Cycle management
  - cycleSwitcher.js - Cycle switching
  - migrationManager.js - Schema migrations
  - modeManager.js - Mode management

- **UI Coordination** (6 modules)
  - menuManager.js - Menu system
  - modalManager.js - Modal dialogs
  - settingsManager.js - Settings panel
  - onboardingManager.js - First-time experience
  - gamesManager.js - Gamification
  - undoRedoManager.js - History management

- **Recurring System** (3 modules)
  - recurringCore.js - Scheduling logic
  - recurringPanel.js - UI panel
  - recurringIntegration.js - System integration

- **Support Services** (8 modules)
  - notifications.js - Toast notifications
  - statsPanel.js - Statistics display
  - themeManager.js - Theme system
  - deviceDetection.js - Platform detection
  - globalUtils.js - Shared utilities
  - consoleCapture.js - Debug logging
  - dueDates.js - Date management
  - reminders.js - Notification system

### Changed
- Architecture: Monolithic → Modular ES6
- Module loading: Version-based cache busting
- Dependency injection throughout
- Resilient constructor pattern

---

## [Schema 2.5] - 2025-10

### Added
- **Unified Schema 2.5** - Complete data structure overhaul
  - Cycles-based architecture
  - Recurring task templates
  - Settings & metadata
  - Theme unlock tracking
  - Migration from legacy schemas
- **Undo/Redo System** - Per-cycle history management
  - IndexedDB persistence
  - 20 snapshots per cycle
  - Smart deduplication
  - Throttled capture (300ms)
  - Debounced writes (3s)
  - 73/73 tests passing

### Changed
- Data storage: Multiple formats → Single Schema 2.5
- State management: Centralized AppState
- Backward compatibility maintained

---

## [Earlier Versions] - 2024-2025

### Major Features Added Over Time
- **Drag & Drop System**
  - Custom implementation (no libraries)
  - Desktop mouse events
  - Mobile touch/long-press
  - Arrow navigation fallback
  - Performance optimized

- **Theme System 2.0**
  - Scalable architecture
  - CSS custom properties
  - Achievement-based unlocks
  - Unlimited theme creation

- **Recurring Tasks**
  - Offline-first polling (30s intervals)
  - DST-safe calculations
  - Hourly, daily, weekly, monthly, yearly patterns
  - Duration options (forever, count, until-date)
  - Specific date overrides
  - Catch-up logic for missed tasks

- **PWA Implementation**
  - Service Worker caching
  - Offline functionality
  - Background sync
  - Install prompts
  - Update notifications

- **Testing Infrastructure**
  - Playwright browser tests
  - 1011 automated tests
  - Performance benchmarks
  - GitHub Actions CI/CD
  - Cross-platform testing (Mac, iPad, iPhone)

---

## Migration Guide

### Upgrading to 1.352

**Breaking Changes:** None

**New Features:**
1. Completed tasks dropdown (opt-in via Settings)
2. Enhanced documentation

**Action Required:** None - automatic compatibility

---

### Upgrading to Schema 2.5

**Breaking Changes:** Data structure completely changed

**Migration:** Automatic on first load
- Legacy data detected and migrated
- Backup created automatically
- All data preserved

**Action Required:**
1. Export backups before upgrading
2. Test migration on non-production data first
3. Verify all cycles and tasks after migration

---

## Deprecation Notices

### Deprecated (will be removed in future versions)

None currently.

### Removed

- **Legacy Schema Support** (pre-2.5) - Removed in v1.330
  - Use Schema 2.5 migration manager
  - Export/import as workaround

---

## Security Updates

### v1.352
- **XSS Protection** - HTML escaping in task text, onboarding themes, notifications

### Earlier
- Input sanitization throughout
- Safe DOM manipulation
- No eval() usage
- CSP-friendly implementation

---

## Performance Improvements

### v1.352
- Event delegation for memory leak prevention
- Optimized recurring task polling
- Fast path checks for scheduling

### v1.348
- Benchmark suite established
- All operations 9-125x within thresholds
- Memory usage 16x better than budget

### v1.0.0 (Modularization)
- 74.8% code size reduction
- Lazy module loading
- Cache-busted imports

---

## Known Issues

### v1.352
- None currently

### Workarounds for Browser Quirks
- **Safari/iOS**: `navigator.connection` unavailable - feature detection handles gracefully
- **Old Browsers**: Lite version available (ES5 compatible)

---

## Roadmap Highlights

See [ROADMAP.md](./ROADMAP.md) for detailed future plans.

**Under Consideration:**
- Cloud sync (cross-device)
- Team collaboration features
- Mobile native apps
- Plugin system expansion
- AI-powered suggestions

---

## Release Frequency

- **Major versions** (X.0.0): ~6 months
- **Minor versions** (1.X.0): ~1-2 months
- **Patch versions** (1.0.X): As needed
- **Hot fixes**: Immediate for critical bugs

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- How to report bugs
- Feature request process
- Pull request guidelines
- Code style requirements

---

## Support

- **Bug Reports:** GitHub Issues
- **Feature Requests:** GitHub Issues
- **Documentation:** `/docs` folder
- **Questions:** GitHub Discussions (if enabled)

---

**Maintained by:** miniCycle Team
**License:** (see LICENSE file)
**Version Format:** [Major].[Minor].[Patch] following SemVer

---

*For detailed technical changes, see git commit history.*
*For user-facing changes, see release notes in GitHub Releases.*
