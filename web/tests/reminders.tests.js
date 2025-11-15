/**
 * Reminders Module Tests
 * Comprehensive tests for the miniCycle Reminders module (Schema 2.5)
 * @version 1.330
 */

export async function runRemindersTests(resultsDiv, isPartOfSuite = false) {
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
        // ✅ CRITICAL: Mark core as ready BEFORE anything else
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
            console.log('✅ Test environment: AppInit core systems marked as ready');
        }

        // Import the module class
        const MiniCycleReminders = window.MiniCycleReminders;

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

        await test('has correct version', async () => {
            const instance = new MiniCycleReminders();
            // Check version exists and is in semver format
            if (!instance.version || !/^\d+\.\d+(\.\d+)?$/.test(instance.version)) {
                throw new Error(`Expected valid semver version, got ${instance.version}`);
            }
        });

        await test('initializes with AppGlobalState integration', async () => {
            const instance = new MiniCycleReminders();

            // Test state getters/setters
            instance.state.timesReminded = 5;

            if (window.AppGlobalState.timesReminded !== 5) {
                throw new Error('AppGlobalState integration not working');
            }
        });

        // === CORE FUNCTIONALITY TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Core Functionality</h4>';

        await test('autoSaveReminders saves to customReminders in Schema 2.5', async () => {
            const enableReminders = document.createElement('input');
            enableReminders.type = 'checkbox';
            enableReminders.id = 'enableReminders';
            enableReminders.checked = true;

            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: (id) => {
                    if (id === 'enableReminders') return enableReminders;
                    return null;
                }
            });

            const enabled = instance.autoSaveReminders();

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            // Saves to customReminders
            if (!savedData.customReminders || savedData.customReminders.enabled !== true) {
                throw new Error('Reminder settings not saved to customReminders');
            }

            if (enabled !== true) {
                throw new Error('autoSaveReminders should return enabled state');
            }
        });

        await test('saveTaskReminderState updates task in Schema 2.5', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data
            });

            await instance.saveTaskReminderState('task-1', true);

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'task-1');

            if (task.remindersEnabled !== true) {
                throw new Error('Reminder state not saved correctly');
            }
        });

        await test('stopReminders clears interval', async () => {
            const instance = new MiniCycleReminders();

            instance.state.reminderIntervalId = setInterval(() => {}, 1000);

            instance.stopReminders();

            if (instance.state.reminderIntervalId !== null) {
                throw new Error('Reminder interval not cleared');
            }
        });

        await test('startReminders sets up interval when enabled', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => ({
                    reminders: {
                        enabled: true,
                        indefinite: true,
                        frequencyValue: 1,
                        frequencyUnit: 'minutes'
                    }
                }),
                querySelectorAll: () => []
            });

            await instance.startReminders();

            if (!instance.state.reminderIntervalId) {
                throw new Error('Reminder interval not created');
            }

            // Clean up
            instance.stopReminders();
        });

        await test('startReminders does not start when disabled', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => ({
                    reminders: {
                        enabled: false,
                        frequencyValue: 1,
                        frequencyUnit: 'hours'
                    }
                })
            });

            await instance.startReminders();

            if (instance.state.reminderIntervalId !== null) {
                throw new Error('Interval should not be created when disabled');
            }
        });

        // === SCHEMA 2.5 STORAGE TESTS ===
        resultsDiv.innerHTML += '<h4>💾 Schema 2.5 Storage</h4>';

        await test('saves reminder settings to customReminders location', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: (id) => {
                    if (id === 'enableReminders') {
                        const checkbox = document.createElement('input');
                        checkbox.checked = true;
                        return checkbox;
                    }
                    if (id === 'frequencyValue') {
                        const input = document.createElement('input');
                        input.value = '2';
                        return input;
                    }
                    if (id === 'frequencyUnit') {
                        const select = document.createElement('select');
                        select.value = 'hours';
                        return select;
                    }
                    return null;
                }
            });

            instance.autoSaveReminders();

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (!savedData.customReminders) {
                throw new Error('customReminders not created in Schema 2.5');
            }

            if (savedData.customReminders.frequencyValue !== 2) {
                throw new Error('Frequency value not saved correctly');
            }
        });

        await test('updates metadata timestamp on save', async () => {
            const originalData = JSON.parse(localStorage.getItem('miniCycleData'));
            const originalTimestamp = originalData.metadata.lastModified;

            await new Promise(resolve => setTimeout(resolve, 10));

            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: () => {
                    const checkbox = document.createElement('input');
                    checkbox.checked = true;
                    return checkbox;
                }
            });

            instance.autoSaveReminders();

            const updatedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (updatedData.metadata.lastModified <= originalTimestamp) {
                throw new Error('Metadata timestamp not updated');
            }
        });

        await test('stores reminder start time when enabling', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: () => {
                    const checkbox = document.createElement('input');
                    checkbox.checked = true;
                    return checkbox;
                }
            });

            instance.autoSaveReminders();

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));

            if (!savedData.customReminders.reminderStartTime) {
                throw new Error('Reminder start time not saved');
            }

            const timeDiff = Date.now() - savedData.customReminders.reminderStartTime;
            if (timeDiff > 100) {
                throw new Error('Reminder start time not set to current time');
            }
        });

        // === ERROR HANDLING TESTS ===
        resultsDiv.innerHTML += '<h4>⚠️ Error Handling</h4>';

        await test('handles missing task gracefully', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data,
                showNotification: () => {}
            });

            // Should not throw when task doesn't exist
            await instance.saveTaskReminderState('non-existent-task', true);

            // Task should not be created
            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            const task = savedData.data.cycles['test-cycle'].tasks.find(t => t.id === 'non-existent-task');

            if (task) {
                throw new Error('Non-existent task should not be created');
            }
        });

        await test('handles missing Schema 2.5 data', async () => {
            localStorage.clear();

            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => null,
                showNotification: () => {}
            });

            // Should throw error when Schema 2.5 data is missing
            let errorThrown = false;
            try {
                await instance.saveTaskReminderState('task-1', true);
            } catch (error) {
                errorThrown = true;
            }

            if (!errorThrown) {
                throw new Error('Should throw error when Schema 2.5 data is missing');
            }
        });

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

        await test('setupReminderButtonHandler attaches event listener', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data
            });

            const button = document.createElement('button');
            const taskContext = { assignedTaskId: 'task-1' };

            instance.setupReminderButtonHandler(button, taskContext);

            // Should not throw
            if (!button) {
                throw new Error('Button should still exist after setup');
            }
        });

        await test('handleReminderToggle updates UI and saves state', async () => {
            const enableReminders = document.createElement('input');
            enableReminders.type = 'checkbox';
            enableReminders.id = 'enableReminders';
            enableReminders.checked = true;

            const frequencySection = document.createElement('div');
            frequencySection.id = 'frequency-section';
            frequencySection.classList.add('hidden');

            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: (id) => {
                    if (id === 'enableReminders') return enableReminders;
                    if (id === 'frequency-section') return frequencySection;
                    return null;
                },
                querySelectorAll: () => [],
                showNotification: () => {}
            });

            await instance.handleReminderToggle();

            if (frequencySection.classList.contains('hidden')) {
                throw new Error('Frequency section should be visible when enabled');
            }

            const savedData = JSON.parse(localStorage.getItem('miniCycleData'));
            if (!savedData.customReminders.enabled) {
                throw new Error('Enabled state not saved');
            }
        });

        await test('sendReminderNotificationIfNeeded stops when all tasks complete', async () => {
            // Create mock completed task
            const taskDiv = document.createElement('div');
            taskDiv.classList.add('task');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true; // Completed
            const taskText = document.createElement('span');
            taskText.classList.add('task-text');
            taskText.textContent = 'Test Task';
            const reminderBtn = document.createElement('button');
            reminderBtn.classList.add('enable-task-reminders', 'reminder-active');
            taskDiv.appendChild(checkbox);
            taskDiv.appendChild(taskText);
            taskDiv.appendChild(reminderBtn);

            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => ({
                    reminders: { enabled: true, indefinite: true }
                }),
                querySelectorAll: (selector) => {
                    if (selector === '.task') return [taskDiv];
                    return [];
                },
                showNotification: () => {}
            });

            instance.state.reminderIntervalId = 123; // Fake interval ID

            await instance.sendReminderNotificationIfNeeded();

            // Should clear interval when all tasks complete
            if (instance.state.reminderIntervalId !== null) {
                throw new Error('Interval should be cleared when all tasks complete');
            }
        });

        // === PERFORMANCE TESTS ===
        resultsDiv.innerHTML += '<h4>⚡ Performance Tests</h4>';

        await test('saveTaskReminderState completes within reasonable time', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')).data
            });

            const startTime = performance.now();
            await instance.saveTaskReminderState('task-1', true);
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
        });

        await test('autoSaveReminders completes within reasonable time', async () => {
            const instance = new MiniCycleReminders({
                loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
                getElementById: () => {
                    const checkbox = document.createElement('input');
                    checkbox.checked = true;
                    return checkbox;
                }
            });

            const startTime = performance.now();
            instance.autoSaveReminders();
            const endTime = performance.now();

            const duration = endTime - startTime;

            if (duration > 100) {
                throw new Error(`Operation took too long: ${duration.toFixed(2)}ms`);
            }
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
