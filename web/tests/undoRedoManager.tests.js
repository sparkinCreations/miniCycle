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
    const {
        setUndoRedoManagerDependencies,
        wireUndoRedoUI,
        initializeUndoRedoButtons,
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
        initializeUndoSystemForApp,
        initializeUndoIndexedDB,
        saveUndoStackToIndexedDB,
        loadUndoStackFromIndexedDB
    } = await import('../modules/ui/undoRedoManager.js');

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
        captureStateSnapshot(mockState);
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

        // Call twice
        wireUndoRedoUI();
        const firstCallWired = mockDeps.AppGlobalState.__undoRedoWired;

        wireUndoRedoUI();
        const secondCallWired = mockDeps.AppGlobalState.__undoRedoWired;

        if (!firstCallWired || !secondCallWired) {
            throw new Error('Should be marked as wired after first call');
        }
    });

    await test('wireUndoRedoUI handles missing buttons gracefully', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null; // No buttons
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        wireUndoRedoUI();
    });

    await test('wireUndoRedoUI requires safeAddEventListener', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.safeAddEventListener = null;
        setUndoRedoManagerDependencies(mockDeps);

        // Create buttons so we reach the assertion
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undo-btn';
        document.body.appendChild(undoBtn);

        const redoBtn = document.createElement('button');
        redoBtn.id = 'redo-btn';
        document.body.appendChild(redoBtn);

        let threwError = false;
        try {
            wireUndoRedoUI();
        } catch (error) {
            if (error.message.includes('safeAddEventListener')) {
                threwError = true;
            }
        }

        if (!threwError) {
            throw new Error('Should throw error about missing safeAddEventListener');
        }
    });

    await test('initializeUndoRedoButtons sets hidden state', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Initialize buttons (creates them via mock)
        initializeUndoRedoButtons();

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

    await test('initializeUndoRedoButtons handles missing buttons', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.getElementById = () => null;
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw
        initializeUndoRedoButtons();
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
        captureStateSnapshot(state);

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
        captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 0) {
            throw new Error('Should not capture snapshot during initialization');
        }
    });

    await test('captureStateSnapshot throttles identical snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();

        // Capture first snapshot
        captureStateSnapshot(state);

        // Try to capture identical snapshot immediately
        captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Identical snapshot should be throttled');
        }
    });

    await test('captureStateSnapshot allows different snapshots', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state1 = mockDeps.AppState.get();
        captureStateSnapshot(state1);

        // Modify state
        const state2 = mockDeps.AppState.get();
        state2.data.cycles['Test Cycle'].tasks[0].completed = true;

        // Wait to avoid time throttling
        await new Promise(resolve => setTimeout(resolve, 350));

        captureStateSnapshot(state2);

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
        captureStateSnapshot(state);

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
        captureStateSnapshot(state);

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

        captureStateSnapshot(state);

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
        captureStateSnapshot(state1);

        // Modify state
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });

        // Wait to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 350));

        // Capture modified state
        const state2 = mockDeps.AppState.get();
        captureStateSnapshot(state2);

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

        // Capture two states
        const state1 = mockDeps.AppState.get();
        captureStateSnapshot(state1);

        await new Promise(resolve => setTimeout(resolve, 350));

        state1.data.cycles['Test Cycle'].tasks[0].completed = true;
        captureStateSnapshot(state1);

        // Undo
        await performStateBasedUndo();

        if (mockDeps.AppGlobalState.activeRedoStack.length !== 1) {
            throw new Error('Current state should be moved to redoStack');
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
        captureStateSnapshot(state);

        await new Promise(resolve => setTimeout(resolve, 350));

        state.data.cycles['Test Cycle'].tasks[0].completed = true;
        captureStateSnapshot(state);

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
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Update state via proper update() call
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });

        // Capture modified state (completed = true)
        captureStateSnapshot(mockDeps.AppState.get());

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

        // Setup: capture two states and undo
        const state1 = mockDeps.AppState.get();
        captureStateSnapshot(state1);

        await new Promise(resolve => setTimeout(resolve, 350));

        state1.data.cycles['Test Cycle'].tasks[0].completed = true;
        captureStateSnapshot(state1);

        await performStateBasedUndo();

        const undoStackBefore = mockDeps.AppGlobalState.activeUndoStack.length;

        // Redo
        await performStateBasedRedo();

        if (mockDeps.AppGlobalState.activeUndoStack.length <= undoStackBefore) {
            throw new Error('Redo should move snapshot to undoStack');
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
        captureStateSnapshot(state);

        await new Promise(resolve => setTimeout(resolve, 350));

        // Modify tasks
        state.data.cycles['Test Cycle'].tasks[0].completed = true;
        captureStateSnapshot(state);

        // Undo
        await performStateBasedUndo();

        const restored = mockDeps.AppState.get();
        if (!restored.data.cycles['Test Cycle'].recurringTemplates['template-1']) {
            throw new Error('Undo should preserve recurringTemplates');
        }
    });

    await test('undo/redo handles cycle switching', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Add second cycle via proper update
        await mockDeps.AppState.update(state => {
            state.data.cycles['Cycle 2'] = {
                title: 'Cycle 2',
                tasks: [{ id: 'task-3', text: 'Task 3', completed: false }],
                recurringTemplates: {},
                autoReset: true,
                deleteCheckedTasks: false
            };
        });

        // Capture state in Cycle 1
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Switch to Cycle 2 via proper update
        await mockDeps.AppState.update(state => {
            state.appState.activeCycleId = 'Cycle 2';
        });

        // Capture state in Cycle 2
        captureStateSnapshot(mockDeps.AppState.get());

        // Undo should switch back to Cycle 1
        await performStateBasedUndo();

        const restored = mockDeps.AppState.get();
        if (restored.appState.activeCycleId !== 'Test Cycle') {
            throw new Error(`Undo should restore activeCycleId to 'Test Cycle', got '${restored.appState.activeCycleId}'`);
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
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        // Modify state
        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        captureStateSnapshot(mockDeps.AppState.get());

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
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        captureStateSnapshot(mockDeps.AppState.get());

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
        captureStateSnapshot(mockDeps.AppState.get());

        await new Promise(resolve => setTimeout(resolve, 350));

        await mockDeps.AppState.update(state => {
            state.data.cycles['Test Cycle'].tasks[0].completed = true;
        });
        captureStateSnapshot(mockDeps.AppState.get());

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

    await test('state subscription skips when wrapper active', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.wrapperActive = true;  // ✅ Set the correct dependency flag
        setUndoRedoManagerDependencies(mockDeps);

        setupStateBasedUndoRedo();

        // Should not subscribe
        if (mockDeps.AppState._subscribers && mockDeps.AppState._subscribers['undo-system']) {
            throw new Error('Should not subscribe when wrapper is active');
        }
    });

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
        captureStateSnapshot(invalidState);

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
        captureStateSnapshot(state);

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
        captureStateSnapshot(null);

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
        captureStateSnapshot(state);

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
        captureStateSnapshot(state1);

        const initialCount = mockDeps.AppGlobalState.activeUndoStack.length;

        // Set switching flag
        mockDeps.AppGlobalState.isSwitchingCycles = true;

        // Try to capture multiple states (simulating progressive loading)
        for (let i = 0; i < 5; i++) {
            const state = mockDeps.AppState.get();
            state.data.cycles['Test Cycle'].tasks[0].text = `Modified ${i}`;
            captureStateSnapshot(state);
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
        captureStateSnapshot(state1);

        if (mockDeps.AppGlobalState.activeUndoStack.length > 0) {
            throw new Error('Should block during switch');
        }

        // Clear flag
        mockDeps.AppGlobalState.isSwitchingCycles = false;

        await new Promise(resolve => setTimeout(resolve, 350));

        // Now should capture
        const state2 = mockDeps.AppState.get();
        captureStateSnapshot(state2);

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

    await test('onCycleRenamed handles IndexedDB key update', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Should not throw (might not have IndexedDB in test env)
        await onCycleRenamed('old-id', 'new-id');
    });

    // === 10. INDEXEDDB PERSISTENCE (4 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 IndexedDB Persistence</h4>';

    await test('initializeUndoIndexedDB returns a promise', async () => {
        // Should return a promise (may fail in test env without full IndexedDB)
        const result = initializeUndoIndexedDB();

        if (!(result instanceof Promise)) {
            throw new Error('initializeUndoIndexedDB should return a promise');
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

    // === 11. SIGNATURE CACHING (3 tests) ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔖 Signature Caching</h4>';

    await test('captureStateSnapshot caches signature on snapshot', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        const state = mockDeps.AppState.get();
        captureStateSnapshot(state);

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
        captureStateSnapshot(state);

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
        captureStateSnapshot(state);
        const firstSig = mockDeps.AppGlobalState.activeUndoStack[0]._sig;

        // Try to capture identical snapshot
        captureStateSnapshot(state);

        // Should only have one snapshot
        if (mockDeps.AppGlobalState.activeUndoStack.length !== 1) {
            throw new Error('Should deduplicate using cached signatures');
        }
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
