# Test Plan: undoRedoManager.js

**Module**: `utilities/ui/undoRedoManager.js`
**Pattern**: Strict Injection 🔧
**Version**: 1.330
**Lines**: 463 lines
**Status**: Ready for Testing

---

## 📋 Overview

The undoRedoManager is a **Strict Injection** pattern module that provides state-based undo/redo functionality with snapshot management. It **cannot work without AppState** and fails fast when dependencies are missing.

### Key Features
- State-based undo/redo with snapshot management
- Automatic snapshot capture on state changes
- Deduplication to avoid identical snapshots
- Throttling to prevent snapshot spam
- Stack limit of 50 snapshots
- UI button state management
- First interaction detection for enabling undo system

### Critical Dependencies
- `AppState` - Required, must have `isReady()`, `get()`, `update()`, `subscribe()`
- `refreshUIFromState` - Required for UI updates after undo/redo
- `AppGlobalState` - Required for stack management (`undoStack`, `redoStack`)
- `getElementById` - Required for DOM access
- `safeAddEventListener` - Required for event binding

---

## 🎯 Test Categories

### 1. **Initialization & Dependency Injection** (8 tests)
Tests that the module properly initializes and enforces dependency requirements.

### 2. **Snapshot Management** (10 tests)
Tests snapshot capture, deduplication, throttling, and signature generation.

### 3. **Undo/Redo Operations** (12 tests)
Tests the core undo/redo functionality including edge cases.

### 4. **UI Integration** (8 tests)
Tests button state management and event listener setup.

### 5. **State Subscription** (6 tests)
Tests AppState subscription and automatic snapshot capture.

### 6. **Error Handling** (8 tests)
Tests fail-fast behavior and graceful degradation.

### 7. **Integration Tests** (6 tests)
Tests integration with AppState, AppGlobalState, and real workflows.

### 8. **Performance Tests** (4 tests)
Tests that operations complete within acceptable timeframes.

**Total: 62 tests**

---

## 🧪 Detailed Test Specifications

### 1. Initialization & Dependency Injection (8 tests)

#### Test 1.1: `setUndoRedoManagerDependencies configures dependencies`
**Purpose**: Verify dependency injection works correctly
**Setup**:
```javascript
const mockDeps = {
  AppState: { isReady: () => true },
  refreshUIFromState: () => {},
  AppGlobalState: { undoStack: [], redoStack: [] },
  getElementById: (id) => document.createElement('button'),
  safeAddEventListener: () => {}
};
```
**Action**: Call `setUndoRedoManagerDependencies(mockDeps)`
**Expected**: All dependencies assigned, console log shows configuration

---

#### Test 1.2: `assertInjected throws when dependency missing`
**Purpose**: Verify fail-fast behavior
**Setup**: Call function without setting dependencies
**Action**: Call any exported function that uses `assertInjected()`
**Expected**: Throws error with message about missing dependency

---

#### Test 1.3: `wireUndoRedoUI is idempotent`
**Purpose**: Verify multiple calls don't attach multiple listeners
**Setup**: Set dependencies, create DOM buttons
**Action**: Call `wireUndoRedoUI()` twice
**Expected**: Second call logs "already wired", no duplicate listeners

---

#### Test 1.4: `wireUndoRedoUI handles missing buttons gracefully`
**Purpose**: Verify graceful handling when DOM elements missing
**Setup**: Set dependencies but don't create DOM buttons
**Action**: Call `wireUndoRedoUI()`
**Expected**: Logs warning about missing buttons, doesn't throw

---

#### Test 1.5: `wireUndoRedoUI requires safeAddEventListener`
**Purpose**: Verify dependency enforcement
**Setup**: Set dependencies except `safeAddEventListener`, create DOM buttons
**Action**: Call `wireUndoRedoUI()`
**Expected**: Throws error about missing `safeAddEventListener`

---

#### Test 1.6: `initializeUndoRedoButtons sets hidden state`
**Purpose**: Verify buttons initialize to hidden/disabled
**Setup**: Create undo/redo buttons in DOM, set dependencies
**Action**: Call `initializeUndoRedoButtons()`
**Expected**: Both buttons have `hidden=true` and `disabled=true`

---

#### Test 1.7: `initializeUndoRedoButtons handles missing buttons`
**Purpose**: Verify graceful handling when buttons don't exist
**Setup**: Set dependencies but don't create buttons
**Action**: Call `initializeUndoRedoButtons()`
**Expected**: Completes without error, logs success

---

#### Test 1.8: `captureInitialSnapshot captures first snapshot`
**Purpose**: Verify initial snapshot capture works
**Setup**: Mock AppState with valid cycle data, set dependencies
**Action**: Call `captureInitialSnapshot()`
**Expected**: Snapshot added to undoStack, console log shows capture

---

### 2. Snapshot Management (10 tests)

#### Test 2.1: `captureStateSnapshot captures valid snapshot`
**Purpose**: Verify snapshot structure is correct
**Setup**: Mock AppState with cycle data, AppGlobalState with empty stacks
**Action**: Call `captureStateSnapshot(currentState)`
**Expected**: Snapshot contains `activeCycleId`, `tasks`, `title`, `autoReset`, `deleteCheckedTasks`, `timestamp`

---

#### Test 2.2: `captureStateSnapshot skips during initialization`
**Purpose**: Verify initialization guard works
**Setup**: Set `AppGlobalState.isInitializing = true`
**Action**: Call `captureStateSnapshot(validState)`
**Expected**: Logs "Skipping snapshot during initialization", no snapshot added

---

#### Test 2.3: `captureStateSnapshot throttles identical snapshots`
**Purpose**: Verify deduplication within 300ms window
**Setup**: Mock state, call capture with same state twice within 300ms
**Action**: Two rapid calls with identical state
**Expected**: Only first snapshot captured, second skipped

---

#### Test 2.4: `captureStateSnapshot allows different snapshots`
**Purpose**: Verify different snapshots are captured
**Setup**: Mock state with different task data
**Action**: Capture snapshot, modify tasks, capture again
**Expected**: Both snapshots added to stack

---

#### Test 2.5: `captureStateSnapshot respects UNDO_LIMIT (50)`
**Purpose**: Verify stack doesn't exceed limit
**Setup**: Pre-fill undoStack with 50 snapshots
**Action**: Capture one more snapshot
**Expected**: Stack length remains 50, oldest removed

---

#### Test 2.6: `captureStateSnapshot clears redoStack`
**Purpose**: Verify redo stack clears on new action
**Setup**: Pre-fill redoStack with snapshots
**Action**: Capture new snapshot
**Expected**: redoStack becomes empty array

---

#### Test 2.7: `buildSnapshotSignature generates consistent signature`
**Purpose**: Verify signature is deterministic
**Setup**: Create two identical snapshot objects
**Action**: Generate signatures for both
**Expected**: Signatures are identical

---

#### Test 2.8: `buildSnapshotSignature handles null input`
**Purpose**: Verify null handling
**Action**: Call `buildSnapshotSignature(null)`
**Expected**: Returns empty string

---

#### Test 2.9: `snapshotsEqual correctly compares snapshots`
**Purpose**: Verify equality detection
**Setup**: Create two identical snapshots and two different ones
**Action**: Compare identical pair and different pair
**Expected**: Returns true for identical, false for different

---

#### Test 2.10: `captureStateSnapshot uses structuredClone for deep copy`
**Purpose**: Verify snapshots don't share references
**Setup**: Capture snapshot, modify original state
**Action**: Verify snapshot unchanged
**Expected**: Snapshot tasks array is independent copy

---

### 3. Undo/Redo Operations (12 tests)

#### Test 3.1: `performStateBasedUndo restores previous state`
**Purpose**: Verify basic undo functionality
**Setup**: Capture snapshot, modify state, capture again
**Action**: Call `performStateBasedUndo()`
**Expected**: State restored to first snapshot, refreshUIFromState called

---

#### Test 3.2: `performStateBasedUndo moves snapshot to redoStack`
**Purpose**: Verify redo capability after undo
**Setup**: Capture snapshot, modify state
**Action**: Perform undo
**Expected**: Current state moved to redoStack

---

#### Test 3.3: `performStateBasedUndo skips duplicate snapshots`
**Purpose**: Verify duplicate skipping logic
**Setup**: Add identical snapshots to undoStack
**Action**: Perform undo
**Expected**: Logs show duplicates skipped, finds first different snapshot

---

#### Test 3.4: `performStateBasedUndo handles empty stack gracefully`
**Purpose**: Verify behavior when nothing to undo
**Setup**: Empty undoStack
**Action**: Call `performStateBasedUndo()`
**Expected**: Logs "Nothing to undo", doesn't throw

---

#### Test 3.5: `performStateBasedUndo sets isPerformingUndoRedo flag`
**Purpose**: Verify flag prevents recursive snapshots
**Setup**: Mock AppState with subscriber
**Action**: Perform undo, check flag during operation
**Expected**: Flag set during operation, cleared after

---

#### Test 3.6: `performStateBasedUndo requires AppState.isReady()`
**Purpose**: Verify readiness check
**Setup**: Mock AppState with `isReady: () => false`
**Action**: Attempt undo
**Expected**: Logs "AppState not ready", doesn't proceed

---

#### Test 3.7: `performStateBasedRedo restores next state`
**Purpose**: Verify basic redo functionality
**Setup**: Perform undo to populate redoStack
**Action**: Call `performStateBasedRedo()`
**Expected**: State moves forward, refreshUIFromState called

---

#### Test 3.8: `performStateBasedRedo moves snapshot to undoStack`
**Purpose**: Verify undo capability after redo
**Setup**: Undo once, then redo
**Action**: Check undoStack
**Expected**: Snapshot moved back to undoStack

---

#### Test 3.9: `performStateBasedRedo handles empty redoStack`
**Purpose**: Verify behavior when nothing to redo
**Setup**: Empty redoStack
**Action**: Call `performStateBasedRedo()`
**Expected**: Logs "Nothing to redo", doesn't throw

---

#### Test 3.10: `performStateBasedRedo skips duplicate snapshots`
**Purpose**: Verify duplicate handling in redo
**Setup**: Add identical snapshots to redoStack
**Action**: Perform redo
**Expected**: Skips duplicates, finds different snapshot

---

#### Test 3.11: `undo/redo preserves recurringTemplates`
**Purpose**: Verify recurring data not lost
**Setup**: State with recurringTemplates, capture, modify, undo
**Action**: Check restored state
**Expected**: recurringTemplates intact

---

#### Test 3.12: `undo/redo handles cycle switching`
**Purpose**: Verify cross-cycle undo works
**Setup**: Switch cycles, capture snapshots in each
**Action**: Undo across cycle boundaries
**Expected**: activeCycleId updated, correct cycle restored

---

### 4. UI Integration (8 tests)

#### Test 4.1: `updateUndoRedoButtons shows buttons when stack has items`
**Purpose**: Verify button visibility logic
**Setup**: Add item to undoStack, create buttons
**Action**: Call `updateUndoRedoButtons()`
**Expected**: Undo button `hidden=false`, `disabled=false`

---

#### Test 4.2: `updateUndoRedoButtons hides buttons when stack empty`
**Purpose**: Verify button hiding logic
**Setup**: Empty undoStack, create buttons
**Action**: Call `updateUndoRedoButtons()`
**Expected**: Undo button `hidden=true`, `disabled=true`

---

#### Test 4.3: `updateUndoRedoButtons sets opacity correctly`
**Purpose**: Verify visual feedback
**Setup**: Create buttons, populate stacks
**Action**: Call `updateUndoRedoButtons()` with empty and full stacks
**Expected**: Opacity is '0.5' when disabled, '1' when enabled

---

#### Test 4.4: `updateUndoRedoButtons handles missing buttons`
**Purpose**: Verify graceful handling
**Setup**: Don't create DOM buttons
**Action**: Call `updateUndoRedoButtons()`
**Expected**: Completes without error

---

#### Test 4.5: `wireUndoRedoUI attaches click handlers`
**Purpose**: Verify event listeners work
**Setup**: Set dependencies, create buttons
**Action**: Wire UI, simulate button click
**Expected**: Undo/redo functions called

---

#### Test 4.6: `wireUndoRedoUI logs success`
**Purpose**: Verify feedback
**Action**: Wire UI with valid setup
**Expected**: Console shows "Undo/redo UI wired"

---

#### Test 4.7: `button states update after undo`
**Purpose**: Verify automatic button updates
**Setup**: Perform undo operation
**Action**: Check button states
**Expected**: Redo button becomes visible

---

#### Test 4.8: `button states update after redo`
**Purpose**: Verify automatic button updates
**Setup**: Perform redo operation
**Action**: Check button states
**Expected**: Undo button remains visible

---

### 5. State Subscription (6 tests)

#### Test 5.1: `setupStateBasedUndoRedo subscribes to AppState`
**Purpose**: Verify subscription setup
**Setup**: Mock AppState with subscribe method
**Action**: Call `setupStateBasedUndoRedo()`
**Expected**: AppState.subscribe called with 'undo-system' key

---

#### Test 5.2: `state subscription captures snapshot on task change`
**Purpose**: Verify automatic snapshot capture
**Setup**: Set up subscription, modify tasks in AppState
**Action**: Trigger state update
**Expected**: Snapshot captured automatically

---

#### Test 5.3: `state subscription ignores changes during undo/redo`
**Purpose**: Verify flag prevents recursive captures
**Setup**: Set `isPerformingUndoRedo = true`
**Action**: Trigger state change
**Expected**: No snapshot captured

---

#### Test 5.4: `state subscription skips when wrapper active`
**Purpose**: Verify wrapper compatibility
**Setup**: Set `window.__useUpdateWrapper = true`
**Action**: Call `setupStateBasedUndoRedo()`
**Expected**: Logs "wrapper handles snapshots", no subscription

---

#### Test 5.5: `state subscription detects task changes`
**Purpose**: Verify change detection
**Setup**: Subscribe, modify task completion status
**Action**: Trigger state update
**Expected**: Snapshot captured (tasks changed)

---

#### Test 5.6: `state subscription detects title changes`
**Purpose**: Verify title tracking
**Setup**: Subscribe, modify cycle title
**Action**: Trigger state update
**Expected**: Snapshot captured (title changed)

---

### 6. Error Handling (8 tests)

#### Test 6.1: `missing AppState throws on performUndo`
**Purpose**: Verify fail-fast behavior
**Setup**: Don't inject AppState
**Action**: Call `performStateBasedUndo()`
**Expected**: Throws with "missing required dependency 'AppState'"

---

#### Test 6.2: `missing refreshUIFromState throws on performUndo`
**Purpose**: Verify fail-fast behavior
**Setup**: Inject all except refreshUIFromState
**Action**: Call `performStateBasedUndo()` with items in stack
**Expected**: Throws with "missing required dependency"

---

#### Test 6.3: `invalid state handled gracefully in captureSnapshot`
**Purpose**: Verify validation
**Setup**: Pass state without required properties
**Action**: Call `captureStateSnapshot(invalidState)`
**Expected**: Logs "Invalid state", no snapshot added

---

#### Test 6.4: `undo with corrupted snapshot logs error`
**Purpose**: Verify error recovery
**Setup**: Manually add invalid snapshot to stack
**Action**: Attempt undo
**Expected**: Error logged, operation completes safely

---

#### Test 6.5: `missing cycle in state handled gracefully`
**Purpose**: Verify null safety
**Setup**: State with activeCycleId but no matching cycle
**Action**: Capture snapshot
**Expected**: Early return, no error

---

#### Test 6.6: `setupStateBasedUndoRedo handles subscription failure`
**Purpose**: Verify error handling
**Setup**: Mock AppState.subscribe to throw
**Action**: Call setup
**Expected**: Logs warning, doesn't crash

---

#### Test 6.7: `performUndo handles update failure`
**Purpose**: Verify error propagation
**Setup**: Mock AppState.update to throw
**Action**: Call undo
**Expected**: Error logged and re-thrown, flag cleared in finally

---

#### Test 6.8: `performRedo handles update failure`
**Purpose**: Verify error propagation
**Setup**: Mock AppState.update to throw
**Action**: Call redo
**Expected**: Error logged and re-thrown, flag cleared in finally

---

### 7. Integration Tests (6 tests)

#### Test 7.1: `full undo/redo cycle with real AppState`
**Purpose**: End-to-end integration test
**Setup**: Real AppState instance, perform sequence of changes
**Action**: Add task → undo → redo → undo
**Expected**: State matches expected at each step

---

#### Test 7.2: `multiple undos in sequence`
**Purpose**: Verify stack behavior
**Setup**: Perform 5 changes, capture 5 snapshots
**Action**: Undo 3 times
**Expected**: State rolls back 3 steps

---

#### Test 7.3: `undo/redo with AppGlobalState interaction`
**Purpose**: Verify global state coordination
**Setup**: Real AppGlobalState with other properties
**Action**: Perform undo/redo
**Expected**: Only undo properties affected, others intact

---

#### Test 7.4: `enableUndoSystemOnFirstInteraction enables system`
**Purpose**: Verify first interaction detection
**Setup**: Set `AppGlobalState.isInitializing = true`
**Action**: Call `enableUndoSystemOnFirstInteraction()`
**Expected**: Flag set to false, logged

---

#### Test 7.5: `snapshot capture integrates with real task operations`
**Purpose**: Real-world scenario test
**Setup**: Add, edit, delete tasks with snapshots
**Action**: Undo each operation
**Expected**: Each operation correctly reversed

---

#### Test 7.6: `UI buttons reflect actual stack state`
**Purpose**: End-to-end UI test
**Setup**: Wire UI, perform operations
**Action**: Check button states at each step
**Expected**: Buttons always match stack state

---

### 8. Performance Tests (4 tests)

#### Test 8.1: `captureStateSnapshot completes quickly`
**Purpose**: Verify performance
**Setup**: Large cycle with 100 tasks
**Action**: Time snapshot capture
**Expected**: Completes in < 10ms

---

#### Test 8.2: `performUndo completes quickly`
**Purpose**: Verify performance
**Setup**: Large state, perform undo
**Action**: Time undo operation
**Expected**: Completes in < 50ms

---

#### Test 8.3: `buildSnapshotSignature is efficient`
**Purpose**: Verify signature generation speed
**Setup**: Large snapshot with 100 tasks
**Action**: Time signature generation
**Expected**: Completes in < 5ms

---

#### Test 8.4: `large undo stack (50 items) doesn't degrade performance`
**Purpose**: Verify scalability
**Setup**: Fill undoStack to limit
**Action**: Time capture and undo operations
**Expected**: No significant slowdown vs small stack

---

## 📊 Test Coverage Goals

| Category | Tests | Priority | Coverage Target |
|----------|-------|----------|-----------------|
| Initialization | 8 | 🔴 Critical | 100% |
| Snapshot Management | 10 | 🔴 Critical | 100% |
| Undo/Redo Operations | 12 | 🔴 Critical | 100% |
| UI Integration | 8 | 🟡 High | 100% |
| State Subscription | 6 | 🟡 High | 90% |
| Error Handling | 8 | 🔴 Critical | 100% |
| Integration | 6 | 🟡 High | 80% |
| Performance | 4 | 🟢 Medium | 75% |
| **TOTAL** | **62** | - | **95%+** |

---

## 🎯 Success Criteria

### Must Have (Critical)
- ✅ All dependency injection tests pass (fail-fast behavior verified)
- ✅ All snapshot capture/comparison tests pass (deduplication works)
- ✅ All undo/redo operation tests pass (core functionality works)
- ✅ All error handling tests pass (module fails gracefully)

### Should Have (High Priority)
- ✅ All UI integration tests pass (buttons work correctly)
- ✅ State subscription tests pass (automatic capture works)
- ✅ Integration tests show real-world usage works

### Nice to Have (Medium Priority)
- ✅ Performance tests show acceptable speed
- ✅ 95%+ overall test coverage
- ✅ Tests complete in < 5 seconds total

---

## 🛠️ Test Implementation Strategy

### Phase 1: Core Tests (Week 1)
1. Set up test file structure following `cycleSwitcher.tests.js` pattern
2. Implement Initialization tests (8 tests)
3. Implement Snapshot Management tests (10 tests)
4. Implement Undo/Redo Operations tests (12 tests)
5. **Checkpoint**: 30 tests passing

### Phase 2: Integration Tests (Week 1)
1. Implement UI Integration tests (8 tests)
2. Implement State Subscription tests (6 tests)
3. Implement Error Handling tests (8 tests)
4. **Checkpoint**: 52 tests passing

### Phase 3: Advanced Tests (Week 2)
1. Implement Integration tests (6 tests)
2. Implement Performance tests (4 tests)
3. Fix any failing tests
4. **Checkpoint**: All 62 tests passing

### Phase 4: Refinement (Week 2)
1. Review test coverage reports
2. Add edge case tests if needed
3. Optimize slow tests
4. Document test patterns for future modules
5. **Final Goal**: 95%+ coverage, all tests passing

---

## 🔍 Testing Patterns to Follow

Based on `cycleSwitcher.tests.js`, follow these conventions:

### Test Structure
```javascript
export async function runUndoRedoManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔄 UndoRedoManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Import the module
    // Note: undoRedoManager uses Strict Injection, so we import functions directly
    const {
        setUndoRedoManagerDependencies,
        wireUndoRedoUI,
        // ... other exports
    } = await import('../utilities/ui/undoRedoManager.js');

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment
            localStorage.clear();

            // Create mock dependencies
            const mockDeps = { /* ... */ };
            setUndoRedoManagerDependencies(mockDeps);

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        }
    }

    // Test sections
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization Tests</h4>';
    await test('test name', async () => { /* test logic */ });

    // Summary
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    return { passed: passed.count, total: total.count };
}
```

### Mock Patterns

#### Mock AppState
```javascript
const mockAppState = {
    isReady: () => true,
    get: () => ({
        metadata: { version: "2.5" },
        data: {
            cycles: {
                'Test Cycle': {
                    title: 'Test Cycle',
                    tasks: [
                        { id: 'task-1', text: 'Task 1', completed: false }
                    ],
                    autoReset: false,
                    deleteCheckedTasks: false
                }
            }
        },
        appState: { activeCycleId: 'Test Cycle' }
    }),
    update: (updateFn, immediate) => {
        const state = mockAppState.get();
        updateFn(state);
        return Promise.resolve();
    },
    subscribe: (key, callback) => {
        // Store callback for testing
        mockAppState._subscribers = mockAppState._subscribers || {};
        mockAppState._subscribers[key] = callback;
    }
};
```

#### Mock AppGlobalState
```javascript
const mockAppGlobalState = {
    undoStack: [],
    redoStack: [],
    isInitializing: false,
    isPerformingUndoRedo: false,
    lastSnapshotSignature: null,
    lastSnapshotTs: 0,
    __undoRedoWired: false
};
```

#### Mock DOM Helpers
```javascript
const mockGetElementById = (id) => {
    const element = document.createElement('button');
    element.id = id;
    return element;
};

const mockSafeAddEventListener = (element, event, handler) => {
    element.addEventListener(event, handler);
};
```

---

## 📝 Notes for Implementation

### Key Testing Challenges

1. **Async Operations**: Undo/redo operations are async and include `setTimeout(0)` for rendering
   - Use `await new Promise(resolve => setTimeout(resolve, 0))` in tests

2. **State Cloning**: Use `structuredClone()` for deep copies
   - Verify snapshots are independent copies

3. **Deduplication Logic**: Complex signature generation
   - Test with identical and subtly different states

4. **Timing/Throttling**: 300ms minimum interval for snapshots
   - Use `await new Promise(resolve => setTimeout(resolve, 300))` to test throttling

5. **Idempotent Guards**: `__undoRedoWired` flag prevents duplicate setup
   - Test multiple calls to wireUndoRedoUI()

### Common Mock Setups

Store reusable mock factories in test file:
```javascript
function createMockDependencies() {
    return {
        AppState: createMockAppState(),
        refreshUIFromState: () => {},
        AppGlobalState: createMockAppGlobalState(),
        getElementById: mockGetElementById,
        safeAddEventListener: mockSafeAddEventListener
    };
}
```

### Console Output in Tests

The module logs extensively. Consider:
- Spy on console methods to verify logs
- Or ignore console output in test environment
- Check for specific log messages in critical tests

---

## 🎓 Lessons from Similar Modules

From `cycleSwitcher.tests.js`:
- ✅ Test with and without dependencies (resilient pattern)
- ✅ Test DOM element missing scenarios
- ✅ Test debouncing/throttling with timing
- ✅ Test performance with `performance.now()`
- ✅ Group tests by category with clear headers
- ✅ Mock Schema 2.5 data structure correctly
- ✅ Clean up after each test (clear localStorage, remove DOM elements)

From docs `minicycle_modularization_guide_v3.md`:
- ✅ Test complete function implementations, not skeletons
- ✅ Verify helper functions are actually defined
- ✅ Test explicit DOM refresh after state changes
- ✅ Use optional chaining for deferred function resolution

---

## ✅ Next Steps

1. **Review this plan** with team
2. **Create test file**: `tests/undoRedoManager.tests.js`
3. **Implement tests** following the pattern above
4. **Run tests** and iterate
5. **Document results** in test suite HTML

---

## 📚 References

- Module: `/utilities/ui/undoRedoManager.js` (463 lines)
- Pattern Guide: `/docs/minicycle_modularization_guide_v3.md` (Strict Injection 🔧)
- Example Tests: `/tests/cycleSwitcher.tests.js` (651 lines, 22 tests)
- Test Suite: `/tests/module-test-suite.html`

---

**Total Tests Planned**: 62
**Estimated Time**: 2 weeks
**Expected Coverage**: 95%+
**Pattern**: Strict Injection 🔧 (fail-fast, explicit dependencies)
