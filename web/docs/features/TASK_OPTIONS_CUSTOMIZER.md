# Task Options Customizer

> **Version:** 1.373+ (November 23, 2025)
> **Status:** ✅ Production Ready
> **Test Coverage:** 100% (29/29 tests passing)
> **Module:** `modules/ui/taskOptionsCustomizer.js` (703 lines)

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Global vs Per-Cycle Philosophy](#global-vs-per-cycle-philosophy)
3. [User Experience](#user-experience)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Details](#implementation-details)
6. [Testing](#testing)
7. [Usage Guide](#usage-guide)
8. [Migration & Compatibility](#migration--compatibility)

---

## Overview

The **Task Options Customizer** is a per-cycle button visibility system that allows users to show/hide individual task action buttons for each routine. This enables cycles to range from ultra-minimal (simple checklists) to full-featured (complex project management).

### Key Features

- ✅ **Per-cycle customization** - Each routine can have different button visibility
- ✅ **Real-time updates** - Changes apply immediately without page reload (v1.372+)
- ✅ **Responsive design** - Desktop (two-column + preview) vs Mobile (single-column with tap preview)
- ✅ **Bidirectional sync** - Changes sync with settings panel, reminders modal, three dots menu
- ✅ **Global consistency** - UI chrome (arrows, three dots) stays consistent across cycles
- ✅ **Zero-config defaults** - Sensible defaults for new cycles
- ✅ **Backward compatible** - Existing cycles work with fallback defaults
- ✅ **Reopen after reload** - Automatically restores customizer if user was editing before reload (v1.372+)

### Access Points

Users can open the customizer from:
1. **Per-task `-/+` button** - Click customize button on any task
2. **Settings panel** - "Customize Task Buttons" option
3. **Keyboard shortcut** - (Future: Could add shortcut)

---

## Global vs Per-Cycle Philosophy

### 🎯 Design Principle

**The core philosophy:** Separate **UI preferences** (global) from **feature requirements** (per-cycle).

```
UI Preference:   "I don't like arrows"           → Global setting
Feature Need:    "This cycle needs due dates"    → Per-cycle setting
```

---

### 🌐 Global Settings

**Settings that affect UI interaction paradigm across all cycles:**

| Button | Icon | Why Global? |
|--------|------|-------------|
| **Move Arrows** | ▲▼ | **Navigation preference** - Users who like/dislike arrows want consistency everywhere |
| **Three Dots** | ⋮ | **Access method preference** - Dropdown vs direct buttons is a UI paradigm choice |

**Synchronized with:**
- `state.ui.moveArrowsVisible` - Global arrow visibility
- `state.settings.showThreeDots` - Global three dots visibility

**Rationale:**
- UI chrome should be **consistent** across all cycles
- Users don't think "I want arrows in this cycle but not that one"
- Users think "I prefer arrows" or "I don't like arrows"
- **Interaction method is a preference, not a requirement**

---

### 🔄 Per-Cycle Settings

**Settings that affect task functionality/features for specific routines:**

| Button | Icon | Why Per-Cycle? |
|--------|------|----------------|
| **Customize** | -/+ | Always visible (can't be disabled) - access to customizer itself |
| **High Priority** | ⚡ | Some cycles need priorities (work), others don't (shopping) |
| **Rename** | ✏️ | Editing frequency varies by cycle type |
| **Delete** | 🗑️ | Some cycles are stable (routines), others change often (projects) |
| **Recurring** | 🔁 | Only needed for cycles with repeating tasks |
| **Due Date** | 📅 | Only needed for time-sensitive cycles |
| **Reminders** | 🔔 | Only needed when notifications matter |
| **Delete When Complete** | ❌ | Remove task during auto-reset instead of unchecking (v1.370+) |

**Stored in:**
- `cycle.taskOptionButtons` object per cycle

**Rationale:**
- Different cycles have **different purposes**
- Feature needs vary based on routine type
- Allows cycles to be **simple or complex** as needed
- **Functionality is a requirement, not a preference**

---

### 📊 Real-World Examples

#### Example 1: Morning Routine (Minimal)
```javascript
{
  customize: true,      // Always available
  moveArrows: false,    // ← Global: User doesn't like arrows
  threeDots: false,     // ← Global: User prefers direct buttons
  highPriority: true,   // Some tasks matter more
  rename: true,         // Occasional adjustments
  delete: true,         // Remove tasks I don't need
  recurring: false,     // Daily routine, no recurring needed
  dueDate: false,       // No deadlines in morning routine
  reminders: false      // I do it every morning anyway
}
```
**Result:** Clean, minimal 4-button interface

---

#### Example 2: Work Projects (Full-Featured)
```javascript
{
  customize: true,      // Always available
  moveArrows: false,    // ← Same global preference
  threeDots: false,     // ← Same global preference
  highPriority: true,   // Prioritize important work
  rename: true,         // Update task names often
  delete: true,         // Remove completed tasks
  recurring: true,      // Weekly reports, monthly reviews
  dueDate: true,        // Project deadlines matter!
  reminders: true       // Need deadline notifications
}
```
**Result:** Full-featured 9-button interface

---

#### Example 3: Shopping List (Ultra-Minimal)
```javascript
{
  customize: true,      // Always available
  moveArrows: false,    // ← Same global preference
  threeDots: false,     // ← Same global preference
  highPriority: false,  // Nothing is "high priority"
  rename: true,         // Fix typos
  delete: true,         // Remove bought items
  recurring: false,     // One-time shopping trip
  dueDate: false,       // No deadlines for groceries
  reminders: false      // No reminders needed
}
```
**Result:** Absolute minimal 3-button interface

---

### 🎓 Decision Framework

**When deciding if a setting should be global or per-cycle:**

#### Make it GLOBAL if:
- ✅ It's UI chrome/navigation (visual paradigm)
- ✅ User wants consistent behavior everywhere
- ✅ Doesn't affect task business logic
- ✅ Preference-based, not requirement-based
- ✅ Affects "how I interact" not "what I can do"

#### Make it PER-CYCLE if:
- ✅ Different cycles have different needs
- ✅ Affects task functionality/features
- ✅ Requirement-based, not just preference
- ✅ Allows cycles to be simple or complex
- ✅ Affects "what I can do" not "how I interact"

---

### 🚫 Why Not Everything Global?

**Problem:** Inflexible, defeats purpose of multiple cycles
```
❌ User wants recurring in "Work" but not "Morning Routine"
❌ Can't customize per cycle
❌ All cycles look the same
❌ Forces complexity on simple routines
```

---

### 🚫 Why Not Everything Per-Cycle?

**Problem:** Inconsistent UI, cognitive overload
```
❌ User doesn't like arrows but has to disable in every cycle
❌ Inconsistent navigation across cycles (confusing!)
❌ Settings explosion (overwhelming)
❌ Same preference set 20 times
```

---

### ✅ Why Hybrid Approach Works

**Best of Both Worlds:**
```
✅ UI preferences global → Consistent experience
✅ Features per-cycle → Flexible functionality
✅ Simple cycles stay simple
✅ Complex cycles get full features
✅ No redundant configuration
```

---

## User Experience

### Opening the Customizer

**Method 1: Per-Task Button**
1. Click the `-/+` button on any task
2. Modal opens for the current cycle
3. Make changes with live preview
4. Click "Close" to save

**Method 2: Settings Panel**
1. Open Settings (gear icon)
2. Click "Customize Task Buttons"
3. Same modal interface
4. Changes saved automatically

### The Customization Modal

**Desktop Layout (≥768px):**
```
┌─────────────────────────────────────────────┐
│  Customize Task Buttons: Morning Routine    │
├─────────────────────┬───────────────────────┤
│                     │                       │
│  [Checkbox List]    │   [Preview Panel]     │
│                     │                       │
│  ☑ High Priority    │   Sample Task         │
│  ☑ Rename Task      │   [⚡][✏️][🗑️]        │
│  ☑ Delete Task      │   [-/+]               │
│  ☐ Recurring        │                       │
│  ☐ Due Date         │   Updates in          │
│  ☐ Reminders        │   real-time!          │
│                     │                       │
├─────────────────────┴───────────────────────┤
│              [Close]                         │
└─────────────────────────────────────────────┘
```

**Mobile Layout (<768px):**
```
┌──────────────────────────────┐
│  Customize Task Buttons      │
├──────────────────────────────┤
│                              │
│  ☑ High Priority             │
│  ☑ Rename Task               │
│  ☑ Delete Task               │
│  ☐ Recurring Task            │
│  ☐ Due Date                  │
│  ☐ Reminders                 │
│                              │
│  (No preview on mobile)      │
│                              │
├──────────────────────────────┤
│         [Close]              │
└──────────────────────────────┘
```

### Real-Time Preview

**Desktop only** - Shows a sample task with current button configuration:
- Checkboxes update → Preview updates instantly
- See exactly what buttons will appear
- No surprises when you close the modal

### Button Visibility Rules

**Special Cases:**

1. **Customize Button (`-/+`)**
   - Always visible
   - Can't be disabled
   - Provides access to the customizer itself

2. **Move Arrows (`▲▼`)**
   - Controlled by global `state.ui.moveArrowsVisible`
   - Synced bidirectionally
   - Changes here affect settings panel
   - Changes in settings affect customizer

3. **Three Dots (`⋮`)**
   - Controlled by global `state.settings.showThreeDots`
   - Synced bidirectionally
   - Changes here affect settings panel
   - Changes in settings affect customizer

---

## Technical Architecture

### Module Structure

**Location:** `modules/ui/taskOptionsCustomizer.js`

**Class:** `TaskOptionsCustomizer`

**Pattern:** Dependency Injection (resilient pattern)

```javascript
class TaskOptionsCustomizer {
    constructor(dependencies) {
        this.deps = {
            AppState: dependencies.AppState,
            showNotification: dependencies.showNotification,
            renderTaskButtons: dependencies.renderTaskButtons,
            updateMoveArrowsVisibility: dependencies.updateMoveArrowsVisibility,
            renderAllTasks: dependencies.renderAllTasks
        };
    }
}
```

### Key Methods

#### `showCustomizationModal(cycleId)`
Opens the customizer modal for a specific cycle.

**Flow:**
1. Wait for AppState to be ready
2. Load cycle data
3. Get current `taskOptionButtons` or use defaults
4. Sync with global settings (moveArrows, threeDots)
5. Create and display modal
6. Attach event listeners

#### `saveCustomization(cycleId, newOptions)`
Saves customization changes and syncs with global settings.

**Flow:**
1. Update `cycle.taskOptionButtons` in AppState
2. If moveArrows changed → update `state.ui.moveArrowsVisible`
3. If threeDots changed → update `state.settings.showThreeDots`
4. If reminders changed → update `cycle.reminders.enabled`
5. Trigger button re-render
6. Update arrow visibility globally
7. Close modal
8. Show success notification

#### `createModal(cycleId, cycleTitle, options)`
Creates the modal DOM structure.

**Responsibilities:**
- Build responsive layout (desktop vs mobile)
- Create checkbox inputs
- Build preview panel (desktop only)
- Attach event listeners for real-time updates
- Handle close button

#### `updatePreview(options)`
Updates the preview panel in real-time.

**Desktop only** - rebuilds preview task with current button configuration.

### Data Flow

```
┌─────────────────┐
│  User Action    │
│  (Toggle box)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Event Handler  │
│  (onChange)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│  Update Preview │  →   │  Save to State   │
│  (Desktop)      │      │  (AppState)      │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ↓
                         ┌────────────────────┐
                         │  Sync Global       │
                         │  (if needed)       │
                         └────────┬───────────┘
                                  │
                                  ↓
                         ┌────────────────────┐
                         │  Re-render Tasks   │
                         │  (All cycles)      │
                         └────────────────────┘
```

### Bidirectional Sync

**Move Arrows Sync:**
```javascript
// Customizer → Global
if (newOptions.moveArrows !== currentGlobalMoveArrows) {
    await this.deps.AppState.update(state => {
        if (!state.ui) state.ui = {};
        state.ui.moveArrowsVisible = newOptions.moveArrows;
    });

    // Update visibility in DOM
    this.deps.updateMoveArrowsVisibility?.();

    // Sync with settings panel checkbox
    const settingsMoveArrowsToggle = document.getElementById('toggle-move-arrows');
    if (settingsMoveArrowsToggle) {
        settingsMoveArrowsToggle.checked = newOptions.moveArrows;
    }
}

// Global → Customizer (on open)
const globalMoveArrowsEnabled = state.ui?.moveArrowsVisible || false;
currentOptions.moveArrows = globalMoveArrowsEnabled;
```

**Three Dots Sync:**
```javascript
// Customizer → Global
if (newOptions.threeDots !== oldOptions.threeDots) {
    this.deps.AppState.update(state => {
        if (!state.settings) state.settings = {};
        state.settings.showThreeDots = newOptions.threeDots;
    });
}

// Global → Customizer (on open)
const globalThreeDotsEnabled = state.settings?.showThreeDots || false;
currentOptions.threeDots = globalThreeDotsEnabled;
```

**Reminders Sync:**
```javascript
// Customizer → Reminders
if (newOptions.reminders !== oldOptions.reminders) {
    this.deps.AppState.update(state => {
        if (!state.data.cycles[cycleId].reminders) {
            state.data.cycles[cycleId].reminders = { enabled: false };
        }
        state.data.cycles[cycleId].reminders.enabled = newOptions.reminders;
    });
}
```

---

## Implementation Details

### Schema Structure

**Per-Cycle:**
```javascript
cycle.taskOptionButtons = {
    customize: true,      // Always true, can't be disabled
    moveArrows: false,    // Synced with state.ui.moveArrowsVisible
    threeDots: false,     // Synced with state.settings.showThreeDots
    highPriority: true,
    rename: true,
    delete: true,
    recurring: false,
    dueDate: false,
    reminders: false
}
```

**Global State:**
```javascript
state.ui = {
    moveArrowsVisible: false  // Global arrow visibility
}

state.settings = {
    showThreeDots: false      // Global three dots visibility
}
```

### Default Values

**Location:** `modules/utils/globalUtils.js`

```javascript
export const DEFAULT_TASK_OPTION_BUTTONS = {
    customize: true,        // -/+ Customize button (always visible)
    moveArrows: false,      // ▲▼ Move task arrows (global)
    threeDots: false,       // ⋮ Three dots menu (global)
    highPriority: true,     // ⚡ High priority toggle
    rename: true,           // ✏️ Rename/edit task
    delete: true,           // 🗑️ Delete task
    recurring: false,       // 🔁 Recurring task
    dueDate: false,         // 📅 Set due date
    reminders: false        // 🔔 Task reminders
};
```

### Backward Compatibility

**Fallback Pattern:**
```javascript
// Triple fallback for maximum safety
const visibleOptions = currentCycle.taskOptionButtons ||
                       this.deps.DEFAULT_TASK_OPTION_BUTTONS ||
                       {};
```

**Migration:** Not required - fallbacks handle missing properties gracefully.

### CSS Architecture

**Modal Styling:**
- `.task-options-modal` - Main modal container
- `.task-options-content` - Content area (desktop: flex row, mobile: block)
- `.task-options-column` - Left column (checkboxes)
- `.task-options-preview-column` - Right column (preview, desktop only)
- `.close-button-fullwidth` - Full-width close button

**Responsive Breakpoint:** 768px
- Desktop: Two-column layout with preview
- Mobile: Single-column, no preview

**Total CSS:** ~844 lines added to `miniCycle-styles.css`

---

## Testing

### Test Coverage

**File:** `tests/taskOptionsCustomizer.tests.js`
**Tests:** 29 comprehensive tests
**Coverage:** 100% passing ✅

### Test Categories

**1. Initialization (4 tests)**
- Constructor initialization
- Dependency injection
- Event listener setup
- Modal creation

**2. Modal Display (5 tests)**
- Show modal with current settings
- Load cycle data correctly
- Sync with global settings
- Preview panel rendering (desktop)
- Mobile layout (no preview)

**3. Save Functionality (6 tests)**
- Save customization to AppState
- Update global moveArrows setting
- Update global threeDots setting
- Sync with reminders modal
- Trigger re-render
- Close modal after save

**4. Move Arrows Sync (4 tests)**
- Bidirectional sync with global setting
- Update from customizer → settings
- Update from settings → customizer
- Visibility updates across all cycles

**5. Three Dots Sync (3 tests)**
- Bidirectional sync with global setting
- Update from customizer → settings
- Update from settings → customizer

**6. Reminders Sync (3 tests)**
- Enable reminders via customizer
- Disable reminders via customizer
- Sync with reminders modal state

**7. Button Visibility (2 tests)**
- Customize button always visible
- Other buttons respect settings

**8. Error Handling (2 tests)**
- Handle missing cycle gracefully
- Handle AppState not ready

### Running Tests

```bash
# Run all tests
npm test

# Run in browser
npm start
# Visit: http://localhost:8080/tests/module-test-suite.html
# Select: taskOptionsCustomizer from dropdown
```

---

## Usage Guide

### For Users

**Creating a Minimal Cycle:**
1. Create a new cycle for a simple routine
2. Click `-/+` on any task
3. Uncheck: Recurring, Due Date, Reminders
4. Keep: High Priority, Rename, Delete
5. Result: Clean 4-button interface

**Creating a Full-Featured Cycle:**
1. Create a new cycle for complex projects
2. Click `-/+` on any task
3. Check all boxes
4. Result: Full 9-button interface

**Adjusting UI Preferences:**
1. Open Settings
2. Toggle "Show Move Arrows" (global)
3. Toggle "Show Three Dots Menu" (global)
4. Changes apply to ALL cycles instantly

### For Developers

**Accessing the Customizer:**
```javascript
// From JavaScript (module already initialized)
const { taskOptionsCustomizer } = await import(`./modules/ui/taskOptionsCustomizer.js?v=${globalThis.APP_VERSION}`);
const cycleId = 'your-cycle-id';
taskOptionsCustomizer?.showCustomizationModal?.(cycleId);
```

**Reading Current Settings:**
```javascript
const { state } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
const appState = state().AppState;
const state = appState.get();
const cycle = state.data.cycles[cycleId];
const { DEFAULT_TASK_OPTION_BUTTONS } = await import(`./modules/utils/globalUtils.js?v=${globalThis.APP_VERSION}`);
const settings = cycle.taskOptionButtons || DEFAULT_TASK_OPTION_BUTTONS;

console.log('Recurring enabled?', settings.recurring);
console.log('Due dates enabled?', settings.dueDate);
```

**Updating Programmatically:**
```javascript
appState.update(state => {
    state.data.cycles[cycleId].taskOptionButtons.recurring = true;
    state.data.cycles[cycleId].taskOptionButtons.dueDate = true;
});

// Trigger re-render
const { task } = await import(`./modules/core/appContext.js?v=${globalThis.APP_VERSION}`);
task().refresh?.();
```

### Integration Points

**1. Task DOM Rendering**
- `modules/task/taskDOM.js` reads `taskOptionButtons`
- Conditionally renders buttons based on settings
- Customize button (`-/+`) always rendered first

**2. Settings Panel**
- "Customize Task Buttons" opens customizer modal
- Move arrows toggle syncs bidirectionally
- Three dots toggle syncs bidirectionally

**3. Reminders Modal**
- Reminders button visibility controlled by customizer
- `cycle.reminders.enabled` syncs with `taskOptionButtons.reminders`

**4. Cycle Creation**
- `modules/routine/routineManager.js` adds `taskOptionButtons` to new cycles
- Uses `DEFAULT_TASK_OPTION_BUTTONS` as template

---

## Migration & Compatibility

### Backward Compatibility

**Existing Cycles (Pre-v1.357):**
- Missing `taskOptionButtons` → Uses `DEFAULT_TASK_OPTION_BUTTONS`
- No data loss, no breakage
- Fallbacks at three levels (cycle → global → hardcoded)

**Schema Version:**
- Still 2.5 (additive change, not breaking)
- No migration needed

### Upgrade Path

**User Experience:**
1. User opens app after update
2. Old cycles work perfectly (use defaults)
3. User opens customizer
4. Saves changes
5. `taskOptionButtons` added to cycle

**No action required** - seamless upgrade.

### Future Migration (Optional)

If you want to backfill `taskOptionButtons` to existing cycles:

```javascript
// Add to migrationManager.js
function backfillTaskOptionButtons(state) {
    Object.keys(state.data.cycles).forEach(cycleId => {
        const cycle = state.data.cycles[cycleId];
        if (!cycle.taskOptionButtons) {
            cycle.taskOptionButtons = { ...DEFAULT_TASK_OPTION_BUTTONS };
            console.log(`✅ Backfilled taskOptionButtons for ${cycleId}`);
        }
    });
}
```

**Not required** - current fallback approach is equally valid.

---

## Design Decisions

### Why Real-Time Preview?

**Problem:** Users don't know what buttons will look like until they close modal.

**Solution:** Show live preview (desktop only) that updates as they change settings.

**Benefits:**
- Immediate feedback
- No surprises
- Easier to understand
- More confidence in changes

### Why Desktop-Only Preview?

**Reasoning:**
- Mobile screens too small for two-column layout
- Mobile users can see results immediately after closing modal
- Preview would push content below fold on mobile
- Desktop has room, mobile doesn't

### Why Full-Width Close Button?

**Consistency:** Matches other modals in miniCycle (reminders, settings, routine switcher).

**Accessibility:** Large touch target, easy to tap on mobile.

**Visual Hierarchy:** Clear exit path, can't miss it.

### Why `-/+` Icon?

**Meaning:** "Customize/Adjust" (like volume controls)

**Compact:** Takes minimal space

**Universal:** No language barrier

**Distinct:** Different from all other icons

### Why Bidirectional Sync?

**User Mental Model:** "If I change it here, it should change everywhere."

**Consistency:** Global settings stay consistent across all access points.

**Single Source of Truth:** `state.ui.moveArrowsVisible` is the authority for arrows.

---

## Changelog

### v1.373 (November 23, 2025)
- ✅ Enhanced UI refresh handling for task options and mode changes
- ✅ Improved module filter and dark mode in test suite
- ✅ Module file count updated to 703 lines

### v1.372 (November 22, 2025)
- ✅ Real-time saving - Changes apply immediately without save button
- ✅ Reopen after reload - Automatically restores customizer if user was editing
- ✅ Enhanced reminders integration - Start/stop reminders when checkbox changes
- ✅ Improved UI sync - Settings panel, reminders modal, and customizer stay in sync
- ✅ Better state management - Uses `refreshAllTaskButtons()` for consistent updates
- ✅ Mobile tap preview - Shows option details when tapping on mobile

### v1.370 (November 18, 2025)
- ✅ Delete When Complete feature added
- ✅ New button option for auto-removing tasks during reset
- ✅ Integration with deleteWhenComplete system

### v1.357 (November 15, 2025)
- ✅ Initial release
- ✅ Per-cycle button visibility customization
- ✅ Global vs cycle settings architecture
- ✅ Real-time preview (desktop)
- ✅ Responsive design
- ✅ Bidirectional sync with global settings
- ✅ 29 comprehensive tests (100% passing)
- ✅ Backward compatible (no migration needed)
- ✅ Complete documentation

---

## Related Documentation

- [SCHEMA_2_5.md](../data-schema/SCHEMA_2_5.md) - Data schema details
- [CLAUDE.md](../developer-guides/CLAUDE.md) - Architecture overview
- [TASK_OPTIONS_CUSTOMIZER_PLAN.md](../future-work/TASK_OPTIONS_CUSTOMIZER_PLAN.md) - Original planning doc
- [FOLDER_STRUCTURE.md](../start-here/FOLDER_STRUCTURE.md) - Module organization

---

**miniCycle Task Options Customizer** - Flexible button visibility for every routine

Built by [sparkinCreations](https://sparkincreations.com) | [minicycleapp.com](https://minicycleapp.com)
