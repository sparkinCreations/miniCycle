/**
 * RecurringPanel Module Tests
 * Tests for the recurring tasks UI panel manager
 *
 * Pattern: Resilient Constructor 🛡️
 */

import { RecurringPanelManager, buildRecurringSummaryFromSettings } from '../modules/recurring/recurringPanel.js';

export function runRecurringPanelTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎛️ RecurringPanel Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Save console methods at suite level
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };

    function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        // Save global state
        const savedGlobals = {
            AppState: window.AppState,
            showNotification: window.showNotification,
            loadMiniCycleData: window.loadMiniCycleData,
            refreshUIFromState: window.refreshUIFromState,
            FeatureFlags: window.FeatureFlags
        };

        try {
            testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // Restore global state
            Object.keys(savedGlobals).forEach(key => {
                if (savedGlobals[key] === undefined) {
                    delete window[key];
                } else {
                    window[key] = savedGlobals[key];
                }
            });

            // Restore console methods
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;

            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ===== INITIALIZATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('RecurringPanelManager class is defined', () => {
        if (typeof RecurringPanelManager === 'undefined') {
            throw new Error('RecurringPanelManager not found');
        }
    });

    test('creates instance without dependencies', () => {
        const panel = new RecurringPanelManager();

        if (!panel) {
            throw new Error('Panel not created');
        }

        if (!panel.deps) {
            throw new Error('Dependencies not initialized');
        }
    });

    test('creates instance with dependencies', () => {
        const mockDeps = {
            showNotification: (msg) => msg,
            getAppState: () => ({ data: {}, appState: {} })
        };

        const panel = new RecurringPanelManager(mockDeps);

        if (!panel) {
            throw new Error('Panel not created');
        }
    });

    test('initializes with default internal state', () => {
        const panel = new RecurringPanelManager();

        if (!panel.state) {
            throw new Error('State not initialized');
        }

        if (panel.state.isInitialized !== false) {
            throw new Error('isInitialized should be false initially');
        }

        if (panel.state.panelOpen !== false) {
            throw new Error('panelOpen should be false initially');
        }

        if (panel.state.selectedTaskId !== null) {
            throw new Error('selectedTaskId should be null initially');
        }
    });

    test('stores dependency overrides correctly', () => {
        let notificationCalled = false;

        const panel = new RecurringPanelManager({
            showNotification: () => { notificationCalled = true; }
        });

        panel.deps.showNotification('test');

        if (!notificationCalled) {
            throw new Error('Custom notification function not called');
        }
    });

    // ===== FALLBACK METHODS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Fallback Methods</h4>';

    test('fallbackApplySettings logs without throwing', () => {
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.fallbackApplySettings('task-1', { frequency: 'daily' });
    });

    test('fallbackDeleteTemplate logs without throwing', () => {
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.fallbackDeleteTemplate('task-1');
    });

    test('fallbackBuildSummary returns default summary', () => {
        const panel = new RecurringPanelManager();

        const summary = panel.fallbackBuildSummary({ frequency: 'weekly' });

        if (!summary.includes('weekly')) {
            throw new Error('Summary should include frequency');
        }
    });

    test('fallbackNormalize returns settings unchanged', () => {
        const panel = new RecurringPanelManager();
        const settings = { frequency: 'daily', count: 5 };

        const result = panel.fallbackNormalize(settings);

        if (result.frequency !== 'daily') {
            throw new Error('Settings should be returned unchanged');
        }
    });

    test('fallbackNotification logs without throwing', () => {
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.fallbackNotification('Test message', 'info');
    });

    test('fallbackConfirmation uses native confirm', () => {
        const panel = new RecurringPanelManager();

        let callbackCalled = false;

        // Mock window.confirm
        const originalConfirm = window.confirm;
        window.confirm = () => true;

        try {
            panel.fallbackConfirmation({
                message: 'Test',
                callback: (confirmed) => { callbackCalled = confirmed; }
            });

            if (!callbackCalled) {
                throw new Error('Callback should be called with true');
            }
        } finally {
            window.confirm = originalConfirm;
        }
    });

    // ===== STATE MANAGEMENT =====
    resultsDiv.innerHTML += '<h4 class="test-section">📊 State Management</h4>';

    test('tracks panel open state', () => {
        const panel = new RecurringPanelManager();

        if (panel.state.panelOpen !== false) {
            throw new Error('Panel should be closed initially');
        }

        panel.state.panelOpen = true;

        if (panel.state.panelOpen !== true) {
            throw new Error('Panel open state not updated');
        }
    });

    test('tracks selected task ID', () => {
        const panel = new RecurringPanelManager();

        panel.state.selectedTaskId = 'task-123';

        if (panel.state.selectedTaskId !== 'task-123') {
            throw new Error('Selected task ID not tracked');
        }
    });

    test('tracks yearly day selections per month', () => {
        const panel = new RecurringPanelManager();

        panel.state.selectedYearlyDays[1] = [5, 10, 15];

        if (!Array.isArray(panel.state.selectedYearlyDays[1])) {
            throw new Error('Should store array of days');
        }

        if (panel.state.selectedYearlyDays[1].length !== 3) {
            throw new Error('Should track correct number of days');
        }
    });

    // ===== PANEL OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 Panel Operations</h4>';

    test('openPanel waits for core systems', async () => {
        // ✅ Test updated: With AppInit, openPanel() waits for core instead of failing

        // Mark core ready so the test completes
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        const panel = new RecurringPanelManager({
            getAppState: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: 'cycle-1' }
            }),
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });

        // Should wait and then open successfully
        await panel.openPanel();

        if (!panel.state.panelOpen) {
            throw new Error('Panel should open after waiting for core');
        }
    });

    test('openPanel sets panelOpen state', async () => {
        // ✅ Mark core systems ready for test
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        const panel = new RecurringPanelManager({
            isAppStateReady: () => true,
            getAppState: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: 'cycle-1' }
            }),
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });

        await panel.openPanel();

        if (!panel.state.panelOpen) {
            throw new Error('Panel should be marked as open');
        }
    });

    test('closePanel clears panelOpen state', () => {
        const panel = new RecurringPanelManager({
            getElementById: () => ({ classList: { add: () => {} } })
        });

        panel.state.panelOpen = true;
        panel.state.selectedTaskId = 'task-1';

        panel.closePanel();

        if (panel.state.panelOpen) {
            throw new Error('Panel should be marked as closed');
        }

        if (panel.state.selectedTaskId !== null) {
            throw new Error('Selected task should be cleared');
        }
    });

    // ===== FORM BUILDING =====
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Form Building</h4>';

    test('buildRecurringSettingsFromPanel returns default settings', () => {
        const panel = new RecurringPanelManager({
            getElementById: () => null,
            querySelectorAll: () => []
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        if (!settings.frequency) {
            throw new Error('Should return frequency');
        }
    });

    test('buildRecurringSettingsFromPanel reads frequency', () => {
        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-frequency') return { value: 'weekly' };
                return null;
            },
            querySelectorAll: () => []
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        if (settings.frequency !== 'weekly') {
            throw new Error('Should read frequency from form');
        }
    });

    test('buildRecurringSettingsFromPanel reads indefinitely checkbox', () => {
        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-indefinitely') return { checked: false };
                if (id === 'recur-count-input') return { value: '10' };
                return null;
            },
            querySelectorAll: () => []
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        if (settings.indefinitely !== false) {
            throw new Error('Should read indefinitely setting');
        }

        if (settings.count !== 10) {
            throw new Error('Should read count when not indefinite');
        }
    });

    test('buildRecurringSettingsFromPanel handles specific dates', () => {
        const mockDateInputs = [
            { value: '2025-10-15' },
            { value: '2025-10-20' }
        ];

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-specific-dates') return { checked: true };
                return null;
            },
            querySelectorAll: (sel) => {
                if (sel.includes('specific-date-list')) return mockDateInputs;
                return [];
            }
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        if (!settings.specificDates.enabled) {
            throw new Error('Should enable specific dates');
        }

        if (settings.specificDates.dates.length !== 2) {
            throw new Error('Should read all date values');
        }
    });

    test('buildRecurringSettingsFromPanel handles hourly frequency', () => {
        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-frequency') return { value: 'hourly' };
                if (id === 'hourly-specific-time') return { checked: true };
                if (id === 'hourly-minute') return { value: '30' };
                return null;
            },
            querySelectorAll: () => []
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        if (settings.frequency !== 'hourly') {
            throw new Error('Should be hourly frequency');
        }

        if (!settings.hourly.useSpecificMinute) {
            throw new Error('Should enable specific minute');
        }

        if (settings.hourly.minute !== 30) {
            throw new Error('Should read minute value');
        }
    });

    // ===== FORM OPERATIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Form Operations</h4>';

    test('clearRecurringForm resets frequency to daily', () => {
        let frequencySet = null;
        let eventDispatched = false;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-frequency') {
                    return {
                        value: 'weekly',
                        set value(val) { frequencySet = val; },
                        dispatchEvent: () => { eventDispatched = true; }
                    };
                }
                return null;
            }
        });

        panel.clearRecurringForm();

        if (frequencySet !== 'daily') {
            throw new Error('Should reset frequency to daily');
        }

        if (!eventDispatched) {
            throw new Error('Should dispatch change event');
        }
    });

    test('clearRecurringForm resets indefinite checkbox', () => {
        let checkboxChecked = null;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-indefinitely') {
                    return {
                        set checked(val) { checkboxChecked = val; }
                    };
                }
                if (id === 'recur-frequency') {
                    return {
                        value: 'daily',
                        dispatchEvent: () => {}
                    };
                }
                return null;
            }
        });

        panel.clearRecurringForm();

        if (checkboxChecked !== true) {
            throw new Error('Should reset indefinite to true');
        }
    });

    test('populateRecurringFormWithSettings sets frequency', () => {
        let frequencyValue = null;
        let eventDispatched = false;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-frequency') {
                    return {
                        value: 'daily',
                        set value(val) { frequencyValue = val; },
                        dispatchEvent: () => { eventDispatched = true; }
                    };
                }
                return null;
            }
        });

        panel.populateRecurringFormWithSettings({ frequency: 'monthly' });

        if (frequencyValue !== 'monthly') {
            throw new Error('Should set frequency from settings');
        }
    });

    test('populateRecurringFormWithSettings sets count', () => {
        let countValue = null;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-frequency') {
                    return { value: 'daily', dispatchEvent: () => {} };
                }
                if (id === 'recur-count-input') {
                    return {
                        set value(val) { countValue = val; }
                    };
                }
                if (id === 'recur-indefinitely') {
                    return { set checked(val) {} };
                }
                return null;
            }
        });

        panel.populateRecurringFormWithSettings({
            frequency: 'daily',
            indefinitely: false,
            count: 25
        });

        if (countValue !== 25) {
            throw new Error('Should set count from settings');
        }
    });

    // ===== GRID GENERATION =====
    resultsDiv.innerHTML += '<h4 class="test-section">📅 Grid Generation</h4>';

    test('generateMonthlyDayGrid creates 31 day boxes', () => {
        const mockContainer = {
            innerHTML: '',
            appendChild: function(el) { this.innerHTML += el.outerHTML || 'box'; }
        };

        const panel = new RecurringPanelManager({
            querySelector: () => mockContainer
        });

        panel.generateMonthlyDayGrid();

        // Should create 31 boxes (roughly)
        const boxCount = (mockContainer.innerHTML.match(/box/g) || []).length;
        if (boxCount !== 31) {
            throw new Error(`Should create 31 day boxes, got ${boxCount}`);
        }
    });

    test('generateYearlyMonthGrid creates 12 month boxes', () => {
        const mockContainer = {
            innerHTML: '',
            appendChild: function(el) { this.innerHTML += el.outerHTML || 'box'; }
        };

        const panel = new RecurringPanelManager({
            querySelector: () => mockContainer,
            getElementById: () => null,
            querySelectorAll: () => []
        });

        panel.generateYearlyMonthGrid();

        const boxCount = (mockContainer.innerHTML.match(/box/g) || []).length;
        if (boxCount !== 12) {
            throw new Error(`Should create 12 month boxes, got ${boxCount}`);
        }
    });

    test('getSelectedYearlyMonths returns selected months', () => {
        const mockMonthBoxes = [
            { classList: { contains: () => true }, dataset: { month: '1' } },
            { classList: { contains: () => true }, dataset: { month: '6' } },
            { classList: { contains: () => false }, dataset: { month: '12' } }
        ];

        const panel = new RecurringPanelManager({
            querySelectorAll: (sel) => {
                if (sel.includes('yearly-month-box.selected')) {
                    return mockMonthBoxes.filter(box => box.classList.contains());
                }
                return [];
            }
        });

        const selected = panel.getSelectedYearlyMonths();

        if (selected.length !== 2) {
            throw new Error('Should return only selected months');
        }

        if (!selected.includes(1) || !selected.includes(6)) {
            throw new Error('Should return correct month numbers');
        }
    });

    test('getSelectedMonthlyDays returns selected days', () => {
        const mockDayBoxes = [
            { classList: { contains: () => true }, dataset: { day: '5' } },
            { classList: { contains: () => true }, dataset: { day: '15' } },
            { classList: { contains: () => false }, dataset: { day: '25' } }
        ];

        const panel = new RecurringPanelManager({
            querySelectorAll: (sel) => {
                if (sel.includes('monthly-day-box.selected')) {
                    return mockDayBoxes.filter(box => box.classList.contains());
                }
                return [];
            }
        });

        const selected = panel.getSelectedMonthlyDays();

        if (selected.length !== 2) {
            throw new Error('Should return only selected days');
        }
    });

    // ===== UTILITY FUNCTIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🛠️ Utility Functions</h4>';

    test('getTomorrow returns future date', () => {
        const panel = new RecurringPanelManager();

        const tomorrow = panel.getTomorrow();
        const today = new Date();

        if (!(tomorrow instanceof Date)) {
            throw new Error('Should return Date object');
        }

        if (tomorrow <= today) {
            throw new Error('Tomorrow should be after today');
        }
    });

    test('getTomorrow handles errors gracefully', () => {
        const panel = new RecurringPanelManager();

        // Should not throw even if there are internal errors
        const result = panel.getTomorrow();

        if (!result) {
            throw new Error('Should return fallback date on error');
        }
    });

    test('updateRecurCountVisibility hides count for indefinite', () => {
        let countContainerHidden = false;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-indefinitely') return { checked: true };
                if (id === 'recur-specific-dates') return { checked: false };
                if (id === 'recur-count-container') {
                    return {
                        classList: {
                            toggle: (cls, condition) => {
                                if (cls === 'hidden') countContainerHidden = condition;
                            }
                        }
                    };
                }
                return null;
            }
        });

        panel.updateRecurCountVisibility();

        if (!countContainerHidden) {
            throw new Error('Count should be hidden for indefinite');
        }
    });

    test('updateRecurCountVisibility shows count for limited repetition', () => {
        let countContainerHidden = null;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'recur-indefinitely') return { checked: false };
                if (id === 'recur-specific-dates') return { checked: false };
                if (id === 'recur-count-container') {
                    return {
                        classList: {
                            toggle: (cls, condition) => {
                                if (cls === 'hidden') countContainerHidden = condition;
                            }
                        }
                    };
                }
                return null;
            }
        });

        panel.updateRecurCountVisibility();

        if (countContainerHidden !== false) {
            throw new Error('Count should be shown for limited repetition');
        }
    });

    // ===== BUTTON VISIBILITY =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 Button Visibility</h4>';

    test('updateRecurringPanelButtonVisibility hides when no templates', () => {
        let buttonHidden = false;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'open-recurring-panel') {
                    return {
                        classList: {
                            toggle: (cls, condition) => {
                                if (cls === 'hidden') buttonHidden = condition;
                            }
                        }
                    };
                }
                return null;
            },
            isAppStateReady: () => true,
            getAppState: () => ({
                data: {
                    cycles: {
                        'cycle-1': { recurringTemplates: {} }
                    }
                },
                appState: { activeCycleId: 'cycle-1' }
            })
        });

        panel.updateRecurringPanelButtonVisibility();

        if (!buttonHidden) {
            throw new Error('Button should be hidden when no templates');
        }
    });

    test('updateRecurringPanelButtonVisibility shows when templates exist', () => {
        let buttonHidden = null;

        const panel = new RecurringPanelManager({
            getElementById: (id) => {
                if (id === 'open-recurring-panel') {
                    return {
                        classList: {
                            toggle: (cls, condition) => {
                                if (cls === 'hidden') buttonHidden = condition;
                            }
                        }
                    };
                }
                return null;
            },
            isAppStateReady: () => true,
            getAppState: () => ({
                data: {
                    cycles: {
                        'cycle-1': {
                            recurringTemplates: {
                                'task-1': { id: 'task-1', text: 'Test' }
                            }
                        }
                    }
                },
                appState: { activeCycleId: 'cycle-1' }
            })
        });

        panel.updateRecurringPanelButtonVisibility();

        if (buttonHidden !== false) {
            throw new Error('Button should be shown when templates exist');
        }
    });

    // ===== STANDALONE FUNCTIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Standalone Functions</h4>';

    test('buildRecurringSummaryFromSettings function exists', () => {
        if (typeof buildRecurringSummaryFromSettings !== 'function') {
            throw new Error('buildRecurringSummaryFromSettings not exported');
        }
    });

    test('buildRecurringSummaryFromSettings returns string', () => {
        const summary = buildRecurringSummaryFromSettings({ frequency: 'daily' });

        if (typeof summary !== 'string') {
            throw new Error('Should return string');
        }
    });

    test('buildRecurringSummaryFromSettings handles daily frequency', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'daily',
            indefinitely: true
        });

        if (!summary.includes('daily')) {
            throw new Error('Summary should mention daily');
        }

        if (!summary.includes('indefinitely')) {
            throw new Error('Summary should mention indefinitely');
        }
    });

    test('buildRecurringSummaryFromSettings handles count', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'weekly',
            indefinitely: false,
            count: 10
        });

        if (!summary.includes('10')) {
            throw new Error('Summary should include count');
        }
    });

    test('buildRecurringSummaryFromSettings handles specific time', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'daily',
            useSpecificTime: true,
            time: {
                hour: 14,
                minute: 30,
                military: true
            }
        });

        if (!summary.includes('14:30')) {
            throw new Error('Summary should include time');
        }
    });

    test('buildRecurringSummaryFromSettings handles 12-hour time', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'daily',
            useSpecificTime: true,
            time: {
                hour: 2,
                minute: 30,
                meridiem: 'PM',
                military: false
            }
        });

        if (!summary.includes('2:30') || !summary.includes('PM')) {
            throw new Error('Summary should include 12-hour time with meridiem');
        }
    });

    test('buildRecurringSummaryFromSettings handles weekly with days', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'weekly',
            weekly: {
                days: ['Monday', 'Wednesday', 'Friday']
            }
        });

        if (!summary.includes('Monday') || !summary.includes('Wednesday')) {
            throw new Error('Summary should include days');
        }
    });

    test('buildRecurringSummaryFromSettings handles monthly with days', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'monthly',
            monthly: {
                days: [1, 15, 30]
            }
        });

        if (!summary.includes('1') || !summary.includes('15')) {
            throw new Error('Summary should include monthly days');
        }
    });

    test('buildRecurringSummaryFromSettings handles specific dates', () => {
        const summary = buildRecurringSummaryFromSettings({
            specificDates: {
                enabled: true,
                dates: ['2025-10-15', '2025-10-20']
            }
        });

        if (!summary.includes('Specific dates')) {
            throw new Error('Summary should mention specific dates');
        }
    });

    test('buildRecurringSummaryFromSettings handles hourly with minute', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'hourly',
            hourly: {
                useSpecificMinute: true,
                minute: 30
            }
        });

        if (!summary.includes(':30')) {
            throw new Error('Summary should include minute for hourly');
        }
    });

    test('buildRecurringSummaryFromSettings handles yearly with months', () => {
        const summary = buildRecurringSummaryFromSettings({
            frequency: 'yearly',
            yearly: {
                months: [1, 6, 12],
                useSpecificDays: false
            }
        });

        if (!summary.includes('Jan') || !summary.includes('Jun') || !summary.includes('Dec')) {
            throw new Error('Summary should include month names');
        }
    });

    // ===== ERROR HANDLING =====
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    test('handles missing DOM elements gracefully in setup', () => {
        const panel = new RecurringPanelManager({
            getElementById: () => null,
            showNotification: (msg) => msg
        });

        // Should not throw
        panel.setup();
    });

    test('handles AppState not ready in openPanel', async () => {
        // ✅ Test updated: With AppInit, openPanel() now waits for core instead of checking readiness
        // The old behavior (show notification immediately) no longer applies
        // New behavior: waits silently via appInit.waitForCore()

        // Mark core ready so the test completes
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        const panel = new RecurringPanelManager({
            getAppState: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: 'cycle-1' }
            }),
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });

        // Should complete successfully (waits for core internally)
        await panel.openPanel();

        // Verify it opened successfully
        if (!panel.state.panelOpen) {
            throw new Error('Panel should open after waiting for core');
        }
    });

    test('handles missing active cycle in updateRecurringPanel', () => {
        const panel = new RecurringPanelManager({
            isAppStateReady: () => true,
            getAppState: () => ({
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            getElementById: () => ({ innerHTML: '' })
        });

        // Should not throw
        panel.updateRecurringPanel();
    });

    test('handles null task in showTaskSummaryPreview', () => {
        const panel = new RecurringPanelManager({
            getElementById: () => null
        });

        // Should not throw
        panel.showTaskSummaryPreview(null);
    });

    test('buildRecurringSettingsFromPanel handles errors gracefully', () => {
        const panel = new RecurringPanelManager({
            getElementById: () => { throw new Error('DOM error'); },
            querySelectorAll: () => []
        });

        const settings = panel.buildRecurringSettingsFromPanel();

        // Should return default settings instead of throwing
        if (!settings.frequency) {
            throw new Error('Should return fallback settings on error');
        }
    });

    // ===== INTEGRATION TESTS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Integration</h4>';

    test('integrates with AppState for panel updates', () => {
        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [
                            { id: 'task-1', text: 'Test Task', recurring: true }
                        ],
                        recurringTemplates: {
                            'task-1': { id: 'task-1', text: 'Test Task' }
                        }
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const panel = new RecurringPanelManager({
            isAppStateReady: () => true,
            getAppState: () => mockState,
            getElementById: (id) => {
                if (id === 'recurring-task-list') return { innerHTML: '' };
                return null;
            },
            querySelectorAll: () => []
        });

        // Should not throw
        panel.updateRecurringPanel();
    });

    test('uses dependency injection for notifications', () => {
        let notificationMessage = null;

        const panel = new RecurringPanelManager({
            showNotification: (msg) => { notificationMessage = msg; }
        });

        panel.deps.showNotification('Test notification');

        if (notificationMessage !== 'Test notification') {
            throw new Error('Should use injected notification function');
        }
    });

    test('uses dependency injection for AppState', () => {
        const mockState = {
            data: { cycles: {} },
            appState: { activeCycleId: null }
        };

        const panel = new RecurringPanelManager({
            getAppState: () => mockState
        });

        const state = panel.deps.getAppState();

        if (state !== mockState) {
            throw new Error('Should use injected AppState function');
        }
    });

    // ===== RESULTS SUMMARY =====
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
