# Routine Switcher Architecture

> **Complete guide to miniCycle's routine switcher modal system**

**Version**: See [PROJECT_STATS.md](../PROJECT_STATS.md)
**Last Updated**: January 17, 2026
**Module**: `modules/routine/routineSwitcher.js` (~1,676 lines)
**Pattern**: Strict Dependency Injection

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [UI Components](#ui-components)
5. [Sorting System](#sorting-system)
6. [Filtering System](#filtering-system)
7. [Duplicate Feature](#duplicate-feature)
8. [Inline Editing](#inline-editing)
9. [Date Display](#date-display)
10. [Data Validation](#data-validation)
11. [Implementation Details](#implementation-details)
12. [Best Practices](#best-practices)

---

## Overview

The **Routine Switcher** (`routineSwitcher.js`) manages the modal interface for switching between, creating, renaming, duplicating, and deleting routines. It provides a comprehensive view of all routines with sorting, filtering, and search capabilities.

### Core Responsibilities

**The Routine Switcher handles:**
- Modal display and lifecycle
- Routine list rendering with mode indicators
- Sorting by name, date, or size
- Filtering by mode (Auto/Manual/To-Do)
- Search functionality
- Routine duplication with inline rename
- Rename and delete operations
  - **Deleting the *last* routine** (zero cycles remain) opens the neutral **"Create a Routine"** dialog
    — *not* the brand-new-user onboarding walkthrough. An existing user who just deleted a routine is
    treated as the returning user they are; cancelling the dialog loads the getting-started sample so the
    app is never left empty. (`deleteMiniCycle` → `showCycleCreationModal`, v2.329)
- Preview panel updates
- Storage usage display
- Undo system integration

---

## Features

### Visual Mode Indicators

Each routine displays its mode using emojis for quick identification:

| Mode | Emoji | Settings |
|------|-------|----------|
| Auto Cycle | 🔄 | `autoReset: true`, `deleteCheckedTasks: false` |
| Manual Cycle | ✋ | `autoReset: false`, `deleteCheckedTasks: false` |
| To-Do Mode | 📋 | `deleteCheckedTasks: true` |

```javascript
// Mode detection logic (lines 1517-1526)
_getCycleMode(cycleData) {
    if (cycleData.deleteCheckedTasks) {
        return 'todo';
    } else if (cycleData.autoReset) {
        return 'auto';
    } else {
        return 'manual';
    }
}
```

### Date Information

Each routine shows contextual date information:
- **Modified [date]** - When the routine was last changed
- **Created [date]** - For new routines that haven't been modified yet

```javascript
// Date display logic (lines 1089-1101)
const timestamp = cycleData.lastModified || cycleData.createdAt;
if (timestamp) {
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const label = cycleData.lastModified ? 'Modified' : 'Created';
    dateDisplay.textContent = `${label}: ${formattedDate}`;
}
```

### Storage Size Display

Each routine shows its approximate storage size with `~` prefix indicating estimate:

```javascript
const cycleSize = getObjectSizeBytes(cycleData);
sizeSpan.textContent = `~${formatBytes(cycleSize)}`;
```

---

## Architecture

### Class Structure

```javascript
export class RoutineSwitcher {
    constructor(dependencies = {}) {
        // Resolve deps from diBase, with constructor overrides
        const resolvedDeps = di.resolve(dependencies);

        this.deps = {
            AppState: resolvedDeps.AppState,
            showNotification: resolvedDeps.showNotification,
            showPromptModal: resolvedDeps.showPromptModal,
            showConfirmationModal: resolvedDeps.showConfirmationModal,
            sanitizeInput: resolvedDeps.sanitizeInput,
            loadMiniCycle: resolvedDeps.loadMiniCycle,
            safeAddEventListener: resolvedDeps.safeAddEventListener,
            onCycleRenamed: resolvedDeps.onCycleRenamed,
            onCycleDeleted: resolvedDeps.onCycleDeleted,
            onCycleSwitched: resolvedDeps.onCycleSwitched,
            // ... more deps
        };

        // Instance state
        this._tempRenameData = null;
        this._sortMode = 'alpha';      // 'alpha', 'recent', 'size'
        this._sortDirection = 'asc';   // 'asc', 'desc'
        this._filterMode = 'all';      // 'all', 'auto', 'manual', 'todo'

        this.setupModalClickOutside();
    }
}
```

### Dependency Injection

The module uses strict DI via `diBase.js`:

```javascript
const di = createDIModule('RoutineSwitcher', {
    AppState: optional(null),
    AppMeta: optional(null),
    loadMiniCycleData: optional(() => null),
    showNotification: optional(null),
    hideMainMenu: optional(() => {}),
    showPromptModal: optional(null),
    showConfirmationModal: optional(null),
    sanitizeInput: optional((str) => str),
    loadMiniCycle: optional(null),
    safeAddEventListener: optional(null),
    onCycleRenamed: optional(null),
    onCycleDeleted: optional(null),
    onCycleSwitched: optional(null),
    // ... more deps
});
```

---

## UI Components

### Modal Structure

```
┌─────────────────────────────────────────────────┐
│  Routine Switcher                          [X]  │
├─────────────────────────────────────────────────┤
│  [Search input                              🔍]  │
│  [A-Z] [Recent] [Size]   Filter: [All Modes ▼]  │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │ 🔄  Morning Routine              ~2.1KB │    │
│  │ ✋  Weekly Review               ~1.4KB │    │
│  │ 📋  Shopping List                ~0.8KB │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│  Preview:                                       │
│  ┌─────────────────────────────────────────┐    │
│  │ Tasks:                                  │    │
│  │ ✔️ Wake up at 7am                       │    │
│  │ ___ Brush teeth                         │    │
│  │ ___ Exercise 30 min                     │    │
│  └─────────────────────────────────────────┘    │
│  Modified: Jan 3, 2026                          │
├─────────────────────────────────────────────────┤
│  [Duplicate] [Rename] [Delete]                  │
│  ┌──────────────────────┐                       │
│  │ Storage: ████░░ 45%  │ [↻]                   │
│  └──────────────────────┘                       │
├─────────────────────────────────────────────────┤
│  [Cancel]                            [Confirm]  │
└─────────────────────────────────────────────────┘
```

### List Item Structure

```javascript
// List item creation (lines 1180-1237)
const listItem = document.createElement("div");
listItem.classList.add("mini-cycle-switch-item");
listItem.dataset.cycleName = cycleData.title;
listItem.dataset.cycleKey = cycleKey;

// Left side: emoji + title
const leftSide = document.createElement("span");
leftSide.className = "cycle-item-left";

const emojiSpan = document.createElement("span");
emojiSpan.className = "cycle-item-emoji";
emojiSpan.textContent = emoji;  // 🔄, ✋, or 📋

const titleSpan = document.createElement("span");
titleSpan.className = "cycle-item-title";
titleSpan.textContent = cycleData.title;

// Right side: size
const sizeSpan = document.createElement("span");
sizeSpan.className = "cycle-item-size";
sizeSpan.textContent = `~${formatBytes(cycleSize)}`;
```

---

## Sorting System

### Sort Modes

| Mode | Button Label | Behavior |
|------|--------------|----------|
| `alpha` | A-Z / Z-A | Alphabetical by title |
| `recent` | Recent / Oldest | By lastModified or createdAt |
| `size` | Largest / Smallest | By storage size in bytes |

### Sort Implementation

```javascript
// Sort cycles (lines 1459-1487)
_sortCycles(cycleEntries) {
    const isAsc = this._sortDirection === 'asc';

    if (this._sortMode === 'recent') {
        return cycleEntries.sort((a, b) => {
            const aTime = a[1].lastModified || a[1].createdAt || 0;
            const bTime = b[1].lastModified || b[1].createdAt || 0;
            return isAsc ? bTime - aTime : aTime - bTime;
        });
    } else if (this._sortMode === 'size') {
        return cycleEntries.sort((a, b) => {
            const aSize = getObjectSizeBytes(a[1]);
            const bSize = getObjectSizeBytes(b[1]);
            return isAsc ? bSize - aSize : aSize - bSize;
        });
    } else {
        // Default: alphabetical
        return cycleEntries.sort((a, b) => {
            const aTitle = (a[1].title || a[0]).toLowerCase();
            const bTitle = (b[1].title || b[0]).toLowerCase();
            return isAsc ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
        });
    }
}
```

### Toggle Behavior

Clicking an active sort button toggles direction:

```javascript
sortAlpha._sortHandler = () => {
    if (this._sortMode === 'alpha') {
        // Toggle direction
        this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        this._sortMode = 'alpha';
        this._sortDirection = 'asc';
    }
    this._updateSortButtonStates();
    this.loadMiniCycleList();
};
```

---

## Filtering System

### Filter Options

| Value | Label | Shows |
|-------|-------|-------|
| `all` | All Modes | All routines |
| `auto` | 🔄 Auto Cycle | Only `autoReset: true` routines |
| `manual` | ✋ Manual | Only manual cycle routines |
| `todo` | 📋 To-Do | Only `deleteCheckedTasks: true` routines |

### Filter Implementation

```javascript
// Filter cycles (lines 1533-1541)
_filterCycles(cycleEntries) {
    if (this._filterMode === 'all') {
        return cycleEntries;
    }

    return cycleEntries.filter(([key, cycleData]) => {
        return this._getCycleMode(cycleData) === this._filterMode;
    });
}
```

### No Results Handling

```javascript
if (filteredCycles.length === 0) {
    const modeLabels = { auto: 'Auto Cycle', manual: 'Manual Cycle', todo: 'To-Do' };
    miniCycleList.innerHTML = `<div class="no-cycles-message">No ${modeLabels[this._filterMode] || ''} routines found</div>`;
    return;
}
```

---

## Duplicate Feature

### Duplication Flow

```
1. User selects routine
2. Clicks "Duplicate" button
3. System creates deep copy with:
   - New name: "[Original] Copy" (unique)
   - Reset cycleCount to 0
   - New createdAt timestamp
   - Removed lastModified (shows "Created" until edited)
   - New unique IDs for all tasks
4. List refreshes with new item selected
5. New item enters inline edit mode
6. User can rename immediately or press Escape
```

### Implementation

```javascript
// Duplicate method (lines 508-606)
duplicateMiniCycle() {
    // Generate unique name
    const baseName = `${originalCycle.title} Copy`;
    const { name: uniqueName } = getUniqueCycleName(baseName, cycles);

    // Deep copy with structuredClone
    const copiedCycle = structuredClone(originalCycle);
    copiedCycle.title = uniqueName;
    copiedCycle.createdAt = Date.now();
    delete copiedCycle.lastModified;  // Show "Created" until actual changes
    copiedCycle.cycleCount = 0;

    // Generate new IDs for all tasks
    if (Array.isArray(copiedCycle.tasks)) {
        copiedCycle.tasks = copiedCycle.tasks.map(task => ({
            ...task,
            id: `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        }));
    }

    // Save to state
    this.deps.AppState.update(state => {
        state.data.cycles[uniqueName] = copiedCycle;
        state.metadata.lastModified = Date.now();
        state.metadata.totalCyclesCreated = (state.metadata.totalCyclesCreated || 0) + 1;
    }, true);

    // Refresh and start inline edit
    this.loadMiniCycleList();
    setTimeout(() => {
        const newItem = /* find new item */;
        this._startInlineEdit(newItem, uniqueName);
    }, 100);
}
```

---

## Inline Editing

Both **Rename** and **Duplicate** use inline editing for a seamless experience.

### Edit Flow

```
1. User clicks Rename or Duplicate button
2. _startInlineEdit() called on selected item
3. Title span hidden, input element inserted
4. Input focused with all text selected
5. User types new name
6. On Enter or blur: _finishInlineEdit() saves
7. On Escape: original name restored
```

### Implementation

```javascript
// Start inline edit (lines 613-653)
_startInlineEdit(listItem, cycleKey) {
    const titleSpan = listItem.querySelector('.cycle-item-title');
    const currentName = titleSpan.textContent;

    // Create and insert input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cycle-item-edit-input';
    input.value = currentName;

    titleSpan.style.display = 'none';
    titleSpan.parentNode.insertBefore(input, titleSpan.nextSibling);

    input.focus();
    input.select();

    // Event handlers
    input.addEventListener('blur', () => this._finishInlineEdit(...), { once: true });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.value = currentName; input.blur(); }
    });
}

// Finish inline edit (lines 662-731)
_finishInlineEdit(listItem, oldKey, input, titleSpan) {
    const newName = this.deps.sanitizeInput(input.value.trim());

    input.remove();
    titleSpan.style.display = '';

    if (!newName || newName === oldName) return;

    // Handle name collision
    const { name: uniqueName, wasModified } = getUniqueCycleName(newName, cycles);

    // Update state
    this.deps.AppState.update(state => {
        const cycleData = state.data.cycles[oldKey];
        state.data.cycles[uniqueName] = { ...cycleData, title: uniqueName };
        delete state.data.cycles[oldKey];

        if (state.appState.activeCycleId === oldKey) {
            state.appState.activeCycleId = uniqueName;
        }
    }, true);

    // Notify undo system
    this.deps.onCycleRenamed?.(oldKey, uniqueName);
}
```

---

## Date Display

### Timestamp Priority

1. `lastModified` - When routine was last changed
2. `createdAt` - When routine was created (fallback)

### When Timestamps Update

| Action | lastModified | createdAt |
|--------|--------------|-----------|
| Create routine | Not set | Set to now |
| Duplicate routine | Deleted | Set to now |
| Edit tasks | Updated | Unchanged |
| Switch away | Updated | Unchanged |
| Rename | Updated | Unchanged |

### Display Logic

```javascript
// In updatePreview() (lines 1089-1101)
const timestamp = cycleData.lastModified || cycleData.createdAt;
const label = cycleData.lastModified ? 'Modified' : 'Created';
dateDisplay.textContent = `${label}: ${formattedDate}`;
```

---

## Data Validation

### On-Switch Validation

Before switching to a routine, data is validated and repaired:

```javascript
// Validate and repair (lines 866-986)
_validateAndRepairCycleData(cycleKey) {
    const cycle = structuredClone(originalCycle);
    let repaired = false;

    // Ensure tasks is an array
    if (!Array.isArray(cycle.tasks)) {
        cycle.tasks = [];
        repaired = true;
    }

    // Validate each task
    for (const task of cycle.tasks) {
        if (!task.id) {
            task.id = `task-${Date.now()}-${Math.random()}`;
            repaired = true;
        }
        if (typeof task.completed !== 'boolean') {
            task.completed = Boolean(task.completed);
            repaired = true;
        }
        // ... more field validation
    }

    // Ensure cycle has required fields
    if (typeof cycle.cycleCount !== 'number') {
        cycle.cycleCount = 0;
        repaired = true;
    }

    if (repaired) {
        this.deps.AppState.update(state => {
            state.data.cycles[cycleKey] = cycle;
        }, true);
    }

    return repaired;
}
```

---

## Implementation Details

### Debounced List Loading

```javascript
loadMiniCycleList() {
    if (this.loadMiniCycleListTimeout) {
        clearTimeout(this.loadMiniCycleListTimeout);
    }

    this.loadMiniCycleListTimeout = setTimeout(() => {
        this.loadMiniCycleListActual();
    }, 50);
}
```

### Click-Outside Handler

```javascript
setupModalClickOutside() {
    // Handler stored on class instance (not document.*) for proper cleanup
    this._clickOutsideHandler = (event) => {
        const switchModal = this.deps.querySelector(".mini-cycle-switch-modal");
        if (!switchModal || switchModal.style.display !== "flex") return;

        const switchModalContent = this.deps.querySelector(".mini-cycle-switch-modal-content");
        const modalOverlay = event.target.closest('.mini-modal-overlay');

        // Don't close if clicking inside modal, menu, or confirmation dialogs
        if (
            !switchModalContent.contains(event.target) &&
            !mainMenu.contains(event.target) &&
            !modalOverlay  // Important: Don't close when clicking confirmations
        ) {
            switchModal.style.display = "none";
        }
    };
    safeAdd(document, "click", this._clickOutsideHandler);
}
```

### Idle-Time Saves

For non-critical operations, saves are deferred to idle time:

```javascript
_scheduleIdleSave() {
    if (this._idleSaveScheduled) return;
    this._idleSaveScheduled = true;

    const doSave = () => {
        this._idleSaveScheduled = false;
        if (this.deps.AppState.isReady?.()) {
            this.deps.AppState.forceSave();
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(doSave, { timeout: 500 });
    } else {
        setTimeout(doSave, 50);
    }
}
```

---

## Best Practices

### When Modifying the Switcher

1. **Always use AppState** for data access, never direct localStorage
2. **Use safeAddEventListener** to prevent duplicate event handlers
3. **Debounce list refreshes** to avoid performance issues
4. **Handle click-outside** with care - exclude confirmation dialogs
5. **Notify undo system** on rename, delete, and switch operations

### When Adding New Features

1. **Add to sort/filter options** if introducing new categorization
2. **Update emoji mappings** if adding new modes
3. **Preserve data integrity** by validating on switch
4. **Support inline editing** for user-friendly renaming
5. **Update documentation** (this file and USER_GUIDE.md)

### Testing Considerations

```javascript
// Key test scenarios:
// 1. Sort by each mode, toggle direction
// 2. Filter by each mode, verify correct routines shown
// 3. Duplicate routine, verify new IDs and inline edit
// 4. Rename via inline edit with collision
// 5. Delete active routine, verify fallback
// 6. Click outside with confirmation dialog open
```

---

## Related Documentation

- [USER_GUIDE.md](../user-guides/USER_GUIDE.md) - User-facing switcher documentation
- [MODE_MANAGER_ARCHITECTURE.md](./MODE_MANAGER_ARCHITECTURE.md) - Mode system architecture
- [SCHEMA_2_5.md](../data-schema/SCHEMA_2_5.md) - Data schema with cycle fields
- [DI_PATTERNS.md](../developer-guides/DI_PATTERNS.md) - Dependency injection patterns

---

**Routine Switcher Architecture** - Complete routine management modal system

Built by [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
