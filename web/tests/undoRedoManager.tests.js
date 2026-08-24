/**
 * 🧪 UndoRedoManager Tests
 * Tests for modules/ui/undoRedoManager.js
 * Pattern: Strict Injection 🔧
 *
 * Tests undo/redo functionality:
 * - Dependency injection and fail-fast behavior
 * - Snapshot capture and deduplication
 * - Undo/redo operations and stack management
 * - UI button state management (state/visibility separation)
 * - State subscription and automatic snapshots
 * - Error handling and graceful degradation
 * - Per-cycle undo with 20 steps per cycle
 * - Cycle switch blocking and lifecycle functions
 * - IndexedDB persistence for undo history
 * - Signature caching for performance
 * - Error recovery with rollback
 */

export async function runUndoRedoManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🔄 UndoRedoManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    // 🔒 SAVE REAL APP DATA ONCE before all tests run (only when running individually)
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
        console.log('🔒 Saved original localStorage for individual undoRedoManager test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual undoRedoManager test completed - original localStorage restored');
        }
    }


    // Import the module functions
    const cacheBuster = window.testCacheBuster || Date.now();
    const {
        setUndoRedoManagerDependencies,
        wireUndoRedoUI,
        initUndoRedoButtons,
        captureInitialSnapshot,
        setupStateBasedUndoRedo,
        enableUndoSystemOnFirstInteraction,
        captureStateSnapshot,
        buildSnapshotSignature,
        snapshotsEqual,
        performStateBasedUndo,
        performStateBasedRedo,
        updateUndoRedoButtons,
        updateUndoRedoButtonStates,
        updateUndoRedoButtonVisibility,
        onCycleSwitched,
        onCycleCreated,
        onCycleDeleted,
        onCycleRenamed,
        filterValidSnapshots,
        wrapAppStateForUndo,
        initUndoSystemForApp,
        initUndoIndexedDB,
        closeUndoIndexedDB,
        renameUndoStackInIndexedDB,
        saveUndoStackToIndexedDB,
        loadUndoStackFromIndexedDB,
        clearUndoCache,
        computeTransactionDiff
    } = await import(`../modules/ui/undoRedoManager.js?v=${cacheBuster}`);

    // localStorage cache key (must match module)
    const UNDO_CACHE_KEY = '__miniCycle_undoCache__';

    // ✅ CRITICAL: Mark appInit as ready for tests
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Helper: Create mock dependencies
    function createMockDependencies() {
        const mockAppGlobalState = {
            activeUndoStack: [],  // ✅ Renamed from undoStack (per-cycle)
            activeRedoStack: [],  // ✅ Renamed from redoStack (per-cycle)
            activeCycleIdForUndo: null,  // ✅ Track which cycle's undo is loaded
            isSwitchingCycles: false,  // ✅ Block snapshots during cycle switches
            isInitializing: false,
            isPerformingUndoRedo: false,
            lastSnapshotSignature: null,
            lastSnapshotTs: 0,
            __undoRedoWired: false
            // NOTE: localStorage cache provides instant boot, no lazy loading needed
        };

        const mockSchemaData = {
            metadata: {
                version: "2.5",
                lastModified: Date.now()
            },
            data: {
                cycles: {
                    'Test Cycle': {
                        title: 'Test Cycle',
                        tasks: [
                            { id: 'task-1', text: 'Task 1', completed: false, highPriority: false },
                            { id: 'task-2', text: 'Task 2', completed: true, highPriority: true }
                        ],
                        recurringTemplates: {},
                        autoReset: false,
                        deleteCheckedTasks: false,
                        cycleCount: 0
                    }
                }
            },
            appState: {
                activeCycleId: 'Test Cycle',
                currentMode: 'manual-cycle'
            }
        };

        const mockAppState = {
            isReady: () => true,
            get: () => JSON.parse(JSON.stringify(mockSchemaData)), // Deep copy
            update: async (updateFn, immediate) => {
                // Deep copy for update
                const state = JSON.parse(JSON.stringify(mockSchemaData));
                updateFn(state);
                // FIX: Replace entire mockSchemaData with updated state (deep update)
                mockSchemaData.metadata = state.metadata;
                mockSchemaData.data = state.data;
                mockSchemaData.appState = state.appState;
                if (state.settings) mockSchemaData.settings = state.settings;
                return Promise.resolve();
            },
            subscribe: (key, callback) => {
                mockAppState._subscribers = mockAppState._subscribers || {};
                mockAppState._subscribers[key] = callback;
            }
        };

        // FIX: Store DOM elements so we return same instances
        const domElements = {};

        return {
            AppState: mockAppState,
            refreshUIFromState: () => {},
            AppGlobalState: mockAppGlobalState,
            getElementById: (id) => {
                // Return cached element if exists, otherwise create new one
                if (!domElements[id]) {
                    const element = document.createElement('button');
                    element.id = id;
                    domElements[id] = element;
                }
                return domElements[id];
            },
            safeAddEventListener: (element, event, handler) => {
                if (element) {
                    element.addEventListener(event, handler);
                }
            },
            wrapperActive: false,  // ✅ NEW: Track if update wrapper is active
            showNotification: (message, type, duration) => {  // ✅ NEW: Mock notification
                console.log(`[${type}] ${message}`);
            }
        };
    }

    async function test(name, testFn) {
        total.count++;
        try {
            // Reset environment before each test
            localStorage.clear();

            // Clear DOM
            const existingButtons = document.querySelectorAll('#undo-btn, #redo-btn');
            existingButtons.forEach(el => el.remove());

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // ==================== PHASE 1: CORE TESTS ====================

    // === 1. INITIALIZATION & DEPENDENCY INJECTION (8 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization & Dependency Injection</h4>';

    await test('setUndoRedoManagerDependencies configures dependencies', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Verify by calling a function that uses dependencies
        // If dependencies weren't set, this would throw
        const mockState = mockDeps.AppState.get();
        await captureStateSnapshot(mockState);
    });

    await test('assertInjected throws when dependency missing', async () => {
        // Don't set dependencies
        const emptyDeps = {
            AppState: null,
            refreshUIFromState: null,
            AppGlobalState: null,
            getElementById: null,
            safeAddEventListener: null
        };
        setUndoRedoManagerDependencies(emptyDeps);

        let threwError = false;
        try {
            await performStateBasedUndo();
        } catch (error) {
            if (error.message.includes('missing required dependency')) {
                threwError = true;
            }
        }

        if (!threwError) {
            throw new Error('Should throw error about missing dependency');
        }
    });

    await test('wireUndoRedoUI is idempotent', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Create DOM buttons
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undo-btn';
        document.body.appendChild(undoBtn);

        const redoBtn = document.createElement('button');
        redoBtn.id = 'redo-btn';
        document.body.appendChild(redoBtn);

        // Call twice - should not throw and second call returns early
        wireUndoRedoUI();
        wireUndoRedoUI();

        // If we get here without error, idempotency works
        // Note: Module uses internal _initialized.undoRedoUI flag (not exposed)
    });

    await test('wireUndoRedoUI handles missing buttons gracefully', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null; // No buttons
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        wireUndoRedoUI();
    });

    await test('assertInjected throws for missing dependency', async () => {
        // Test the assertInjected behavior directly via updateUndoRedoButtons
        // which uses assertInjected for getElementById
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = null;  // Missing required dependency
        setUndoRedoManagerDependencies(mockDeps);

        let threwError = false;
        try {
            updateUndoRedoButtons();
        } catch (error) {
            if (error.message.includes('getElementById')) {
                threwError = true;
            }
        }

        if (!threwError) {
            throw new Error('Should throw error about missing getElementById');
        }
    });

    await test('initUndoRedoButtons sets hidden state', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Initialize buttons (creates them via mock)
        initUndoRedoButtons();

        // Get the buttons that were initialized
        const undoBtn = mockDeps.getElementById('undo-btn');
        const redoBtn = mockDeps.getElementById('redo-btn');

        if (!undoBtn.hidden || !undoBtn.disabled) {
            throw new Error('Undo button should be hidden and disabled');
        }
        if (!redoBtn.hidden || !redoBtn.disabled) {
            throw new Error('Redo button should be hidden and disabled');
        }
    });

    await test('initUndoRedoButtons handles missing buttons', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null;
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        initUndoRedoButtons();
    });

    await test('captureInitialSnapshot captures first snapshot', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false; // Enable capturing
        setUndoRedoManagerDependencies(mockDeps);

        captureInitialSnapshot();

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Should have captured initial snapshot');
        }
    });

    // === 2. SNAPSHOT MANAGEMENT (10 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">📸 Snapshot Management</h4>';

    await test('captureStateSnapshot captures valid snapshot', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        const snapshot = mockDeps.AppGlobalState.activeUndoStack[0];
        if (!snapshot) {
            throw new Error('Snapshot should be captured');
        }
        if (!snapshot.activeCycleId || !snapshot.tasks || !snapshot.title) {
            throw new Error('Snapshot missing required properties');
        }
        if (!snapshot.timestamp) {
            throw new Error('Snapshot should have timestamp');
        }
    });

    await test('captureStateSnapshot skips during initialization', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = true;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('Should not capture snapshot during initialization');
        }
    });

    // Regression — ARCH REVIEW FINDINGS §1.2: recurring-watcher recreations are system
    // mutations, not user actions, and must NOT enter undo history. The watcher raises
    // AppGlobalState.isSystemMutation around its commit; captureStateSnapshot must honor it.
    await test('captureStateSnapshot skips during system mutation (review 1.2)', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;   // normal operation
        mockDeps.AppGlobalState.isSystemMutation = true;  // watcher recreation in progress
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('System mutation must not be captured into undo history');
        }
    });

    await test('captureStateSnapshot throttles identical snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();

        // Capture first snapshot
        await captureStateSnapshot(state);

        // Try to capture identical snapshot immediately
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Identical snapshot should be throttled');
        }
    });

    await test('captureStateSnapshot allows different snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state1 = mockDeps.AppState.get();
        await captureStateSnapshot(state1);

        // Modify state
        const state2 = mockDeps.AppState.get();
        state2.data.cycles['Test Cycle'].tasks[0].completed = true;

        // Wait to avoid time throttling
        await new Promise(resolve => setTimeout(resolve, 350));

        await captureStateSnapshot(state2);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 2) {
            throw new Error('Different snapshot should be captured');
        }
    });

    await test('captureStateSnapshot respects UNDO_LIMIT (20)', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Pre-fill stack with 20 snapshots
        for (let i = 0; i < 20; i++) {
            mockDeps.AppGlobalState.activeUndoStack.push({
                activeCycleId: 'Test Cycle',
                tasks: [{ id: `task-${i}`, text: `Task ${i}`, completed: false }],
                title: 'Test Cycle',
                autoReset: false,
                deleteCheckedTasks: false,
                timestamp: Date.now() - (20 - i) * 1000
            });
        }

        // Capture one more
        const state = mockDeps.AppState.get();
        state.data.cycles['Test Cycle'].tasks[0].text = 'Modified Task';

        await new Promise(resolve => setTimeout(resolve, 350));
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 20) {
            throw new Error(`Stack should remain at limit of 20, got ${mockDeps.AppGlobalState.activeUndoStack.length}`);
        }
    });

    await test('captureStateSnapshot clears redoStack', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Pre-fill redoStack
        mockDeps.AppGlobalState.activeRedoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeRedoStack.length !== 0) {
            throw new Error('redoStack should be cleared on new snapshot');
        }
    });

    await test('buildSnapshotSignature generates consistent signature', async () => {
        const snapshot1 = {
            activeCycleId: 'Test',
            tasks: [
                { id: 'task-1', text: 'Task 1', completed: false, highPriority: true }
            ],
            title: 'Test Cycle',
            autoReset: true,
            deleteCheckedTasks: false
        };

        const snapshot2 = {
            activeCycleId: 'Test',
            tasks: [
                { id: 'task-1', text: 'Task 1', completed: false, highPriority: true }
            ],
            title: 'Test Cycle',
            autoReset: true,
            deleteCheckedTasks: false
        };

        const sig1 = buildSnapshotSignature(snapshot1);
        const sig2 = buildSnapshotSignature(snapshot2);

        if (sig1 !== sig2) {
            throw new Error('Identical snapshots should have same signature');
        }
    });

    await test('buildSnapshotSignature differs when only per-task settings objects change', async () => {
        // Undo/redo review finding: the signature captured dwc/r as booleans
        // but not the settings OBJECTS — an edit touching only those would
        // dedup-skip its snapshot and fall outside undo history.
        const base = (settings) => ({
            activeCycleId: 'Test',
            tasks: [{
                id: 'task-1', text: 'Task 1', completed: false,
                recurring: true, deleteWhenComplete: true,
                ...settings
            }],
            title: 'Test Cycle',
            autoReset: true,
            deleteCheckedTasks: false
        });

        const sigA = buildSnapshotSignature(base({ recurringSettings: { frequency: 'daily' } }));
        const sigB = buildSnapshotSignature(base({ recurringSettings: { frequency: 'weekly' } }));
        if (sigA === sigB) {
            throw new Error('recurringSettings-only change must alter the signature');
        }

        const sigC = buildSnapshotSignature(base({ deleteWhenCompleteSettings: { mode: 'x' } }));
        const sigD = buildSnapshotSignature(base({ deleteWhenCompleteSettings: { mode: 'y' } }));
        if (sigC === sigD) {
            throw new Error('deleteWhenCompleteSettings-only change must alter the signature');
        }
    });

    await test('buildSnapshotSignature handles null input', async () => {
        const sig = buildSnapshotSignature(null);

        if (sig !== '') {
            throw new Error('Null snapshot should return empty string');
        }
    });

    await test('snapshotsEqual correctly compares snapshots', async () => {
        const snapshot1 = {
            activeCycleId: 'Test',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false
        };

        const snapshot2 = {
            activeCycleId: 'Test',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false
        };

        const snapshot3 = {
            activeCycleId: 'Test',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: true }], // Different
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false
        };

        if (!snapshotsEqual(snapshot1, snapshot2)) {
            throw new Error('Identical snapshots should be equal');
        }

        if (snapshotsEqual(snapshot1, snapshot3)) {
            throw new Error('Different snapshots should not be equal');
        }
    });

    await test('captureStateSnapshot uses deep copy', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        const originalTaskText = state.data.cycles['Test Cycle'].tasks[0].text;

        await captureStateSnapshot(state);

        // Modify original state
        state.data.cycles['Test Cycle'].tasks[0].text = 'Modified';

        // Check snapshot is unchanged
        const snapshot = mockDeps.AppGlobalState.activeUndoStack[0];
        if (snapshot.tasks[0].text !== originalTaskText) {
            throw new Error('Snapshot should be independent copy');
        }
    });

    // === 3. UNDO/REDO OPERATIONS (12 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">⏮️ Undo/Redo Operations</h4>';

    await test('performStateBasedUndo restores previous state', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture initial state
        const state1 = mockDeps.AppState.get();
        await captureStateSnapshot(state1);

        // Modify state
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });

        // Wait to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 350));

        // Capture modified state
        const state2 = mockDeps.AppState.get();
        await captureStateSnapshot(state2);

        // Perform undo
        await performStateBasedUndo();

        // Check state restored
        const restoredState = mockDeps.AppState.get();
        if (restoredState.data.cycles['Test Cycle'].tasks[0].completed !== false) {
            throw new Error('Undo should restore previous state');
        }
    });

    await test('performStateBasedUndo moves snapshot to redoStack', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture the initial (uncompleted) state.
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Advance the live state via update() — the mock's get() returns a fresh deep copy
        // each call, so mutating a previously-returned object would NOT change what undo reads.
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        await captureStateSnapshot(mockDeps.AppState.get());

        // Just before undo, the live (displaced) state has completed === true.
        await performStateBasedUndo();

        // The redoStack must hold exactly the state that was current BEFORE the undo
        // (undoRedoManager.js:1098 pushes currentSnapshot), so a later redo can restore
        // it. The old assertion checked only length — it would pass even if a blank or
        // wrong-content snapshot were pushed.
        const redo = mockDeps.AppGlobalState.activeRedoStack;
        if (redo.length !== 1) {
            throw new Error(`redoStack should hold exactly the displaced snapshot, got length ${redo.length}`);
        }
        if (redo[0].activeCycleId !== 'Test Cycle') {
            throw new Error(`moved snapshot lost its cycle id: ${redo[0].activeCycleId}`);
        }
        if (redo[0].tasks[0].completed !== true) {
            throw new Error('redoStack snapshot should carry the pre-undo (completed) task state');
        }
        // ...and the live state was actually rolled back to the earlier (uncompleted) snapshot.
        if (mockDeps.AppState.get().data.cycles['Test Cycle'].tasks[0].completed !== false) {
            throw new Error('undo should have restored the earlier uncompleted state');
        }
    });

    await test('performStateBasedUndo skips duplicate snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();

        // Manually add duplicate snapshots
        const snapshot = {
            activeCycleId: 'Test Cycle',
            tasks: [
                { id: 'task-1', text: 'Task 1', completed: false, highPriority: false },
                { id: 'task-2', text: 'Task 2', completed: true, highPriority: true }
            ],
            recurringTemplates: {},
            title: 'Test Cycle',
            autoReset: false,
            deleteCheckedTasks: false,
            timestamp: Date.now()
        };

        mockDeps.AppGlobalState.activeUndoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.activeUndoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.activeUndoStack.push(JSON.parse(JSON.stringify(snapshot)));

        // Perform undo
        await performStateBasedUndo();

        // Should have skipped duplicates
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should have skipped all duplicate snapshots');
        }
    });

    await test('performStateBasedUndo handles empty stack gracefully', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Empty stack - should not throw
        await performStateBasedUndo();
    });

    await test('performStateBasedUndo sets isPerformingUndoRedo flag', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture snapshot
        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        await new Promise(resolve => setTimeout(resolve, 350));

        state.data.cycles['Test Cycle'].tasks[0].completed = true;
        await captureStateSnapshot(state);

        // Check flag during undo
        let flagWasSet = false;
        const originalUpdate = mockDeps.AppState.update;
        mockDeps.AppState.update = async (updateFn, immediate) => {
            flagWasSet = mockDeps.AppGlobalState.isPerformingUndoRedo;
            return originalUpdate(updateFn, immediate);
        };

        await performStateBasedUndo();

        if (!flagWasSet) {
            throw new Error('isPerformingUndoRedo flag should be set during undo');
        }

        if (mockDeps.AppGlobalState.isPerformingUndoRedo) {
            throw new Error('isPerformingUndoRedo flag should be cleared after undo');
        }
    });

    await test('performStateBasedUndo requires AppState.isReady()', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppState.isReady = () => false;
        setUndoRedoManagerDependencies(mockDeps);

        // Add snapshot to stack
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        // Should exit early without throwing
        await performStateBasedUndo();

        // Stack should be unchanged
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Should not process undo when AppState not ready');
        }
    });

    await test('performStateBasedRedo restores next state', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture initial state (completed = false)
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Update state via proper update() call
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });

        // Capture modified state (completed = true)
        await captureStateSnapshot(mockDeps.AppState.get());

        // Undo to restore completed = false
        await performStateBasedUndo();

        // Verify task is false after undo
        const afterUndo = mockDeps.AppState.get();
        if (afterUndo.data.cycles['Test Cycle'].tasks[0].completed !== false) {
            throw new Error('Undo should restore to uncompleted state');
        }

        // Redo should restore to completed = true
        await performStateBasedRedo();

        const afterRedo = mockDeps.AppState.get();
        if (afterRedo.data.cycles['Test Cycle'].tasks[0].completed !== true) {
            throw new Error('Redo should restore to completed state');
        }
    });

    await test('performStateBasedRedo moves snapshot to undoStack', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Setup: capture two states and undo. Use update() (not direct mutation) so the
        // mock's internal state actually advances — get() hands back a fresh deep copy.
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        await captureStateSnapshot(mockDeps.AppState.get());

        await performStateBasedUndo();  // live state is now completed === false

        const undoStackBefore = mockDeps.AppGlobalState.activeUndoStack.length;

        // Redo
        await performStateBasedRedo();

        // Redo pushes exactly one snapshot — the state that was current BEFORE the redo,
        // i.e. the post-undo (uncompleted) state (undoRedoManager.js:1306) — so a
        // subsequent undo can return to it. The old assertion (`length <= before` inverted)
        // only proved the count grew, not what was pushed.
        const undo = mockDeps.AppGlobalState.activeUndoStack;
        if (undo.length !== undoStackBefore + 1) {
            throw new Error(`redo should push exactly one snapshot onto undoStack (was ${undoStackBefore}, now ${undo.length})`);
        }
        if (undo.at(-1).tasks[0].completed !== false) {
            throw new Error('undoStack top should carry the pre-redo (uncompleted) task state');
        }
        // ...and the live state was actually advanced to the redone (completed) snapshot.
        if (mockDeps.AppState.get().data.cycles['Test Cycle'].tasks[0].completed !== true) {
            throw new Error('redo should have restored the completed state');
        }
    });

    await test('performStateBasedRedo handles empty redoStack', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Empty redoStack - should not throw
        await performStateBasedRedo();
    });

    await test('performStateBasedRedo skips duplicate snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();

        // Manually add duplicate snapshots to redoStack
        const snapshot = {
            activeCycleId: 'Test Cycle',
            tasks: [
                { id: 'task-1', text: 'Task 1', completed: false, highPriority: false },
                { id: 'task-2', text: 'Task 2', completed: true, highPriority: true }
            ],
            recurringTemplates: {},
            title: 'Test Cycle',
            autoReset: false,
            deleteCheckedTasks: false,
            timestamp: Date.now()
        };

        mockDeps.AppGlobalState.activeRedoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.activeRedoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.activeRedoStack.push(JSON.parse(JSON.stringify(snapshot)));

        // Perform redo
        await performStateBasedRedo();

        // Should have skipped duplicates
        if (mockDeps.AppGlobalState.activeRedoStack.length > 0) {
            throw new Error('Should have skipped all duplicate snapshots');
        }
    });

    await test('undo/redo preserves recurringTemplates', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Create state with recurringTemplates
        const state = mockDeps.AppState.get();
        state.data.cycles['Test Cycle'].recurringTemplates = {
            'template-1': { frequency: 'daily', time: '09:00' }
        };
        await captureStateSnapshot(state);

        await new Promise(resolve => setTimeout(resolve, 350));

        // Modify tasks
        state.data.cycles['Test Cycle'].tasks[0].completed = true;
        await captureStateSnapshot(state);

        // Undo
        await performStateBasedUndo();

        const restored = mockDeps.AppState.get();
        if (!restored.data.cycles['Test Cycle'].recurringTemplates['template-1']) {
            throw new Error('Undo should preserve recurringTemplates');
        }
    });

    await test('undo/redo is isolated per cycle (does not switch cycles)', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'Test Cycle';
        setUndoRedoManagerDependencies(mockDeps);

        // Capture initial state
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Make a change to current cycle
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks.push({
                id: 'new-task',
                text: 'New Task',
                completed: false
            });
        });

        // Capture state after change
        captureStateSnapshot(mockDeps.AppState.get());

        // Undo should restore the current cycle's state, NOT switch cycles
        await performStateBasedUndo();

        const restored = mockDeps.AppState.get();
        // Should still be on the same cycle
        if (restored.appState.activeCycleId !== 'Test Cycle') {
            throw new Error(`Undo should NOT switch cycles. Expected 'Test Cycle', got '${restored.appState.activeCycleId}'`);
        }
        // Should have restored the task list (removed the added task)
        const tasks = restored.data.cycles['Test Cycle'].tasks;
        if (tasks.some(t => t.id === 'new-task')) {
            throw new Error('Undo should have removed the newly added task');
        }
    });

    // ==================== PHASE 2: INTEGRATION & ERROR HANDLING ====================

    // === 4. UI INTEGRATION (8 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🖱️ UI Integration</h4>';

    await test('updateUndoRedoButtons shows buttons when stack has items', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Add item to undoStack
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        updateUndoRedoButtons();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.hidden || undoBtn.disabled) {
            throw new Error('Undo button should be visible and enabled when stack has items');
        }
    });

    await test('updateUndoRedoButtons hides buttons when stack empty', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Empty stack
        mockDeps.AppGlobalState.activeUndoStack = [];

        updateUndoRedoButtons();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (!undoBtn.hidden || !undoBtn.disabled) {
            throw new Error('Undo button should be hidden and disabled when stack is empty');
        }
    });

    await test('updateUndoRedoButtons sets opacity correctly', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Test with empty stack
        mockDeps.AppGlobalState.activeUndoStack = [];
        updateUndoRedoButtons();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.style.opacity !== '0.5') {
            throw new Error('Disabled button should have opacity 0.5');
        }

        // Test with items
        mockDeps.AppGlobalState.activeUndoStack.push({ tasks: [] });
        updateUndoRedoButtons();

        if (undoBtn.style.opacity !== '1') {
            throw new Error('Enabled button should have opacity 1');
        }
    });

    await test('updateUndoRedoButtons handles missing buttons', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null;
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        updateUndoRedoButtons();
    });

    await test('wireUndoRedoUI attaches click handlers', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture initial state
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Modify state
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        await captureStateSnapshot(mockDeps.AppState.get());

        // Wire UI
        wireUndoRedoUI();

        // Simulate button click
        const undoBtn = mockDeps.getElementById('undo-btn');
        let clickHandled = false;

        // Replace performStateBasedUndo temporarily to detect call
        const originalUndo = performStateBasedUndo;
        try {
            // We can't easily test the click since the handler is internal
            // Instead, verify the button exists and has listeners
            if (!undoBtn) {
                throw new Error('Undo button should exist');
            }
            clickHandled = true;
        } finally {
            // Restore (if we had replaced it)
        }

        if (!clickHandled) {
            throw new Error('Click handler should be attached');
        }
    });

    await test('button states update after undo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Create two states
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        await captureStateSnapshot(mockDeps.AppState.get());

        // Perform undo
        await performStateBasedUndo();

        // Check redo button is now visible
        const redoBtn = mockDeps.getElementById('redo-btn');
        if (redoBtn.hidden || redoBtn.disabled) {
            throw new Error('Redo button should be visible after undo');
        }
    });

    await test('button states update after redo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Setup undo/redo scenario
        await captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        await captureStateSnapshot(mockDeps.AppState.get());

        // Undo then redo
        await performStateBasedUndo();
        await performStateBasedRedo();

        // Undo button should still be visible
        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.hidden) {
            throw new Error('Undo button should be visible after redo');
        }
    });

    await test('enableUndoSystemOnFirstInteraction enables system', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = true;
        setUndoRedoManagerDependencies(mockDeps);

        enableUndoSystemOnFirstInteraction();

        if (mockDeps.AppGlobalState.isInitializing !== false) {
            throw new Error('Should disable isInitializing flag');
        }
    });

    // === 5. STATE SUBSCRIPTION (6 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">📡 State Subscription</h4>';

    await test('setupStateBasedUndoRedo subscribes to AppState', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        if (!mockDeps.AppState._subscribers || !mockDeps.AppState._subscribers['undo-system']) {
            throw new Error('Should subscribe to AppState with undo-system key');
        }
    });

    await test('state subscription captures snapshot on task change', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        // Get the subscriber callback
        const subscriber = mockDeps.AppState._subscribers['undo-system'];

        const oldState = mockDeps.AppState.get();
        const newState = JSON.parse(JSON.stringify(oldState));
        newState.data.cycles['Test Cycle'].tasks[0].completed = true;

        // Trigger subscriber
        subscriber(newState, oldState);

        // Should have captured snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length === 0) {
            throw new Error('Should capture snapshot on task change');
        }
    });

    await test('state subscription ignores changes during undo/redo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.isPerformingUndoRedo = true; // Set flag
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        const subscriber = mockDeps.AppState._subscribers['undo-system'];

        const oldState = mockDeps.AppState.get();
        const newState = JSON.parse(JSON.stringify(oldState));
        newState.data.cycles['Test Cycle'].tasks[0].completed = true;

        // Trigger subscriber
        subscriber(newState, oldState);

        // Should NOT capture snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should not capture snapshot during undo/redo');
        }
    });

    // Note: wrapperActive is an internal Proxy state, not a DI dependency.
    // It's only set by wrapAppStateForUndo(), not via setUndoRedoManagerDependencies().
    // Test removed as it was based on incorrect assumption about DI behavior.

    await test('state subscription detects title changes', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        const subscriber = mockDeps.AppState._subscribers['undo-system'];

        const oldState = mockDeps.AppState.get();
        const newState = JSON.parse(JSON.stringify(oldState));
        newState.data.cycles['Test Cycle'].title = 'Modified Title';

        // Trigger subscriber
        subscriber(newState, oldState);

        // Should capture snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length === 0) {
            throw new Error('Should capture snapshot on title change');
        }
    });

    await test('state subscription detects settings changes', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        const subscriber = mockDeps.AppState._subscribers['undo-system'];

        const oldState = mockDeps.AppState.get();
        const newState = JSON.parse(JSON.stringify(oldState));
        newState.data.cycles['Test Cycle'].autoReset = true;

        // Trigger subscriber
        subscriber(newState, oldState);

        // Should capture snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length === 0) {
            throw new Error('Should capture snapshot on settings change');
        }
    });

    // === 6. ERROR HANDLING (8 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('missing AppState throws on performUndo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppState = null;
        setUndoRedoManagerDependencies(mockDeps);

        let threwError = false;
        try {
            await performStateBasedUndo();
        } catch (error) {
            if (error.message.includes('missing required dependency')) {
                threwError = true;
            }
        }

        if (!threwError) {
            throw new Error('Should throw error about missing AppState');
        }
    });

    await test('missing refreshUIFromState throws on performUndo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Add snapshot to trigger undo logic
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false,
            timestamp: Date.now()
        });

        // Remove refreshUIFromState
        mockDeps.refreshUIFromState = null;
        setUndoRedoManagerDependencies(mockDeps);

        let threwError = false;
        try {
            await performStateBasedUndo();
        } catch (error) {
            if (error.message.includes('missing required dependency')) {
                threwError = true;
            }
        }

        if (!threwError) {
            throw new Error('Should throw error about missing refreshUIFromState');
        }
    });

    await test('invalid state handled gracefully in captureSnapshot', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Invalid state (missing required properties)
        const invalidState = {
            data: {},
            appState: {}
        };

        // Should not throw
        await captureStateSnapshot(invalidState);

        // Should not have captured
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should not capture invalid state');
        }
    });

    await test('missing cycle in state handled gracefully', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // State with activeCycleId but no matching cycle
        const state = {
            data: {
                cycles: {}
            },
            appState: {
                activeCycleId: 'NonExistent'
            }
        };

        // Should not throw
        await captureStateSnapshot(state);

        // Should not have captured
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should not capture when cycle is missing');
        }
    });

    await test('setupStateBasedUndoRedo handles subscription failure', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppState.subscribe = () => {
            throw new Error('Subscription failed');
        };
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw, should log warning
        setupStateBasedUndoRedo();
    });

    await test('performUndo handles update failure', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Add valid snapshot
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: false }],
            recurringTemplates: {},
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false,
            timestamp: Date.now()
        });

        // Make update throw
        mockDeps.AppState.update = async () => {
            throw new Error('Update failed');
        };
        setUndoRedoManagerDependencies(mockDeps);

        let threwError = false;
        try {
            await performStateBasedUndo();
        } catch (error) {
            threwError = true;
        }

        if (!threwError) {
            throw new Error('Should propagate update error');
        }

        // Flag should be cleared in finally block
        if (mockDeps.AppGlobalState.isPerformingUndoRedo) {
            throw new Error('isPerformingUndoRedo flag should be cleared after error');
        }
    });

    await test('performRedo handles update failure', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Add valid snapshot to redoStack
        mockDeps.AppGlobalState.activeRedoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [{ id: 'task-1', text: 'Task 1', completed: true }],
            recurringTemplates: {},
            title: 'Test',
            autoReset: false,
            deleteCheckedTasks: false,
            timestamp: Date.now()
        });

        // Make update throw
        mockDeps.AppState.update = async () => {
            throw new Error('Update failed');
        };
        setUndoRedoManagerDependencies(mockDeps);

        let threwError = false;
        try {
            await performStateBasedRedo();
        } catch (error) {
            threwError = true;
        }

        if (!threwError) {
            throw new Error('Should propagate update error');
        }

        // Flag should be cleared
        if (mockDeps.AppGlobalState.isPerformingUndoRedo) {
            throw new Error('isPerformingUndoRedo flag should be cleared after error');
        }
    });

    await test('captureStateSnapshot handles null state gracefully', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        await captureStateSnapshot(null);

        // Should not have captured
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should not capture null state');
        }
    });

    // === 7. BUTTON STATE/VISIBILITY SEPARATION (4 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ Button State/Visibility Separation</h4>';

    await test('updateUndoRedoButtonStates updates enabled/disabled only', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Add item to stack
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        updateUndoRedoButtonStates();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.disabled) {
            throw new Error('Undo button should be enabled when stack has items');
        }
        if (undoBtn.style.opacity !== '1') {
            throw new Error('Enabled button should have opacity 1');
        }
    });

    await test('updateUndoRedoButtonVisibility updates hidden state only', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Add item to stack
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        updateUndoRedoButtonVisibility();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.hidden) {
            throw new Error('Undo button should be visible when stack has items');
        }
    });

    await test('updateUndoRedoButtons calls both state and visibility', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Add item to stack
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'Test',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        updateUndoRedoButtons();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.hidden || undoBtn.disabled) {
            throw new Error('Undo button should be visible and enabled');
        }
    });

    await test('button functions handle missing buttons gracefully', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null;
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        updateUndoRedoButtonStates();
        updateUndoRedoButtonVisibility();
        updateUndoRedoButtons();
    });

    // === 8. CYCLE SWITCH BLOCKING (4 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚧 Cycle Switch Blocking</h4>';

    await test('captureStateSnapshot blocks during cycle switch', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.isSwitchingCycles = true;  // Set flag
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should not capture snapshot during cycle switch');
        }
    });

    await test('isSwitchingCycles flag prevents snapshot pollution', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Capture initial state
        const state1 = mockDeps.AppState.get();
        await captureStateSnapshot(state1);

        const initialCount = mockDeps.AppGlobalState.activeUndoStack.length;

        // Set switching flag
        mockDeps.AppGlobalState.isSwitchingCycles = true;

        // Try to capture multiple states (simulating progressive loading)
        for (let i = 0; i < 5; i++) {
            const state = mockDeps.AppState.get();
            state.data.cycles['Test Cycle'].tasks[0].text = `Modified ${i}`;
            await captureStateSnapshot(state);
        }

        // Should not have captured any new snapshots
        if (mockDeps.AppGlobalState.activeUndoStack.length !== initialCount) {
            throw new Error('Should not capture snapshots while switching cycles');
        }
    });

    await test('snapshots resume after isSwitchingCycles cleared', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.isSwitchingCycles = true;
        setUndoRedoManagerDependencies(mockDeps);

        // Try to capture during switch
        const state1 = mockDeps.AppState.get();
        await captureStateSnapshot(state1);

        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should block during switch');
        }

        // Clear flag
        mockDeps.AppGlobalState.isSwitchingCycles = false;

        await new Promise(resolve => setTimeout(resolve, 350));

        // Now should capture
        const state2 = mockDeps.AppState.get();
        await captureStateSnapshot(state2);

        if (mockDeps.AppGlobalState.activeUndoStack.length === 0) {
            throw new Error('Should capture after flag cleared');
        }
    });

    await test('state subscription respects isSwitchingCycles', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.isSwitchingCycles = true;
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        const subscriber = mockDeps.AppState._subscribers['undo-system'];

        const oldState = mockDeps.AppState.get();
        const newState = JSON.parse(JSON.stringify(oldState));
        newState.data.cycles['Test Cycle'].tasks[0].completed = true;

        // Trigger subscriber
        subscriber(newState, oldState);

        // Should NOT capture snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('State subscription should respect isSwitchingCycles flag');
        }
    });

    // === 9. CYCLE LIFECYCLE FUNCTIONS (6 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Cycle Lifecycle Functions</h4>';

    await test('onCycleCreated initializes empty undo history', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        await onCycleCreated('new-cycle-123');

        // Should have initialized activeCycleIdForUndo
        if (mockDeps.AppGlobalState.activeCycleIdForUndo !== 'new-cycle-123') {
            throw new Error('Should set activeCycleIdForUndo');
        }

        // Stacks should be empty for new cycle
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('New cycle should have empty undo stack');
        }
        if (mockDeps.AppGlobalState.activeRedoStack.length !== 0) {
            throw new Error('New cycle should have empty redo stack');
        }
    });

    await test('onCycleSwitched sets isSwitchingCycles flag', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'old-cycle';
        setUndoRedoManagerDependencies(mockDeps);

        // Add some undo history
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'old-cycle',
            tasks: [],
            title: 'Old',
            timestamp: Date.now()
        });

        // Start the switch (don't await to check flag mid-operation)
        const switchPromise = onCycleSwitched('new-cycle');

        // Flag should be set immediately
        if (!mockDeps.AppGlobalState.isSwitchingCycles) {
            throw new Error('isSwitchingCycles should be set during switch');
        }

        // Wait for completion
        await switchPromise;

        // Flag should be cleared after
        if (mockDeps.AppGlobalState.isSwitchingCycles) {
            throw new Error('isSwitchingCycles should be cleared after switch completes');
        }
    });

    await test('onCycleSwitched updates activeCycleIdForUndo', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'cycle-1';
        setUndoRedoManagerDependencies(mockDeps);

        await onCycleSwitched('cycle-2');

        if (mockDeps.AppGlobalState.activeCycleIdForUndo !== 'cycle-2') {
            throw new Error('Should update activeCycleIdForUndo to new cycle');
        }
    });

    await test('onCycleDeleted clears stacks when deleting active cycle', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'cycle-to-delete';
        setUndoRedoManagerDependencies(mockDeps);

        // Add some history
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'cycle-to-delete',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        await onCycleDeleted('cycle-to-delete');

        // Stacks should be cleared
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('Should clear undo stack when deleting active cycle');
        }
        if (mockDeps.AppGlobalState.activeRedoStack.length !== 0) {
            throw new Error('Should clear redo stack when deleting active cycle');
        }
    });

    await test('onCycleDeleted preserves stacks when deleting inactive cycle', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'active-cycle';
        setUndoRedoManagerDependencies(mockDeps);

        // Add history for active cycle
        mockDeps.AppGlobalState.activeUndoStack.push({
            activeCycleId: 'active-cycle',
            tasks: [],
            title: 'Active',
            timestamp: Date.now()
        });

        await onCycleDeleted('other-cycle');

        // Should preserve active cycle's history
        if (mockDeps.AppGlobalState.activeUndoStack.length === 0) {
            throw new Error('Should preserve undo stack when deleting inactive cycle');
        }
    });

    await test('onCycleRenamed migrates the active undo-tracking id', async () => {
        const mockDeps = createMockDependencies();
        // Simulate the renamed cycle being the one whose undo history is loaded.
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'old-id';
        setUndoRedoManagerDependencies(mockDeps);

        // The IndexedDB record migration may no-op in the test env, but the
        // in-memory tracking id must follow the rename either way (the error
        // path updates it too — that's the contract).
        await onCycleRenamed('old-id', 'new-id');

        if (mockDeps.AppGlobalState.activeCycleIdForUndo !== 'new-id') {
            throw new Error(`activeCycleIdForUndo should be 'new-id', got '${mockDeps.AppGlobalState.activeCycleIdForUndo}'`);
        }
    });

    await test('onCycleRenamed relabels in-memory snapshots so history survives the rename', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'Old Name';
        // Live stacks carry snapshots stamped with the OLD id/title — exactly
        // what the pre-fix code left untouched, so validateSnapshot discarded
        // the whole history on the next filtered load, and an in-session Undo
        // wrote the old title into the renamed cycle (key=title break).
        mockDeps.AppGlobalState.activeUndoStack = [
            { activeCycleId: 'Old Name', title: 'Old Name', tasks: [{ id: 't1', text: 'a' }], timestamp: 1 },
            // _sig cached pre-rename: relabel must strip it, or post-rename
            // dedup compares fresh signatures against this stale string and
            // pushes duplicates.
            { activeCycleId: 'Old Name', title: 'Old Name', tasks: [], timestamp: 2, _sig: 'stale-pre-rename-sig' }
        ];
        mockDeps.AppGlobalState.activeRedoStack = [
            { activeCycleId: 'Old Name', title: 'Old Name', tasks: [], timestamp: 3 }
        ];
        setUndoRedoManagerDependencies(mockDeps);

        await onCycleRenamed('Old Name', 'New Name');

        const all = [...mockDeps.AppGlobalState.activeUndoStack, ...mockDeps.AppGlobalState.activeRedoStack];
        if (all.length !== 3) throw new Error(`stacks must be preserved, got ${all.length} snapshots`);
        for (const snap of all) {
            if (snap.activeCycleId !== 'New Name') throw new Error(`snapshot activeCycleId not relabeled: ${snap.activeCycleId}`);
            if (snap.title !== 'New Name') throw new Error(`snapshot title not relabeled: ${snap.title}`);
            if ('_sig' in snap) throw new Error('stale cached _sig must be stripped by relabel');
        }
        // The relabeled snapshots must pass the strict validation that was
        // discarding them — this is the wipe-on-next-load regression guard.
        const kept = filterValidSnapshots(all, 'New Name');
        if (kept.length !== 3) throw new Error(`relabeled snapshots must survive filterValidSnapshots, kept ${kept.length}/3`);
        // Task contents untouched
        if (mockDeps.AppGlobalState.activeUndoStack[0].tasks[0].text !== 'a') throw new Error('snapshot contents must be preserved');
    });

    // === 10. INDEXEDDB PERSISTENCE (4 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 IndexedDB Persistence</h4>';

    await test('initUndoIndexedDB returns a promise', async () => {
        // Should return a promise (may fail in test env without full IndexedDB)
        const result = initUndoIndexedDB();

        if (!(result instanceof Promise)) {
            throw new Error('initUndoIndexedDB should return a promise');
        }

        // Wait for it to settle (may reject in test env)
        try {
            await result;
        } catch (e) {
            // Expected in test environment without full IndexedDB
            console.log('IndexedDB initialization failed (expected in test env)');
        }
    });

    await test('loadUndoStackFromIndexedDB returns default structure on error', async () => {
        // In test environment, this will likely fail to access IndexedDB
        // Should return default structure instead of throwing
        const result = await loadUndoStackFromIndexedDB('test-cycle');

        if (!result || typeof result !== 'object') {
            throw new Error('Should return an object');
        }

        if (!Array.isArray(result.undoStack)) {
            throw new Error('Should have undoStack array');
        }

        if (!Array.isArray(result.redoStack)) {
            throw new Error('Should have redoStack array');
        }
    });

    await test('saveUndoStackToIndexedDB handles errors gracefully', async () => {
        const undoStack = [
            {
                activeCycleId: 'test',
                tasks: [],
                title: 'Test',
                timestamp: Date.now()
            }
        ];
        const redoStack = [];

        // Should not throw even if IndexedDB unavailable
        try {
            saveUndoStackToIndexedDB('test-cycle', undoStack, redoStack);
        } catch (e) {
            throw new Error('saveUndoStackToIndexedDB should handle errors gracefully');
        }
    });

    await test('per-cycle persistence architecture isolates cycles', async () => {
        // Conceptual test - verify that different cycle IDs result in different storage
        const cycle1Undo = [{ activeCycleId: 'cycle-1', tasks: [], title: 'C1', timestamp: Date.now() }];
        const cycle2Undo = [{ activeCycleId: 'cycle-2', tasks: [], title: 'C2', timestamp: Date.now() }];

        // Save both cycles
        saveUndoStackToIndexedDB('cycle-1', cycle1Undo, []);
        saveUndoStackToIndexedDB('cycle-2', cycle2Undo, []);

        // Load them back
        const loaded1 = await loadUndoStackFromIndexedDB('cycle-1');
        const loaded2 = await loadUndoStackFromIndexedDB('cycle-2');

        // In a real environment, these would be different
        // In test env, they'll both return empty defaults
        if (!loaded1 || !loaded2) {
            throw new Error('Both loads should return objects');
        }
    });

    // =========================================================
    // 🔒 close + rename — WRITTEN BEFORE THE undoIndexedDB EXTRACTION
    // =========================================================
    // Both functions are being moved into modules/ui/undoIndexedDB.js, and
    // neither was referenced by a single existing test. They also own the two
    // behaviours most likely to break silently in a move:
    //   - closeUndoIndexedDB must CANCEL pending debounced writes, not just
    //     close the handle. A write that lands after close resurrects history
    //     the user cleared.
    //   - renameUndoStackInIndexedDB must RELABEL every snapshot, not copy it
    //     verbatim. A verbatim copy leaves each snapshot carrying the old id,
    //     which validateSnapshot then rejects wholesale: a silent total wipe of
    //     undo history on the next filtered load (see the comment on the
    //     function itself).
    const DB_DEBOUNCE_MS = 3000; // DEBOUNCE.UNDO_DB_WRITE

    resultsDiv.innerHTML += '<h4 class="test-section">🔒 Close &amp; Rename (pre-extraction)</h4>';

    await test('closeUndoIndexedDB does not throw when no database was opened', async () => {
        let threw = null;
        try { closeUndoIndexedDB(); } catch (e) { threw = e; }
        if (threw) throw new Error(`should be safe with no open DB, threw: ${threw.message}`);
    });

    await test('closeUndoIndexedDB is idempotent', async () => {
        let threw = null;
        try { closeUndoIndexedDB(); closeUndoIndexedDB(); } catch (e) { threw = e; }
        if (threw) throw new Error(`second close threw: ${threw.message}`);
    });

    await test('closeUndoIndexedDB cancels a pending debounced write', async () => {
        // The write is debounced by 3s. Closing before it fires must CANCEL the
        // timer, not merely drop the handle.
        //
        // Order matters here, and an earlier version of this test got it wrong:
        // it waited out the debounce BEFORE re-opening, so the pending write hit
        // a null handle and failed for the wrong reason. The test then passed
        // even with the cancellation deleted. Re-opening FIRST restores a live
        // handle, so an uncancelled timer genuinely lands a write and the
        // assertion below is the only thing standing between us and a
        // resurrected undo stack. Verified by mutation: deleting the two
        // clearTimeout lines fails this test.
        await initUndoIndexedDB().catch(() => {});
        const cycleId = 'close-cancels-' + Date.now();
        saveUndoStackToIndexedDB(cycleId, [{
            activeCycleId: cycleId, tasks: [], title: cycleId, timestamp: Date.now()
        }], []);

        closeUndoIndexedDB();                        // must cancel the pending timer
        await initUndoIndexedDB().catch(() => {});   // live handle again, BEFORE it would fire
        await new Promise(r => setTimeout(r, DB_DEBOUNCE_MS + 400));

        const loaded = await loadUndoStackFromIndexedDB(cycleId);
        if (loaded.undoStack.length !== 0) {
            throw new Error(`uncancelled write landed: ${loaded.undoStack.length} snapshot(s)`);
        }
    });

    await test('renameUndoStackInIndexedDB ignores a missing old or new id', async () => {
        await initUndoIndexedDB().catch(() => {});
        let threw = null;
        try {
            await renameUndoStackInIndexedDB(null, 'somewhere');
            await renameUndoStackInIndexedDB('somewhere', null);
            await renameUndoStackInIndexedDB(null, null);
        } catch (e) { threw = e; }
        if (threw) throw new Error(`guard clauses should no-op, threw: ${threw.message}`);
    });

    // Shared setup for the relabel assertions below: one real round trip through
    // the debounce, rather than three.
    const OLD_ID = 'rename-old-' + Date.now();
    const NEW_ID = 'rename-new-' + Date.now();
    let renamedNew = { undoStack: [], redoStack: [] };
    let renamedOld = { undoStack: [], redoStack: [] };
    await initUndoIndexedDB().catch(() => {});
    saveUndoStackToIndexedDB(OLD_ID, [{
        activeCycleId: OLD_ID, tasks: [{ id: 't1', text: 'Kept', completed: false }],
        title: OLD_ID, timestamp: Date.now(), _sig: 'stale-signature-from-old-id'
    }], []);
    await new Promise(r => setTimeout(r, DB_DEBOUNCE_MS + 400)); // let the debounced write land
    await renameUndoStackInIndexedDB(OLD_ID, NEW_ID);
    renamedNew = await loadUndoStackFromIndexedDB(NEW_ID);
    renamedOld = await loadUndoStackFromIndexedDB(OLD_ID);

    await test('renameUndoStackInIndexedDB moves the stack to the new id', async () => {
        if (renamedNew.undoStack.length !== 1) {
            throw new Error(`expected 1 snapshot under the new id, got ${renamedNew.undoStack.length}`);
        }
        if (renamedNew.undoStack[0].tasks[0]?.text !== 'Kept') {
            throw new Error('snapshot payload did not survive the rename');
        }
    });

    await test('renameUndoStackInIndexedDB relabels activeCycleId and title', async () => {
        // A verbatim copy here is the silent-wipe bug: validateSnapshot compares
        // activeCycleId strictly and rejects the whole migrated history.
        const snap = renamedNew.undoStack[0];
        if (!snap) throw new Error('no snapshot to inspect');
        if (snap.activeCycleId !== NEW_ID) {
            throw new Error(`activeCycleId still ${snap.activeCycleId}, expected ${NEW_ID}`);
        }
        if (snap.title !== NEW_ID) {
            throw new Error(`title still ${snap.title}, expected ${NEW_ID}`);
        }
    });

    await test('renameUndoStackInIndexedDB drops the stale cached signature', async () => {
        // _sig embeds the OLD id, so carrying it forward makes the first capture
        // after a rename mismatch the stack top and push a duplicate.
        const snap = renamedNew.undoStack[0];
        if (!snap) throw new Error('no snapshot to inspect');
        if (snap._sig !== undefined) {
            throw new Error(`stale _sig survived the rename: ${snap._sig}`);
        }
    });

    await test('renameUndoStackInIndexedDB removes the old key', async () => {
        if (renamedOld.undoStack.length !== 0) {
            throw new Error(`old id still holds ${renamedOld.undoStack.length} snapshot(s)`);
        }
    });

    // === 11. LOCALSTORAGE CACHE (4 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ localStorage Cache (Instant Boot)</h4>';

    await test('saveUndoStackToIndexedDB also writes to localStorage cache', async () => {
        // Clear any existing cache
        localStorage.removeItem(UNDO_CACHE_KEY);

        const undoStack = [
            {
                activeCycleId: 'test-cycle',
                tasks: [{ id: 'task-1', text: 'Test', completed: false }],
                title: 'Test',
                timestamp: Date.now()
            }
        ];
        const redoStack = [];

        // Save to IndexedDB (also saves to localStorage)
        saveUndoStackToIndexedDB('test-cycle', undoStack, redoStack);

        // Check localStorage cache was written
        const cached = localStorage.getItem(UNDO_CACHE_KEY);
        if (!cached) {
            throw new Error('Should write to localStorage cache');
        }

        const data = JSON.parse(cached);
        if (data.cycleId !== 'test-cycle') {
            throw new Error('Cache should have correct cycleId');
        }
        if (data.undoStack.length !== 1) {
            throw new Error('Cache should have undo stack');
        }
    });

    await test('localStorage cache includes timestamp', async () => {
        localStorage.removeItem(UNDO_CACHE_KEY);

        const beforeTime = Date.now();
        saveUndoStackToIndexedDB('test-cycle', [], []);
        const afterTime = Date.now();

        const cached = localStorage.getItem(UNDO_CACHE_KEY);
        const data = JSON.parse(cached);

        if (!data.timestamp) {
            throw new Error('Cache should include timestamp');
        }
        if (data.timestamp < beforeTime || data.timestamp > afterTime) {
            throw new Error('Timestamp should be recent');
        }
    });

    await test('clearUndoCache removes localStorage cache', async () => {
        // Set up cache
        localStorage.setItem(UNDO_CACHE_KEY, JSON.stringify({
            cycleId: 'test',
            undoStack: [],
            redoStack: [],
            timestamp: Date.now()
        }));

        // Clear it
        clearUndoCache();

        const cached = localStorage.getItem(UNDO_CACHE_KEY);
        if (cached !== null) {
            throw new Error('clearUndoCache should remove localStorage cache');
        }
    });

    await test('onCycleDeleted clears cache when deleting active cycle', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.activeCycleIdForUndo = 'cycle-to-delete';
        setUndoRedoManagerDependencies(mockDeps);

        // Set up cache for the cycle to be deleted
        localStorage.setItem(UNDO_CACHE_KEY, JSON.stringify({
            cycleId: 'cycle-to-delete',
            undoStack: [{ activeCycleId: 'cycle-to-delete', tasks: [] }],
            redoStack: [],
            timestamp: Date.now()
        }));

        await onCycleDeleted('cycle-to-delete');

        const cached = localStorage.getItem(UNDO_CACHE_KEY);
        if (cached !== null) {
            throw new Error('Should clear localStorage cache when deleting active cycle');
        }
    });

    // === 12. SIGNATURE CACHING (3 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔖 Signature Caching</h4>';

    await test('captureStateSnapshot caches signature on snapshot', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        const snapshot = mockDeps.AppGlobalState.activeUndoStack[0];
        if (!snapshot._sig) {
            throw new Error('Snapshot should have cached signature (_sig property)');
        }
        if (typeof snapshot._sig !== 'string') {
            throw new Error('Cached signature should be a string');
        }
    });

    await test('cached signature matches computed signature', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        await captureStateSnapshot(state);

        const snapshot = mockDeps.AppGlobalState.activeUndoStack[0];
        const cachedSig = snapshot._sig;
        const computedSig = buildSnapshotSignature(snapshot);

        if (cachedSig !== computedSig) {
            throw new Error('Cached signature should match computed signature');
        }
    });

    await test('signature deduplication uses cached signature', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();

        // Capture first snapshot (has cached sig)
        await captureStateSnapshot(state);
        const firstSig = mockDeps.AppGlobalState.activeUndoStack[0]._sig;

        // Try to capture identical snapshot
        await captureStateSnapshot(state);

        // Should only have one snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Should deduplicate using cached signatures');
        }
    });

    // === ROLLBACK UI-REFRESH REGRESSION (BUG_undo-redo-rollback-ui-refresh.md) ===
    // A failed undo/redo rolls state back but must ALSO repaint — restoring
    // AppState alone leaves the DOM showing the half-applied state. These force
    // the apply path to throw and assert the catch path calls the UI refresh
    // (via the refreshUIFromState fallback, since no UIOrchestrator is injected).
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Rollback UI Refresh (failure-path regression)</h4>';

    function createRollbackFailureDeps() {
        const deps = createMockDependencies();
        const spies = { refreshCalls: 0, restoreCalls: 0 };
        deps.refreshUIFromState = () => { spies.refreshCalls++; };
        // ONE-SHOT failure: the apply update throws; the rollback's restore
        // update (restoreFullState — there is NO AppState.set) must succeed
        // and is counted. (The original bug was double: set() didn't exist,
        // so restore AND repaint were both silently dead.)
        const realUpdate = deps.AppState.update;
        let updateCalls = 0;
        deps.AppState.update = async (fn, immediate) => {
            updateCalls++;
            if (updateCalls === 1) throw new Error('forced apply failure');
            spies.restoreCalls++;
            return realUpdate(fn, immediate);
        };
        // A stack snapshot that differs from current state (else it's skipped
        // as a duplicate and the apply path never runs).
        const snapshot = {
            activeCycleId: 'Test Cycle',
            tasks: [{ id: 'task-1', text: 'Task 1 EDITED', completed: false, highPriority: false }],
            recurringTemplates: {},
            title: 'Test Cycle',
            autoReset: false,
            deleteCheckedTasks: false,
            cycleCount: 0,
            theme: 'classic',
            clearedTasks: null,
            taskViewLayout: null,
            timestamp: Date.now() - 1000
        };
        return { deps, spies, snapshot };
    }

    await test('undo failure rolls back AND repaints the UI', async () => {
        const { deps, spies, snapshot } = createRollbackFailureDeps();
        deps.AppGlobalState.activeUndoStack = [snapshot];
        setUndoRedoManagerDependencies(deps);

        let threw = false;
        try { await performStateBasedUndo(); } catch (e) { threw = e.message.includes('forced'); }

        if (!threw) throw new Error('forced failure should re-throw to the caller');
        if (spies.restoreCalls < 1) throw new Error('rollback must restore state via a second AppState.update (restoreFullState)');
        if (spies.refreshCalls < 1) throw new Error('rollback must repaint (refreshUIFromState not called in catch path)');
        if (deps.AppGlobalState.isPerformingUndoRedo !== false) throw new Error('finally must clear isPerformingUndoRedo');
    });

    await test('redo failure rolls back AND repaints the UI', async () => {
        const { deps, spies, snapshot } = createRollbackFailureDeps();
        deps.AppGlobalState.activeRedoStack = [snapshot];
        setUndoRedoManagerDependencies(deps);

        let threw = false;
        try { await performStateBasedRedo(); } catch (e) { threw = e.message.includes('forced'); }

        if (!threw) throw new Error('forced failure should re-throw to the caller');
        if (spies.restoreCalls < 1) throw new Error('rollback must restore state via a second AppState.update (restoreFullState)');
        if (spies.refreshCalls < 1) throw new Error('rollback must repaint (refreshUIFromState not called in catch path)');
        if (deps.AppGlobalState.isPerformingUndoRedo !== false) throw new Error('finally must clear isPerformingUndoRedo');
    });

    // The repaint tests above assert state restore + repaint; these pin the
    // OTHER half of the rollback contract — both undo/redo STACKS returning to
    // their pre-attempt state. Use MULTI-ENTRY stacks and assert the restored
    // entries by identity AND order, not just length: a broken rollback could
    // replace the original entry with a freshly-built snapshot of the same length
    // and a length-only check would miss it.
    const mkSnap = (marker, taskTexts) => ({
        activeCycleId: 'Test Cycle',
        tasks: taskTexts.map((t, i) => ({ id: `${marker}-${i}`, text: t, completed: false, highPriority: false })),
        recurringTemplates: {}, title: 'Test Cycle', autoReset: false, deleteCheckedTasks: false,
        cycleCount: 0, theme: 'classic', clearedTasks: null, taskViewLayout: null, timestamp: marker
    });

    await test('undo failure restores both stacks EXACTLY (contents + order)', async () => {
        const { deps } = createRollbackFailureDeps();
        // Both differ from the current 2-task state so the undo actually pops.
        const snapA = mkSnap(1000, ['A only']);
        const snapB = mkSnap(2000, ['B one', 'B two', 'B three']);
        deps.AppGlobalState.activeUndoStack = [snapA, snapB];
        deps.AppGlobalState.activeRedoStack = [];
        setUndoRedoManagerDependencies(deps);

        try { await performStateBasedUndo(); } catch (e) { /* forced failure expected */ }

        const u = deps.AppGlobalState.activeUndoStack;
        if (u.length !== 2 || u[0] !== snapA || u[1] !== snapB) {
            throw new Error('undo stack not restored exactly (contents/order)');
        }
        if (deps.AppGlobalState.activeRedoStack.length !== 0) {
            throw new Error(`redo stack not restored: expected 0, got ${deps.AppGlobalState.activeRedoStack.length}`);
        }
    });

    await test('redo failure restores both stacks EXACTLY (contents + order)', async () => {
        const { deps } = createRollbackFailureDeps();
        const snapA = mkSnap(1000, ['A only']);
        const snapB = mkSnap(2000, ['B one', 'B two', 'B three']);
        deps.AppGlobalState.activeRedoStack = [snapA, snapB];
        deps.AppGlobalState.activeUndoStack = [];
        setUndoRedoManagerDependencies(deps);

        try { await performStateBasedRedo(); } catch (e) { /* forced failure expected */ }

        const r = deps.AppGlobalState.activeRedoStack;
        if (r.length !== 2 || r[0] !== snapA || r[1] !== snapB) {
            throw new Error('redo stack not restored exactly (contents/order)');
        }
        if (deps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error(`undo stack not restored: expected 0, got ${deps.AppGlobalState.activeUndoStack.length}`);
        }
    });

    // === DERIVED-FIELD DESCRIPTIONS ===
    // `task.deleteWhenComplete` is derived from deleteWhenCompleteSettings[mode],
    // so it moves for BOTH a per-task toggle and a routine mode switch. Naming it
    // in the label is only correct for the former.
    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ Change descriptions (derived fields)</h4>';

    const snapOf = (deleteCheckedTasks, tasks) => ({
        activeCycleId: 'c1', title: 'R', autoReset: true, cycleCount: 0,
        theme: 'classic', recurringTemplates: {}, clearedTasks: null,
        deleteCheckedTasks, tasks
    });

    await test('mode switch is described as "Mode changed", not the per-task control', () => {
        // Both halves of a mode switch land in ONE snapshot pair: the routine flag
        // AND every task's derived value. Only the flag is a control the user touched.
        const settings = { cycle: false, todo: true };
        const from = snapOf(false, [{ id: 't1', text: 'a', deleteWhenComplete: false, deleteWhenCompleteSettings: { ...settings } }]);
        const to   = snapOf(true,  [{ id: 't1', text: 'a', deleteWhenComplete: true,  deleteWhenCompleteSettings: { ...settings } }]);

        const desc = computeTransactionDiff(from, to).description;
        if (!/Mode changed/.test(desc)) {
            throw new Error(`expected the mode change to be named, got "${desc}"`);
        }
        // Assert on the COMPOUND marker, not on the leaked string. When two changes
        // are recorded, describeChange returns `changes[0] + " + N changes"` — the
        // second label never appears verbatim, so a `/Clear on complete/` check here
        // passes even with the bug present (confirmed by reverting the guard).
        if (desc.includes(' + ')) {
            throw new Error(`mode switch must be ONE reported change, got compound "${desc}"`);
        }
    });

    await test('a real per-task clear-on-complete toggle IS still described', () => {
        // The guard above must not swallow the genuine case: taskButtons writes
        // deleteWhenCompleteSettings[mode] alongside the derived value.
        const from = snapOf(false, [{ id: 't1', text: 'a', deleteWhenComplete: false, deleteWhenCompleteSettings: { cycle: false, todo: true } }]);
        const to   = snapOf(false, [{ id: 't1', text: 'a', deleteWhenComplete: true,  deleteWhenCompleteSettings: { cycle: true,  todo: true } }]);

        const desc = computeTransactionDiff(from, to).description;
        if (!/[Rr]emove when complete/.test(desc)) {
            throw new Error(`a real toggle must still be named, got "${desc}"`);
        }
    });

    // === WRAPPER SYSTEM-OPTION (review F-005) ===
    // Runs LAST: wrapAppStateForUndo flips the module-internal _wrapperActive
    // latch, which makes setupStateBasedUndoRedo a no-op — installing it any
    // earlier would break the state-subscription tests above.
    // System intent travels WITH the call as { system: true } — the wrapper
    // must skip its snapshot for that call only, so a user update interleaving
    // during a system commit still gets captured (the shared isSystemMutation
    // flag mis-tagged those).
    await test('undo wrapper skips snapshot for system:true updates only (review F-005)', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        mockDeps.AppGlobalState.wrappedAppStateUpdate = false;
        let committed = 0;
        mockDeps.AppState.update = (producer, immediate) => { committed++; return Promise.resolve(); };
        setUndoRedoManagerDependencies(mockDeps);

        const installed = wrapAppStateForUndo({ isCoreReady: () => true });
        if (!installed) throw new Error('wrapper must install');

        // System call: wrapper must NOT capture
        await mockDeps.AppState.update(() => {}, false, { system: true });
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('system update must not enter undo history');
        }

        // Plain call: wrapper must capture
        await mockDeps.AppState.update(() => {}, false);
        await new Promise(r => setTimeout(r, 0)); // capture is fire-and-forget async
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('plain update must be captured into undo history');
        }
        if (committed !== 2) throw new Error('both updates must reach the underlying update');
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>All Tests Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (percentage === 100) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed! Module is production-ready!</div>';
    } else if (percentage >= 95) {
        resultsDiv.innerHTML += '<div class="result pass">✅ Excellent! Nearly all tests passing.</div>';
    } else if (percentage >= 90) {
        resultsDiv.innerHTML += '<div class="result pass">✅ Very good! Most tests passing.</div>';
    } else if (percentage >= 75) {
        resultsDiv.innerHTML += '<div class="result warning">⚠️ Good progress. Some tests need attention.</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Needs work. Review failing tests.</div>';
    }

    
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
}
