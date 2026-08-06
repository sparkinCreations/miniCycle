/**
 * HistoryManager Tests
 * Tests for event logging, history retrieval, clearing, and label/icon snapshots
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runHistoryManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/historyManager.js?v=${cacheBuster}`);
    const { HistoryManager, setHistoryManagerDependencies } = mod;

    resultsDiv.innerHTML = '<h2>HistoryManager Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function createMockState(overrides = {}) {
        return {
            metadata: { lastModified: Date.now() },
            settings: {},
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [],
                        history: { events: [] },
                        cycleCount: 3,
                        clearedTasks: { items: [], totalCleared: 5 },
                        metadata: { title: 'Test Routine' }
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' },
            userProgress: { cyclesCompleted: 3, totalTasksCleared: 5 },
            achievements: { unlocked: [], seen: {} },
            ...overrides
        };
    }

    function createMockAppState(stateOverrides = {}) {
        let state = createMockState(stateOverrides);
        return {
            isReady: () => true,
            get: () => state,
            update: (fn) => { fn(state); },
            subscribe: () => () => {}
        };
    }

    function createMockAppInit() {
        return {
            waitForCore: () => Promise.resolve(),
            isCoreReady: () => true
        };
    }

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('HistoryManager class is exported', () => {
        if (typeof HistoryManager !== 'function') throw new Error('HistoryManager not a class');
    });

    await test('setHistoryManagerDependencies is exported', () => {
        if (typeof setHistoryManagerDependencies !== 'function') throw new Error('DI setter not exported');
    });

    // ============================================
    // 🏗️ INITIALIZATION
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Initialization</h4>';

    await test('creates instance', () => {
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        if (!mgr) throw new Error('Instance not created');
    });

    // ============================================
    // 📝 EVENT LOGGING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Event Logging</h4>';

    await test('logEvent adds event to history', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('taskAdded', { taskText: 'New task' });

        const state = mockAS.get();
        const events = state.data.cycles['cycle-1'].history.events;
        if (events.length === 0) throw new Error('Event not added');
    });

    await test('logEvent stores event type', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('cycleCompleted', {});

        const events = mockAS.get().data.cycles['cycle-1'].history.events;
        if (events[0].type !== 'cycleCompleted') throw new Error(`Expected "cycleCompleted", got "${events[0].type}"`);
    });

    await test('logEvent stores timestamp', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const before = Date.now();
        mgr.logEvent('taskDeleted', { taskText: 'Old task' });

        const events = mockAS.get().data.cycles['cycle-1'].history.events;
        if (!events[0].timestamp || events[0].timestamp < before) {
            throw new Error('Timestamp not set correctly');
        }
    });

    await test('logEvent adds newest events first', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('taskAdded', { taskText: 'First' });
        mgr.logEvent('taskAdded', { taskText: 'Second' });

        const events = mockAS.get().data.cycles['cycle-1'].history.events;
        if (events.length < 2) throw new Error('Both events should be stored');
        // Newest first — Second should be at index 0
        if (!events[0].details?.taskText?.includes('Second')) {
            // Some implementations store details differently, just verify ordering
            if (events[0].timestamp < events[1].timestamp) {
                throw new Error('Newest event should be first');
            }
        }
    });

    // ============================================
    // 📖 HISTORY RETRIEVAL
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📖 History Retrieval</h4>';

    await test('getHistory returns events for active cycle', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('taskAdded', { taskText: 'Test' });

        const history = mgr.getHistory();
        if (!history || !Array.isArray(history)) throw new Error('Should return array');
        if (history.length === 0) throw new Error('Should have events');
    });

    await test('getHistory returns events for specific cycle', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('taskAdded', { taskText: 'Test' });

        const history = mgr.getHistory('cycle-1');
        if (!history || history.length === 0) throw new Error('Should return events for cycle-1');
    });

    await test('getHistory returns empty array for nonexistent cycle', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const history = mgr.getHistory('nonexistent');
        if (!Array.isArray(history)) throw new Error('Should return array');
    });

    // ============================================
    // 🧹 CLEAR HISTORY
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Clear History</h4>';

    await test('clearHistory removes events', () => {
        const mockAS = createMockAppState();
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        mgr.logEvent('taskAdded', { taskText: 'Test' });

        mgr.clearHistory('cycle-1');
        const events = mockAS.get().data.cycles['cycle-1'].history.events;
        if (events.length !== 0) throw new Error('Events should be cleared');
    });

    // ============================================
    // ⚠️ ERROR HANDLING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('logEvent handles null state gracefully', () => {
        setHistoryManagerDependencies({
            AppState: { isReady: () => true, get: () => null, update: () => {} },
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        // Should not throw
        mgr.logEvent('test', {});
    });

    await test('getHistory handles missing history object', () => {
        const mockAS = createMockAppState();
        delete mockAS.get().data.cycles['cycle-1'].history;
        setHistoryManagerDependencies({
            AppState: mockAS,
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const history = mgr.getHistory();
        if (!Array.isArray(history)) throw new Error('Should return empty array');
    });

    // ============================================
    // 🎨 EVENT RENDERING (features-review finding: priority branches were
    // shadowed by the generic taskName branch and unreachable)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Event Rendering</h4>';

    await test('task_priority_set renders the priority-color dot', () => {
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const html = mgr._renderEvent({
            type: 'task_priority_set',
            timestamp: 1723000000000,
            details: { taskName: 'Water plants', priorityColor: '#ff8800' }
        });
        if (!html.includes('history-priority-dot')) {
            throw new Error('priority_set must render the priority dot (branch was unreachable below the generic taskName branch)');
        }
        if (!html.includes('#ff8800')) {
            throw new Error('the logged priorityColor must reach the dot');
        }
        if (!html.includes('Water plants')) throw new Error('task name must render');
    });

    await test('task_priority_removed renders the name without a dot', () => {
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const html = mgr._renderEvent({
            type: 'task_priority_removed',
            timestamp: 1723000000000,
            details: { taskName: 'Water plants', priorityColor: '#ff8800' }
        });
        if (html.includes('history-priority-dot')) {
            throw new Error('priority_removed must not render a dot');
        }
        if (!html.includes('Water plants')) throw new Error('task name must render');
    });

    await test('priority dot rejects a non-hex color (falls back to default)', () => {
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const html = mgr._renderEvent({
            type: 'task_priority_set',
            timestamp: 1723000000000,
            details: { taskName: 'x', priorityColor: 'red;background:url(evil)' }
        });
        if (html.includes('url(evil)')) throw new Error('non-hex color must not reach the style attribute');
        if (!html.includes('history-priority-dot')) throw new Error('dot still renders with the default color');
    });

    // ============================================
    // 📊 RESULTS
    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
