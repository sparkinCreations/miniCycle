# Undo/Redo System Architecture

**Module:** `modules/ui/undoRedoManager.js` (1,050 lines)
**Version:** 1.347
**Test Coverage:** 73/73 tests passing (100%)
**Status:** Production-ready, per-cycle IndexedDB persistence

---

## Overview

miniCycle's undo/redo system is a **per-cycle, state-based snapshot system** with persistent IndexedDB storage. Each cycle maintains its own independent undo/redo history, allowing users to undo up to 20 actions per cycle with full state restoration.

### Key Features

- ✅ **Per-cycle isolation** - Each cycle has independent undo/redo history
- ✅ **IndexedDB persistence** - History survives page reloads
- ✅ **Full state snapshots** - Complete cycle state, not deltas
- ✅ **Smart deduplication** - Prevents duplicate snapshots
- ✅ **Throttled capture** - 300ms minimum interval between snapshots
- ✅ **Debounced writes** - Batches IndexedDB writes every 3 seconds
- ✅ **Graceful degradation** - Works in-memory if IndexedDB unavailable
- ✅ **Rollback on failure** - Automatic recovery from failed operations
- ✅ **Descriptive notifications** - User-friendly change descriptions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Actions                            │
│        (add task, edit, complete, reorder, etc.)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 AppState Subscription                       │
│         (Detects changes, triggers snapshot)                │
│                                                             │
│  • Skip if initializing                                    │
│  • Skip if switching cycles                                │
│  • Skip if performing undo/redo                            │
│  • Skip if within 300ms throttle window                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Snapshot Capture & Deduplication               │
│                                                             │
│  1. Build complete state snapshot                          │
│  2. Generate signature for comparison                      │
│  3. Check if duplicate of last snapshot                    │
│  4. Push to in-memory undo stack (max 20)                  │
│  5. Clear redo stack                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          IndexedDB Persistence (Debounced)                  │
│                                                             │
│  Database: miniCycleUndoHistory                            │
│  Store: undoStacks                                         │
│  Key: cycleId                                              │
│  Debounce: 3 seconds                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cycle Switch Detection                         │
│                                                             │
│  1. Save current cycle's stacks to IndexedDB               │
│  2. Clear in-memory stacks                                 │
│  3. Load new cycle's stacks from IndexedDB                 │
│  4. Update UI button states                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Snapshot Structure

Each snapshot captures **complete cycle state** at a point in time:

```javascript
{
  activeCycleId: string,           // Which cycle this snapshot belongs to
  tasks: Task[],                   // Deep cloned task array
  recurringTemplates: object,      // Deep cloned recurring templates
  title: string,                   // Cycle name
  autoReset: boolean,              // Auto-cycle mode
  deleteCheckedTasks: boolean,     // To-do mode
  cycleCount: number,              // Number of completed cycles
  timestamp: number,               // When snapshot was captured
  _sig: string                     // Cached signature for fast comparison
}
```

### IndexedDB Schema

**Database:** `miniCycleUndoHistory` (version 1)
**Object Store:** `undoStacks` (keyPath: `cycleId`)

```javascript
{
  cycleId: string,                 // Primary key
  undoStack: Snapshot[],           // Array of up to 20 snapshots
  redoStack: Snapshot[],           // Array of redo snapshots
  lastUpdated: number,             // Timestamp of last save
  version: string                  // App version (e.g., "1.344")
}
```

### In-Memory State

Stored in `window.AppGlobalState`:

```javascript
{
  activeUndoStack: [],             // Current cycle's undo snapshots
  activeRedoStack: [],             // Current cycle's redo snapshots
  activeCycleIdForUndo: string,    // Which cycle owns current stacks
  isPerformingUndoRedo: boolean,   // Flag to prevent recursive snapshots
  isSwitchingCycles: boolean,      // Flag to block snapshots during switch
  isInitializing: boolean,         // Flag to skip snapshots during app init
  lastSnapshotSignature: string,   // For deduplication
  lastSnapshotTs: number           // For throttling
}
```

---

## Core Operations

### 1. Snapshot Capture

**Triggered by:** AppState subscription on cycle data changes
**Function:** `captureStateSnapshot(state)`
**Throttle:** 300ms minimum interval
**Limit:** 20 snapshots per cycle (oldest discarded)

**Logic Flow:**
1. Check if should skip (initializing, switching, within throttle window)
2. Extract current cycle state
3. Create deep clones of tasks and templates
4. Build compact signature for comparison
5. Check for duplicates (skip if identical to last)
6. Push to undo stack (shift oldest if > 20)
7. Clear redo stack (can't redo after new action)
8. Update UI button states
9. Save to IndexedDB (debounced)

**What triggers snapshots:**
- Task text changes
- Task completion/incompletion
- Task added/deleted
- Task reordering
- Task priority changes
- Cycle title changes
- Mode changes (autoReset, deleteCheckedTasks)

**What doesn't trigger snapshots:**
- Initial app load
- Cycle switches
- Undo/redo operations themselves
- Changes to other cycles (only active cycle)

### 2. Undo Operation

**Function:** `performStateBasedUndo()`
**Keyboard:** Ctrl+Z (Cmd+Z on Mac)
**Button:** Undo button (hidden if stack empty)

**Logic Flow:**
1. Validate: Check stack not empty, AppState ready
2. Create rollback points (in case of failure)
3. Set `isPerformingUndoRedo` flag
4. Capture current state as snapshot
5. Pop from undo stack (skip duplicates)
6. Push current state to redo stack
7. Restore snapshot to AppState
8. Refresh UI from restored state
9. Update button states
10. Save updated stacks to IndexedDB
11. Show success notification with change description
12. On error: Rollback to saved state

**Example notifications:**
- "↩️ Undone: Task added (3 steps left)"
- "↩️ Undone: 2 tasks completed (no steps left)"
- "↩️ Undone: Mode changed (5 steps left)"

### 3. Redo Operation

**Function:** `performStateBasedRedo()`
**Keyboard:** Ctrl+Y or Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
**Button:** Redo button (hidden if stack empty)

**Logic Flow:**
(Identical to undo but with stacks reversed)

### 4. Cycle Switching

**Function:** `onCycleSwitched(newCycleId)`
**Called by:** `cycleSwitcher` module when user switches cycles

**Logic Flow:**
1. Check if actually changing cycles
2. Set `isSwitchingCycles` flag to block snapshots
3. Save current cycle's stacks to IndexedDB
4. Clear in-memory stacks
5. Load new cycle's stacks from IndexedDB
6. Update tracking variables
7. Update UI button states
8. Wait 300ms for cycle to fully load
9. Clear `isSwitchingCycles` flag

**Important:** The 300ms delay ensures the new cycle's data is fully loaded before re-enabling snapshot capture, preventing corruption.

---

## Deduplication & Performance

### Signature Generation

To avoid storing duplicate snapshots, each snapshot gets a compact signature:

```javascript
function buildSnapshotSignature(snapshot) {
  return JSON.stringify({
    c: snapshot.activeCycleId,
    t: snapshot.tasks.map(t => ({
      id: t.id,
      txt: t.text,
      c: !!t.completed,
      p: !!t.highPriority,
      d: t.dueDate || null
    })),
    ti: snapshot.title || '',
    ar: !!snapshot.autoReset,
    dc: !!snapshot.deleteCheckedTasks
  });
}
```

**Cached Signatures:**
Signatures are cached on snapshot objects (`_sig` property) to avoid recomputing on every comparison.

### Throttling Strategy

**300ms minimum interval** between snapshots prevents spam:
- Rapid task completions → Only last state captured
- Drag reordering → Only final position captured
- Batch operations → Single snapshot

### Debounced IndexedDB Writes

**3-second debounce** on IndexedDB writes:
- Multiple snapshots → Single database write
- Reduces I/O overhead
- Force-saves on page unload (beforeunload handler)

---

## Lifecycle Integration

### App Initialization

**Function:** `initializeUndoSystemForApp()`
**Called:** During app startup after AppState ready

**Steps:**
1. Initialize IndexedDB connection
2. Get current active cycle ID from AppState
3. Load that cycle's undo history from IndexedDB
4. Populate in-memory stacks
5. Update UI button states
6. Set up `beforeunload` handler for force-save

### Cycle Creation

**Function:** `onCycleCreated(cycleId)`
**Called by:** `cycleManager` when new cycle created

**Action:** Initialize empty undo/redo stacks in IndexedDB for new cycle

### Cycle Deletion

**Function:** `onCycleDeleted(cycleId)`
**Called by:** `cycleManager` when cycle deleted

**Action:**
- Remove cycle's undo history from IndexedDB
- Clear in-memory stacks if this was active cycle

### Cycle Rename

**Function:** `onCycleRenamed(oldCycleId, newCycleId)`
**Called by:** `cycleSwitcher` when cycle renamed

**Action:**
- Load undo history under old key
- Save under new key
- Delete old key
- Update in-memory tracking

### Factory Reset

**Function:** `clearAllUndoHistoryFromIndexedDB()`
**Called by:** Settings → Factory Reset

**Action:** Clear entire `undoStacks` object store

---

## Change Detection & Descriptions

The system analyzes what changed between snapshots to show user-friendly notifications:

```javascript
function describeChange(fromSnapshot, toSnapshot) {
  // Checks in priority order:
  // 1. Cycle renamed
  // 2. Mode changed (autoReset or deleteCheckedTasks)
  // 3. Tasks added/deleted (with count)
  // 4. Task text edited
  // 5. Tasks completed/uncompleted (with count)
  // 6. Tasks reordered
  // 7. Priority changed
  // 8. Generic "Change" fallback
}
```

**Examples:**
- "Task added"
- "3 tasks deleted"
- "Task edited"
- "2 tasks completed"
- "Tasks reordered"
- "Priority changed"
- "Cycle renamed"
- "Mode changed"

---

## Error Handling & Safety

### Rollback on Failure

Both undo and redo operations create rollback points before modifying state:

```javascript
try {
  // Perform undo/redo
} catch (e) {
  // Rollback to saved state
  await AppState.set(rollbackState);
  AppGlobalState.activeUndoStack = rollbackUndoStack;
  AppGlobalState.activeRedoStack = rollbackRedoStack;
  showNotification('⚠️ Undo failed - state restored', 'error');
  throw e;
}
```

### Graceful Degradation

If IndexedDB is unavailable (private browsing, browser limitations):
- System continues working in-memory only
- History lost on page reload
- No errors thrown
- User can still undo within current session

### Force-Save on Page Unload

A `beforeunload` handler ensures unsaved changes are written:

```javascript
window.addEventListener('beforeunload', () => {
  // Clear debounce timer
  if (dbWriteTimeout) {
    clearTimeout(dbWriteTimeout);
  }

  // Force immediate synchronous write
  // (No await - must complete before unload)
  const transaction = undoDB.transaction(["undoStacks"], "readwrite");
  // ... save current stacks ...
});
```

---

## Testing Strategy

**Test Suite:** `tests/undoRedoManager.tests.js` (73 tests, 100% passing)

### Test Categories

1. **Initialization Tests** (7 tests)
   - Module creation and dependency injection
   - Button initialization
   - IndexedDB setup

2. **Snapshot Capture Tests** (12 tests)
   - Basic snapshot creation
   - Deduplication
   - Throttling
   - Stack size limits

3. **Undo/Redo Operations** (15 tests)
   - Basic undo/redo
   - Multiple operations
   - Duplicate skipping
   - Stack boundaries
   - Error handling

4. **Cycle Lifecycle Tests** (10 tests)
   - Cycle switching
   - Cycle creation
   - Cycle deletion
   - Cycle rename

5. **IndexedDB Persistence Tests** (12 tests)
   - Save/load operations
   - Cycle-specific storage
   - Database cleanup
   - Migration operations

6. **Change Detection Tests** (8 tests)
   - Signature generation
   - Description generation
   - Comparison accuracy

7. **Integration Tests** (9 tests)
   - AppState integration
   - UI updates
   - Keyboard shortcuts
   - Notification display

### Test Patterns

**localStorage Protection:**
Tests save and restore user data before/after each test:

```javascript
let savedRealData = {};
before(() => {
  const protectedKeys = ['miniCycleData'];
  protectedKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) savedRealData[key] = value;
  });
});

after(() => {
  Object.keys(savedRealData).forEach(key => {
    localStorage.setItem(key, savedRealData[key]);
  });
});
```

**IndexedDB Mocking:**
Tests use mock IndexedDB implementations to avoid polluting real database.

---

## Performance Characteristics

### Memory Usage

- **Per-cycle overhead:** ~5-20KB depending on task count
- **20 snapshots max:** Prevents unbounded growth
- **Deep clones:** Uses `structuredClone()` for safety

### IndexedDB Performance

- **Write debouncing:** Reduces writes by ~90%
- **Read caching:** Stacks cached in memory
- **Async operations:** Non-blocking UI

### Throttling Impact

- **300ms minimum:** Prevents snapshot spam
- **Worst case:** One snapshot per 300ms (3.3/second)
- **Typical usage:** 1-5 snapshots per minute

---

## Known Limitations

1. **Not cross-device** - Undo history is device-local (no sync)
2. **20 snapshot limit** - Older changes are lost
3. **Full snapshots** - Not delta-based (more memory)
4. **No undo for cycle deletion** - Cycle must be restored via import
5. **Browser storage limits** - IndexedDB quota varies by browser

---

## Future Enhancements

Potential improvements (not currently planned):

1. **Delta-based snapshots** - Store only changes, not full state
2. **Configurable limits** - Let users choose undo depth
3. **Undo across cycles** - Cross-cycle undo history
4. **Cloud sync** - Sync undo history across devices
5. **Visual timeline** - Show undo history with previews
6. **Selective undo** - Undo specific changes out of order

---

## API Reference

### Initialization

```javascript
// Set dependencies (called by main app)
setUndoRedoManagerDependencies({
  AppState,
  refreshUIFromState,
  AppGlobalState,
  getElementById,
  safeAddEventListener,
  showNotification
});

// Initialize system
await initializeUndoSystemForApp();

// Wire UI buttons
wireUndoRedoUI();

// Set up AppState subscription
setupStateBasedUndoRedo();
```

### Core Operations

```javascript
// Manual snapshot capture
captureStateSnapshot(state);

// Perform operations
await performStateBasedUndo();
await performStateBasedRedo();

// Update UI
updateUndoRedoButtons();
```

### Lifecycle Hooks

```javascript
// Cycle events
await onCycleSwitched(newCycleId);
await onCycleCreated(cycleId);
await onCycleDeleted(cycleId);
await onCycleRenamed(oldCycleId, newCycleId);

// Enable on first interaction
enableUndoSystemOnFirstInteraction();
```

### Utilities

```javascript
// Snapshot comparison
const equal = snapshotsEqual(snapshot1, snapshot2);

// Signature generation
const sig = buildSnapshotSignature(snapshot);

// Change description
const desc = describeChange(fromSnapshot, toSnapshot);
```

---

## Debugging Tips

### Enable Verbose Logging

The module logs extensively to console:
- 📸 Snapshot capture
- 💾 IndexedDB saves
- 📂 IndexedDB loads
- 🔄 Cycle switches
- ↩️ Undo operations
- ↪️ Redo operations

### Check IndexedDB State

```javascript
// Open DevTools → Application → IndexedDB → miniCycleUndoHistory
// Inspect undoStacks object store
// Each entry shows cycleId, undoStack[], redoStack[]
```

### Check In-Memory State

```javascript
// In browser console:
console.log(window.AppGlobalState.activeUndoStack);
console.log(window.AppGlobalState.activeRedoStack);
console.log(window.AppGlobalState.activeCycleIdForUndo);
```

### Common Issues

**Snapshots not captured:**
- Check `isInitializing` flag (should be false after first interaction)
- Check `isSwitchingCycles` flag (should be false)
- Check throttle window (300ms between snapshots)

**History not persisting:**
- Check IndexedDB available (`undoDB` should not be null)
- Check browser storage quota
- Check for private browsing mode

**Wrong cycle's history:**
- Check `activeCycleIdForUndo` matches current cycle
- Verify cycle switch completed (`isSwitchingCycles` should be false)

---

## Related Documentation

- **[TESTING_QUICK_REFERENCE.md](./TESTING_QUICK_REFERENCE.md)** - Test suite guide
- **[DEVELOPER_DOCUMENTATION.md](./DEVELOPER_DOCUMENTATION.md)** - Overall architecture
- **[SCHEMA_2_5.md](./SCHEMA_2_5.md)** - Data structure details

---

**Last Updated:** November 10, 2025
**Module Version:** 1.347
**Test Status:** 73/73 passing ✅
