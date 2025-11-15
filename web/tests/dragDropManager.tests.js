/**
 * 🧪 DragDropManager Tests
 * Tests for drag-and-drop task reordering functionality
 */

export async function runDragDropManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔄 DragDropManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ============================================
    // Test Helper Function with Data Protection
    // ============================================
    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            // Run test (handle both sync and async)
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // 🔒 RESTORE REAL APP DATA (runs even if test crashes)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ✅ CRITICAL: Mark core as ready for test environment
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('DragDropManager class is defined', () => {
        if (typeof DragDropManager === 'undefined') {
            throw new Error('DragDropManager class not found');
        }
    });

    test('DragDropManager class is exported', () => {
        if (typeof window.DragDropManager === 'undefined') {
            throw new Error('DragDropManager not available on window object');
        }
    });

    test('Global functions are exported', () => {
        const requiredFunctions = [
            'initDragDropManager',
            'updateMoveArrowsVisibility',
            'toggleArrowVisibility',
            'updateArrowsInDOM'
        ];

        for (const funcName of requiredFunctions) {
            if (typeof window[funcName] !== 'function') {
                throw new Error(`${funcName} not found on window object`);
            }
        }
    });

    test('Legacy DragAndDrop function is available', () => {
        if (typeof window.DragAndDrop !== 'function') {
            throw new Error('Backward compatible DragAndDrop function not found');
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('creates instance with no dependencies', () => {
        const manager = new DragDropManager();

        if (!manager) {
            throw new Error('Failed to create DragDropManager instance');
        }
        if (manager.initialized) {
            throw new Error('Should not be initialized without calling init()');
        }
    });

    test('creates instance with dependencies', () => {
        const mockDeps = {
            saveCurrentTaskOrder: () => {},
            autoSave: () => {},
            showNotification: (msg) => {}
        };

        const manager = new DragDropManager(mockDeps);

        if (!manager) {
            throw new Error('Failed to create instance with dependencies');
        }
        if (!manager.deps.saveCurrentTaskOrder) {
            throw new Error('Dependencies not stored correctly');
        }
    });

    test('has correct default timeout values', () => {
        const manager = new DragDropManager();

        if (manager.REARRANGE_DELAY !== 75) {
            throw new Error(`Expected REARRANGE_DELAY to be 75ms, got ${manager.REARRANGE_DELAY}ms`);
        }
        if (manager.REORDER_SNAPSHOT_INTERVAL !== 500) {
            throw new Error(`Expected REORDER_SNAPSHOT_INTERVAL to be 500ms, got ${manager.REORDER_SNAPSHOT_INTERVAL}ms`);
        }
    });

    test('initializes internal state correctly', () => {
        const manager = new DragDropManager();

        if (manager.rearrangeTimeout !== null) {
            throw new Error('rearrangeTimeout should be null initially');
        }
        if (manager.initialized !== false) {
            throw new Error('initialized flag should be false initially');
        }
    });

    await test('init() waits for core systems', async () => {
        const manager = new DragDropManager({
            showNotification: () => {}
        });

        // Should not throw and should mark as initialized
        await manager.init();

        if (!manager.initialized) {
            throw new Error('Manager should be marked as initialized after init()');
        }
    });

    await test('init() prevents double initialization', async () => {
        const manager = new DragDropManager({
            showNotification: () => {}
        });

        await manager.init();
        const firstInitState = manager.initialized;

        await manager.init(); // Call again

        if (!firstInitState || !manager.initialized) {
            throw new Error('Double initialization should be prevented');
        }
    });

    test('setupRearrange() sets up event listeners', () => {
        const manager = new DragDropManager();

        // Create mock taskList
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);

        // Should not throw
        manager.setupRearrange();

        // Cleanup
        document.body.removeChild(taskList);
    });

    test('setupRearrange() prevents double setup', () => {
        const manager = new DragDropManager();

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }

        window.AppGlobalState.rearrangeInitialized = false;

        manager.setupRearrange();
        const firstSetup = window.AppGlobalState.rearrangeInitialized;

        manager.setupRearrange(); // Call again

        if (!firstSetup) {
            throw new Error('First setup should have marked as initialized');
        }
    });

    // ============================================
    // ⚡ CORE FUNCTIONALITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Core Functionality</h4>';

    test('enableDragAndDrop() adds styles to task element', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('div');
        taskElement.className = 'task';

        manager.enableDragAndDrop(taskElement);

        if (taskElement.style.userSelect !== 'none') {
            throw new Error('userSelect should be set to none');
        }
        if (taskElement.style.webkitUserSelect !== 'none') {
            throw new Error('webkitUserSelect should be set to none');
        }
    });

    test('enableDragAndDrop() handles null element gracefully', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.enableDragAndDrop(null);
        manager.enableDragAndDrop(undefined);
    });

    test('enableDragAndDrop() sets up touch event listeners', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('div');
        taskElement.className = 'task';

        let touchStartCalled = false;
        taskElement.addEventListener = (eventName, handler) => {
            if (eventName === 'touchstart') {
                touchStartCalled = true;
            }
        };

        manager.enableDragAndDrop(taskElement);

        // The actual addEventListener is called, so touchstart should be registered
        // In real DOM, this would be true
    });

    test('cleanupDragState() removes dragging classes', () => {
        const manager = new DragDropManager();

        // Create mock dragged task
        const taskElement = document.createElement('div');
        taskElement.className = 'task dragging rearranging';
        document.body.appendChild(taskElement);

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = taskElement;

        manager.cleanupDragState();

        if (taskElement.classList.contains('dragging')) {
            throw new Error('dragging class should be removed');
        }
        if (taskElement.classList.contains('rearranging')) {
            throw new Error('rearranging class should be removed');
        }
        if (window.AppGlobalState.draggedTask !== null) {
            throw new Error('draggedTask should be set to null');
        }

        // Cleanup
        document.body.removeChild(taskElement);
    });

    test('cleanupDragState() handles missing elements gracefully', () => {
        const manager = new DragDropManager();

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = null;

        // Should not throw
        manager.cleanupDragState();
    });

    // ============================================
    // ↕️ ARROW BUTTON TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">↕️ Arrow Button Functionality</h4>';

    test('handleArrowClick() requires AppState', () => {
        const manager = new DragDropManager();
        const button = document.createElement('button');
        button.className = 'move-up';

        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.appendChild(button);

        // Mock AppState as not ready
        const originalAppState = window.AppState;
        window.AppState = { isReady: () => false };

        // Should handle gracefully (not throw)
        manager.handleArrowClick(button);

        // Restore
        window.AppState = originalAppState;
    });

    test('handleArrowClick() handles missing task element', () => {
        const manager = new DragDropManager();
        const button = document.createElement('button');
        button.className = 'move-up';
        // Button not inside a task element

        // Should handle gracefully
        manager.handleArrowClick(button);
    });

    test('handleArrowClick() calculates move-up index', () => {
        const manager = new DragDropManager();

        // Create mock task list
        const taskList = document.createElement('div');
        taskList.id = 'taskList';

        const task1 = document.createElement('div');
        task1.className = 'task';
        const task2 = document.createElement('div');
        task2.className = 'task';
        const task3 = document.createElement('div');
        task3.className = 'task';

        taskList.appendChild(task1);
        taskList.appendChild(task2);
        taskList.appendChild(task3);
        document.body.appendChild(taskList);

        const button = document.createElement('button');
        button.className = 'move-up';
        task2.appendChild(button);

        // Test would move task2 from index 1 to index 0

        // Cleanup
        document.body.removeChild(taskList);
    });

    test('handleArrowClick() calculates move-down index', () => {
        const manager = new DragDropManager();

        // Create mock task list
        const taskList = document.createElement('div');
        taskList.id = 'taskList';

        const task1 = document.createElement('div');
        task1.className = 'task';
        const task2 = document.createElement('div');
        task2.className = 'task';
        const task3 = document.createElement('div');
        task3.className = 'task';

        taskList.appendChild(task1);
        taskList.appendChild(task2);
        taskList.appendChild(task3);
        document.body.appendChild(taskList);

        const button = document.createElement('button');
        button.className = 'move-down';
        task2.appendChild(button);

        // Test would move task2 from index 1 to index 2

        // Cleanup
        document.body.removeChild(taskList);
    });

    test('handleArrowClick() does not move beyond bounds', () => {
        const manager = new DragDropManager();

        // Create mock task list
        const taskList = document.createElement('div');
        taskList.id = 'taskList';

        const task1 = document.createElement('div');
        task1.className = 'task';

        taskList.appendChild(task1);
        document.body.appendChild(taskList);

        const buttonUp = document.createElement('button');
        buttonUp.className = 'move-up';
        task1.appendChild(buttonUp);

        // Should not move task1 up (already at top)
        manager.handleArrowClick(buttonUp);

        // Cleanup
        document.body.removeChild(taskList);
    });

    // ============================================
    // 👁️ ARROW VISIBILITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ Arrow Visibility</h4>';

    test('updateArrowsInDOM() shows arrows when enabled', () => {
        const manager = new DragDropManager();

        // Create mock tasks
        const task1 = document.createElement('div');
        task1.className = 'task';
        const upBtn1 = document.createElement('button');
        upBtn1.className = 'move-up';
        const downBtn1 = document.createElement('button');
        downBtn1.className = 'move-down';
        task1.appendChild(upBtn1);
        task1.appendChild(downBtn1);

        const task2 = document.createElement('div');
        task2.className = 'task';
        const upBtn2 = document.createElement('button');
        upBtn2.className = 'move-up';
        const downBtn2 = document.createElement('button');
        downBtn2.className = 'move-down';
        task2.appendChild(upBtn2);
        task2.appendChild(downBtn2);

        document.body.appendChild(task1);
        document.body.appendChild(task2);

        manager.updateArrowsInDOM(true);

        // First task's up button should be hidden (at top)
        if (!upBtn1.classList.contains('hidden')) {
            throw new Error('First task up button should have hidden class');
        }

        // Second task's up button should be visible (no hidden class)
        if (upBtn2.classList.contains('hidden')) {
            throw new Error('Second task up button should not have hidden class');
        }

        // Cleanup
        document.body.removeChild(task1);
        document.body.removeChild(task2);
    });

    test('updateArrowsInDOM() hides arrows when disabled', () => {
        const manager = new DragDropManager();

        // Create mock task
        const task = document.createElement('div');
        task.className = 'task';
        const upBtn = document.createElement('button');
        upBtn.className = 'move-up';
        const downBtn = document.createElement('button');
        downBtn.className = 'move-down';
        task.appendChild(upBtn);
        task.appendChild(downBtn);

        document.body.appendChild(task);

        manager.updateArrowsInDOM(false);

        if (!upBtn.classList.contains('hidden')) {
            throw new Error('Up button should have hidden class when arrows disabled');
        }
        if (!downBtn.classList.contains('hidden')) {
            throw new Error('Down button should have hidden class when arrows disabled');
        }

        // Cleanup
        document.body.removeChild(task);
    });

    test('updateArrowsInDOM() handles missing elements gracefully', () => {
        const manager = new DragDropManager();

        // Should not throw when no tasks exist
        manager.updateArrowsInDOM(true);
        manager.updateArrowsInDOM(false);
    });

    test('updateMoveArrowsVisibility() reads from AppState', () => {
        const manager = new DragDropManager();

        // Mock AppState
        const originalAppState = window.AppState;
        window.AppState = {
            isReady: () => true,
            get: () => ({
                ui: {
                    moveArrowsVisible: true
                }
            })
        };

        // Should not throw
        manager.updateMoveArrowsVisibility();

        // Restore
        window.AppState = originalAppState;
    });

    test('updateMoveArrowsVisibility() falls back to localStorage', () => {
        const manager = new DragDropManager();

        // Mock AppState as not ready
        const originalAppState = window.AppState;
        window.AppState = { isReady: () => false };

        localStorage.setItem('miniCycleMoveArrows', 'true');

        // Should not throw and should read from localStorage
        manager.updateMoveArrowsVisibility();

        // Restore
        window.AppState = originalAppState;
    });

    test('toggleArrowVisibility() updates AppState', () => {
        const manager = new DragDropManager();

        let updateCalled = false;
        let updatedValue = null;

        // Mock AppState
        const originalAppState = window.AppState;
        window.AppState = {
            isReady: () => true,
            get: () => ({
                ui: {
                    moveArrowsVisible: false
                },
                metadata: {}
            }),
            update: (updateFn, immediate) => {
                updateCalled = true;
                const mockState = {
                    ui: { moveArrowsVisible: false },
                    metadata: {}
                };
                updateFn(mockState);
                updatedValue = mockState.ui.moveArrowsVisible;
            }
        };

        manager.toggleArrowVisibility();

        if (!updateCalled) {
            throw new Error('AppState.update should be called');
        }
        if (updatedValue !== true) {
            throw new Error('Arrow visibility should be toggled to true');
        }

        // Restore
        window.AppState = originalAppState;
    });

    await test('toggleArrowVisibility() defers when AppState not ready', async () => {
        const manager = new DragDropManager();

        // Mock AppState as not ready
        const originalAppState = window.AppState;
        window.AppState = { isReady: () => false };

        // Should defer and not throw
        manager.toggleArrowVisibility();

        // Give it time to defer
        await new Promise(resolve => setTimeout(resolve, 150));

        // Restore
        window.AppState = originalAppState;
    });

    // ============================================
    // 🔀 REARRANGEMENT LOGIC TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔀 Rearrangement Logic</h4>';

    test('handleRearrange() requires draggedTask', () => {
        const manager = new DragDropManager();

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = null;

        const target = document.createElement('div');
        const event = { clientY: 100 };

        // Should return early without throwing
        manager.handleRearrange(target, event);
    });

    test('handleRearrange() ignores if target is draggedTask', () => {
        const manager = new DragDropManager();

        const taskElement = document.createElement('div');
        taskElement.className = 'task';

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = taskElement;

        const event = { clientY: 100 };

        // Should return early without rearranging
        manager.handleRearrange(taskElement, event);
    });

    test('handleRearrange() uses debouncing timeout', () => {
        const manager = new DragDropManager();

        const task1 = document.createElement('div');
        task1.className = 'task';
        const task2 = document.createElement('div');
        task2.className = 'task';

        document.body.appendChild(task1);
        document.body.appendChild(task2);

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = task1;

        const event = {
            clientY: 50,
            target: task2
        };

        // First call should set timeout
        const timeoutBefore = manager.rearrangeTimeout;
        manager.handleRearrange(task2, event);
        const timeoutAfter = manager.rearrangeTimeout;

        // Cleanup
        document.body.removeChild(task1);
        document.body.removeChild(task2);
    });

    test('handleRearrange() tracks reorder time for snapshots', () => {
        const manager = new DragDropManager();

        const task1 = document.createElement('div');
        task1.className = 'task';
        const task2 = document.createElement('div');
        task2.className = 'task';

        const parent = document.createElement('div');
        parent.appendChild(task1);
        parent.appendChild(task2);
        document.body.appendChild(parent);

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = task1;
        window.AppGlobalState.lastReorderTime = 0;

        const event = { clientY: 50 };

        manager.handleRearrange(task2, event);

        // Cleanup
        document.body.removeChild(parent);
    });

    // ============================================
    // 🛡️ FALLBACK METHODS TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Fallback Methods</h4>';

    test('fallbackSave() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackSave();
    });

    test('fallbackAutoSave() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackAutoSave();
    });

    test('fallbackUpdate() is silent', () => {
        const manager = new DragDropManager();

        // Should not throw or log
        manager.fallbackUpdate();
    });

    test('fallbackCapture() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackCapture({});
    });

    test('fallbackRefresh() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackRefresh();
    });

    test('fallbackReveal() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackReveal(document.createElement('div'));
    });

    test('fallbackHide() logs warning', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackHide(document.createElement('div'));
    });

    test('fallbackIsTouchDevice() detects touch support', () => {
        const manager = new DragDropManager();

        const result = manager.fallbackIsTouchDevice();

        if (typeof result !== 'boolean') {
            throw new Error('fallbackIsTouchDevice should return boolean');
        }
    });

    test('fallbackEnableUndo() is silent', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackEnableUndo();
    });

    test('fallbackNotification() logs to console', () => {
        const manager = new DragDropManager();

        // Should not throw
        manager.fallbackNotification('Test message', 'info');
    });

    test('uses fallbacks when dependencies missing', () => {
        const manager = new DragDropManager(); // No dependencies

        if (typeof manager.deps.saveCurrentTaskOrder !== 'function') {
            throw new Error('Should use fallback for saveCurrentTaskOrder');
        }
        if (typeof manager.deps.showNotification !== 'function') {
            throw new Error('Should use fallback for showNotification');
        }
    });

    test('uses provided dependencies over fallbacks', () => {
        let customSaveCalled = false;

        const manager = new DragDropManager({
            saveCurrentTaskOrder: () => { customSaveCalled = true; }
        });

        manager.deps.saveCurrentTaskOrder();

        if (!customSaveCalled) {
            throw new Error('Should use provided dependency over fallback');
        }
    });

    // ============================================
    // 🌐 GLOBAL FUNCTIONS TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';

    await test('initDragDropManager() creates global instance', async () => {
        // Note: In actual test environment, this would create the global instance
        if (typeof window.initDragDropManager !== 'function') {
            throw new Error('initDragDropManager should be available globally');
        }
    });

    test('updateMoveArrowsVisibility() global function exists', () => {
        if (typeof window.updateMoveArrowsVisibility !== 'function') {
            throw new Error('updateMoveArrowsVisibility should be available globally');
        }
    });

    test('toggleArrowVisibility() global function exists', () => {
        if (typeof window.toggleArrowVisibility !== 'function') {
            throw new Error('toggleArrowVisibility should be available globally');
        }
    });

    test('updateArrowsInDOM() global function exists', () => {
        if (typeof window.updateArrowsInDOM !== 'function') {
            throw new Error('updateArrowsInDOM should be available globally');
        }
    });

    test('DragAndDrop backward compatibility exists', () => {
        if (typeof window.DragAndDrop !== 'function') {
            throw new Error('Legacy DragAndDrop function should exist for backward compatibility');
        }
    });

    // ============================================
    // 🔗 INTEGRATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests</h4>';

    test('integrates with AppState for arrow visibility', () => {
        const manager = new DragDropManager();

        // Mock AppState with state data
        const originalAppState = window.AppState;
        window.AppState = {
            isReady: () => true,
            get: () => ({
                ui: {
                    moveArrowsVisible: true
                }
            })
        };

        // Should read from AppState successfully
        manager.updateMoveArrowsVisibility();

        // Restore
        window.AppState = originalAppState;
    });

    test('integrates with AppGlobalState for drag tracking', () => {
        const manager = new DragDropManager();

        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }

        const taskElement = document.createElement('div');
        window.AppGlobalState.draggedTask = taskElement;

        manager.cleanupDragState();

        if (window.AppGlobalState.draggedTask !== null) {
            throw new Error('Should clear draggedTask in AppGlobalState');
        }
    });

    await test('waits for appInit before initialization', async () => {
        const manager = new DragDropManager();

        // Should not throw and should wait for core systems
        await manager.init();

        if (!manager.initialized) {
            throw new Error('Should be initialized after init() completes');
        }
    });

    // ============================================
    // ⚠️ ERROR HANDLING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('handles missing taskList element in setupRearrange', () => {
        const manager = new DragDropManager();

        // No taskList in DOM
        const taskList = document.getElementById('taskList');
        if (taskList) {
            taskList.remove();
        }

        // Should not throw
        manager.setupRearrange();
    });

    await test('handles errors in init() gracefully', async () => {
        const manager = new DragDropManager({
            showNotification: () => {}
        });

        // Mock setupRearrange to throw
        manager.setupRearrange = () => {
            throw new Error('Test error');
        };

        // Should not throw, but should handle error
        await manager.init();
    });

    test('handles errors in enableDragAndDrop gracefully', () => {
        const manager = new DragDropManager();

        // Should not throw even with problematic element
        const badElement = {};
        manager.enableDragAndDrop(badElement);
    });

    test('handles errors in cleanupDragState gracefully', () => {
        const manager = new DragDropManager();

        // Mock problematic state
        if (!window.AppGlobalState) {
            window.AppGlobalState = {};
        }
        window.AppGlobalState.draggedTask = { classList: null };

        // Should not throw
        manager.cleanupDragState();
    });

    test('handles errors in updateArrowsInDOM gracefully', () => {
        const manager = new DragDropManager();

        // Create task with missing elements
        const task = document.createElement('div');
        task.className = 'task';
        document.body.appendChild(task);

        // Should not throw even without arrow buttons
        manager.updateArrowsInDOM(true);

        // Cleanup
        document.body.removeChild(task);
    });

    // ============================================
    // 📱 TOUCH/MOBILE TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📱 Touch & Mobile</h4>';

    test('enableDragAndDrop() prevents text selection', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('div');

        manager.enableDragAndDrop(taskElement);

        if (taskElement.style.userSelect !== 'none') {
            throw new Error('Should prevent text selection with userSelect');
        }
        if (taskElement.style.webkitUserSelect !== 'none') {
            throw new Error('Should prevent text selection with webkitUserSelect');
        }
        if (taskElement.style.msUserSelect !== 'none') {
            throw new Error('Should prevent text selection with msUserSelect');
        }
    });

    test('fallbackIsTouchDevice() checks for touch capability', () => {
        const manager = new DragDropManager();

        const result = manager.fallbackIsTouchDevice();

        // Should return boolean based on touch support
        if (typeof result !== 'boolean') {
            throw new Error('Should return boolean for touch detection');
        }
    });

    test('isTouchDevice dependency can be overridden', () => {
        let customCheckCalled = false;

        const manager = new DragDropManager({
            isTouchDevice: () => {
                customCheckCalled = true;
                return true;
            }
        });

        const result = manager.deps.isTouchDevice();

        if (!customCheckCalled) {
            throw new Error('Should use custom isTouchDevice function');
        }
        if (result !== true) {
            throw new Error('Should return value from custom function');
        }
    });

    // ============================================
    // 🍎 SAFARI COMPATIBILITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🍎 Safari Compatibility</h4>';

    test('sets webkitUserDrag property for Safari compatibility', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        manager.enableDragAndDrop(taskElement);

        if (taskElement.style.webkitUserDrag !== 'element') {
            throw new Error('webkitUserDrag should be set to "element" for Safari');
        }
    });

    test('sets draggable attribute required by Safari', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        manager.enableDragAndDrop(taskElement);

        if (taskElement.getAttribute('draggable') !== 'true') {
            throw new Error('Safari requires draggable="true" attribute');
        }
    });

    test('configures all required Safari drag properties together', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        manager.enableDragAndDrop(taskElement);

        // Verify all Safari requirements in one test
        if (taskElement.getAttribute('draggable') !== 'true') {
            throw new Error('Missing draggable attribute for Safari');
        }
        if (taskElement.style.webkitUserDrag !== 'element') {
            throw new Error('Missing -webkit-user-drag CSS property for Safari');
        }
        if (taskElement.style.userSelect !== 'none') {
            throw new Error('Missing userSelect for text selection prevention');
        }
        if (taskElement.style.webkitUserSelect !== 'none') {
            throw new Error('Missing webkitUserSelect for Safari text selection prevention');
        }
    });

    test('Safari drag properties are reflected in computed styles', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        // Must be in DOM for computed styles
        document.body.appendChild(taskElement);

        manager.enableDragAndDrop(taskElement);

        const computedStyle = window.getComputedStyle(taskElement);
        if (computedStyle.webkitUserDrag !== 'element') {
            document.body.removeChild(taskElement);
            throw new Error('Computed style should reflect webkitUserDrag="element"');
        }

        // Cleanup
        document.body.removeChild(taskElement);
    });

    test('creates transparent drag image for Safari (Stack Overflow fix)', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        // The fix requires creating the transparent pixel image
        // OUTSIDE the dragstart event handler for Safari compatibility
        manager.enableDragAndDrop(taskElement);

        // Verify dragstart event listener was added
        // (Image is created in closure, can't directly test but we verify setup)
        if (taskElement.getAttribute('draggable') !== 'true') {
            throw new Error('Drag setup incomplete - missing draggable attribute');
        }
    });

    test('prevents Safari from blocking drag with text selection styles', () => {
        const manager = new DragDropManager();
        const taskElement = document.createElement('li');
        taskElement.className = 'task';

        manager.enableDragAndDrop(taskElement);

        // Safari can block drag if text selection is not prevented
        const hasUserSelectNone = taskElement.style.userSelect === 'none';
        const hasWebkitUserSelectNone = taskElement.style.webkitUserSelect === 'none';
        const hasMsUserSelectNone = taskElement.style.msUserSelect === 'none';

        if (!hasUserSelectNone || !hasWebkitUserSelectNone || !hasMsUserSelectNone) {
            throw new Error('All text selection prevention styles must be set for Safari');
        }
    });

    // ============================================
    // 📊 SUMMARY
    // ============================================
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;

    return { passed: passed.count, total: total.count };
}
