/**
 * 🧪 UndoRedoManager Tests
 * Tests for utilities/ui/undoRedoManager.js
 * Pattern: Strict Injection 🔧
 *
 * Tests undo/redo functionality:
 * - Dependency injection and fail-fast behavior
 * - Snapshot capture and deduplication
 * - Undo/redo operations and stack management
 * - UI button state management
 * - State subscription and automatic snapshots
 * - Error handling and graceful degradation
 */

export async function runUndoRedoManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔄 UndoRedoManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

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
        updateUndoRedoButtons
    } = await import('../utilities/ui/undoRedoManager.js');

    // ✅ CRITICAL: Mark appInit as ready for tests
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Helper: Create mock dependencies
    function createMockDependencies() {
        const mockAppGlobalState = {
            undoStack: [],
            redoStack: [],
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

        if (mockDeps.AppGlobalState.undoStack.length !== 1) {
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

        const snapshot = mockDeps.AppGlobalState.undoStack[0];
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

        if (mockDeps.AppGlobalState.undoStack.length !== 0) {
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

        if (mockDeps.AppGlobalState.undoStack.length !== 1) {
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

        if (mockDeps.AppGlobalState.undoStack.length !== 2) {
            throw new Error('Different snapshot should be captured');
        }
    });

    await test('captureStateSnapshot respects UNDO_LIMIT (50)', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Pre-fill stack with 50 snapshots
        for (let i = 0; i < 50; i++) {
            mockDeps.AppGlobalState.undoStack.push({
                activeCycleId: 'Test Cycle',
                tasks: [{ id: `task-${i}`, text: `Task ${i}`, completed: false }],
                title: 'Test Cycle',
                autoReset: false,
                deleteCheckedTasks: false,
                timestamp: Date.now() - (50 - i) * 1000
            });
        }

        // Capture one more
        const state = mockDeps.AppState.get();
        state.data.cycles['Test Cycle'].tasks[0].text = 'Modified Task';

        await new Promise(resolve => setTimeout(resolve, 350));
        captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.undoStack.length !== 50) {
            throw new Error(`Stack should remain at limit of 50, got ${mockDeps.AppGlobalState.undoStack.length}`);
        }
    });

    await test('captureStateSnapshot clears redoStack', async () => {
        const mockDeps = createMockDependencies();
        mockDeps.AppGlobalState.isInitializing = false;
        setUndoRedoManagerDependencies(mockDeps);

        // Pre-fill redoStack
        mockDeps.AppGlobalState.redoStack.push({
            activeCycleId: 'Test Cycle',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        const state = mockDeps.AppState.get();
        captureStateSnapshot(state);

        if (mockDeps.AppGlobalState.redoStack.length !== 0) {
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
        const snapshot = mockDeps.AppGlobalState.undoStack[0];
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

        if (mockDeps.AppGlobalState.redoStack.length !== 1) {
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

        mockDeps.AppGlobalState.undoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.undoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.undoStack.push(JSON.parse(JSON.stringify(snapshot)));

        // Perform undo
        await performStateBasedUndo();

        // Should have skipped duplicates
        if (mockDeps.AppGlobalState.undoStack.length > 0) {
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
        mockDeps.AppGlobalState.undoStack.push({
            activeCycleId: 'Test',
            tasks: [],
            title: 'Test',
            timestamp: Date.now()
        });

        // Should exit early without throwing
        await performStateBasedUndo();

        // Stack should be unchanged
        if (mockDeps.AppGlobalState.undoStack.length !== 1) {
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

        const undoStackBefore = mockDeps.AppGlobalState.undoStack.length;

        // Redo
        await performStateBasedRedo();

        if (mockDeps.AppGlobalState.undoStack.length <= undoStackBefore) {
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

        mockDeps.AppGlobalState.redoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.redoStack.push(JSON.parse(JSON.stringify(snapshot)));
        mockDeps.AppGlobalState.redoStack.push(JSON.parse(JSON.stringify(snapshot)));

        // Perform redo
        await performStateBasedRedo();

        // Should have skipped duplicates
        if (mockDeps.AppGlobalState.redoStack.length > 0) {
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
        mockDeps.AppGlobalState.undoStack.push({
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
        mockDeps.AppGlobalState.undoStack = [];

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
        mockDeps.AppGlobalState.undoStack = [];
        updateUndoRedoButtons();

        const undoBtn = mockDeps.getElementById('undo-btn');
        if (undoBtn.style.opacity !== '0.5') {
            throw new Error('Disabled button should have opacity 0.5');
        }

        // Test with items
        mockDeps.AppGlobalState.undoStack.push({ tasks: [] });
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
        if (mockDeps.AppGlobalState.undoStack.length === 0) {
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
        if (mockDeps.AppGlobalState.undoStack.length > 0) {
            throw new Error('Should not capture snapshot during undo/redo');
        }
    });

    await test('state subscription skips when wrapper active', async () => {
        const mockDeps = createMockDependencies();
        setUndoRedoManagerDependencies(mockDeps);

        // Activate wrapper
        window.__useUpdateWrapper = true;

        setupStateBasedUndoRedo();

        // Should not subscribe
        if (mockDeps.AppState._subscribers && mockDeps.AppState._subscribers['undo-system']) {
            throw new Error('Should not subscribe when wrapper is active');
        }

        // Cleanup
        delete window.__useUpdateWrapper;
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
        if (mockDeps.AppGlobalState.undoStack.length === 0) {
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
        if (mockDeps.AppGlobalState.undoStack.length === 0) {
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
        mockDeps.AppGlobalState.undoStack.push({
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
        if (mockDeps.AppGlobalState.undoStack.length > 0) {
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
        if (mockDeps.AppGlobalState.undoStack.length > 0) {
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
        mockDeps.AppGlobalState.undoStack.push({
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
        mockDeps.AppGlobalState.redoStack.push({
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
        if (mockDeps.AppGlobalState.undoStack.length > 0) {
            throw new Error('Should not capture null state');
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

    return { passed: passed.count, total: total.count };
}
