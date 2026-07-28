/**
 * 🧪 DragDropManager Tests
 * Tests for drag-and-drop task reordering functionality
 *
 * Updated for Phase 3 DI Pattern - direct module imports
 * @version 2.2.0 - Standalone tests (Dec 2025)
 */

import {
    DragDropManager,
    setDragDropManagerDependencies
} from '../modules/task/dragDropManager.js';

import {
    setupTestEnvironment,
    createProtectedTest
} from './testHelpers.js';

export async function runDragDropManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔄 DragDropManager Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Set up DragDropManager module dependencies
    setDragDropManagerDependencies({
        safeAddEventListener: env.deps.safeAddEventListener
    });

    resultsDiv.innerHTML = '<h2>🔄 DragDropManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    test('DragDropManager class is defined', () => {
        if (typeof DragDropManager === 'undefined') {
            throw new Error('DragDropManager class not found');
        }
    });

    test('DragDropManager class is exported from module', () => {
        if (typeof DragDropManager !== 'function') {
            throw new Error('DragDropManager not exported from module');
        }
    });


    // NOTE: Legacy DragAndDrop test removed - Phase 3 intentionally removes window.* pollution
    // The module now uses ES6 exports only, accessed via the main script

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
            showNotification: (msg) => {},
            updateProgressBar: () => {},
            AppState: { isReady: () => true, get: () => null }
        };

        const manager = new DragDropManager(mockDeps);

        if (!manager) {
            throw new Error('Failed to create instance with dependencies');
        }
        if (!manager.deps.showNotification) {
            throw new Error('Dependencies not stored correctly');
        }
    });

    test('has correct default timeout values', () => {
        const manager = new DragDropManager();

        if (manager.REARRANGE_DELAY !== 75) {
            throw new Error(`Expected REARRANGE_DELAY to be 75ms, got ${manager.REARRANGE_DELAY}ms`);
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

        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);
        try {
            manager.setupRearrange();
            // setupRearrange installs the arrow-click handler on #taskList and the
            // dragover/drop handlers on the manager. The old test only ran it ("does not throw").
            if (typeof taskList._arrowClickHandler !== 'function') {
                throw new Error('setupRearrange should install the arrow-click handler on #taskList');
            }
            if (typeof manager._dragoverHandler !== 'function' || typeof manager._dropHandler !== 'function') {
                throw new Error('setupRearrange should install dragover/drop handlers');
            }
        } finally {
            document.body.removeChild(taskList);
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

        // enableDragAndDrop attaches its touchstart handler via safeAddEventListener,
        // which forwards to taskElement.addEventListener — captured by the spy above.
        // The old test set touchStartCalled and then never asserted it.
        if (!touchStartCalled) {
            throw new Error('enableDragAndDrop should register a touchstart listener on the task element');
        }
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

    // Shared builder: a #taskList DOM whose child order mirrors the state's tasks
    // array, wired to a DragDropManager via a mock AppState. handleArrowClick reads
    // the current index from the DOM and reorders the state tasks array (splice
    // currentIndex→newIndex), so these tests assert on that array — the real contract.
    // (The old three tests built this DOM and then never called handleArrowClick at all.)
    function buildArrowScenario(ids, arrowIndex, arrowClass) {
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        ids.forEach(id => {
            const t = document.createElement('div');
            t.className = 'task';
            t.dataset.taskId = id;
            taskList.appendChild(t);
        });
        document.body.appendChild(taskList);

        const button = document.createElement('button');
        button.className = arrowClass;
        taskList.children[arrowIndex].appendChild(button);

        const state = {
            appState: { activeCycleId: 'c1' },
            data: { cycles: { c1: { tasks: ids.map(id => ({ id })) } } },
            metadata: {},
            ui: {}
        };
        const manager = new DragDropManager({
            AppState: { isReady: () => true, get: () => state, update: (fn) => { fn(state); return state; } },
            refreshUIFromState: () => {},
            captureStateSnapshot: () => {},
            updateUndoRedoButtons: () => {}
        });
        return { taskList, button, state, manager };
    }

    const arrowOrder = (state) => state.data.cycles.c1.tasks.map(t => t.id).join(',');

    await test('handleArrowClick() moves a task up (reorders the state tasks array)', async () => {
        const { taskList, button, state, manager } = buildArrowScenario(['task-1', 'task-2', 'task-3'], 1, 'move-up');
        try {
            await manager.handleArrowClick(button);
            if (arrowOrder(state) !== 'task-2,task-1,task-3') {
                throw new Error(`move-up should reorder to task-2,task-1,task-3; got ${arrowOrder(state)}`);
            }
        } finally { document.body.removeChild(taskList); }
    });

    await test('handleArrowClick() moves a task down (reorders the state tasks array)', async () => {
        const { taskList, button, state, manager } = buildArrowScenario(['task-1', 'task-2', 'task-3'], 1, 'move-down');
        try {
            await manager.handleArrowClick(button);
            if (arrowOrder(state) !== 'task-1,task-3,task-2') {
                throw new Error(`move-down should reorder to task-1,task-3,task-2; got ${arrowOrder(state)}`);
            }
        } finally { document.body.removeChild(taskList); }
    });

    await test('handleArrowClick() does not move a task beyond bounds (top stays put)', async () => {
        const { taskList, button, state, manager } = buildArrowScenario(['task-1', 'task-2', 'task-3'], 0, 'move-up');
        try {
            await manager.handleArrowClick(button);
            if (arrowOrder(state) !== 'task-1,task-2,task-3') {
                throw new Error(`move-up at the top should be a no-op; got ${arrowOrder(state)}`);
            }
        } finally { document.body.removeChild(taskList); }
    });

    // ============================================
    // 👁️ ARROW VISIBILITY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ Arrow Visibility</h4>';

    test('updateArrowsInDOM() sets data-move-arrows attribute and first/last markers', () => {
        const manager = new DragDropManager();

        // Create mock taskList container (required for CSS-driven approach)
        const taskList = document.createElement('div');
        taskList.id = 'taskList';

        // Create two mock tasks
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

        taskList.appendChild(task1);
        taskList.appendChild(task2);
        document.body.appendChild(taskList);

        // Test arrows disabled
        manager.updateArrowsInDOM(false);
        if (taskList.dataset.moveArrows !== 'false') {
            throw new Error('taskList should have data-move-arrows="false" when arrows disabled');
        }

        // Test arrows enabled
        manager.updateArrowsInDOM(true);
        if (taskList.dataset.moveArrows !== 'true') {
            throw new Error('taskList should have data-move-arrows="true" when arrows enabled');
        }

        // Check first/last markers
        if (!task1.classList.contains('is-first-task')) {
            throw new Error('First task should have is-first-task class');
        }
        if (!task2.classList.contains('is-last-task')) {
            throw new Error('Last task should have is-last-task class');
        }

        // Cleanup
        document.body.removeChild(taskList);
    });

    test('updateArrowsInDOM() handles missing elements gracefully', () => {
        const manager = new DragDropManager();

        // Should not throw when no tasks exist
        manager.updateArrowsInDOM(true);
        manager.updateArrowsInDOM(false);
    });

    // NOTE: two former updateMoveArrowsVisibility() tests removed here.
    //  • 'reads from AppState' set window.AppState — which the module IGNORES (it reads the
    //    injected this.deps.AppState) — and asserted nothing. The real AppState→DOM path is
    //    now covered by 'updateMoveArrowsVisibility() reflects injected AppState into the
    //    taskList DOM' above, with a real data-move-arrows assertion.
    //  • 'falls back to localStorage' was mis-premised: updateMoveArrowsVisibility() early-
    //    returns when AppState isn't ready — there is no localStorage fallback. (Test-suite audit.)

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

    // NOTE: three former handleRearrange() tests were removed here. Each asserted
    // nothing AND was built on the removed `window.AppGlobalState.draggedTask` global —
    // drag state moved to instance fields (`this.draggedTask`), so none exercised the
    // real drag-over reorder path. Rather than keep zero-coverage tests that only look
    // like coverage, they were deleted; the arrow-button reorder contract is covered
    // above with real AppState-driven tests. (Test-suite audit.)

    // ============================================
    // 🛡️ DI DEPENDENCY TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ DI Dependency Tests</h4>';

    test('fallbackNotification() logs to console', () => {
        const manager = new DragDropManager();

        // Should not throw - this is the only remaining fallback
        manager.fallbackNotification('Test message', 'info');
    });

    test('uses showNotification fallback when dependencies missing', () => {
        const manager = new DragDropManager(); // No dependencies

        // showNotification should fall back to fallbackNotification
        if (typeof manager.deps.showNotification !== 'function') {
            throw new Error('Should have showNotification function (fallback or injected)');
        }
    });

    test('uses provided dependencies over fallbacks', () => {
        let customNotificationCalled = false;

        const manager = new DragDropManager({
            showNotification: () => { customNotificationCalled = true; }
        });

        manager.deps.showNotification('test', 'info');

        if (!customNotificationCalled) {
            throw new Error('Should use provided dependency over fallback');
        }
    });

    // ============================================
    // 🌐 GLOBAL FUNCTIONS TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Functions</h4>';


    // NOTE: DragAndDrop backward compatibility test removed - Phase 3 pattern
    // Legacy window.DragAndDrop is no longer exposed; use ES6 imports instead

    // ============================================
    // 🔗 INTEGRATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration Tests</h4>';

    test('updateMoveArrowsVisibility() reflects injected AppState into the taskList DOM', () => {
        // Real wiring: updateMoveArrowsVisibility reads state.ui.moveArrowsVisible from the
        // INJECTED AppState (this.deps.AppState — NOT window.AppState) and forwards it to
        // updateArrowsInDOM → setArrowsEnabled, which sets #taskList's data-move-arrows.
        // The old test set window.AppState (ignored by the module) and asserted nothing.
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);
        try {
            const manager = new DragDropManager({
                AppState: { isReady: () => true, get: () => ({ ui: { moveArrowsVisible: true } }) }
            });
            manager.updateMoveArrowsVisibility();
            if (taskList.dataset.moveArrows !== 'true') {
                throw new Error(`expected #taskList data-move-arrows="true", got ${taskList.dataset.moveArrows}`);
            }
        } finally { document.body.removeChild(taskList); }
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

    test('showNotification dependency can be overridden', () => {
        let customNotifCalled = false;

        const manager = new DragDropManager({
            showNotification: (msg, type) => {
                customNotifCalled = true;
            }
        });

        manager.deps.showNotification('test', 'info');

        if (!customNotifCalled) {
            throw new Error('Should use custom showNotification function');
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
