/**
 * Reminders Module Tests
 * Comprehensive tests for the miniCycle Reminders module (Schema 2.5)
 *
 * Updated for Phase 3 DI Pattern - direct module imports
 * @version 1.331
 */

import {
    setupTestEnvironment,
    createMockAppState,
    createMockNotification,
    waitForAsyncOperations
} from './testHelpers.js';

// Module-level variable for dynamic import
let MiniCycleReminders;

export async function runRemindersTests(resultsDiv, isPartOfSuite = false) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/features/reminders.js?v=${cacheBuster}`);
    MiniCycleReminders = module.MiniCycleReminders;
    resultsDiv.innerHTML = '<h2>Reminders Module Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>Reminders Module Tests</h2>';
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
        console.log('🔒 Saved original localStorage for individual reminders test');
    }

    // Helper to restore original data after all tests (only when running individually)
    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
            console.log('✅ Individual reminders test completed - original localStorage restored');
        }
    }


    try {

        // Check if class is available
        if (!MiniCycleReminders) {
            resultsDiv.innerHTML += '<div class="result fail">❌ MiniCycleReminders class not found. Make sure the module is properly loaded.</div>';
            resultsDiv.innerHTML += '<h3>Results: 0/1 tests passed (0%)</h3>';
            return { passed: 0, total: 1 };
        }

        // Create test container for DOM elements (persists across tests)
        let testContainer = document.getElementById('reminders-test-container');
        if (!testContainer) {
            testContainer = document.createElement('div');
            testContainer.id = 'reminders-test-container';
            testContainer.style.cssText = 'display: none; position: absolute; left: -9999px;';
            document.body.appendChild(testContainer);
        }

        async function test(name, testFn) {
            total.count++;
            try {
                // Reset environment before each test
                localStorage.clear();

                // Mock Schema 2.5 data
                // NOTE: reminders.js reads from 'reminders' but writes to 'customReminders'
                const mockSchemaData = {
                    metadata: {
                        version: "2.5",
                        lastModified: Date.now()
                    },
                    appState: {
                        activeCycleId: 'test-cycle'
                    },
                    data: {
                        cycles: {
                            'test-cycle': {
                                name: 'Test Cycle',
                                tasks: [
                                    {
                                        id: 'task-1',
                                        text: 'Test Task 1',
                                        completed: false,
                                        remindersEnabled: false
                                    },
                                    {
                                        id: 'task-2',
                                        text: 'Test Task 2',
                                        completed: false,
                                        remindersEnabled: true
                                    }
                                ],
                                taskOptionButtons: {
                                    reminders: false
                                }
                            }
                        }
                    },
                    // NOTE: Code reads from 'reminders' property
                    reminders: {
                        enabled: false,
                        indefinite: true,
                        dueDatesReminders: false,
                        repeatCount: 0,
                        frequencyValue: 1,
                        frequencyUnit: 'hours'
                    },
                    // But saves to 'customReminders' property
                    customReminders: {
                        enabled: false,
                        indefinite: true,
                        dueDatesReminders: false,
                        repeatCount: 0,
                        frequencyValue: 1,
                        frequencyUnit: 'hours'
                    },
                    settings: {}
                };
                localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

                // Clear test container
                testContainer.innerHTML = '';

                // Mock AppState for tests that need it
                window.AppState = {
                    isReady: () => true,
                    get: () => mockSchemaData,
                    update: (fn) => {
                        fn(mockSchemaData);
                        localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));
                    }
                };

                // Clear reminder manager instance
                delete window.reminderManager;

                // Ensure AppGlobalState exists and is reset
                if (!window.AppGlobalState) {
                    window.AppGlobalState = {};
                }
                window.AppGlobalState.reminderIntervalId = null;
                window.AppGlobalState.timesReminded = 0;
                window.AppGlobalState.lastReminderTime = null;

                await testFn();
                resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
                passed.count++;
            } catch (error) {
                resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            }
        }

        // The module is DI-pure (module-level DI); window.AppState/AppGlobalState set above
        // never reach it. Behavior tests MUST wire deps via setRemindersDependencies, and
        // crucially inject AppGlobalState — without it `instance.state` is a black hole
        // (getters return null, setters no-op), which is exactly why the old stopReminders
        // tests passed while asserting nothing. Construct the instance AFTER wiring so its
        // deps cache resolves the freshly-set module deps.
        const { setRemindersDependencies } = module;
        function wireReminders({ AppGlobalState = {}, loadMiniCycleData = () => null, AppState = null, appInit = null } = {}) {
            const notifications = [];
            setRemindersDependencies({
                AppGlobalState,
                loadMiniCycleData,
                AppState,
                appInit,
                showNotification: (msg, type) => { notifications.push({ msg, type }); },
            });
            const instance = new MiniCycleReminders();
            return { instance, notifications, AppGlobalState };
        }

        // === INITIALIZATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔧 Initialization Tests</h4>';

        await test('creates instance successfully', async () => {
            const instance = new MiniCycleReminders();
            if (!instance || typeof instance.startReminders !== 'function') {
                throw new Error('MiniCycleReminders not properly initialized');
            }
        });

        await test('accepts dependency injection', async () => {
            const mockShowNotification = (msg) => console.log(msg);
            const mockLoadData = () => ({ reminders: { enabled: false }});

            const instance = new MiniCycleReminders({
                showNotification: mockShowNotification,
                loadMiniCycleData: mockLoadData
            });

            if (!instance || !instance.deps.showNotification) {
                throw new Error('Dependency injection failed');
            }
        });



        // === CORE FUNCTIONALITY TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';



        await test('stopReminders clears the stored timeout id', async () => {
            const { instance, AppGlobalState } = wireReminders();   // AppGlobalState injected → state persists
            const realId = setTimeout(() => {}, 100000);
            instance.state.reminderTimeoutId = realId;
            // Precondition: the id is actually stored (proves the injected AppGlobalState is wired,
            // unlike the old test where this was a silent no-op).
            if (AppGlobalState.reminderTimeoutId !== realId) throw new Error('state should store the id via AppGlobalState');
            instance.stopReminders();
            if (instance.state.reminderTimeoutId !== null) throw new Error('stopReminders should clear the stored id');
            clearTimeout(realId);
        });

        // === ERROR HANDLING TESTS ===
        resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';


        await test('stopReminders handles a null interval gracefully', async () => {
            const { instance } = wireReminders();
            instance.state.reminderTimeoutId = null;
            instance.stopReminders();   // should not throw
            if (instance.state.reminderTimeoutId !== null) throw new Error('id should remain null');
        });

        // === START / SCHEDULE REMINDERS ===
        resultsDiv.innerHTML += '<h4>⏰ startReminders / scheduleNextReminder</h4>';

        await test('startReminders schedules a timeout when enabled with a future next time', async () => {
            const { instance, AppGlobalState } = wireReminders({
                loadMiniCycleData: () => ({ reminders: { enabled: true, indefinite: true, frequencyValue: 30, frequencyUnit: 'minutes', nextReminderTime: Date.now() + 3600000 } })
            });
            try {
                await instance.startReminders();
                if (!AppGlobalState.reminderTimeoutId) throw new Error('an enabled reminder with a future time should schedule a timeout');
            } finally {
                if (AppGlobalState.reminderTimeoutId) clearTimeout(AppGlobalState.reminderTimeoutId);
            }
        });

        await test('startReminders does nothing when reminders are disabled', async () => {
            const { instance, AppGlobalState } = wireReminders({ loadMiniCycleData: () => ({ reminders: { enabled: false } }) });
            await instance.startReminders();
            if (AppGlobalState.reminderTimeoutId) { clearTimeout(AppGlobalState.reminderTimeoutId); throw new Error('disabled reminders must not schedule a timeout'); }
        });

        await test('startReminders stops once the repeat count is reached (non-indefinite)', async () => {
            const { instance, AppGlobalState } = wireReminders({
                loadMiniCycleData: () => ({ reminders: { enabled: true, indefinite: false, repeatCount: 3, timesReminded: 3, nextReminderTime: Date.now() + 3600000 } })
            });
            await instance.startReminders();
            if (AppGlobalState.reminderTimeoutId) { clearTimeout(AppGlobalState.reminderTimeoutId); throw new Error('should not schedule once repeatCount is reached'); }
        });

        await test('startReminders exits gracefully with no schema data', async () => {
            const { instance, AppGlobalState } = wireReminders({ loadMiniCycleData: () => null });
            await instance.startReminders();   // must not throw
            if (AppGlobalState.reminderTimeoutId) throw new Error('no schema data → no timer scheduled');
        });

        await test('scheduleNextReminder recomputes the interval from frequency when overdue', async () => {
            const { instance, AppGlobalState } = wireReminders({
                loadMiniCycleData: () => ({ reminders: { enabled: true, frequencyValue: 2, frequencyUnit: 'hours', nextReminderTime: Date.now() - 1000 } })
            });
            const origSetTimeout = window.setTimeout;
            let capturedDelay = null;
            window.setTimeout = (fn, delay) => { capturedDelay = delay; return 987654; };
            try {
                await instance.scheduleNextReminder();
                // Overdue (timeUntilNext <= 0) → recompute: 2 * FREQUENCY_MS.hours = 7,200,000 ms.
                if (capturedDelay !== 7200000) throw new Error(`expected recomputed delay 7200000, got ${capturedDelay}`);
                if (AppGlobalState.reminderTimeoutId !== 987654) throw new Error('the scheduled timeout id should be stored in state');
            } finally {
                window.setTimeout = origSetTimeout;
            }
        });

        await test('scheduleNextReminder clamps long intervals below the 32-bit setTimeout ceiling', async () => {
            // setTimeout stores its delay as a signed 32-bit int: >2,147,483,647 ms
            // (~24.8 days) overflows and fires IMMEDIATELY. The frequency input
            // offers Days with no max, so "every 30 days" overflowed — and since
            // the handler reschedules, each immediate fire armed another: a
            // notification loop, unbounded when `indefinite` is set.
            const MAX_TIMEOUT_MS = 2147483647;
            const { instance } = wireReminders({
                loadMiniCycleData: () => ({ reminders: { enabled: true, indefinite: true, frequencyValue: 30, frequencyUnit: 'days', nextReminderTime: Date.now() - 1000 } })
            });
            const origSetTimeout = window.setTimeout;
            let capturedDelay = null;
            let handler = null;
            window.setTimeout = (fn, delay) => { capturedDelay = delay; handler = fn; return 424242; };
            try {
                await instance.scheduleNextReminder();
                // 30 days = 2,592,000,000 ms — above the ceiling, so it must be clamped.
                if (capturedDelay > MAX_TIMEOUT_MS) {
                    throw new Error(`delay ${capturedDelay} exceeds the 32-bit ceiling and would fire immediately`);
                }
                if (capturedDelay !== MAX_TIMEOUT_MS) {
                    throw new Error(`expected the clamp value ${MAX_TIMEOUT_MS}, got ${capturedDelay}`);
                }
                // And when that clamped timer expires early, the handler must
                // re-arm rather than notify — the target time has not arrived.
                let sent = 0;
                instance.sendReminderNotificationIfNeeded = async () => { sent++; };
                await handler();
                if (sent !== 0) throw new Error('clamped timer must re-arm, not send a notification early');
            } finally {
                window.setTimeout = origSetTimeout;
            }
        });

        await test('scheduleNextReminder leaves sub-ceiling intervals exact', async () => {
            // 7 days = 604,800,000 ms — comfortably under the ceiling, must pass through.
            const { instance } = wireReminders({
                loadMiniCycleData: () => ({ reminders: { enabled: true, frequencyValue: 7, frequencyUnit: 'days', nextReminderTime: Date.now() - 1000 } })
            });
            const origSetTimeout = window.setTimeout;
            let capturedDelay = null;
            window.setTimeout = (fn, delay) => { capturedDelay = delay; return 1; };
            try {
                await instance.scheduleNextReminder();
                if (capturedDelay !== 604800000) throw new Error(`expected exact 604800000, got ${capturedDelay}`);
            } finally {
                window.setTimeout = origSetTimeout;
            }
        });

        // === TOGGLE / PER-TASK STATE ===
        resultsDiv.innerHTML += '<h4>🔔 Toggle & Per-Task State</h4>';

        await test('setupReminderToggle reflects the saved enabled state onto the checkbox + frequency section', () => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.id = 'enableReminders';
            const freqSection = document.createElement('div');
            freqSection.id = 'frequency-section';
            testContainer.appendChild(checkbox);
            testContainer.appendChild(freqSection);
            try {
                // Enabled → checkbox checked, frequency section visible (no 'hidden' class).
                let { instance } = wireReminders({ loadMiniCycleData: () => ({ reminders: { enabled: true } }) });
                instance.setupReminderToggle();
                if (checkbox.checked !== true) throw new Error('checkbox should reflect saved enabled=true');
                if (freqSection.classList.contains('hidden')) throw new Error('frequency section should be visible when enabled');

                // Disabled → checkbox unchecked, frequency section hidden.
                ({ instance } = wireReminders({ loadMiniCycleData: () => ({ reminders: { enabled: false } }) }));
                instance.setupReminderToggle();
                if (checkbox.checked !== false) throw new Error('checkbox should reflect saved enabled=false');
                if (!freqSection.classList.contains('hidden')) throw new Error('frequency section should be hidden when disabled');
            } finally {
                checkbox.remove(); freqSection.remove();
            }
        });

        await test('saveTaskReminderState writes remindersEnabled onto the matching task', async () => {
            const cycle = { tasks: [{ id: 'task-1', remindersEnabled: false }] };
            const state = { data: { cycles: { c1: cycle } }, appState: { activeCycleId: 'c1' } };
            const AppState = { isReady: () => true, get: () => state, update: async (fn) => fn(state) };
            const { instance } = wireReminders({ loadMiniCycleData: () => state, AppState });

            await instance.saveTaskReminderState('task-1', true);
            if (state.data.cycles.c1.tasks[0].remindersEnabled !== true) throw new Error('the task remindersEnabled flag should be set true');

            // Unknown task id → no-op (no throw, no new task).
            await instance.saveTaskReminderState('does-not-exist', true);
            if (state.data.cycles.c1.tasks.length !== 1) throw new Error('an unknown task id should be a no-op');
        });

        // === SUMMARY ===
        const percentage = Math.round((passed.count / total.count) * 100);
        resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

        if (passed.count === total.count) {
            resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
        } else {
            resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
        }

        return { passed: passed.count, total: total.count };

    } catch (error) {
        console.error('❌ Test suite error:', error);
        resultsDiv.innerHTML += `<div class="result fail">❌ Test suite error: ${error.message}</div>`;
        resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (test suite error)</h3>`;
        
    // 🔓 RESTORE original localStorage data (only when running individually)
    restoreOriginalData();

return { passed: passed.count, total: total.count };
    }
}
