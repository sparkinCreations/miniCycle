/**
 * 🧪 TaskRenderer Tests
 * Tests for task rendering and UI refresh operations
 */

// ============================================
// 🧪 MOCK DEPENDENCIES FOR TASKRENDERER
// (Phase 3 - all deps are now required)
// ============================================
function createMockDependencies(overrides = {}) {
    return {
        AppState: { isReady: () => true, get: () => ({}) },
        addTask: async () => {},
        loadMiniCycle: () => {},
        updateProgressBar: () => {},
        checkCompleteAllButton: () => {},
        updateStatsPanel: () => {},
        updateMainMenuHeader: () => {},
        updateArrowsInDOM: () => {},
        checkOverdueTasks: () => {},
        enableDragAndDropOnTask: () => {},
        recurringPanel: { updateRecurringPanel: () => {}, updateRecurringPanelButtonVisibility: () => {} },
        updateRecurringPanelButtonVisibility: () => {},
        getElementById: (id) => document.getElementById(id),
        querySelectorAll: (sel) => document.querySelectorAll(sel),
        ...overrides
    };
}

export async function runTaskRendererTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎨 TaskRenderer Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Test helper with data protection
    async function test(name, testFn) {
        total.count++;
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskRenderer class is defined', () => {
        if (typeof TaskRenderer === 'undefined') {
            throw new Error('TaskRenderer class not found');
        }
    });

    await test('TaskRenderer is exported to window', () => {
        if (typeof window.TaskRenderer === 'undefined') {
            throw new Error('TaskRenderer not available on window object');
        }
    });

    await test('initTaskRenderer function is exported', () => {
        if (typeof window.initTaskRenderer !== 'function') {
            throw new Error('initTaskRenderer not found on window object');
        }
    });

    await test('all rendering functions are exported', () => {
        const requiredFunctions = ['renderTasks', 'refreshUIFromState', 'refreshTaskListUI'];
        for (const funcName of requiredFunctions) {
            if (typeof window[funcName] !== 'function') {
                throw new Error(`${funcName} not found on window object`);
            }
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('creates instance with required dependencies', () => {
        const renderer = new TaskRenderer(createMockDependencies());
        if (!renderer) throw new Error('Failed to create TaskRenderer instance');
        if (!renderer.deps) throw new Error('Dependencies not initialized');
    });

    await test('creates instance with custom dependencies', () => {
        const mockAppState = { isReady: () => true, get: () => ({}) };
        const renderer = new TaskRenderer(createMockDependencies({ AppState: mockAppState }));
        if (renderer.deps.AppState !== mockAppState) {
            throw new Error('Custom AppState dependency not set');
        }
    });

    await test('has correct version property', () => {
        const renderer = new TaskRenderer(createMockDependencies());
        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!renderer.version || !/^\d+\.\d+(\.\d+)?$/.test(renderer.version)) {
            throw new Error(`Expected valid semver version, got ${renderer.version}`);
        }
    });

    await test('warns when missing dependencies', () => {
        // Capture console.warn
        const originalWarn = console.warn;
        let warnCalled = false;
        console.warn = (...args) => {
            if (args[0]?.includes?.('missing dependencies')) {
                warnCalled = true;
            }
        };

        try {
            new TaskRenderer({});  // Missing deps should warn, not throw
            if (!warnCalled) {
                throw new Error('Should have warned about missing dependencies');
            }
        } finally {
            console.warn = originalWarn;
        }
    });

    // ============================================
    // 🎨 RENDERING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Rendering</h4>';

    await test('renderTasks requires taskList element', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: () => null
        }));
        // Should not throw, just return early
        await renderer.renderTasks([]);
    });

    await test('renderTasks handles empty array', async () => {
        const taskList = document.createElement('ul');
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: (id) => id === 'taskList' ? taskList : null
        }));
        await renderer.renderTasks([]);
        if (taskList.innerHTML !== '') {
            throw new Error('Should clear taskList for empty array');
        }
    });

    await test('renderTasks validates array input', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            getElementById: () => document.createElement('ul')
        }));
        // Should not throw for non-array
        await renderer.renderTasks(null);
        await renderer.renderTasks(undefined);
        await renderer.renderTasks('not an array');
    });

    // ============================================
    // 🔄 REFRESH UI TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Refresh UI</h4>';

    await test('refreshUIFromState handles null state', async () => {
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: { isReady: () => false }
        }));
        // Should not throw
        await renderer.refreshUIFromState(null);
    });

    await test('refreshUIFromState uses AppState when ready', async () => {
        let appStateCalled = false;
        const renderer = new TaskRenderer(createMockDependencies({
            AppState: {
                isReady: () => true,
                get: () => {
                    appStateCalled = true;
                    return {
                        data: { cycles: { 'cycle-1': { tasks: [] } } },
                        appState: { activeCycleId: 'cycle-1' },
                        ui: {}
                    };
                }
            },
            getElementById: () => document.createElement('ul')
        }));
        await renderer.refreshUIFromState();
        if (!appStateCalled) throw new Error('Should call AppState.get() when ready');
    });

    await test('refreshTaskListUI delegates to refreshUIFromState', async () => {
        let refreshCalled = false;
        const renderer = new TaskRenderer(createMockDependencies());
        renderer.refreshUIFromState = async () => { refreshCalled = true; };
        await renderer.refreshTaskListUI();
        if (!refreshCalled) throw new Error('Should call refreshUIFromState');
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrappers</h4>';

    await test('global renderTasks handles uninitialized renderer', async () => {
        // Should not throw even if renderer is null
        await window.renderTasks([]);
    });

    await test('global refreshUIFromState handles uninitialized renderer', async () => {
        // Should not throw
        await window.refreshUIFromState(null);
    });

    await test('global refreshTaskListUI handles uninitialized renderer', async () => {
        // Should not throw
        await window.refreshTaskListUI();
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}
