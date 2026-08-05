# 🔄 Drag & Drop Architecture
## Custom Implementation for miniCycle Task Rearrangement

**Author:** miniCycle Team
**Last Updated:** August 2026
**Status:** Production Ready
**Test Coverage:** 40 tests (100% passing)

---

## 📋 Table of Contents

1. [Why Custom Implementation?](#why-custom-implementation)
2. [Architecture Overview](#architecture-overview)
3. [Interaction Methods](#interaction-methods)
4. [State Management](#state-management)
5. [Performance Optimizations](#performance-optimizations)
6. [Browser Compatibility](#browser-compatibility)
7. [Code Organization](#code-organization)
8. [Testing Strategy](#testing-strategy)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## 🎯 Why Custom Implementation?

### The Decision

We chose to implement drag-and-drop from scratch rather than use an existing library like SortableJS, react-beautiful-dnd, or dnd-kit.

### Rationale

#### 1. **miniCycle-Specific Requirements**
- **Task Cycling Paradigm**: Tasks persist and only completion status resets
- **Undo/Redo Integration**: Tight coupling with AppState snapshot system
- **Multiple Input Methods**: Touch, mouse, AND arrow buttons (not typical in libraries)
- **Modular Architecture**: Needed to fit ES6 module system with dependency injection

#### 2. **Control Over Safari Compatibility**
- Safari desktop has unique requirements (webkitUserDrag, image timing)
- Libraries abstract this away, making Safari fixes harder to implement
- We needed full control to diagnose and fix Safari-specific issues
- Result: Works flawlessly on Safari desktop, iPhone, and iPad

#### 3. **Bundle Size and Dependencies**
```
SortableJS: ~45KB minified
react-beautiful-dnd: ~85KB minified
dnd-kit: ~65KB minified

Our implementation: ~20KB minified (60% smaller)
Dependencies: Zero (except ES6 modules we already use)
```

#### 4. **Tight Integration with Existing Systems**
- AppState: Persistent state with undo/redo
- AppGlobalState: Runtime drag tracking
- Resilient Constructor Pattern: Graceful fallbacks
- appInit 2-Phase System: Waits for core systems

#### 5. **Arrow Button Controls**
Libraries focus on drag-and-drop but we needed:
- Arrow buttons for keyboard-like task reordering
- Same undo/redo behavior as drag
- Integrated visibility toggle (show/hide arrows)
- State persistence for user preference

### Alternatives Considered

| Library | Pros | Cons | Why Not? |
|---------|------|------|----------|
| **SortableJS** | Popular, battle-tested | No arrow buttons, harder Safari fixes | Missing arrow controls |
| **react-beautiful-dnd** | Beautiful API, accessible | React-only, large bundle | Not using React |
| **dnd-kit** | Modern, hooks-based | React-only, complex setup | Not using React |
| **Dragula** | Simple API, lightweight | Limited customization | No arrow buttons |

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
└─────────────┬───────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐      ┌──────────┐       ┌──────────────┐
│  Touch  │      │  Mouse   │       │    Arrow     │
│ Events  │      │  Events  │       │   Buttons    │
└────┬────┘      └─────┬────┘       └──────┬───────┘
     │                 │                    │
     │                 │                    │
     └─────────────────┼────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  DragDropManager     │
            │  - enableDragAndDrop │
            │  - handleRearrange   │
            │  - handleArrowClick  │
            └──────────┬───────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ AppState │  │  DOM     │  │  Undo    │
  │  Update  │  │ Reorder  │  │ Snapshot │
  └──────────┘  └──────────┘  └──────────┘
```

### Key Components

#### 1. **DragDropManager Class**
**Location:** `modules/task/dragDropManager.js`

**Responsibilities:**
- Initialize drag-and-drop system
- Enable drag on individual task elements
- Handle rearrangement logic
- Manage arrow button clicks
- Cleanup drag state
- Update arrow visibility

**Design Pattern:** Resilient Constructor Pattern
- Works with or without dependencies
- Provides fallback methods
- Logs helpful warnings

#### 2. **DragDropManager Instance State (Runtime)**
**Location:** `modules/task/dragDropManager.js` (constructor)

Drag state lives on the DragDropManager instance (not `window.AppGlobalState`):
```javascript
// Instance properties (this.*)
this.draggedTask = null;           // Current element being dragged
this.rearrangeInitialized = false; // Prevents double setup
this.didDragReorderOccur = false;  // Flag for save operations
this._nativeDragActive = false;   // True when iOS native DnD has fired dragstart
this._currentDropTarget = null;   // O(1) drop target tracking
```

**Why `_nativeDragActive`?** (February 2026 Fix)
On iOS, when the user long-presses a `draggable="true"` element, iOS fires `dragstart`
then `touchcancel` (taking over the touch). Without this flag, `touchcancel` would clear
`this.draggedTask`, breaking the subsequent `dragover` and `drop` handlers.

#### 3. **AppState (Persistent)**
**Location:** `modules/core/appState.js`

**Relevant State:**
```javascript
{
  data: {
    cycles: {
      [cycleId]: {
        tasks: [...],  // Task order persisted here
      }
    }
  },
  ui: {
    moveArrowsVisible: false  // Arrow visibility preference
  }
}
```

---

## 🎮 Interaction Methods

### Method 1: Touch Events (Mobile)

#### Behavior
1. **Long-press** (500ms) activates drag mode
2. Task shows `.long-pressed` class (visual feedback)
3. **Movement threshold** (15px) prevents accidental activation
4. **Vertical scroll detection** allows normal page scrolling
5. Task options remain visible after long-press

#### Code Flow
```javascript
touchstart →
  Start 500ms timer →
  Check if moved > 15px → Cancel if yes →
  Timer completes → Enter drag mode →

touchmove →
  If vertical delta > horizontal → Allow scroll →
  If horizontal → Prevent default → handleRearrange() →

touchend →
  Save if reorder occurred →
  Cleanup drag state
```

#### Why These Values?

**500ms Long-Press Delay:**
- Prevents accidental activation
- Long enough to distinguish from tap
- Short enough to feel responsive
- iOS Safari standard (matches system behavior)

**15px Movement Threshold:**
- Accounts for hand shakiness
- Prevents false positives on older devices
- Tested on iPhone SE (2016) and Samsung Galaxy S8

**Vertical vs Horizontal Detection:**
- If `deltaY > deltaX` → Allow scroll
- If `deltaX > deltaY` → Start drag
- Prevents drag interfering with page scroll

#### Safari Mobile Consideration
Safari on iPhone/iPad uses touch events exclusively. The HTML5 drag API is not supported on iOS, which is why we implement custom touch handling.

---

### Method 2: Mouse Events (Desktop)

#### Behavior
1. **Mouse down** on task element
2. **Drag** activates instantly (no delay)
3. **Native browser ghost image** on most browsers; **custom 70%-width ghost clone** on Safari desktop
4. **Rearrange in real-time** as mouse moves
5. **Drop** saves new order

#### Code Flow
```javascript
dragstart →
  Set this.draggedTask →
  Add .dragging class →
  Safari desktop only: create custom ghost clone (70% width, themed) →
  Non-Safari: browser shows native ghost image →

dragover (event delegation on document) →
  preventDefault() →
  requestAnimationFrame() →
  Find closest .task element via DOM_SELECTORS.TASK →
  handleRearrange() →

drop →
  Save if reorder occurred →
  Cleanup drag state (clear force-hidden from all task options)
```

#### Safari Desktop Fix (CRITICAL!)

**Problem:** Safari desktop wouldn't fire drag events despite correct configuration.

**Solution (March 2026 — custom ghost):**
```javascript
// 1. Set webkitUserDrag CSS property (Safari requirement)
taskElement.style.webkitUserDrag = "element";

// 2. Detect Safari desktop via UA (not iOS Safari)
const ua = navigator.userAgent;
const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)
    && !('ontouchstart' in window);

// 3. In dragstart handler: create a custom ghost clone for Safari
if (isSafariDesktop) {
    const rect = taskElement.getBoundingClientRect();
    const ghost = taskElement.cloneNode(true);
    ghost.style.cssText = `
        position: fixed; top: -9999px; left: -9999px;
        width: ${Math.round(rect.width * 0.7)}px;
        background: var(--theme-task-bg, #fff);
        border-radius: var(--radius-md, 8px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        opacity: 0.9; pointer-events: none;
    `;
    // Hide task-options in the ghost
    ghost.querySelector(DOM_SELECTORS.TASK_OPTIONS)?.style.display = 'none';
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    requestAnimationFrame(() => ghost.remove());
}
// Non-Safari browsers: no setDragImage call → browser shows native ghost
```

**Why custom ghost for Safari?**
- Safari requires `-webkit-user-drag` to enable drag on arbitrary elements
- Safari's native ghost rendering can be inconsistent
- The custom clone at 70% width provides a polished, themed drag preview
- Non-Safari browsers have reliable native ghosts — no intervention needed

**Reference:** [Stack Overflow: Safari drag events not firing](https://stackoverflow.com/questions/48973815/javascript-html5-drag-events-not-firing-on-safari-mac-dragging-does-not-work)

---

### Method 3: Arrow Buttons (Accessibility)

#### Behavior
1. **Click up arrow** → Move task up one position
2. **Click down arrow** → Move task down one position
3. **Boundary prevention** → Can't move past top/bottom
4. **Same undo behavior** → Creates snapshot like drag
5. **Toggle visibility** → User can show/hide arrows

#### Code Flow
```javascript
Arrow button click →
  Find parent .task element →
  Calculate current index in taskList →
  Calculate new index (currentIndex ± 1) →
  Clamp to bounds [0, taskCount-1] →

  Capture undo snapshot →
  Update AppState (splice and reinsert) →
  Trigger refreshUIFromState() →
  Update undo/redo buttons
```

#### Why Arrow Buttons?

**Accessibility:**
- Users who can't or don't want to drag
- Keyboard-centric workflows
- Precision control (move exactly one position)

**Discoverability:**
- Some users don't know tasks are draggable
- Visible buttons make reordering obvious
- Can be toggled on/off per user preference

**State Integration:**
- Uses same AppState.update() as drag
- Same undo/redo behavior
- Visibility preference persisted

---

## 🗄️ State Management

### DragDropManager Instance State (Runtime Tracking)

**Purpose:** Track drag operation in progress

All drag state lives on the `DragDropManager` instance (not `window.AppGlobalState`):
```javascript
// Set when drag starts
this.draggedTask = taskElement;
this.didDragReorderOccur = true;

// Cleared on drop/cleanup
this.draggedTask = null;
this.didDragReorderOccur = false;
this._nativeDragActive = false;
```

**Why Instance State (not AppState)?**
- Runtime-only data (doesn't need persistence)
- Frequently updated (every mousemove)
- Would pollute undo history if in AppState
- DI-pure: no `window.*` globals

---

### AppState (Persistent Storage)

**Purpose:** Store task order and user preferences

```javascript
// Task order (persisted)
state.data.cycles[activeCycleId].tasks = [
  { id: 'task-1', text: '...', completed: false },
  { id: 'task-2', text: '...', completed: true },
  // Order in array = visual order
];

// Arrow visibility preference (persisted)
state.ui.moveArrowsVisible = true; // or false
```

**Update Pattern:**
```javascript
// Arrow button click or drag drop (AppState via DI — this._getAppState())
AppState.update(state => {
  const tasks = state.data.cycles[activeCycleId].tasks;

  // Reorder tasks (splice + insert)
  const [movedTask] = tasks.splice(oldIndex, 1);
  tasks.splice(newIndex, 0, movedTask);

  state.metadata.lastModified = Date.now();
}, true); // immediate save
```

---

### Undo/Redo Integration

**Snapshot Timing:**
- **Before reorder** → Capture current state
- **After reorder** → New state is current
- **Undo** → Restore previous state + trigger refreshUIFromState()

**Snapshot Strategy:**
A single undo snapshot is captured once when the drag reorder is saved (in `saveDragReorder()`
or `handleArrowClick()`), not during the drag itself. This keeps the undo stack clean — one
undo step per reorder operation, regardless of how many intermediate positions the task
passed through during the drag.

---

## ⚡ Performance Optimizations

### 1. Debouncing (Smooth Reordering)

```javascript
// Constants
this.REARRANGE_DELAY = 75;  // ms delay to smooth DOM reordering
```

#### REARRANGE_DELAY (75ms)

**Purpose:** Smooth visual feedback during drag

**How It Works:**
```javascript
handleRearrange(target, event) {
  clearTimeout(this.rearrangeTimeout);

  this.rearrangeTimeout = setTimeout(() => {
    // Actually reorder DOM elements
    parent.insertBefore(draggedTask, target);
  }, 75);
}
```

**Why 75ms?**
- **Too fast (<50ms):** Causes visual jank on lower-end devices
- **Too slow (>100ms):** Feels laggy to user
- **Sweet spot:** Fast enough to feel instant, slow enough to prevent jank
- **Tested on:** iPhone SE (2016), Samsung Galaxy S8, MacBook Air (2015)

---

### 2. requestAnimationFrame (60fps Drag)

```javascript
document.addEventListener("dragover", (event) => {
  event.preventDefault();
  requestAnimationFrame(() => {
    const movingTask = event.target.closest(".task");
    if (movingTask) {
      this.handleRearrange(movingTask, event);
    }
  });
});
```

**Why?**
- Synchronizes with browser repaint cycle
- Prevents layout thrashing
- Ensures smooth 60fps drag experience
- Reduces CPU usage on lower-end devices

---

### 3. Event Delegation (DOM Efficiency)

```javascript
// ❌ BAD: Add listener to every arrow button
document.querySelectorAll(DOM_SELECTORS.MOVE_UP).forEach(btn => {
  btn.addEventListener('click', handleArrowClick);
});

// ✅ GOOD: Single listener on parent
taskList.addEventListener('click', (event) => {
  if (event.target.matches(DOM_SELECTORS.MOVE_ARROWS)) {
    this.handleArrowClick(event.target);
  }
});
```

**Benefits:**
- Works with dynamically added tasks
- Only one event listener (vs hundreds)
- Survives DOM re-renders
- Lower memory footprint

---

## 🌐 Browser Compatibility

### Cross-Browser Testing Matrix

| Browser | Version | Drag | Touch | Arrows | Notes |
|---------|---------|------|-------|--------|-------|
| **Chrome** | 120+ | ✅ | ✅ | ✅ | Reference implementation |
| **Firefox** | 115+ | ✅ | ✅ | ✅ | Full support |
| **Edge** | 120+ | ✅ | ✅ | ✅ | Chromium-based |
| **Safari Desktop** | 17+ | ✅* | N/A | ✅ | Requires webkitUserDrag |
| **Safari iOS** | 17+ | N/A | ✅ | ✅ | Touch events only |
| **Safari iPadOS** | 17+ | N/A | ✅ | ✅ | Touch events only |

**✅* Safari Desktop requires special handling** (see below)

---

### Safari Desktop (CRITICAL REQUIREMENTS)

#### Requirement 1: webkitUserDrag CSS Property

```javascript
taskElement.style.webkitUserDrag = "element";
```

**Without this:** Safari won't fire drag events at all.

**Values:**
- `"auto"` - Default (only images/links draggable)
- `"element"` - Entire element is draggable ✅
- `"none"` - Element cannot be dragged

---

#### Requirement 2: Drag Image Timing (Safari Desktop Custom Ghost)

Safari requires drag images to exist in memory BEFORE the `dragstart` event fires. We use
this constraint to our advantage by creating a custom ghost clone for Safari desktop:

```javascript
// In dragstart handler — Safari desktop only:
const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua)
    && !('ontouchstart' in window);
if (isSafariDesktop) {
    const ghost = taskElement.cloneNode(true);
    // Style at 70% width with theme variables, hide task-options
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    requestAnimationFrame(() => ghost.remove());
}
// Non-Safari: no setDragImage call → native browser ghost
```

**Why custom ghost?**
- Safari's native ghost can be inconsistent
- The 70%-width themed clone provides a polished drag preview
- Non-Safari browsers have reliable native ghosts — no intervention needed

**Discovery:** This fix came from [Stack Overflow research](https://stackoverflow.com/questions/48973815/) after Safari desktop drag-and-drop stopped working despite correct configuration.

---

#### Requirement 3: Text Selection Prevention

```javascript
taskElement.style.userSelect = "none";
taskElement.style.webkitUserSelect = "none";
taskElement.style.msUserSelect = "none";
```

**Why all three?**
- `userSelect`: Standard CSS property
- `webkitUserSelect`: Safari/Chrome requirement
- `msUserSelect`: Edge (legacy) requirement

**Without these:** Text selection can interfere with drag start, especially on Safari.

---

### Safari Mobile (iOS/iPadOS)

**Key Difference:** iOS Safari supports HTML5 drag-and-drop via long-press on `draggable="true"` elements. When iOS fires `dragstart`, it takes over the touch sequence and shows a native drag preview.

**Two drag paths on iOS:**

1. **iOS Native DnD (Primary):** Long-press triggers `dragstart` → iOS shows native preview → `touchcancel` fires (iOS taking over) → `dragover`/`drop` handle reorder
2. **Custom Touch Drag (Fallback):** For non-iOS touch devices where native DnD doesn't trigger — uses `touchmove` + `elementFromPoint` + `handleRearrange()`

**Critical: `_nativeDragActive` Flag**
```javascript
// In dragstart handler:
this._nativeDragActive = true;

// In touchcancel handler:
if (this._nativeDragActive) {
    // iOS took over — DON'T clear this.draggedTask!
    // The drop handler needs it.
    return;
}
```

**No `setDragImage` call on mobile** — the Safari desktop custom ghost detection
uses `!('ontouchstart' in window)` to exclude iOS, so iOS always gets its native preview.

**Critical: iOS Native DnD Event Sequence** (February 2026 Fix)

When iOS recognizes a long-press on `draggable="true"`, it fires HTML5 drag events:
```
touchstart → (500ms timer) → dragstart → touchcancel → dragover... → drop
                                  ↑              ↑                      ↑
                          _nativeDragActive    DON'T clear         Save reorder
                             = true          draggedTask!          + cleanup
```

The `touchcancel` is NOT an error — it's iOS handing control to its native DnD system.
The `_nativeDragActive` flag prevents `touchcancel` from clearing `this.draggedTask`,
which the `drop` handler needs to persist the reorder to AppState.

---

## 🔬 Deep Dive: How The Code Actually Works

This section provides line-by-line explanations of the core implementation details.

---

### enableDragAndDrop(): The Closure Pattern

**Location:** `modules/task/dragDropManager.js`

#### Why Closures?

Each task element gets its OWN set of event handlers with their OWN private variables. This prevents state collision between different tasks.

```javascript
enableDragAndDrop(taskElement) {
    // 1. Safari configuration (outside closures)
    taskElement.setAttribute("draggable", "true");
    taskElement.style.webkitUserDrag = "element";

    // 2. CLOSURE VARIABLES (private to THIS task)
    let touchStartX = 0;          // Starting X position
    let touchStartY = 0;          // Starting Y position
    let holdTimeout = null;       // Long-press timer reference
    let isDragging = false;       // Currently dragging?
    let isLongPress = false;      // Long-press completed?
    let isTap = false;            // Was it just a tap?
    let preventClick = false;     // Suppress synthetic click after drag/long-press
    const moveThreshold = 15;     // px before canceling long-press

    // These variables are captured in the closures below
    // Each task gets its OWN copy

    // INSTANCE PROPERTIES (shared across all tasks, on DragDropManager):
    // this.draggedTask            — current dragged element
    // this.didDragReorderOccur    — flag for save operations
    // this._nativeDragActive      — iOS native DnD handoff flag
}
```

**Why This Matters:**
```javascript
// ❌ BAD: Shared state between tasks
let globalIsDragging = false; // ALL tasks share this

taskElement.addEventListener("touchstart", () => {
    globalIsDragging = true; // Oops! Affects ALL tasks
});

// ✅ GOOD: Each task has its own state
taskElement.addEventListener("touchstart", () => {
    isDragging = true; // Only affects THIS task (closure)
});
```

---

### Touch Event State Machine

#### State Transitions

```
IDLE
  ↓ touchstart
  ├─→ isTap = true, _nativeDragActive = false
  ├─→ Start 500ms timer
  │
  ├──→ touchmove (> 15px) → CANCEL
  │     ├─→ clearTimeout(holdTimeout)
  │     └─→ Allow scroll / return
  │
  ├──→ 500ms elapsed → LONG_PRESS
  │     ├─→ isLongPress = true
  │     ├─→ isDragging = true, this.draggedTask = taskElement
  │     ├─→ Add .dragging class
  │     ├─→ If three-dots disabled: Add .long-pressed + reveal task buttons
  │     └─→ If three-dots enabled: drag mode only (no task buttons)
  │
  ├──→ touchmove (isDragging) → CUSTOM TOUCH DRAG
  │     ├─→ preventDefault()
  │     ├─→ elementFromPoint().closest('.task')
  │     └─→ Call handleRearrange()
  │
  ├──→ dragstart fires (iOS native DnD) → NATIVE HANDOFF
  │     ├─→ _nativeDragActive = true
  │     └─→ iOS shows native drag preview
  │
  ├──→ touchcancel
  │     ├─→ If _nativeDragActive: reset local state ONLY (preserve draggedTask!)
  │     └─→ If NOT _nativeDragActive: full cleanup (real cancel)
  │
  └──→ (iOS native) dragover → NATIVE DRAGGING
        └─→ handleRearrange() (same as desktop)

touchend → CLEANUP (custom touch drag path)
  ├─→ clearTimeout(holdTimeout)
  ├─→ If _nativeDragActive: defer to drop handler, return
  ├─→ saveDragReorder() if reorder occurred
  ├─→ Clear this.draggedTask
  └─→ Keep .long-pressed if isLongPress (and three-dots disabled)

drop → SAVE (desktop + iOS native DnD path)
  ├─→ saveDragReorder()
  ├─→ cleanupDragState()
  └─→ _nativeDragActive = false
```

#### Line-by-Line: touchstart Handler

```javascript
taskElement.addEventListener("touchstart", (event) => {
    if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) return;

    // Reset all state variables for new touch sequence
    isLongPress = false;
    isDragging = false;
    isTap = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    preventClick = false;
    this._nativeDragActive = false;  // Reset for new touch sequence

    // Hide task buttons on OTHER tasks (scoped to taskList children)
    const taskList = document.getElementById(DOM_IDS.TASK_LIST);
    if (taskList) {
        for (const task of taskList.children) {
            if (task !== taskElement && task.classList.contains(DOM_CLASSES.TASK)) {
                task.classList.remove(DOM_CLASSES.LONG_PRESSED);
                this.deps.hideTaskButtons?.(task);
            }
        }
    }

    // Start long-press timer (500ms)
    holdTimeout = setTimeout(() => {
        isLongPress = true;
        isTap = false;
        this.draggedTask = taskElement;  // Instance property
        isDragging = true;
        taskElement.classList.add(DOM_CLASSES.DRAGGING);

        event.preventDefault();

        // Enable undo system on first user interaction (touch drag path)
        this.deps.enableUndoSystemOnFirstInteraction?.();

        // Only reveal task buttons if three-dots mode is NOT enabled.
        // When three-dots is on, long press activates drag mode only.
        const body = this.deps.getBody?.() || document.body;
        const threeDotsEnabled = body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);
        if (!threeDotsEnabled) {
            taskElement.classList.add(DOM_CLASSES.LONG_PRESSED);
            this.deps.revealTaskButtons?.(taskElement, 'long-press');
        }
    }, 500);
}, { passive: false });
```

**Why 500ms?**
- iOS standard for long-press (feels familiar to users)
- Short enough to feel responsive
- Long enough to distinguish from tap

---

#### Line-by-Line: touchmove Handler

```javascript
taskElement.addEventListener("touchmove", (event) => {
    const touchMoveX = event.touches[0].clientX;
    const touchMoveY = event.touches[0].clientY;
    const deltaX = Math.abs(touchMoveX - touchStartX);
    const deltaY = Math.abs(touchMoveY - touchStartY);

    // PRIORITY: If already dragging, process drag move FIRST
    // (before threshold check, which would incorrectly cancel an active drag)
    if (isDragging && this.draggedTask) {
        if (event.cancelable) {
            event.preventDefault();
        }
        // elementFromPoint returns child elements — .closest() resolves to task container
        const elementAtPoint = document.elementFromPoint(touchMoveX, touchMoveY);
        const targetTask = elementAtPoint?.closest(DOM_SELECTORS.TASK);
        if (targetTask) {
            this.handleRearrange(targetTask, event);
        }
        return;
    }

    // Before long press activates: cancel if moved too much
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clearTimeout(holdTimeout);
        isLongPress = false;
        isTap = false;
        return;
    }

    // Allow normal scrolling if moving vertically
    if (deltaY > deltaX) {
        clearTimeout(holdTimeout);
        isTap = false;
        return;
    }
}, { passive: false });
```

**Key Insight: Movement Threshold**
```javascript
const moveThreshold = 15; // pixels

// User touches screen at (100, 200)
touchStartX = 100;
touchStartY = 200;

// User moves finger slightly (hand shake)
touchMoveX = 108;  // Moved 8px right
touchMoveY = 203;  // Moved 3px down

deltaX = abs(108 - 100) = 8;   // Less than 15
deltaY = abs(203 - 200) = 3;   // Less than 15

// Still within threshold → Long-press continues
if (8 > 15 || 3 > 15) { // FALSE
    // Not triggered
}
```

---

#### Line-by-Line: touchend Handler

```javascript
taskElement.addEventListener("touchend", () => {
    clearTimeout(holdTimeout);

    // Suppress synthetic click after long-press/drag to prevent
    // accidental checkbox toggle via the delegated click handler
    if (isLongPress || isDragging) {
        preventClick = true;
        setTimeout(() => { preventClick = false; }, 300);
    }

    // If native DnD took over (iOS), let the drop handler save.
    if (this._nativeDragActive) {
        isDragging = false;
        return;
    }

    // Custom touch drag path: save reorder before clearing references
    if (isDragging && this.didDragReorderOccur) {
        this.saveDragReorder();
    }

    if (this.draggedTask) {
        this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
        this.draggedTask = null;
    }

    isDragging = false;

    // Keep task options open after long-press (only when buttons were revealed)
    const body = this.deps.getBody?.() || document.body;
    const threeDotsEnabled = body.classList.contains(DOM_CLASSES.SHOW_THREE_DOTS_ENABLED);
    if (isLongPress && !threeDotsEnabled) {
        return;
    }

    taskElement.classList.remove(DOM_CLASSES.LONG_PRESSED);
});
```

**Click Guard Handler:**
```javascript
// Prevents synthetic click after drag/long-press from toggling checkbox
taskElement.addEventListener("click", (event) => {
    if (preventClick) {
        event.stopPropagation();
        event.preventDefault();
    }
});
```

---

#### Line-by-Line: touchcancel Handler (February 2026)

This handler is critical for iOS native DnD support. When iOS takes over a touch
sequence for its native drag-and-drop, it fires `touchcancel`. The handler must
distinguish between iOS native DnD handoff vs. a real cancellation (system alert, etc.).

```javascript
taskElement.addEventListener("touchcancel", () => {
    clearTimeout(holdTimeout);

    if (this._nativeDragActive) {
        // iOS native DnD took over — DON'T clear this.draggedTask!
        // The drop handler needs it to save the reorder.
        // Only reset local touch state.
        isDragging = false;
        isLongPress = false;
        isTap = false;
        return;
    }

    // Real cancel (system alert, etc.) — clean up everything
    if (isDragging && this.didDragReorderOccur) {
        this.saveDragReorder();
    }

    if (this.draggedTask) {
        this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
        this.draggedTask = null;
    }

    isDragging = false;
    isLongPress = false;
    isTap = false;
    taskElement.classList.remove(DOM_CLASSES.LONG_PRESSED);
});
```

**Why This Matters:**

Without the `_nativeDragActive` guard, the iOS flow breaks:
```
1. touchstart → timer starts
2. Timer fires → this.draggedTask = taskElement
3. iOS fires dragstart → _nativeDragActive = true
4. iOS fires touchcancel → ❌ OLD: clears this.draggedTask (BUG!)
                           ✅ NEW: preserves this.draggedTask
5. dragover fires → handleRearrange needs this.draggedTask
6. drop fires → saveDragReorder needs this.draggedTask
```

---

### Mouse Drag: Desktop Implementation

#### dragstart Handler

```javascript
taskElement.addEventListener("dragstart", (event) => {
    if (event.target.closest(DOM_SELECTORS.TASK_OPTIONS)) return;

    // Mark that native HTML5 DnD has started.
    // On iOS, touchcancel will fire next — this flag tells that handler
    // to preserve this.draggedTask so the drop handler can save the reorder.
    this._nativeDragActive = true;

    this.deps.enableUndoSystemOnFirstInteraction?.();

    this.draggedTask = taskElement;  // Instance property
    event.dataTransfer.setData("text/plain", "");

    taskElement.classList.add(DOM_CLASSES.DRAGGING);

    // Safari desktop only: create custom ghost clone (70% width, themed)
    // Non-Safari browsers use the browser's native ghost image
    const ua = navigator.userAgent;
    const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua)
        && !/Chromium/.test(ua) && !('ontouchstart' in window);
    if (isSafariDesktop) {
        const rect = taskElement.getBoundingClientRect();
        const ghost = taskElement.cloneNode(true);
        // Style and append offscreen for browser to capture
        ghost.querySelector(DOM_SELECTORS.TASK_OPTIONS)?.style.display = 'none';
        document.body.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        requestAnimationFrame(() => ghost.remove());
    }
});
```

---

### handleRearrange(): The Insertion Algorithm

**Location:** `modules/task/dragDropManager.js`

This is the most complex method. It determines WHERE to insert the dragged task.

#### Entry Checks

```javascript
handleRearrange(target, event) {
    // Guard clauses - exit early if invalid state
    if (!target || !this.draggedTask || target === this.draggedTask) {
        return;  // Nothing to do
    }

    // Clear any pending rearrange (debouncing)
    clearTimeout(this.rearrangeTimeout);

    // Schedule new rearrange (75ms delay for smooth UX)
    this.rearrangeTimeout = setTimeout(() => {
        // Validate DOM elements still exist
        if (!document.contains(target) || !document.contains(this.draggedTask)) {
            return;  // Elements removed from DOM during drag
        }

        const parent = this.draggedTask.parentNode;
        if (!parent || !target.parentNode) {
            return;  // No parent (shouldn't happen, but be safe)
        }
```

#### Position Detection and Reorder Flag

```javascript
        // Get mouse position relative to target
        const bounding = target.getBoundingClientRect();
        const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY;
        const offset = clientY - bounding.top;
        //              ^                ^
        //              Mouse/Touch Y    Top of target
        //              = How far DOWN into target element

        // Mark that a reorder occurred (for save on drop)
        this.didDragReorderOccur = true;
```

**Undo snapshots** are captured once in `saveDragReorder()` (on drop/touchend), not during
the drag. This keeps the undo stack clean — one snapshot per reorder operation.

#### Edge Cases: First and Last Tasks

```javascript
        // Detect special positions
        const isLastTask = !target.nextElementSibling;
        const isFirstTask = !target.previousElementSibling;
        const isNextSiblingDragged = target.nextSibling === this.draggedTask;
        const isPrevSiblingDragged = target.previousSibling === this.draggedTask;

        // O(1) drop target cleanup (tracked reference, not querySelectorAll)
        if (this._currentDropTarget) {
            this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = null;
        }

        // Special case - dropping on LAST task
        if (isLastTask && !isNextSiblingDragged) {
            parent.appendChild(this.draggedTask);
            this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = this.draggedTask;
            return;
        }

        // Special case - dropping on FIRST task
        if (isFirstTask && !isPrevSiblingDragged) {
            parent.insertBefore(this.draggedTask, parent.firstChild);
            this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = this.draggedTask;
            return;
        }
```

**Why These Checks?**
```
Task List:
┌─────────┐
│ Task 1  │ ← isFirstTask = true (no previousElementSibling)
├─────────┤
│ Task 2  │
├─────────┤
│ Task 3  │ ← isLastTask = true (no nextElementSibling)
└─────────┘

Without special handling:
- Dragging to first position might insert BEFORE first (wrong!)
- Dragging to last position might not append to end
```

#### Insertion Logic: Upper vs Lower Half

```javascript
        // Determine insertion point based on mouse/touch position
        if (offset > bounding.height / 3) {
            // Mouse is in LOWER 2/3 of target → Insert AFTER
            if (!isNextSiblingDragged) {
                parent.insertBefore(this.draggedTask, target.nextSibling);
            }
        } else {
            // Mouse is in UPPER 1/3 of target → Insert BEFORE
            if (!isPrevSiblingDragged) {
                parent.insertBefore(this.draggedTask, target);
            }
        }

        // Add drop-target visual feedback
        if (this.draggedTask && document.contains(this.draggedTask)) {
            this.draggedTask.classList.add(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = this.draggedTask;
        }
    }, this.REARRANGE_DELAY);  // 75ms delay
}
```

**Insertion Logic Visualization:**
```
Target Task (100px height):
┌─────────────────────┐ ← bounding.top = 200px
│                     │
│   UPPER 1/3 (33px)  │ ← Mouse here → Insert BEFORE
│                     │
├─────────────────────┤ ← offset = 33px (height / 3)
│                     │
│                     │
│   LOWER 2/3 (67px)  │ ← Mouse here → Insert AFTER
│                     │
│                     │
└─────────────────────┘ ← bounding.bottom = 300px

Example:
Mouse at Y = 210px
offset = 210 - 200 = 10px
10 > 33? NO → Insert BEFORE target

Mouse at Y = 250px
offset = 250 - 200 = 50px
50 > 33? YES → Insert AFTER target
```

**Why 1/3 instead of 1/2?**
```
If we used 1/2:
- Upper half inserts before
- Lower half inserts after
- Hard to insert AFTER a task (mouse must be in bottom 50%)

With 1/3:
- Small upper zone inserts before
- Large lower zone inserts after
- Easier to insert after (mouse in bottom 67%)
- Feels more natural in testing
```

---

### handleArrowClick(): Array Splice Logic

**Location:** `modules/task/dragDropManager.js`

This method reorders tasks via arrow buttons (▲▼).

#### Finding the Task

```javascript
handleArrowClick(button) {
    try {
        // Find the parent task element
        const taskItem = button.closest(DOM_SELECTORS.TASK);
        if (!taskItem) return;

        // Get all tasks and find current position
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        const allTasks = Array.from(taskList.children);

        const currentIndex = allTasks.indexOf(taskItem);

        // Calculate new position
        let newIndex;
        if (button.classList.contains(DOM_CLASSES.MOVE_UP)) {
            newIndex = Math.max(0, currentIndex - 1);
            //         ^^^^^^^^
            //         Can't go below 0 (first position)
        } else {
            newIndex = Math.min(allTasks.length - 1, currentIndex + 1);
            //         ^^^^^^^^
            //         Can't go above last position
        }

        No movement needed?
        if (newIndex === currentIndex) return;
```

**Index Calculation Examples:**
```javascript
// 5 tasks total (indices 0-4)

// Example 1: Move up from position 2
currentIndex = 2;
newIndex = Math.max(0, 2 - 1) = 1;  // Move from 2 → 1

// Example 2: Move up from position 0 (first task)
currentIndex = 0;
newIndex = Math.max(0, 0 - 1) = Math.max(0, -1) = 0;  // Stay at 0

// Example 3: Move down from position 2
currentIndex = 2;
newIndex = Math.min(4, 2 + 1) = Math.min(4, 3) = 3;  // Move from 2 → 3

// Example 4: Move down from position 4 (last task)
currentIndex = 4;
newIndex = Math.min(4, 4 + 1) = Math.min(4, 5) = 4;  // Stay at 4
```

#### AppState Update

```javascript
        // Check if AppState is ready (via DI, not window.*)
        const AppState = this._getAppState();
        if (AppState?.isReady?.()) {
            // Capture undo snapshot BEFORE change
            const currentState = AppState.get();
            if (currentState) this.deps.captureStateSnapshot?.(currentState);

            // Update AppState with new order
            AppState.update(state => {
                const activeCycleId = state.appState.activeCycleId;
                if (activeCycleId && state.data.cycles[activeCycleId]) {
                    const tasks = state.data.cycles[activeCycleId].tasks;
                    if (tasks && currentIndex >= 0 && currentIndex < tasks.length) {
                        // ARRAY MANIPULATION: Remove and reinsert
                        const [movedTask] = tasks.splice(currentIndex, 1);
                        //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                        //     Remove task from current position
                        //     Returns array with removed item(s)
                        //     Destructure to get the task

                        tasks.splice(newIndex, 0, movedTask);
                        //           ^^^^^^^  ^  ^^^^^^^^^^
                        //           Position 0  Insert item
                        //           to insert   (don't remove)

                        state.metadata.lastModified = Date.now();
                    }
                }
            }, true);  // ← immediate save (don't wait)
```

**Array Splice Visualization:**
```javascript
// Initial state:
tasks = [
    { id: 'task-1', text: 'Task 1' },  // index 0
    { id: 'task-2', text: 'Task 2' },  // index 1
    { id: 'task-3', text: 'Task 3' },  // index 2
    { id: 'task-4', text: 'Task 4' },  // index 3
    { id: 'task-5', text: 'Task 5' }   // index 4
];

// User clicks move-up on Task 3 (currentIndex = 2, newIndex = 1)

// Step 1: Remove task from position 2
const [movedTask] = tasks.splice(2, 1);
//                        ^^^^^^^  ^
//                        Start at  Remove 1
//                        index 2   item

// movedTask = { id: 'task-3', text: 'Task 3' }
// tasks = [
//     { id: 'task-1', text: 'Task 1' },  // index 0
//     { id: 'task-2', text: 'Task 2' },  // index 1
//     { id: 'task-4', text: 'Task 4' },  // index 2 (moved up!)
//     { id: 'task-5', text: 'Task 5' }   // index 3 (moved up!)
// ];

// Step 2: Insert task at position 1
tasks.splice(1, 0, movedTask);
//          ^  ^  ^^^^^^^^^^
//          At  No  Insert this
//          pos 1   removal

// Final state:
// tasks = [
//     { id: 'task-1', text: 'Task 1' },  // index 0
//     { id: 'task-3', text: 'Task 3' },  // index 1 ← Moved here!
//     { id: 'task-2', text: 'Task 2' },  // index 2 (pushed down)
//     { id: 'task-4', text: 'Task 4' },  // index 3
//     { id: 'task-5', text: 'Task 5' }   // index 4
// ];
```

**Why Not Just Swap?**
```javascript
// ❌ WRONG: Simple swap (doesn't preserve order of other tasks)
[tasks[currentIndex], tasks[newIndex]] = [tasks[newIndex], tasks[currentIndex]];

// ✅ CORRECT: Remove and reinsert (preserves order)
const [task] = tasks.splice(currentIndex, 1);  // Remove
tasks.splice(newIndex, 0, task);                // Insert
```

#### UI Refresh

```javascript
            Trigger full UI re-render from state
            this.deps.refreshUIFromState();
            //  This reads the updated AppState and re-renders the task list
            //  Result: Tasks appear in new order on screen

            Update undo/redo button states
            this.deps.updateUndoRedoButtons();
            //  Undo button: Enable (we just added to undo stack)
            //  Redo stack: Clear (new action clears redo)

            console.log(`✅ Task moved from position ${currentIndex} to ${newIndex} via arrows`);
        }
    } catch (error) {
        console.warn('⚠️ Arrow click handler failed:', error);
        this.deps.showNotification('Failed to reorder task', 'warning');
    }
}
```

---

### Event Delegation: Why We Use It

**Location:** `modules/task/dragDropManager.js`

#### The Problem

```javascript
// ❌ BAD: Add listener to each arrow button
document.querySelectorAll('.move-up').forEach(btn => {
    btn.addEventListener('click', handleArrowClick);
});

// Problems:
// 1. New tasks don't get listeners (until you re-run this code)
// 2. Hundreds of event listeners (memory usage)
// 3. Must remove listeners before DOM changes (memory leaks)
```

#### The Solution

```javascript
// ✅ GOOD: Single listener on parent (event delegation)
const taskList = document.getElementById("taskList");
taskList.addEventListener("click", (event) => {
    if (event.target.matches('.move-up, .move-down')) {
        event.preventDefault();
        event.stopPropagation();
        this.handleArrowClick(event.target);
    }
});

// Benefits:
// 1. New tasks automatically work (event bubbles up)
// 2. Only ONE event listener (low memory)
// 3. Survives DOM re-renders (listener on parent)
```

**Event Bubbling Visualization:**
```
Click on .move-up button

Event bubbles up DOM tree:
.move-up (button)
    ↓ bubbles
.task (li)
    ↓ bubbles
#taskList (ul) ← Event listener here!
    ↓ bubbles
#app-root (div)
    ↓ bubbles
body
    ↓ bubbles
html

At #taskList:
if (event.target.matches('.move-up')) {
    // YES! The original target was .move-up
    handleArrowClick(event.target);
}
```

---

### requestAnimationFrame: 60fps Drag

**Location:** `modules/task/dragDropManager.js`

```javascript
document.addEventListener("dragover", (event) => {
    event.preventDefault();  // Required for drop to work

    requestAnimationFrame(() => {
        // This callback runs at the next screen repaint (60fps)

        const movingTask = event.target.closest(".task");
        if (movingTask) {
            this.handleRearrange(movingTask, event);
        }
    });
});
```

**Why requestAnimationFrame?**

```javascript
// ❌ WITHOUT requestAnimationFrame:
document.addEventListener("dragover", (event) => {
    handleRearrange(event.target, event);  // Runs immediately
});

// Problem: dragover fires VERY frequently (every few ms)
// t=0ms:   dragover → handleRearrange() → DOM manipulation
// t=2ms:   dragover → handleRearrange() → DOM manipulation
// t=4ms:   dragover → handleRearrange() → DOM manipulation
// t=6ms:   dragover → handleRearrange() → DOM manipulation
// Result: Browser struggles to keep up, janky animation

// ✅ WITH requestAnimationFrame:
document.addEventListener("dragover", (event) => {
    requestAnimationFrame(() => {
        handleRearrange(event.target, event);  // Runs at next frame
    });
});

// Benefit: Syncs with screen refresh (60fps = ~16ms)
// t=0ms:   dragover → schedule for next frame
// t=2ms:   dragover → schedule for next frame (cancels previous)
// t=4ms:   dragover → schedule for next frame (cancels previous)
// t=16ms:  FRAME RENDER → handleRearrange() runs ONCE
// Result: Smooth 60fps animation, no wasted work
```

---

### Cleanup: Why It Matters

**Location:** `modules/task/dragDropManager.js`

```javascript
cleanupDragState() {
    try {
        clearTimeout(this.rearrangeTimeout);
        this.rearrangeTimeout = null;

        if (this.draggedTask) {
            this.draggedTask.classList.remove(DOM_CLASSES.DRAGGING, DOM_CLASSES.REARRANGING);
            this.draggedTask = null;
        }

        this._nativeDragActive = false;
        this.didDragReorderOccur = false;

        // O(1) drop target cleanup (tracked reference)
        if (this._currentDropTarget) {
            this._currentDropTarget.classList.remove(DOM_CLASSES.DROP_TARGET);
            this._currentDropTarget = null;
        }

        // Clear force-hidden from all task options so CSS :hover can take over
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        if (taskList) {
            const forceHidden = taskList.querySelectorAll(
                `${DOM_SELECTORS.TASK_OPTIONS}.${DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN}`
            );
            forceHidden.forEach(el => el.classList.remove(DOM_CLASSES.TASK_OPTIONS_FORCE_HIDDEN));
        }
    } catch (error) {
        console.warn('⚠️ Failed to cleanup drag state:', error);
    }
}
```

**Why Cleanup Is Critical:**

```javascript
// Without cleanup:
// 1. Task 1 dragged → AppGlobalState.draggedTask = Task1
// 2. User drops Task 1 → (no cleanup)
// 3. User clicks Task 2 → handleArrowClick() runs
// 4. AppGlobalState.draggedTask still = Task1 (WRONG!)
// 5. Code gets confused, weird behavior

// With cleanup:
// 1. Task 1 dragged → AppGlobalState.draggedTask = Task1
// 2. User drops Task 1 → cleanupDragState()
// 3. AppGlobalState.draggedTask = null (clean slate)
// 4. Next interaction works correctly
```

---

### Drop Handler: The Save Operation

**Location:** `modules/task/dragDropManager.js`

```javascript
// Setup in setupRearrange() — document-level handler (event delegation)
document.addEventListener("drop", (event) => {
    event.preventDefault();

    if (!this.draggedTask) return;  // Instance property (not AppGlobalState)

    // saveDragReorder() reads DOM task order, updates AppState, and refreshes UI.
    // Works for both desktop HTML5 DnD and iOS native DnD (via touchcancel → drop path).
    this.saveDragReorder();
    this.cleanupDragState();
    this._nativeDragActive = false;  // Reset iOS native DnD flag
});
```

**`saveDragReorder()` — State-First Save Pattern (February 2026)**

Extracted shared method used by both `drop` (desktop + iOS native) and `touchend` (custom touch drag):
```javascript
saveDragReorder() {
    if (!this.didDragReorderOccur) return;

    const AppState = this._getAppState();
    if (AppState?.isReady?.()) {
        // Capture undo snapshot BEFORE saving new order
        const currentState = AppState.get();
        if (currentState) this.deps.captureStateSnapshot?.(currentState);

        // Read task order from DOM and update AppState
        const taskList = document.getElementById(DOM_IDS.TASK_LIST);
        const taskElements = taskList?.querySelectorAll(DOM_SELECTORS.TASK);
        const newTaskOrder = [];
        taskElements?.forEach(taskEl => {
            const taskId = taskEl.dataset.taskId;
            if (taskId) newTaskOrder.push(taskId);
        });

        AppState.update(state => {
            const activeCycleId = state.appState.activeCycleId;
            if (activeCycleId && state.data.cycles[activeCycleId]) {
                const tasks = state.data.cycles[activeCycleId].tasks;
                if (tasks && newTaskOrder.length > 0) {
                    const taskMap = new Map(tasks.map(t => [t.id, t]));
                    const reorderedTasks = newTaskOrder.map(id => taskMap.get(id)).filter(Boolean);
                    const missingTasks = tasks.filter(t => !newTaskOrder.includes(t.id));
                    state.data.cycles[activeCycleId].tasks = [...reorderedTasks, ...missingTasks];
                    state.metadata.lastModified = Date.now();
                }
            }
        }, true); // immediate save
    }

    // Update UI elements
    this.deps.updateProgressBar?.();
    this.deps.updateStatsPanel?.();
    this.deps.checkCompleteAllButton?.();
    this.deps.updateUndoRedoButtons?.();
    this.updateFirstLastMarkers();

    this.didDragReorderOccur = false;
}
```

**Why Check didDragReorderOccur?**

```javascript
// Scenario 1: User drags but doesn't reorder
// - Pick up task
// - Move mouse around
// - Drop in same position
// Result: didDragReorderOccur = false → No save (nothing changed!)

// Scenario 2: User drags and reorders
// - Pick up task
// - handleRearrange() fires → didDragReorderOccur = true
// - Drop task
// Result: didDragReorderOccur = true → Save! (order changed)
```

---

## 📁 Code Organization

### File Structure

```
modules/task/
└── dragDropManager.js         Main implementation (~1,100 lines)

modules/boot/ (moduleLoader + featureBoot)   Integration point
  ├── initDragDropManager()     Initialize with dependencies
  └── renderTasks()             Enables drag per task + restores arrow visibility

tests/
└── dragDropManager.tests.js   Test suite (40 tests)

docs/
├── architecture/DRAG_DROP_ARCHITECTURE.md   This document
└── archive/SAFARI_DRAGDROP_FIX.md           Safari-specific fix docs (historical)
```

---

### Class Structure: DragDropManager

```javascript
class DragDropManager {
  constructor(dependencies = {}) {
    // DI via diBase.js — deps resolved from createDIModule manifest
    const resolvedDeps = di.resolve(dependencies);
    this.deps = {
      AppState: resolvedDeps.AppState,
      getBody: resolvedDeps.getBody,
      // ... all deps via DI (no window.* fallbacks)
    };

    // Internal state
    this.rearrangeTimeout = null;
    this.REARRANGE_DELAY = 75;
    this.initialized = false;
  }

  // Core Methods
  async init()                    // Initialize with appInit
  setupRearrange()                // Event delegation setup
  enableDragAndDrop(taskElement)  // Enable on individual task
  handleRearrange(target, event)  // Reorder logic
  handleArrowClick(button)        // Arrow button logic
  cleanupDragState()              // Reset after drag

  // Arrow Visibility
  updateMoveArrowsVisibility()    // Read from state
  toggleArrowVisibility()         // Toggle on/off
  updateArrowsInDOM(showArrows)   // Update DOM

  // Fallback Methods (12 methods)
  fallbackSave()
  fallbackAutoSave()
  // ... graceful degradation
}
```

---

### Initialization Sequence

```javascript
// 1. App initialization starts
modules/boot/orchestrator.js → coreBoot → featureBoot

// 2. moduleLoader loads the dragDropManager manifest entry
//    (phase TASK_MANAGEMENT — requires appInit, AppState, showNotification;
//     optionalDeps include captureStateSnapshot, refreshUIFromState,
//     revealTaskButtons/hideTaskButtons, updateUndoRedoButtons, ...)
const dragDropManager = await initDragDropManager(dependencies); // DI-wired, no window.*

// 3. init() waits for core, then sets up event delegation
await appInit.waitForCore();
this.setupRearrange();

// 4. Enable drag on existing tasks
renderTasks() // Calls enableDragAndDropOnTask() for each task

// 5. Enable drag on new tasks
addTask() → finalizeTaskCreation() → enableDragAndDropOnTask()
```

---

### Dependency Injection Pattern

**Philosophy:** Strict DI via `diBase.js`, with optional calls guarded by `?.()`

```javascript
// Deps resolved from the createDIModule manifest, with constructor overrides
constructor(dependencies = {}) {
  const resolvedDeps = di.resolve(dependencies);

  // Note: saveCurrentTaskOrder and autoSave were removed — state-first pattern
  this.deps = {
    AppState: resolvedDeps.AppState,
    captureStateSnapshot: resolvedDeps.captureStateSnapshot,
    refreshUIFromState: resolvedDeps.refreshUIFromState,
    showNotification: resolvedDeps.showNotification || this.fallbackNotification,
    // ... all other deps via DI (no window.* fallbacks)
  };
}

// The one remaining fallback logs instead of notifying
fallbackNotification(message, type) {
  console.log(`[DragDrop] ${message}`);
}
```

**Benefits:**
- Optional deps degrade gracefully (`this.deps.updateStatsPanel?.()`)
- Easier to test (can inject mocks via constructor overrides)
- DI-pure: no `window.*` globals, wiring declared in `moduleManifests.js`

---

## 🧪 Testing Strategy

### Test Coverage: 40 Tests

**Location:** `tests/dragDropManager.tests.js`

### Test Categories

| Category | Coverage |
|----------|----------|
| Module Loading | Class definition, exports |
| Initialization | Constructor, init, setup |
| Core Functionality | Drag enable, cleanup |
| Arrow Buttons | Click handling, reordering |
| Arrow Visibility | Toggle, update, DOM |
| Rearrangement Logic | Logic, debouncing, timing |
| DI Dependency Tests | Injection, optional-dep degradation |
| Global Functions | Module-level exports |
| Integration | AppState integration |
| Error Handling | Graceful degradation |
| Touch/Mobile | Touch detection |
| **Safari Compatibility** | **webkitUserDrag, image timing** |

**TOTAL: 40 tests** (run `tests/dragDropManager.tests.js` for the live per-section breakdown)

---

### Safari-Specific Tests (6 Tests)

```javascript
// Test 1: webkitUserDrag property
test('sets webkitUserDrag property for Safari compatibility', () => {
  manager.enableDragAndDrop(taskElement);
  assertEqual(taskElement.style.webkitUserDrag, 'element');
});

// Test 2: draggable attribute
test('sets draggable attribute required by Safari', () => {
  manager.enableDragAndDrop(taskElement);
  assertEqual(taskElement.getAttribute('draggable'), 'true');
});

// Test 3: Complete configuration
test('configures all required Safari drag properties together', () => {
  manager.enableDragAndDrop(taskElement);
  // Verifies: draggable, webkitUserDrag, userSelect, webkitUserSelect
});

// Test 4: Computed styles
test('Safari drag properties are reflected in computed styles', () => {
  document.body.appendChild(taskElement);
  manager.enableDragAndDrop(taskElement);
  const computed = window.getComputedStyle(taskElement);
  assertEqual(computed.webkitUserDrag, 'element');
});

// Test 5: Image creation timing (Stack Overflow fix)
test('creates transparent drag image for Safari', () => {
  // Documents the requirement to create image OUTSIDE event handler
});

// Test 6: Text selection prevention
test('prevents Safari from blocking drag with text selection styles', () => {
  // Verifies all three: userSelect, webkitUserSelect, msUserSelect
});
```

---

### Data Protection Pattern

Every test uses save/restore to protect real app data:

```javascript
async function test(name, testFn) {
  // 🔒 SAVE REAL APP DATA before test
  const savedRealData = {};
  const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
  protectedKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) savedRealData[key] = value;
  });

  try {
    await testFn(); // Run test
  } finally {
    // 🔒 RESTORE REAL APP DATA (even if test crashes)
    localStorage.clear();
    Object.keys(savedRealData).forEach(key => {
      localStorage.setItem(key, savedRealData[key]);
    });
  }
}
```

**Why?** Tests run in the same browser context as the app. Without this, tests would corrupt user data.

---

### Running Tests

#### Manual Browser Testing
```bash
# 1. Start server
python3 -m http.server 8080

# 2. Open in browser
open http://localhost:8080/tests/module-test-suite.html

# 3. Select "DragDropManager" from dropdown
# 4. Click "Run Tests"
```

**Result:**
```
🔄 DragDropManager Tests

📦 Module Loading
✅ DragDropManager class is defined
✅ DragDropManager class is exported
...

🍎 Safari Compatibility
✅ sets webkitUserDrag property for Safari compatibility
✅ sets draggable attribute required by Safari
...

Results: 40/40 tests passed (100%)
```

#### Automated Testing
```bash
# Terminal 1: Start server
python3 -m http.server 8080

# Terminal 2: Run tests
node tests/automated/run-browser-tests.cjs
```

**Result:**
```
🧪 Testing dragDropManager...
   ✅ Results: 40/40 tests passed (100%)
```

---

## 🔧 Troubleshooting

### Issue: Drag doesn't work in Safari Desktop

**Symptoms:**
- Drag works in Chrome, Firefox, Edge
- Drag works on Safari iPhone
- Drag doesn't work on Safari Desktop

**Diagnosis:**
```javascript
// Run diagnostic in Safari console
const task = document.querySelector('.task');
console.log({
  draggable: task.getAttribute('draggable'),
  webkitUserDrag: task.style.webkitUserDrag,
  computed: window.getComputedStyle(task).webkitUserDrag
});
```

**Expected:**
```javascript
{
  draggable: "true",
  webkitUserDrag: "element",
  computed: "element"
}
```

**Solutions:**
1. ✅ Verify `webkitUserDrag = "element"` is set
2. ✅ Check drag image created outside event handler
3. ✅ Run Safari compatibility tests
4. ✅ Review `docs/archive/SAFARI_DRAGDROP_FIX.md` (historical)

---

### Issue: Touch drag activates page scroll

**Symptoms:**
- Long-press works
- But dragging scrolls the page instead of moving task

**Diagnosis:**
```javascript
// Add debug logging to touchmove
taskElement.addEventListener("touchmove", (event) => {
  const deltaX = Math.abs(event.touches[0].clientX - touchStartX);
  const deltaY = Math.abs(event.touches[0].clientY - touchStartY);
  console.log({ deltaX, deltaY, isVertical: deltaY > deltaX });
});
```

**Solutions:**
1. ✅ Verify movement threshold is 15px (not too high)
2. ✅ Check `deltaY > deltaX` logic (vertical detection)
3. ✅ Ensure `event.preventDefault()` is called on horizontal drag
4. ✅ Test on actual device (not just desktop Chrome DevTools)

---

### Issue: Undo stack grows too fast

**Symptoms:**
- Dragging one task creates multiple undo entries
- Undo button shows unexpected stack size

**Current Design:**
A single undo snapshot is captured in `saveDragReorder()` (on drop/touchend),
not during the drag itself. If multiple snapshots appear per drag, check that
`captureStateSnapshot` is only called once per reorder operation.

**Solutions:**
1. ✅ Verify `saveDragReorder()` is the only snapshot capture point
2. ✅ Ensure `didDragReorderOccur` flag is reset in `cleanupDragState()`
3. ✅ Check that `cleanupDragState()` isn't called before `saveDragReorder()`

---

### Issue: Arrow buttons don't show/hide

**Symptoms:**
- Arrow toggle in settings doesn't work
- Arrows always visible or always hidden
- Arrow state doesn't persist

**Diagnosis:**
```javascript
// Check AppState
const state = window.AppState.get();
console.log({
  moveArrowsVisible: state.ui?.moveArrowsVisible,
  appStateReady: window.AppState.isReady()
});

// Check DOM
const upArrow = document.querySelector('.move-up');
console.log({
  visibility: upArrow.style.visibility,
  opacity: upArrow.style.opacity,
  pointerEvents: upArrow.style.pointerEvents
});
```

**Solutions:**
1. ✅ Verify AppState is initialized
2. ✅ Check `state.ui.moveArrowsVisible` is boolean
3. ✅ Ensure `updateArrowsInDOM()` is called after state change
4. ✅ Review arrow visibility logic (`updateArrowsInDOM()` in `dragDropManager.js`)

---

### Issue: iOS native drag preview missing (shows placeholder icon)

**Symptoms:**
- Drag works on iOS
- But shows tiny question mark icon instead of task content preview
- Native iOS drag preview (dark rectangle with content) not appearing

**Current Design (March 2026):**
`setDragImage` is only called on Safari desktop (detected via UA). iOS is excluded by the
`!('ontouchstart' in window)` check, so it always gets its native drag preview. Non-Safari
desktop browsers use the browser's default ghost image (no `setDragImage` call at all).

```javascript
// Safari desktop only — custom 70%-width ghost clone
const isSafariDesktop = /Safari/.test(ua) && !/Chrome/.test(ua)
    && !/Chromium/.test(ua) && !('ontouchstart' in window);
if (isSafariDesktop) {
    // Clone task, style, setDragImage, remove after capture
}
// iOS/non-Safari: no setDragImage → native preview
```

**Lesson Learned:**
The `isTouchDevice` DI dependency was removed — inline `'ontouchstart' in window` is more
reliable for critical device branching in event handlers.

---

### Issue: Drag works but doesn't save

**Symptoms:**
- Tasks reorder visually during drag
- But order resets on page refresh
- AppState not updated

**Diagnosis:**
```javascript
// Check if drag state is intact (use browser console)
// Access the DragDropManager instance via appContext or module export
console.log({
  draggedTask: dragDropManager.draggedTask,
  didReorder: dragDropManager.didDragReorderOccur,
  nativeDragActive: dragDropManager._nativeDragActive
});
```

**Common Root Causes:**
1. **`touchcancel` clearing `draggedTask` on iOS** (February 2026 fix) — iOS fires `touchcancel` when native DnD takes over. If `touchcancel` clears `this.draggedTask`, the `drop` handler can't save. Fix: check `_nativeDragActive` flag in `touchcancel`.
2. **`didDragReorderOccur` not set** — `handleRearrange()` must set this flag during drag.
3. **`saveDragReorder()` not called** — Verify it's called from both `drop` and `touchend`.
4. **`AppState.update()` not triggered** — Check AppState is ready (`AppState.isReady()`).

**Solutions:**
1. ✅ Verify `_nativeDragActive` flag is set in `dragstart` and checked in `touchcancel`
2. ✅ Verify `didDragReorderOccur` flag is set during drag
3. ✅ Check `saveDragReorder()` is called on drop (desktop + iOS) and touchend (custom touch)
4. ✅ Ensure `AppState.update()` is triggered
5. ✅ Review save logic in `saveDragReorder()` method

---

### Issue: iOS drag shows native preview but doesn't persist (February 2026)

**Symptoms:**
- Long-press shows iOS native drag preview (dark rectangle with content)
- Tasks visually reorder during drag
- But dropping doesn't save — order resets on refresh
- Console shows `touchcancel` events

**Root Cause:**
iOS fires `touchcancel` when it takes over the touch for native DnD. The old
`touchcancel` handler was clearing `this.draggedTask`, which the `drop` handler
needs to persist the reorder.

**Event sequence:**
```
touchstart → timer (500ms) → dragstart → touchcancel → dragover... → drop
                                               ↑
                              OLD: cleared draggedTask (BUG!)
                              NEW: checks _nativeDragActive, preserves draggedTask
```

**Solution:**
Track whether `dragstart` has fired via `this._nativeDragActive`. In `touchcancel`,
if the flag is true, only reset local closure state — don't touch `this.draggedTask`.

**Also important:** Do NOT add `touch-action: none` to dragging elements on mobile.
This can prevent iOS from recognizing the drag gesture in the first place.

---

## 🚀 Future Enhancements

### Planned Features

#### 1. Multi-Select Drag
**Description:** Drag multiple tasks at once

**Use Case:**
- User selects 3 tasks (Ctrl/Cmd + Click)
- Drags selection to new position
- All 3 tasks move together

**Implementation Complexity:** Medium
**Estimated Effort:** 2-3 days

**Challenges:**
- Selection state management
- Visual feedback for multiple tasks
- Touch selection pattern (long-press + tap?)

---

#### 2. Drag Between Cycles
**Description:** Drag tasks from one cycle to another

**Use Case:**
- User has "Morning Routine" and "Evening Routine" cycles
- Drags "Exercise" from morning to evening
- Task moves between cycles

**Implementation Complexity:** High
**Estimated Effort:** 3-5 days

**Challenges:**
- Two cycles visible simultaneously (UI change)
- Cross-list drag detection
- AppState update for different cycles

---

#### 3. Keyboard-Only Drag
**Description:** Drag using only keyboard (no mouse/touch)

**Use Case:**
- User focuses task with Tab
- Presses Space to "grab"
- Arrow keys to move up/down
- Space again to "drop"

**Implementation Complexity:** Medium
**Estimated Effort:** 2-3 days

**Benefits:**
- Full keyboard accessibility
- Screenreader compatibility
- Power user efficiency

---

#### 4. Haptic Feedback (Mobile)
**Description:** Vibration on long-press and drop

**Use Case:**
- User long-presses task (light haptic)
- Task enters drag mode (medium haptic)
- Task drops in new position (light haptic)

**Implementation Complexity:** Low
**Estimated Effort:** 1 day

**Code:**
```javascript
// Vibration API
if ('vibrate' in navigator) {
  navigator.vibrate(50); // 50ms light haptic
}
```

---

#### 5. Drag Handles (Optional)
**Description:** Dedicated drag handle (⋮⋮ icon) instead of entire task

**Use Case:**
- User wants to select text in task without dragging
- Drag handle provides clear affordance
- Can be toggled on/off in settings

**Implementation Complexity:** Medium
**Estimated Effort:** 2 days

**Trade-offs:**
- **Pro:** Clearer drag affordance
- **Con:** Extra UI element, less space
- **Pro:** Allows text selection in tasks
- **Con:** Smaller drag target (worse on mobile)

---

### Not Planned (but possible)

#### 1. Animation Library Integration
**Why not:** Adds 10-20KB dependency for minimal visual improvement

#### 2. Drag Preview with Task Content
**Why not:** Current transparent image is cleaner UX

#### 3. Drag to Delete (Swipe to Delete)
**Why not:** miniCycle paradigm is persistent tasks (not deletion)

---

## 📚 References

### Documentation
- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [MDN: Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Apple: Drag and Drop Programming](https://developer.apple.com/library/archive/documentation/AppleApplications/Conceptual/SafariJSProgTopics/DragAndDrop.html)

### Safari-Specific
- [Stack Overflow: Safari drag events not firing](https://stackoverflow.com/questions/48973815/javascript-html5-drag-events-not-firing-on-safari-mac-dragging-does-not-work)
- [MDN: -webkit-user-drag](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-user-drag)
- [Can I Use: -webkit-user-drag](https://caniuse.com/webkit-user-drag)

### miniCycle Documentation
- `docs/archive/SAFARI_DRAGDROP_FIX.md` - Safari desktop fix (historical)
- `docs/CLAUDE.md` - Development guidance
- `tests/dragDropManager.tests.js` - 40 comprehensive tests

---

## 🎓 Key Takeaways

### 1. Custom Implementation Can Be Better
Libraries are great, but sometimes custom code gives you:
- ✅ Full control over behavior
- ✅ Tighter integration with your architecture
- ✅ Smaller bundle size
- ✅ Easier debugging (you understand every line)

### 2. Browser Quirks Are Real
Safari desktop requires special handling that's not obvious:
- `webkitUserDrag` CSS property
- Drag image timing requirements
- Different from Safari mobile

**Always test on actual Safari, not just Chrome.**

### 3. Performance Matters
Small optimizations compound:
- 75ms debouncing = smooth drag
- One undo snapshot per reorder gesture = manageable undo stack
- requestAnimationFrame = 60fps experience
- Event delegation = lower memory

### 4. Multiple Input Methods Are Essential
Not just drag-and-drop:
- Touch (mobile users)
- Mouse (desktop users)
- Arrow buttons (accessibility, precision)

**Universal design benefits everyone.**

### 5. Inline Detection for Critical Checks
Dependency injection is great for testability, but for critical device-specific checks:
- ✅ Inline detection is more reliable (no wiring issues)
- ✅ Evaluated at runtime (not initialization time)
- ✅ Self-contained (doesn't depend on boot order)

**Example (December 2025 fix):**
```javascript
// Inline check - always works
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
```

This fixed a bug where iOS native drag preview was hidden because `deps.utils.isTouchDevice` wasn't wired up.

### 6. Cooperate with the Browser, Don't Fight It
iOS native DnD provides a polished, familiar drag preview for free. Fighting it
(with `touch-action: none` or custom touch overrides) breaks the experience.
Instead, detect when the browser takes over (`_nativeDragActive` flag) and
preserve the state it needs (`draggedTask`) for the save path.

**Example (February 2026 fix):**
The `touchcancel` event isn't an error on iOS — it's the browser saying
"I've got this." The fix was to stop cleaning up state that the `drop` handler
still needs.

### 7. Documentation is Worth It
This document took 2 hours to write.
It will save **20+ hours** over the life of this feature:
- Onboarding new developers
- Remembering design decisions
- Debugging issues
- Planning enhancements

**Always document complex custom implementations.**

---

## ✅ Checklist: Adding New Drag Features

When adding new drag-related functionality:

- [ ] Update `dragDropManager.js` with new code
- [ ] Add tests to `dragDropManager.tests.js`
- [ ] Run tests on Safari Desktop (don't skip this!)
- [ ] Check performance with Chrome DevTools Performance tab
- [ ] Verify undo/redo still works
- [ ] Test on actual mobile device (not just DevTools)
- [ ] Verify iOS native DnD flow: long-press → native preview → drop saves
- [ ] Update this document with new behavior
- [ ] Add to "Future Enhancements" if not fully implemented
- [ ] Create git commit with descriptive message

---

## 📞 Questions?

If something in this document is unclear:
1. Check inline comments in `dragDropManager.js`
2. Review tests in `dragDropManager.tests.js` (tests are documentation)
3. Read `docs/archive/SAFARI_DRAGDROP_FIX.md` for Safari-specific issues (historical)
4. Search this document (comprehensive index)
5. Check git history for implementation context

---

**Document Version:** 1.1
**Last Updated:** August 2026
**Maintained By:** miniCycle Team
**License:** Part of miniCycle project
