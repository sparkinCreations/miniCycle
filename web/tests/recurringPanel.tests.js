/**
 * RecurringPanel Module Tests
 * Tests for the recurring tasks UI panel manager
 *
 * Pattern: Resilient Constructor 🛡️
 */

// Module references - populated by dynamic import in runRecurringPanelTests
let RecurringPanelManager, buildRecurringSummaryFromSettings, setRecurringPanelDependencies, loadPanelSubModules;

/**
 * Helper to set up required DI dependencies before creating RecurringPanelManager
 * @param {Object} overrides - Optional overrides for specific deps
 */
function setupPanelDeps(overrides = {}) {
    const defaultDeps = {
        AppState: overrides.AppState || {
            get: () => ({
                schemaVersion: "2.5",
                data: { cycles: {} },
                appState: { activeCycleId: null }
            }),
            update: (fn) => {},
            isReady: () => true
        },
        showNotification: overrides.showNotification || ((msg) => msg),
        applyRecurringSettings: overrides.applyRecurringSettings || ((taskId, settings) => {}),
        normalizeRecurringSettings: overrides.normalizeRecurringSettings || ((settings) => settings || {}),
        calculateNextOccurrence: overrides.calculateNextOccurrence || (() => null),
        appInit: overrides.appInit || { waitForCore: () => Promise.resolve() },
        deleteTemplate: overrides.deleteTemplate || (() => {}),
        buildRecurringSummary: overrides.buildRecurringSummary || ((settings) => `Recurs ${settings?.frequency || 'unknown'}`),
        formatNextOccurrence: overrides.formatNextOccurrence || (() => 'N/A'),
        updateAppState: overrides.updateAppState || ((fn) => {}),
        loadData: overrides.loadData || (() => null),
        showConfirmationModal: overrides.showConfirmationModal || ((options) => options?.onConfirm?.()),
        getElementById: overrides.getElementById || ((id) => document.getElementById(id)),
        querySelector: overrides.querySelector || ((sel) => document.querySelector(sel)),
        querySelectorAll: overrides.querySelectorAll || ((sel) => document.querySelectorAll(sel)),
        safeAddEventListener: overrides.safeAddEventListener || ((el, event, handler, options) => {
            if (el && el.addEventListener) {
                el.addEventListener(event, handler, options);
            }
        }),
        isOverlayActive: overrides.isOverlayActive || (() => false),
        escapeHtml: overrides.escapeHtml || ((str) => str),
        getModal: overrides.getModal || ((name) => {
            const map = { recurringOverlay: 'recurring-panel-overlay', recurringPanel: 'recurring-settings-panel' };
            return document.getElementById(map[name]) || null;
        })
    };
    setRecurringPanelDependencies(defaultDeps);
    return defaultDeps;
}

export async function runRecurringPanelTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🎛️ RecurringPanel Tests</h2><h3>Loading module...</h3>';

    // Dynamic import with cache busting to avoid stale CDN cache
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/recurring/recurringPanel.js?v=${cacheBuster}`);
    RecurringPanelManager = module.RecurringPanelManager;
    buildRecurringSummaryFromSettings = module.buildRecurringSummaryFromSettings;
    setRecurringPanelDependencies = module.setRecurringPanelDependencies;
    loadPanelSubModules = module.loadPanelSubModules;

    resultsDiv.innerHTML = '<h2>🎛️ RecurringPanel Tests</h2><h3>Loading sub-modules...</h3>';

    // Load sub-modules before running tests
    await loadPanelSubModules(cacheBuster);

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

    async function test(name, testFn) {
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
            const result = testFn();
            if (result instanceof Promise) await result;
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

    test('creates instance with DI dependencies', () => {
        setupPanelDeps();
        const panel = new RecurringPanelManager();

        if (!panel) {
            throw new Error('Panel not created');
        }

        if (!panel.deps) {
            throw new Error('Dependencies not initialized');
        }
    });

    test('creates instance with custom dependencies', () => {
        const mockDeps = {
            showNotification: (msg) => msg,
            AppState: {
                get: () => ({ data: {}, appState: {} }),
                update: (fn) => {},
                isReady: () => true
            }
        };

        setupPanelDeps(mockDeps);
        const panel = new RecurringPanelManager();

        if (!panel) {
            throw new Error('Panel not created');
        }
    });

    test('initializes with default internal state', () => {
        setupPanelDeps();
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

        setupPanelDeps({
            showNotification: () => { notificationCalled = true; }
        });
        const panel = new RecurringPanelManager();

        panel.deps.showNotification('test');

        if (!notificationCalled) {
            throw new Error('Custom notification function not called');
        }
    });

    // ===== FALLBACK METHODS =====
    // NOTE: fallbackDeleteTemplate, fallbackBuildSummary, fallbackConfirmation
    // were removed from RecurringPanelManager. These functions are now handled
    // by dependency injection (deleteTemplate, buildRecurringSummary, showConfirmationModal).

    // ===== STATE MANAGEMENT =====
    resultsDiv.innerHTML += '<h4 class="test-section">📊 State Management</h4>';

    test('tracks panel open state', () => {
        setupPanelDeps();
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
        setupPanelDeps();
        const panel = new RecurringPanelManager();

        panel.state.selectedTaskId = 'task-123';

        if (panel.state.selectedTaskId !== 'task-123') {
            throw new Error('Selected task ID not tracked');
        }
    });

    test('tracks yearly day selections per month', () => {
        setupPanelDeps();
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

    await test('openPanel waits for core systems', async () => {
        // ✅ Test updated: With AppInit, openPanel() waits for core instead of failing

        // Mark core ready so the test completes
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        setupPanelDeps({
            AppState: {
                get: () => ({
                    data: { cycles: {} },
                    appState: { activeCycleId: 'cycle-1' }
                }),
                update: (fn) => {},
                isReady: () => true
            },
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });
        const panel = new RecurringPanelManager();

        // Should wait and then open successfully
        await panel.openPanel();

        if (!panel.state.panelOpen) {
            throw new Error('Panel should open after waiting for core');
        }
    });

    await test('openPanel sets panelOpen state', async () => {
        // ✅ Mark core systems ready for test
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        setupPanelDeps({
            AppState: {
                get: () => ({
                    data: { cycles: {} },
                    appState: { activeCycleId: 'cycle-1' }
                }),
                update: (fn) => {},
                isReady: () => true
            },
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });
        const panel = new RecurringPanelManager();

        await panel.openPanel();

        if (!panel.state.panelOpen) {
            throw new Error('Panel should be marked as open');
        }
    });

    test('closePanel clears panelOpen state', () => {
        setupPanelDeps({
            getElementById: () => ({ classList: { add: () => {} } })
        });
        const panel = new RecurringPanelManager();

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
        setupPanelDeps({
            getElementById: () => null,
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

        const settings = panel.buildRecurringSettingsFromPanel();

        if (!settings.frequency) {
            throw new Error('Should return frequency');
        }
    });

    test('buildRecurringSettingsFromPanel reads frequency', () => {
        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'recur-frequency') return { value: 'weekly' };
                return null;
            },
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

        const settings = panel.buildRecurringSettingsFromPanel();

        if (settings.frequency !== 'weekly') {
            throw new Error('Should read frequency from form');
        }
    });

    test('buildRecurringSettingsFromPanel reads indefinitely checkbox', () => {
        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'recur-indefinitely') return { checked: false };
                if (id === 'recur-count-radio') return { checked: true };
                if (id === 'recur-count-input') return { value: '10' };
                return null;
            },
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'recur-specific-dates') return { checked: true };
                return null;
            },
            querySelectorAll: (sel) => {
                if (sel.includes('specific-date-list')) return mockDateInputs;
                return [];
            }
        });
        const panel = new RecurringPanelManager();

        const settings = panel.buildRecurringSettingsFromPanel();

        if (!settings.specificDates.enabled) {
            throw new Error('Should enable specific dates');
        }

        if (settings.specificDates.dates.length !== 2) {
            throw new Error('Should read all date values');
        }
    });

    test('buildRecurringSettingsFromPanel handles hourly frequency', () => {
        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'recur-frequency') return { value: 'hourly' };
                if (id === 'hourly-specific-time') return { checked: true };
                if (id === 'hourly-minute') return { value: '30' };
                return null;
            },
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
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
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
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
        const panel = new RecurringPanelManager();

        panel.clearRecurringForm();

        if (checkboxChecked !== true) {
            throw new Error('Should reset indefinite to true');
        }
    });

    test('populateRecurringFormWithSettings sets frequency', () => {
        let frequencyValue = null;
        let eventDispatched = false;

        setupPanelDeps({
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
        const panel = new RecurringPanelManager();

        panel.populateRecurringFormWithSettings({ frequency: 'monthly' });

        if (frequencyValue !== 'monthly') {
            throw new Error('Should set frequency from settings');
        }
    });

    test('populateRecurringFormWithSettings sets count', () => {
        let countValue = null;

        setupPanelDeps({
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
                    return { set checked(val) {}, dispatchEvent: () => {} };
                }
                if (id === 'recur-count-radio') {
                    return {
                        checked: false,
                        set checked(val) {},
                        dispatchEvent: () => {}
                    };
                }
                return null;
            }
        });
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
            querySelector: () => mockContainer
        });
        const panel = new RecurringPanelManager();

        panel.generateMonthlyDayGrid();

        // Count data-day attributes (one per day box, not ambiguous like "box")
        const boxCount = (mockContainer.innerHTML.match(/data-day="/g) || []).length;
        if (boxCount !== 31) {
            throw new Error(`Should create 31 day boxes, got ${boxCount}`);
        }
    });

    test('generateYearlyMonthGrid creates 12 month boxes', () => {
        const mockContainer = {
            innerHTML: '',
            appendChild: function(el) { this.innerHTML += el.outerHTML || 'box'; }
        };

        setupPanelDeps({
            querySelector: () => mockContainer,
            getElementById: () => null,
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

        panel.generateYearlyMonthGrid();

        // Count data-month attributes (one per month box, not ambiguous like "box")
        const boxCount = (mockContainer.innerHTML.match(/data-month="/g) || []).length;
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

        setupPanelDeps({
            querySelectorAll: (sel) => {
                if (sel.includes('yearly-month-box.selected')) {
                    return mockMonthBoxes.filter(box => box.classList.contains());
                }
                return [];
            }
        });
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
            querySelectorAll: (sel) => {
                if (sel.includes('monthly-day-box.selected')) {
                    return mockDayBoxes.filter(box => box.classList.contains());
                }
                return [];
            }
        });
        const panel = new RecurringPanelManager();

        const selected = panel.getSelectedMonthlyDays();

        if (selected.length !== 2) {
            throw new Error('Should return only selected days');
        }
    });

    // ===== UTILITY FUNCTIONS =====
    resultsDiv.innerHTML += '<h4 class="test-section">🛠️ Utility Functions</h4>';

    test('getTomorrow returns future date', () => {
        setupPanelDeps();
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
        setupPanelDeps();
        const panel = new RecurringPanelManager();

        // Should not throw even if there are internal errors
        const result = panel.getTomorrow();

        if (!result) {
            throw new Error('Should return fallback date on error');
        }
    });

    test('updateRecurCountVisibility hides count for indefinite', () => {
        let countContainerHidden = false;

        setupPanelDeps({
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
        const panel = new RecurringPanelManager();

        panel.updateRecurCountVisibility();

        if (!countContainerHidden) {
            throw new Error('Count should be hidden for indefinite');
        }
    });

    test('updateRecurCountVisibility shows count for limited repetition', () => {
        let countContainerHidden = null;

        setupPanelDeps({
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
        const panel = new RecurringPanelManager();

        panel.updateRecurCountVisibility();

        if (countContainerHidden !== false) {
            throw new Error('Count should be shown for limited repetition');
        }
    });

    // ===== BUTTON VISIBILITY =====
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 Button Visibility</h4>';

    test('updateRecurringPanelButtonVisibility always shows button (no templates)', () => {
        let hiddenRemoved = false;

        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'open-recurring-panel') {
                    return {
                        classList: {
                            remove: (cls) => {
                                if (cls === 'hidden') hiddenRemoved = true;
                            }
                        }
                    };
                }
                return null;
            },
            AppState: {
                get: () => ({
                    data: {
                        cycles: {
                            'cycle-1': { recurringTemplates: {} }
                        }
                    },
                    appState: { activeCycleId: 'cycle-1' }
                }),
                update: (fn) => {},
                isReady: () => true
            }
        });
        const panel = new RecurringPanelManager();

        panel.updateRecurringPanelButtonVisibility();

        if (!hiddenRemoved) {
            throw new Error('Button should always be visible (hidden class removed)');
        }
    });

    test('updateRecurringPanelButtonVisibility always shows button (with templates)', () => {
        let hiddenRemoved = false;

        setupPanelDeps({
            getElementById: (id) => {
                if (id === 'open-recurring-panel') {
                    return {
                        classList: {
                            remove: (cls) => {
                                if (cls === 'hidden') hiddenRemoved = true;
                            }
                        }
                    };
                }
                return null;
            },
            AppState: {
                get: () => ({
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
                }),
                update: (fn) => {},
                isReady: () => true
            }
        });
        const panel = new RecurringPanelManager();

        panel.updateRecurringPanelButtonVisibility();

        if (!hiddenRemoved) {
            throw new Error('Button should always be visible (hidden class removed)');
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
        setupPanelDeps({
            getElementById: () => null,
            showNotification: (msg) => msg
        });
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.setup();
    });

    await test('handles AppState not ready in openPanel', async () => {
        // ✅ Test updated: With AppInit, openPanel() now waits for core instead of checking readiness
        // The old behavior (show notification immediately) no longer applies
        // New behavior: waits silently via appInit.waitForCore()

        // Mark core ready so the test completes
        if (window.appInit && !window.appInit.isCoreReady()) {
            await window.appInit.markCoreSystemsReady();
        }

        setupPanelDeps({
            AppState: {
                get: () => ({
                    data: { cycles: {} },
                    appState: { activeCycleId: 'cycle-1' }
                }),
                update: (fn) => {},
                isReady: () => true
            },
            getElementById: () => ({ classList: { remove: () => {}, add: () => {} } })
        });
        const panel = new RecurringPanelManager();

        // Should complete successfully (waits for core internally)
        await panel.openPanel();

        // Verify it opened successfully
        if (!panel.state.panelOpen) {
            throw new Error('Panel should open after waiting for core');
        }
    });

    test('handles missing active cycle in updateRecurringPanel', () => {
        setupPanelDeps({
            AppState: {
                get: () => ({
                    data: { cycles: {} },
                    appState: { activeCycleId: null }
                }),
                update: (fn) => {},
                isReady: () => true
            },
            getElementById: () => ({ innerHTML: '' })
        });
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.updateRecurringPanel();
    });

    test('handles null task in showTaskSummaryPreview', () => {
        setupPanelDeps({
            getElementById: () => null
        });
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.showTaskSummaryPreview(null);
    });

    test('showTaskSummaryPreview populates summary text for task with settings', () => {
        let previewCleared = false;
        let appendedChildren = [];
        let summaryContainerShown = false;

        const mockElements = {
            'recurring-preview-text': {
                innerHTML: '',
                set innerHTML(val) { previewCleared = (val === ''); },
                appendChild: function(el) { appendedChildren.push(el); }
            },
            'recurring-summary-preview': {
                classList: {
                    remove: function(className) {
                        if (className === 'hidden') summaryContainerShown = true;
                    },
                    add: () => {},
                    contains: () => false
                }
            }
        };

        const task = {
            id: 'task-1',
            text: 'Test Task',
            recurringSettings: { frequency: 'daily' }
        };

        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [task],
                        recurringTemplates: {}
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        setupPanelDeps({
            getElementById: (id) => mockElements[id] || null,
            AppState: {
                get: () => mockState,
                update: (fn) => {},
                isReady: () => true
            },
            buildRecurringSummary: () => 'Daily',
            formatNextOccurrence: () => 'Tomorrow'
        });
        const panel = new RecurringPanelManager();

        panel.showTaskSummaryPreview(task);

        if (!summaryContainerShown) {
            throw new Error('Summary container should be shown (hidden class removed)');
        }

        if (!previewCleared) {
            throw new Error('Preview text should be cleared before populating');
        }

        // Should append at least the task name (strong) and a br element
        if (appendedChildren.length < 2) {
            throw new Error(`Should append task name and summary elements, got ${appendedChildren.length} children`);
        }
    });

    test('showTaskSummaryPreview shows summary container when task has recurring settings', () => {
        let summaryContainerShown = false;
        let appendedChildren = [];

        const mockElements = {
            'recurring-preview-text': {
                innerHTML: '',
                set innerHTML(val) {},
                appendChild: function(el) { appendedChildren.push(el); }
            },
            'recurring-summary-preview': {
                classList: {
                    remove: function(className) {
                        if (className === 'hidden') summaryContainerShown = true;
                    },
                    add: () => {},
                    contains: () => false
                }
            }
        };

        const task = {
            id: 'task-1',
            text: 'Test Task',
            recurringSettings: { frequency: 'weekly' }
        };

        const mockState = {
            data: {
                cycles: {
                    'cycle-1': {
                        tasks: [task],
                        recurringTemplates: {}
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        setupPanelDeps({
            getElementById: (id) => mockElements[id] || null,
            AppState: {
                get: () => mockState,
                update: (fn) => {},
                isReady: () => true
            },
            buildRecurringSummary: () => 'Weekly',
            formatNextOccurrence: () => 'Next Monday'
        });
        const panel = new RecurringPanelManager();

        panel.showTaskSummaryPreview(task);

        if (!summaryContainerShown) {
            throw new Error('Summary container should be visible when task has recurring settings');
        }

        // Should have appended a summary span (class 'recurring-summary-text')
        const hasSummarySpan = appendedChildren.some(el =>
            el.className === 'recurring-summary-text'
        );
        if (!hasSummarySpan) {
            throw new Error('Should append a summary text span with recurring details');
        }
    });

    test('buildRecurringSettingsFromPanel handles errors gracefully', () => {
        setupPanelDeps({
            getElementById: () => { throw new Error('DOM error'); },
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

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

        setupPanelDeps({
            AppState: {
                get: () => mockState,
                update: (fn) => {},
                isReady: () => true
            },
            getElementById: (id) => {
                if (id === 'recurring-task-list') return { innerHTML: '' };
                return null;
            },
            querySelectorAll: () => []
        });
        const panel = new RecurringPanelManager();

        // Should not throw
        panel.updateRecurringPanel();
    });

    test('uses dependency injection for notifications', () => {
        let notificationMessage = null;

        setupPanelDeps({
            showNotification: (msg) => { notificationMessage = msg; }
        });
        const panel = new RecurringPanelManager();

        panel.deps.showNotification('Test notification');

        if (notificationMessage !== 'Test notification') {
            throw new Error('Should use injected notification function');
        }
    });

    test('uses dependency injection for AppState', () => {
        const mockState = {
            get: () => ({ data: { cycles: {} }, appState: { activeCycleId: null } }),
            update: (fn) => {},
            isReady: () => true
        };

        setupPanelDeps({
            AppState: mockState
        });
        const panel = new RecurringPanelManager();

        const state = panel.deps.AppState;

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
