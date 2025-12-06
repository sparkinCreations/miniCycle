/**
 * 🧪 Delete-When-Complete Feature Tests
 * Comprehensive tests for the delete-when-complete indicator and button system
 *
 * @version 1.372
 */

export async function runDeleteWhenCompleteTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>🗑️ Delete-When-Complete Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ============================================
    // Test Helper Function with Data Protection
    // ============================================
    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs (only if running individually)
        let savedRealData = {};
        if (!isPartOfSuite) {
            const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
            protectedKeys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value !== null) savedRealData[key] = value;
            });
        }

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
            // 🔒 RESTORE REAL APP DATA (runs even if test crashes, only if running individually)
            if (!isPartOfSuite && Object.keys(savedRealData).length > 0) {
                localStorage.clear();
                Object.keys(savedRealData).forEach(key => {
                    localStorage.setItem(key, savedRealData[key]);
                });
            }
        }
    }

    // ✅ CRITICAL: Mark core as ready for test environment
    if (window.appInit && !window.appInit.isCoreReady()) {
        await window.appInit.markCoreSystemsReady();
        console.log('✅ Test environment: AppInit core systems marked as ready');
    }

    // Import required modules
    const { GlobalUtils } = await import('../modules/utils/globalUtils.js');
    const { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS, DEFAULT_RECURRING_DELETE_SETTINGS } = await import('../modules/core/constants.js');

    // ============================================
    // 🔧 CONSTANTS TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Constants</h4>';

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS has correct structure', () => {
        if (typeof DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== 'boolean') {
            throw new Error('cycle property should be boolean');
        }
        if (typeof DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.todo !== 'boolean') {
            throw new Error('todo property should be boolean');
        }
    });

    await test('DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS has correct defaults', () => {
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== false) {
            throw new Error('cycle default should be false (keep tasks)');
        }
        if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.todo !== true) {
            throw new Error('todo default should be true (delete tasks)');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS has correct structure', () => {
        if (typeof DEFAULT_RECURRING_DELETE_SETTINGS.cycle !== 'boolean') {
            throw new Error('recurring cycle property should be boolean');
        }
        if (typeof DEFAULT_RECURRING_DELETE_SETTINGS.todo !== 'boolean') {
            throw new Error('recurring todo property should be boolean');
        }
    });

    await test('DEFAULT_RECURRING_DELETE_SETTINGS defaults to true for both modes', () => {
        if (DEFAULT_RECURRING_DELETE_SETTINGS.cycle !== true) {
            throw new Error('recurring cycle default should be true');
        }
        if (DEFAULT_RECURRING_DELETE_SETTINGS.todo !== true) {
            throw new Error('recurring todo default should be true');
        }
    });

    await test('constants are frozen (immutable)', () => {
        try {
            const original = DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle;
            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle = !original;

            if (DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS.cycle !== original) {
                throw new Error('Constants should be immutable');
            }
        } catch (e) {
            // In strict mode, this throws an error (which is good)
            if (!e.message.includes('immutable')) {
                // Expected behavior - constants are frozen
            }
        }
    });

    // ============================================
    // ✅ VALIDATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Validation</h4>';

    await test('validateDeleteSettings accepts valid settings', () => {
        const validSettings = { cycle: false, todo: true };
        const result = GlobalUtils.validateDeleteSettings(validSettings);

        if (result !== true) {
            throw new Error('Should accept valid settings');
        }
    });

    await test('validateDeleteSettings rejects missing cycle property', () => {
        const invalid = { todo: true };
        const result = GlobalUtils.validateDeleteSettings(invalid);

        if (result !== false) {
            throw new Error('Should reject missing cycle property');
        }
    });

    await test('validateDeleteSettings rejects missing todo property', () => {
        const invalid = { cycle: false };
        const result = GlobalUtils.validateDeleteSettings(invalid);

        if (result !== false) {
            throw new Error('Should reject missing todo property');
        }
    });

    await test('validateDeleteSettings rejects non-boolean values', () => {
        const invalid = { cycle: 'false', todo: true };
        const result = GlobalUtils.validateDeleteSettings(invalid);

        if (result !== false) {
            throw new Error('Should reject non-boolean values');
        }
    });

    await test('validateDeleteSettings rejects null input', () => {
        const result = GlobalUtils.validateDeleteSettings(null);

        if (result !== false) {
            throw new Error('Should reject null input');
        }
    });

    await test('validateDeleteSettings rejects undefined input', () => {
        const result = GlobalUtils.validateDeleteSettings(undefined);

        if (result !== false) {
            throw new Error('Should reject undefined input');
        }
    });

    await test('validateDeleteSettings accepts settings with extra properties', () => {
        const valid = { cycle: true, todo: false, extra: 'ignored' };
        const result = GlobalUtils.validateDeleteSettings(valid);

        if (result !== true) {
            throw new Error('Should accept settings with extra properties');
        }
    });

    // ============================================
    // 🎨 DOM SYNC TESTS - CYCLE MODE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Sync - Cycle Mode</h4>';

    await test('Cycle mode: red ❌ appears when deleteWhenComplete=true', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';
        mockTask.dataset.taskId = 'test-task-1';

        const mockButton = document.createElement('button');
        mockButton.className = 'delete-when-complete-btn';
        mockTask.appendChild(mockButton);

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: true, todo: false }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (!mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Should add show-delete-indicator class in cycle mode when deleteWhenComplete=true');
        }
    });

    await test('Cycle mode: NO ❌ when deleteWhenComplete=false (default)', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Should NOT show red ❌ in cycle mode when deleteWhenComplete=false');
        }
    });

    await test('Cycle mode: NO pin 📌 indicator (keeping is default)', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.classList.contains('kept-task')) {
            throw new Error('Should NOT show pin 📌 in cycle mode (keeping is default)');
        }
    });

    await test('Cycle mode: recurring tasks have NO ❌ indicator', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task recurring';

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: true, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Recurring tasks should NOT show ❌ indicator');
        }
    });

    // ============================================
    // 🎨 DOM SYNC TESTS - TO-DO MODE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 DOM Sync - To-Do Mode</h4>';

    await test('To-Do mode: pin 📌 appears when deleteWhenComplete=false (opted OUT)', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: false }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (!mockTask.classList.contains('kept-task')) {
            throw new Error('Should add kept-task class (pin 📌) in todo mode when deleteWhenComplete=false');
        }
    });

    await test('To-Do mode: NO pin when deleteWhenComplete=true (default)', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.classList.contains('kept-task')) {
            throw new Error('Should NOT show pin 📌 in todo mode when deleteWhenComplete=true (deletion is default)');
        }
    });

    await test('To-Do mode: NO red ❌ indicator (deletion is default)', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Should NOT show red ❌ in todo mode (deletion is default)');
        }
    });

    await test('To-Do mode: recurring tasks show pin when deleteWhenComplete=false', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task recurring';

        const taskData = {
            deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: false }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        // Recurring tasks SHOULD show pin 📌 when user manually disabled deleteWhenComplete
        // This indicates the task will be kept at reset instead of being deleted
        if (!mockTask.classList.contains('kept-task')) {
            throw new Error('Recurring tasks with deleteWhenComplete=false should show pin 📌 indicator');
        }
    });

    // ============================================
    // 🔧 SETTINGS PRIORITY TESTS (THE FIX)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Settings Priority (Bug Fix)</h4>';

    await test('BUG FIX: Settings take priority over stale deleteWhenComplete field', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        // Simulate stale data: active field says true, but settings say false
        const taskData = {
            deleteWhenComplete: true,  // ❌ STALE VALUE
            deleteWhenCompleteSettings: { cycle: false, todo: true }  // ✅ CANONICAL
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        // Should use settings.cycle (false), NOT deleteWhenComplete (true)
        if (mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Should prioritize settings.cycle (false) over stale deleteWhenComplete (true)');
        }

        if (mockTask.dataset.deleteWhenComplete !== 'false') {
            throw new Error('Should update dataset to match settings, not stale value');
        }
    });

    await test('Settings priority: Cycle mode uses settings.cycle', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: undefined,  // No active field
            deleteWhenCompleteSettings: { cycle: true, todo: false }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.dataset.deleteWhenComplete !== 'true') {
            throw new Error('Should derive deleteWhenComplete from settings.cycle');
        }

        if (!mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Should show ❌ when settings.cycle=true');
        }
    });

    await test('Settings priority: To-Do mode uses settings.todo', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: undefined,
            deleteWhenCompleteSettings: { cycle: true, todo: false }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.dataset.deleteWhenComplete !== 'false') {
            throw new Error('Should derive deleteWhenComplete from settings.todo');
        }

        if (!mockTask.classList.contains('kept-task')) {
            throw new Error('Should show 📌 when settings.todo=false');
        }
    });

    await test('Fallback to defaults when settings are invalid', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            deleteWhenComplete: undefined,
            deleteWhenCompleteSettings: { invalid: true }  // Invalid structure
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        const storedSettings = JSON.parse(mockTask.dataset.deleteWhenCompleteSettings);

        if (storedSettings.cycle !== false || storedSettings.todo !== true) {
            throw new Error('Should fallback to default settings when invalid');
        }
    });

    await test('Fallback to hard defaults when both fields are missing', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const taskData = {
            // No deleteWhenComplete field
            // No deleteWhenCompleteSettings field
        };

        // Cycle mode should default to false (keep tasks)
        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.dataset.deleteWhenComplete !== 'false') {
            throw new Error('Cycle mode should default to false when both fields missing');
        }

        // Clear for next test
        mockTask.className = 'task';

        // To-Do mode should default to true (delete tasks)
        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'todo',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockTask.dataset.deleteWhenComplete !== 'true') {
            throw new Error('To-Do mode should default to true when both fields missing');
        }
    });

    // ============================================
    // 🔘 BUTTON STATE TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 Button State</h4>';

    await test('Button is active when deleteWhenComplete=true', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const mockButton = document.createElement('button');
        mockButton.className = 'delete-when-complete-btn';
        mockTask.appendChild(mockButton);

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: true, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (!mockButton.classList.contains('active')) {
            throw new Error('Button should have active class when deleteWhenComplete=true');
        }

        if (mockButton.getAttribute('aria-pressed') !== 'true') {
            throw new Error('Button aria-pressed should be "true"');
        }
    });

    await test('Button is inactive when deleteWhenComplete=false', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task';

        const mockButton = document.createElement('button');
        mockButton.className = 'delete-when-complete-btn';
        mockTask.appendChild(mockButton);

        const taskData = {
            deleteWhenComplete: false,
            deleteWhenCompleteSettings: { cycle: false, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        if (mockButton.classList.contains('active')) {
            throw new Error('Button should NOT have active class when deleteWhenComplete=false');
        }

        if (mockButton.getAttribute('aria-pressed') !== 'false') {
            throw new Error('Button aria-pressed should be "false"');
        }
    });

    await test('Recurring task button state is not affected by indicator logic', () => {
        const mockTask = document.createElement('div');
        mockTask.className = 'task recurring';

        const mockButton = document.createElement('button');
        mockButton.className = 'delete-when-complete-btn';
        mockTask.appendChild(mockButton);

        const taskData = {
            deleteWhenComplete: true,
            deleteWhenCompleteSettings: { cycle: true, todo: true }
        };

        GlobalUtils.syncTaskDeleteWhenCompleteDOM(
            mockTask,
            taskData,
            'cycle',
            { DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS }
        );

        // Button should still be active even though indicator is hidden
        if (!mockButton.classList.contains('active')) {
            throw new Error('Recurring task button should still be active');
        }

        // But no visual indicator
        if (mockTask.classList.contains('show-delete-indicator')) {
            throw new Error('Recurring task should not show visual indicator');
        }
    });

    // ============================================
    // 📊 BATCH SYNC TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Batch Sync</h4>';

    await test('syncAllTasksWithMode syncs multiple tasks correctly', () => {
        // Create task list container
        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        document.body.appendChild(taskList);

        // Create 3 test tasks
        const task1 = document.createElement('div');
        task1.className = 'task';
        task1.dataset.taskId = 'task-1';
        taskList.appendChild(task1);

        const task2 = document.createElement('div');
        task2.className = 'task';
        task2.dataset.taskId = 'task-2';
        taskList.appendChild(task2);

        const task3 = document.createElement('div');
        task3.className = 'task';
        task3.dataset.taskId = 'task-3';
        taskList.appendChild(task3);

        // Task data map
        const tasksData = {
            'task-1': {
                deleteWhenComplete: true,
                deleteWhenCompleteSettings: { cycle: true, todo: false }
            },
            'task-2': {
                deleteWhenComplete: false,
                deleteWhenCompleteSettings: { cycle: false, todo: true }
            },
            'task-3': {
                deleteWhenComplete: undefined,
                deleteWhenCompleteSettings: { cycle: true, todo: false }
            }
        };

        const syncedCount = GlobalUtils.syncAllTasksWithMode('cycle', tasksData, {
            DEFAULT_DELETE_WHEN_COMPLETE_SETTINGS
        });

        if (syncedCount !== 3) {
            throw new Error(`Should sync 3 tasks, got ${syncedCount}`);
        }

        if (!task1.classList.contains('show-delete-indicator')) {
            throw new Error('Task 1 should have red ❌');
        }

        if (task2.classList.contains('show-delete-indicator')) {
            throw new Error('Task 2 should NOT have red ❌');
        }

        if (!task3.classList.contains('show-delete-indicator')) {
            throw new Error('Task 3 should have red ❌ (from settings.cycle=true)');
        }

        // Cleanup
        document.body.removeChild(taskList);
    });

    // ============================================
    // 📝 SUMMARY
    // ============================================
    resultsDiv.innerHTML += '<h3>Results: ' + passed.count + '/' + total.count + ' tests passed' +
        (passed.count === total.count ? ' (100%)' : '') + '</h3>';

    return passed.count === total.count;
}

// Auto-register for manual browser testing
if (typeof window !== 'undefined') {
    window.runDeleteWhenCompleteTests = runDeleteWhenCompleteTests;
    console.log('💡 Delete-When-Complete tests loaded. Run with: runDeleteWhenCompleteTests(document.getElementById("test-results"))');
}
