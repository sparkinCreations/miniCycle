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

// Direct import from module (not via appContext which may not be populated)
import { MiniCycleReminders } from '../modules/features/reminders.js';

export async function runRemindersTests(resultsDiv, isPartOfSuite = false) {
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



        await test('stopReminders clears interval', async () => {
            const instance = new MiniCycleReminders();

            instance.state.reminderIntervalId = setInterval(() => {}, 1000);

            instance.stopReminders();

            if (instance.state.reminderIntervalId !== null) {
                throw new Error('Reminder interval not cleared');
            }
        });

        // === ERROR HANDLING TESTS ===
        resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';


        await test('stopReminders handles null interval gracefully', async () => {
            const instance = new MiniCycleReminders();
            instance.state.reminderIntervalId = null;

            // Should not throw
            instance.stopReminders();

            if (instance.state.reminderIntervalId !== null) {
                throw new Error('Interval ID should remain null');
            }
        });

        // === INTEGRATION TESTS ===
        resultsDiv.innerHTML += '<h4>🔗 Integration Tests</h4>';


        // === PERFORMANCE TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';


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
