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

    await test('undo/redo render a real label, icon and description', () => {
        // undoRedoManager logs 'undo'/'redo' with { description }. Neither type was in
        // the icon/label maps, so these rendered as a 📌 next to the raw lowercase
        // type, and the description — the only informative part — was dropped.
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        for (const [type, icon] of [['undo', '↩️'], ['redo', '↪️']]) {
            const html = mgr._renderEvent({
                type,
                timestamp: 1723000000000,
                details: { description: 'Mode changed' }
            });
            if (html.includes('>' + type + '<')) {
                throw new Error(`${type} rendered its raw type as the title`);
            }
            if (html.includes('📌')) throw new Error(`${type} fell back to the generic pin icon`);
            if (!html.includes(icon)) throw new Error(`${type} should render ${icon}`);
            if (!html.includes('Mode changed')) {
                throw new Error(`${type} dropped details.description — the only informative part`);
            }
        }
    });

    await test('the description branch stays BELOW the specific ones', () => {
        // description is the generic fallback in the detail chain. If it ever moves
        // above the type-specific branches, events that carry both lose the specific
        // rendering — the same way the priority dot was lost (see the tests above).
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const html = mgr._renderEvent({
            type: 'task_priority_set',
            timestamp: 1723000000000,
            details: { taskName: 'Water plants', priorityColor: '#ff8800', description: 'should not win' }
        });
        if (html.includes('should not win')) {
            throw new Error('description outranked the priority-set branch');
        }
        if (!html.includes('history-priority-dot')) throw new Error('specific branch must still render');
    });

    await test('undo/redo descriptions are escaped, not injected', () => {
        // description comes from describeChange but is rendered into innerHTML —
        // treat it like any other detail field.
        setHistoryManagerDependencies({
            AppState: createMockAppState(),
            appInit: createMockAppInit(),
            showNotification: () => {},
        });
        const mgr = new HistoryManager();
        const html = mgr._renderEvent({
            type: 'undo',
            timestamp: 1723000000000,
            details: { description: '<img src=x onerror=alert(1)>' }
        });
        if (html.includes('<img')) throw new Error('description must be escaped before it reaches innerHTML');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Completion breakdown rendering</h4>';

    await test('breakdown renders both sides with exact counts', () => {
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: {
                cycleCount: 12, _cycleNoun: 'cycle',
                manualCount: 2, autoCount: 2,
                manualNames: ['Make coffee', 'Stretch'],
                autoNames: ['Dishes', 'Laundry'],
                _checkedLabel: 'Checked off', _buttonLabel: 'Completed by Complete Cycle'
            }
        });
        if (!html.includes('history-completion-split')) throw new Error('breakdown block missing');
        if (!html.includes('Checked off (2)')) throw new Error('manual side missing or miscounted');
        if (!html.includes('Completed by Complete Cycle (2)')) throw new Error('button side missing or miscounted');
        if (!html.includes('Make coffee') || !html.includes('Laundry')) throw new Error('task names missing');
    });

    await test('an ordinary completion renders no breakdown', () => {
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: { cycleCount: 11, _cycleNoun: 'cycle' }
        });
        if (html.includes('history-completion-split')) {
            throw new Error('a cycle with no breakdown must not render the block');
        }
        if (!html.includes('Cycle #11')) throw new Error('the cycle number line regressed');
    });

    await test('truncated name lists report the remainder', () => {
        // Names are capped at capture; the count stays exact, so the renderer
        // must account for the difference or the event silently under-reports.
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: {
                cycleCount: 3, _cycleNoun: 'cycle',
                // MIXED on purpose: an all-one-side split collapses to a summary
                // line with no names, so truncation is only reachable from here.
                manualCount: 1, autoCount: 5,
                manualNames: ['Stretch'], autoNames: ['A', 'B'],
                _checkedLabel: 'Checked off',
                _buttonLabel: 'Completed by Complete Cycle'
            }
        });
        if (!html.includes('(5)')) throw new Error('exact count must survive truncation');
        if (!html.includes('3 more')) throw new Error('remainder not reported');
    });

    await test('all-button completions collapse to one summary line', () => {
        // A 20-task routine must not print 20 names to say one thing.
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: {
                cycleCount: 4, _cycleNoun: 'cycle',
                manualCount: 0, autoCount: 20,
                manualNames: [], autoNames: ['A', 'B', 'C'],
                _allByButtonLabel: 'All 20 tasks completed by Complete Cycle'
            }
        });
        if (!html.includes('All 20 tasks completed by Complete Cycle')) {
            throw new Error('summary line missing');
        }
        if (html.includes('>A<') || html.includes('A, B, C')) {
            throw new Error('names must not be listed when one side is empty');
        }
    });

    await test('all-manual completions collapse to one summary line', () => {
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: {
                cycleCount: 5, _cycleNoun: 'cycle',
                manualCount: 6, autoCount: 0,
                manualNames: ['A', 'B'], autoNames: [],
                _allCheckedOffLabel: 'All 6 tasks checked off'
            }
        });
        if (!html.includes('All 6 tasks checked off')) throw new Error('summary line missing');
        if (html.includes('A, B')) throw new Error('names must not be listed when one side is empty');
    });

    await test('a natural completion still renders no breakdown at all', () => {
        // No button press means no captured breakdown; the distinction between
        // "checked the last box myself" and "pressed the button with everything
        // checked" is carried by presence, so this must stay bare.
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: { cycleCount: 9, _cycleNoun: 'cycle' }
        });
        if (html.includes('history-completion-split')) {
            throw new Error('a natural completion must carry no breakdown block');
        }
    });

    await test('cleared tasks list their names alongside the count', () => {
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'tasks_cleared', timestamp: Date.now(),
            details: {
                tasksCleared: 5, _taskNoun: 'tasks',
                clearedNames: ['Email inbox', 'Pay rent'],
                _clearedLabel: 'Cleared'
            }
        });
        if (!html.includes('5 tasks')) throw new Error('the count line regressed');
        if (!html.includes('Email inbox') || !html.includes('Pay rent')) {
            throw new Error('cleared task names missing');
        }
        if (!html.includes('3 more')) throw new Error('remainder not reported');
    });

    await test('cleared events logged before names existed still render', () => {
        // Backward compatibility: history already on disk has no clearedNames.
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'tasks_cleared', timestamp: Date.now(),
            details: { tasksCleared: 3, _taskNoun: 'tasks' }
        });
        if (!html.includes('3 tasks')) throw new Error('legacy cleared event lost its count');
        if (html.includes('history-completion-split')) {
            throw new Error('legacy event must not render an empty name block');
        }
    });

    await test('cleared task names are HTML-escaped', () => {
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'tasks_cleared', timestamp: Date.now(),
            details: { tasksCleared: 1, _taskNoun: 'task', clearedNames: ['<img src=x onerror=alert(1)>'] }
        });
        if (html.includes('<img src=x')) throw new Error('cleared names reached the HTML unescaped');
    });

    await test('task names in the breakdown are HTML-escaped', () => {
        // Task text is user input and _renderEvent builds an HTML string.
        const hm = new HistoryManager();
        const html = hm._renderEvent({
            type: 'cycle_completed', timestamp: Date.now(),
            details: {
                cycleCount: 1, _cycleNoun: 'cycle',
                manualCount: 1, autoCount: 1,
                manualNames: ['<img src=x onerror=alert(1)>'],
                autoNames: ['<script>alert(2)</script>'],
                _checkedLabel: 'Checked off', _buttonLabel: 'Completed by Complete Cycle'
            }
        });
        if (html.includes('<img src=x') || html.includes('<script>alert(2)')) {
            throw new Error('task names reached the HTML unescaped — XSS via task text');
        }
        if (!html.includes('&lt;img') && !html.includes('&lt;script')) {
            throw new Error('expected escaped entities in the output');
        }
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
