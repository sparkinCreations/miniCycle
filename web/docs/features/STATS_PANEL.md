# Stats Panel

> **Status:** ✅ Production Ready
> **Test Coverage:** 100% (24/24 tests passing)
> **Module:** `modules/features/statsPanel.js`
>
> See [PROJECT_STATS.md](../PROJECT_STATS.md) for current version.

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [User Interface](#user-interface)
3. [Statistics Display](#statistics-display)
4. [Milestone System](#milestone-system)
5. [View Switching & Gestures](#view-switching--gestures)
6. [Mode-Aware Behavior](#mode-aware-behavior)
7. [Technical Architecture](#technical-architecture)
8. [Related Modules](#related-modules)
9. [API Reference](#api-reference)

---

## Overview

The **Stats Panel** is a full-featured statistics dashboard that provides users with progress tracking, milestone achievements, and gamification feedback. It slides in from the right side of the screen using multi-platform gesture support.

### Key Features

- ✅ **Real-time statistics** - Task counts, completion rates, cycle counts
- ✅ **Doughnut chart** - Visual progress indicator for current routine
- ✅ **Milestone tracking** - Progress toward theme and game unlocks
- ✅ **Multi-platform gestures** - Touch swipe, mouse drag, trackpad scroll, pointer events
- ✅ **Mode-aware display** - Adapts text/metrics based on Auto/Manual/To-Do mode
- ✅ **Collapsible sections** - Preferences persisted in AppState
- ✅ **Navigation dots** - Visual indicator of current view
- ✅ **Keyboard accessible** - Tab key support for view switching

### Access Methods

Users can access the stats panel via:
1. **Swipe left** on touch devices
2. **Mouse drag left** on desktop
3. **Trackpad scroll** horizontally
4. **Navigation dots** at bottom of screen
5. **Slide buttons** (arrow buttons)
6. **Tab key** to cycle between views

---

## User Interface

### Layout Structure

```
┌─────────────────────────────────────────┐
│  📊 Stats Panel                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Current Routine ▼              │   │
│  │  ┌───────────┐                  │   │
│  │  │   75%     │ ← Doughnut       │   │
│  │  └───────────┘                  │   │
│  │  3 of 4 Tasks Completed         │   │
│  │  12 Cycles Completed            │   │
│  │  [History] [Achievements]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Progress: 25 / 50 Cycles       │   │
│  │  ████████░░░░░░░░░░░░ 50%       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🏆 Milestones ▼                │   │
│  │  🎨 Dark Ocean (10)    ✅       │   │
│  │  ✨ Golden Glow (50)   🔒       │   │
│  │  🎮 Task Game (100)    🔒       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [🎨] [⚙️] [❓]                  │   │
│  │  Themes Settings Help           │   │
│  └─────────────────────────────────┘   │
│                                         │
│           ● ○  ← Navigation dots       │
└─────────────────────────────────────────┘
```

### Collapsible Sections

Two main sections can be expanded/collapsed:

| Section | Default | Persisted In |
|---------|---------|--------------|
| **Current Routine** | Expanded | `settings.statsPanel.currentRoutineExpanded` |
| **Milestones** | Collapsed | `settings.statsPanel.milestonesExpanded` |

Click the section header (with ▼/▲ toggle) to expand or collapse.

---

## Statistics Display

### Current Session Stats

| Metric | Description | Element ID |
|--------|-------------|------------|
| **Total Tasks** | Tasks in current routine | `#total-tasks` |
| **Completed Tasks** | Checked tasks count | `#completed-tasks` |
| **Completion Rate** | Percentage (e.g., "75.0%") | `#completion-rate` |
| **Doughnut Chart** | SVG visual progress ring | `#current-cycle-doughnut-progress` |

### Global Progress Stats

| Metric | Description | Element ID |
|--------|-------------|------------|
| **Global Cycles** | Total cycles across ALL routines | `#mini-cycle-count` |
| **Per-Routine Cycles** | Cycles for current routine only | `#per-cycle-count` |
| **Cleared Tasks** | Tasks cleared in To-Do mode | `#per-routine-cleared` |

### Progress Bar

The progress bar shows progress toward the **next milestone badge**:

```
Progress: 25 of 50 Cycles (25 remaining)
████████████░░░░░░░░░░░░░░ 50%
```

The progress is mode-aware:
- **Cycle modes**: Shows cycles completed toward next milestone
- **To-Do mode**: Shows cleared tasks toward next milestone

---

## Milestone System

### Milestone Tiers (OR-Based)

Milestones can be unlocked via **cycles completed OR tasks cleared**:

| Badge | Cycles Required | Tasks Required | Unlock |
|-------|-----------------|----------------|--------|
| 🥉 Bronze | 5 | 25 | Badge |
| 🥈 Silver | 10 | 50 | Badge + Dark Ocean Theme |
| 🥇 Gold | 25 | 125 | Badge |
| 💎 Diamond | 50 | 250 | Badge + Golden Glow Theme |
| 👑 Crown | 100 | 500 | Badge + Whack-a-Order Game |
| 🌟 Star | 250 | 1250 | Badge |
| ⚡ Lightning | 500 | 2500 | Badge |
| 🔥 Fire | 1000 | 5000 | Badge |

### Theme Unlocks

| Theme | Requirement | Description |
|-------|-------------|-------------|
| **Dark Ocean** | 10 cycles OR 50 tasks | Deep blue gradient theme |
| **Golden Glow** | 50 cycles OR 250 tasks | Warm golden accent theme |

### Game Unlocks

| Feature | Requirement | Description |
|---------|-------------|-------------|
| **Whack-a-Order Game** | 100 cycles OR 500 tasks | Mini-game for task ordering practice |

### Unlock Messages

When a milestone is locked, the stats panel shows progress hints:

```
🔒 25 more cycles to unlock ✨ Golden Glow!
```

When unlocked:

```
✨ Golden Glow unlocked! 🔓
```

---

## View Switching & Gestures

### Gesture Support (Multi-Platform)

The stats panel supports multiple input methods for switching views:

| Method | Action | Threshold |
|--------|--------|-----------|
| **Touch Swipe** | Swipe left/right | 100px horizontal movement |
| **Mouse Drag** | Click and drag horizontally | 400px movement |
| **Wheel/Trackpad** | Horizontal scroll | 400px accumulated delta |
| **Pointer Events** | Modern unified input | 400px movement |
| **Keyboard** | Tab key | Toggle between views |

### Navigation Elements

| Element | Purpose |
|---------|---------|
| **Navigation Dots** | Visual indicator + click to toggle |
| **Slide Left Button** | Arrow to return to task view |
| **Slide Right Button** | Arrow to open stats panel |

### View States

```javascript
// Internal state tracking
state: {
    isStatsVisible: false,  // Current view
    isSwiping: false,       // Touch swipe in progress
    isMouseDragging: false, // Mouse drag in progress
    isPointerSwiping: false // Pointer event in progress
}
```

---

## Mode-Aware Behavior

The stats panel adapts its display based on the current routine's mode:

### Cycle Modes (Auto/Manual)

- Progress bar shows **cycles completed**
- Milestone text: "25 of 50 cycles (25 remaining)"
- Primary metric: Global cycles completed

### To-Do Mode

- Progress bar shows **cleared tasks**
- Milestone text: "125 of 250 cleared tasks (125 remaining)"
- Primary metric: Global tasks cleared
- Shows per-routine cleared count

### Mode Detection

```javascript
// Mode is detected from the active cycle's settings
const isToDoMode = activeCycleData?.deleteCheckedTasks === true;
```

---

## Technical Architecture

### Dependencies (DI-Pure)

```javascript
const di = createDIModule('StatsPanel', {
    showNotification: optional(null),
    loadMiniCycleData: optional(null),
    isOverlayActive: optional(null),
    isDraggingNotification: optional(null),
    updateThemeColor: optional(null),
    hideMainMenu: optional(null),
    setupDarkModeToggle: optional(null),
    AppState: optional(null),
    appInit: optional(null),
    safeAddEventListener: optional(null),
    // Phase 7 managers
    historyManager: optional(null),
    clearedTasksManager: optional(null),
    achievementsManager: optional(null)
});
```

### Performance Optimizations

1. **DOM Element Caching** - Elements cached on init, not queried repeatedly
2. **Task Stats Cache** - Calculations cached with TTL to avoid redundant DOM queries
3. **Dependency Caching** - Resolved deps cached to avoid Proxy overhead
4. **Debounced Updates** - Stats updates debounced to prevent rapid-fire calculations

### Event Listeners

All event listeners use `safeAddEventListener` for:
- Null-safety (won't throw if element missing)
- Testability (can be mocked in tests)
- Consistent behavior across all modules

### DOM Element Cache

```javascript
this.elements = {
    // Stats display
    totalTasks, completedTasks, completionRate,
    // Doughnut chart
    currentCycleDoughnutProgress, currentCycleDoughnutText,
    // Progress tracking
    miniCycleCount, perCycleCount, statsProgressBar,
    // Navigation
    navDotsContainer, dots, slideLeft, slideRight,
    // Collapsible sections
    currentRoutineStatus, themeUnlockStatus,
    // Theme unlock messages
    themeUnlockMessage, goldenUnlockMessage, gameUnlockMessage,
    // Buttons
    openThemesPanel, closeThemesBtn,
    // ... and more
};
```

---

## Related Modules

The stats panel integrates with several other modules:

| Module | Integration |
|--------|-------------|
| `achievementsManager.js` | Badge UI, achievement popups (delegated in v1.729) |
| `historyManager.js` | History button opens history modal |
| `clearedTasksManager.js` | Cleared tasks button opens cleared tasks modal |
| `themeManager.js` | Theme selection modal |
| `gesturePanelManager.js` | Gesture handling (extracted in v1.729) |
| `appState.js` | All data access via DI |
| `appInit.js` | Waits for core ready before accessing state |

### Badge UI Delegation (v1.729+)

As of v1.729, badge UI methods have been moved to `achievementsManager.js`:

- `initBadgeTooltips()` - Initialize badge click handlers
- `updateBadges(cyclesCompleted)` - Update badge display
- `showBadgeDetail(milestone)` - Show badge popup
- `hideBadgeDetail()` - Hide badge popup

The stats panel calls `achievementsManager.updateBadges()` during stats updates.

---

## API Reference

### Main Class

```javascript
import { StatsPanelManager, setStatsPanelDependencies } from './modules/features/statsPanel.js';

// Set dependencies before creating instance
setStatsPanelDependencies({
    AppState, appInit, showNotification, safeAddEventListener,
    historyManager, clearedTasksManager, achievementsManager
});

// Create instance (usually done by moduleLoader)
const statsPanel = new StatsPanelManager();
```

### Public Methods

| Method | Description |
|--------|-------------|
| `showStatsPanel()` | Slide in stats panel |
| `showTaskView()` | Slide back to task view |
| `updateStatsPanel()` | Refresh all statistics |
| `getStatistics()` | Get current stats object |
| `initView()` | Reset to initial state |

### Events Listened

| Event | Action |
|-------|--------|
| `cycle:ready` | Update stats when cycle data loads |
| `mode-selector:change` | Update stats when mode changes |
| `touchstart/move/end` | Handle swipe gestures |
| `mousedown/move/up` | Handle mouse drag |
| `wheel` | Handle trackpad scroll |
| `pointerdown/move/up` | Handle pointer events |
| `keydown` | Handle Tab key |

### Singleton Access

```javascript
import { statsPanelManager } from './modules/features/statsPanel.js';

// Use the singleton instance
statsPanelManager.updateStatsPanel();
statsPanelManager.showStatsPanel();
```

---

## Testing

### Test File
`tests/statsPanel.tests.js`

### Key Test Cases

1. **Stats calculation** - Correct task counts and percentages
2. **View switching** - Gestures trigger correct view changes
3. **Milestone progress** - Correct progress bar calculations
4. **Mode detection** - Proper mode-aware display
5. **Collapsible preferences** - Section state persistence
6. **Theme unlock logic** - Correct unlock thresholds

### Running Tests

```bash
# Run all tests
npm test

# Or in browser
# http://localhost:8080/tests/module-test-suite.html
# Select "statsPanel" module
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.729 | Jan 2026 | Badge UI delegated to achievementsManager |
| 1.729 | Jan 2026 | Gesture handling extracted to gesturePanelManager |
| 1.672 | Dec 2025 | Mode-aware milestone progress |
| 1.650 | Dec 2025 | OR-based achievements (cycles OR tasks) |
| 1.606 | Dec 2025 | Collapsible section preferences |
| 1.395 | Nov 2025 | Multi-platform gesture support |

---

**Related Documentation:**
- [FEATURE_LIST.md](./FEATURE_LIST.md) - Complete feature overview
- [API_REFERENCE.md](../developer-guides/API_REFERENCE.md) - Module APIs
- [ARCHITECTURE_OVERVIEW.md](../developer-guides/ARCHITECTURE_OVERVIEW.md) - System architecture
