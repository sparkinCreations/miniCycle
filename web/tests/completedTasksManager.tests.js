/**
 * CompletedTasksManager Tests (DI-Pure)
 * Tests for modules/ui/completedTasksManager.js
 *
 * Tests the completed tasks dropdown functionality:
 * - Section initialization
 * - Toggle expand/collapse
 * - Moving tasks between active and completed lists
 * - Count updates
 * - Feature enable/disable checks
 */

let CompletedTasksManager = null;
let setCompletedTasksManagerDependencies = null;

export async function runCompletedTasksManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>✅ CompletedTasksManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const module = await import('../modules/ui/completedTasksManager.js');
        CompletedTasksManager = module.CompletedTasksManager;
        setCompletedTasksManagerDependencies = module.setCompletedTasksManagerDependencies;
        resultsDiv.innerHTML = '<h2>✅ CompletedTasksManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>✅ CompletedTasksManager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    if (!CompletedTasksManager) {
        resultsDiv.innerHTML += '<div class="result fail">❌ CompletedTasksManager class not found</div>';
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 }, total = { count: 0 };

    // Create mock dependencies
    function createMockDeps(overrides = {}) {
        return {
            getAppState: () => ({
                isReady: () => true,
                get: () => ({
                    settings: { completedTasksExpanded: false, showCompletedDropdown: true }
                }),
                update: () => {}
            }),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            safeAddEventListener: (el, evt, fn) => el?.addEventListener(evt, fn),
            ...overrides
        };
    }

    // Create DOM elements for testing
    function createTestDOM() {
        const container = document.createElement('div');
        container.id = 'test-completed-tasks-container';
        container.innerHTML = `
            <div id="completed-tasks-section" style="display: none;">
                <div id="completed-tasks-header">
                    <span>Completed</span>
                    <span class="toggle-icon">▼</span>
                    <span id="completed-count">0</span>
                </div>
                <ul id="completedTaskList"></ul>
            </div>
            <ul id="taskList"></ul>
            <input type="checkbox" id="toggle-completed-dropdown" />
        `;
        document.body.appendChild(container);
        return container;
    }

    function cleanupTestDOM() {
        const container = document.getElementById('test-completed-tasks-container');
        if (container) container.remove();
    }

    function createMockTask(id, completed = false) {
        const task = document.createElement('li');
        task.className = 'task';
        task.id = `task-${id}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = completed;
        task.appendChild(checkbox);
        return task;
    }

    async function test(name, testFn) {
        total.count++;
        try {
            cleanupTestDOM();
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            cleanupTestDOM();
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization Tests</h4>';

    await test('CompletedTasksManager class exists', async () => {
        if (typeof CompletedTasksManager !== 'function') {
            throw new Error('CompletedTasksManager class not found');
        }
    });

    await test('creates instance with DI successfully', async () => {
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();
        if (!manager || typeof manager.init !== 'function') {
            throw new Error('CompletedTasksManager not properly initialized');
        }
    });

    await test('has isInitialized flag set to false initially', async () => {
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();
        if (manager.isInitialized !== false) {
            throw new Error('isInitialized should be false before init()');
        }
    });

    await test('init sets isInitialized to true', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();
        manager.init();
        if (manager.isInitialized !== true) {
            throw new Error('isInitialized should be true after init()');
        }
    });

    await test('init handles missing DOM elements gracefully', async () => {
        // No DOM created
        setCompletedTasksManagerDependencies(createMockDeps({
            getElementById: () => null
        }));
        const manager = new CompletedTasksManager();
        // Should not throw
        manager.init();
        if (manager.isInitialized !== false) {
            throw new Error('isInitialized should remain false when DOM missing');
        }
    });

    // === TOGGLE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Toggle Tests</h4>';

    await test('toggle expands collapsed section', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const completedList = document.getElementById('completedTaskList');
        const toggleIcon = document.querySelector('#completed-tasks-header .toggle-icon');

        manager.toggle();

        if (!completedList.classList.contains('visible')) {
            throw new Error('Section should be visible after toggle');
        }
        if (toggleIcon.textContent !== '▲') {
            throw new Error('Toggle icon should be ▲ when expanded');
        }
    });

    await test('toggle collapses expanded section', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const completedList = document.getElementById('completedTaskList');
        const toggleIcon = document.querySelector('#completed-tasks-header .toggle-icon');

        // First toggle to expand
        manager.toggle();
        // Second toggle to collapse
        manager.toggle();

        if (completedList.classList.contains('visible')) {
            throw new Error('Section should be hidden after second toggle');
        }
        if (toggleIcon.textContent !== '▼') {
            throw new Error('Toggle icon should be ▼ when collapsed');
        }
    });

    await test('toggle saves state to AppState', async () => {
        createTestDOM();
        let savedState = null;
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: {} }),
                update: (fn) => {
                    const state = { settings: {} };
                    fn(state);
                    savedState = state;
                }
            })
        }));
        const manager = new CompletedTasksManager();

        manager.toggle();

        if (!savedState || savedState.settings.completedTasksExpanded !== true) {
            throw new Error('State should be saved with completedTasksExpanded: true');
        }
    });

    await test('toggle handles missing DOM gracefully', async () => {
        setCompletedTasksManagerDependencies(createMockDeps({
            getElementById: () => null,
            querySelector: () => null
        }));
        const manager = new CompletedTasksManager();
        // Should not throw
        manager.toggle();
    });

    // === RESTORE STATE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Restore State Tests</h4>';

    await test('restoreState expands section when saved as expanded', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { completedTasksExpanded: true } })
            })
        }));
        const manager = new CompletedTasksManager();

        manager.restoreState();

        const completedList = document.getElementById('completedTaskList');
        if (!completedList.classList.contains('visible')) {
            throw new Error('Section should be expanded');
        }
    });

    await test('restoreState keeps section collapsed when saved as collapsed', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { completedTasksExpanded: false } })
            })
        }));
        const manager = new CompletedTasksManager();

        manager.restoreState();

        const completedList = document.getElementById('completedTaskList');
        if (completedList.classList.contains('visible')) {
            throw new Error('Section should be collapsed');
        }
    });

    await test('restoreState handles AppState not ready', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({ isReady: () => false })
        }));
        const manager = new CompletedTasksManager();
        // Should not throw
        manager.restoreState();
    });

    // === MOVE TASKS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Move Tasks Tests</h4>';

    await test('moveToCompleted moves task to completed list', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');
        const task = createMockTask('1');
        taskList.appendChild(task);

        manager.moveToCompleted(task);

        if (!completedList.contains(task)) {
            throw new Error('Task should be in completed list');
        }
        if (taskList.contains(task)) {
            throw new Error('Task should not be in active list');
        }
    });

    await test('moveToCompleted shows completed section', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedSection = document.getElementById('completed-tasks-section');
        const task = createMockTask('1');
        taskList.appendChild(task);

        manager.moveToCompleted(task);

        if (completedSection.style.display === 'none') {
            throw new Error('Completed section should be visible');
        }
    });

    await test('moveToActive moves task back to active list', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');
        const task = createMockTask('1');
        completedList.appendChild(task);

        manager.moveToActive(task);

        if (!taskList.contains(task)) {
            throw new Error('Task should be in active list');
        }
        if (completedList.contains(task)) {
            throw new Error('Task should not be in completed list');
        }
    });

    await test('moveToActive inserts at top of list', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const existingTask = createMockTask('existing');
        taskList.appendChild(existingTask);

        const completedList = document.getElementById('completedTaskList');
        const movedTask = createMockTask('moved');
        completedList.appendChild(movedTask);

        manager.moveToActive(movedTask);

        if (taskList.firstChild !== movedTask) {
            throw new Error('Moved task should be at top of list');
        }
    });

    await test('moveToCompleted handles null task gracefully', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();
        // Should not throw
        manager.moveToCompleted(null);
    });

    await test('moveToActive handles null task gracefully', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();
        // Should not throw
        manager.moveToActive(null);
    });

    // === COUNT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Count Tests</h4>';

    await test('updateCount displays correct count', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const completedList = document.getElementById('completedTaskList');
        completedList.appendChild(createMockTask('1'));
        completedList.appendChild(createMockTask('2'));
        completedList.appendChild(createMockTask('3'));

        manager.updateCount();

        const countDisplay = document.getElementById('completed-count');
        if (countDisplay.textContent !== '3') {
            throw new Error(`Expected count 3, got ${countDisplay.textContent}`);
        }
    });

    await test('updateCount hides section when count is 0', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const completedSection = document.getElementById('completed-tasks-section');
        completedSection.style.display = 'block';

        manager.updateCount();

        if (completedSection.style.display !== 'none') {
            throw new Error('Section should be hidden when count is 0');
        }
    });

    await test('updateCount shows section when count > 0', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps());
        const manager = new CompletedTasksManager();

        const completedList = document.getElementById('completedTaskList');
        completedList.appendChild(createMockTask('1'));

        manager.updateCount();

        const completedSection = document.getElementById('completed-tasks-section');
        if (completedSection.style.display === 'none') {
            throw new Error('Section should be visible when count > 0');
        }
    });

    // === IS ENABLED TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ Feature Enable Tests</h4>';

    await test('isEnabled returns true when AppState has showCompletedDropdown true', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: true } })
            })
        }));
        const manager = new CompletedTasksManager();

        if (!manager.isEnabled()) {
            throw new Error('isEnabled should return true');
        }
    });

    await test('isEnabled returns false when AppState has showCompletedDropdown false', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: false } })
            })
        }));
        const manager = new CompletedTasksManager();

        if (manager.isEnabled()) {
            throw new Error('isEnabled should return false');
        }
    });

    await test('isEnabled falls back to checkbox when AppState not ready', async () => {
        createTestDOM();
        const toggle = document.getElementById('toggle-completed-dropdown');
        toggle.checked = true;

        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({ isReady: () => false })
        }));
        const manager = new CompletedTasksManager();

        if (!manager.isEnabled()) {
            throw new Error('isEnabled should return true from checkbox fallback');
        }
    });

    // === HANDLE MOVEMENT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔀 Handle Movement Tests</h4>';

    await test('handleMovement moves completed task when feature enabled', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: true } })
            })
        }));
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');
        const task = createMockTask('1', true);
        taskList.appendChild(task);

        manager.handleMovement(task, true);

        if (!completedList.contains(task)) {
            throw new Error('Task should be moved to completed list');
        }
    });

    await test('handleMovement moves uncompleted task back when feature enabled', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: true } })
            })
        }));
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');
        const task = createMockTask('1', false);
        completedList.appendChild(task);

        manager.handleMovement(task, false);

        if (!taskList.contains(task)) {
            throw new Error('Task should be moved back to active list');
        }
    });

    await test('handleMovement does nothing when feature disabled', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: false } })
            })
        }));
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');
        const task = createMockTask('1', true);
        taskList.appendChild(task);

        manager.handleMovement(task, true);

        if (completedList.contains(task)) {
            throw new Error('Task should not be moved when feature disabled');
        }
        if (!taskList.contains(task)) {
            throw new Error('Task should remain in active list');
        }
    });

    // === ORGANIZE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Organize Tests</h4>';

    await test('organize moves all completed tasks to completed section', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: true } })
            })
        }));
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');

        taskList.appendChild(createMockTask('1', false));
        taskList.appendChild(createMockTask('2', true));
        taskList.appendChild(createMockTask('3', false));
        taskList.appendChild(createMockTask('4', true));

        manager.organize();

        if (completedList.children.length !== 2) {
            throw new Error(`Expected 2 completed tasks, got ${completedList.children.length}`);
        }
        if (taskList.querySelectorAll('.task').length !== 2) {
            throw new Error(`Expected 2 active tasks, got ${taskList.querySelectorAll('.task').length}`);
        }
    });

    await test('organize does nothing when feature disabled', async () => {
        createTestDOM();
        setCompletedTasksManagerDependencies(createMockDeps({
            getAppState: () => ({
                isReady: () => true,
                get: () => ({ settings: { showCompletedDropdown: false } })
            })
        }));
        const manager = new CompletedTasksManager();

        const taskList = document.getElementById('taskList');
        const completedList = document.getElementById('completedTaskList');

        taskList.appendChild(createMockTask('1', true));
        taskList.appendChild(createMockTask('2', true));

        manager.organize();

        if (completedList.children.length !== 0) {
            throw new Error('No tasks should be moved when feature disabled');
        }
    });

    // === SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}
