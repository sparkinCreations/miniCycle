/**
 * CycleCompletion Tests
 * Tests for modules/progress/cycleCompletion.js
 *
 * Tests cycle completion functionality:
 * - Module loading and exports
 * - Dependency injection
 * - Completion animation
 * - Cycle count increment
 * - Milestone detection
 * - Theme/game unlocks
 * - Progress bar and completion/due-date checks, read from AppState (not the DOM)
 */

import {
    setupTestEnvironment,
    createMockData,
    waitForAsyncOperations
} from './testHelpers.js';

import {
    setCycleCompletionDependencies,
    showCompletionAnimation,
    incrementCycleCount,
    updateProgressBar,
    checkMiniCycle,
    initCycleCompletion
} from '../modules/progress/cycleCompletion.js';

export async function runCycleCompletionTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>CycleCompletion Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    resultsDiv.innerHTML = '<h2>CycleCompletion Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // Save real app data
    let savedRealData = {};
    if (!isPartOfSuite) {
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });
    }

    function restoreOriginalData() {
        if (!isPartOfSuite) {
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // Helper: Create mock AppState with Schema 2.5 data
    function createMockAppStateWithData(overrides = {}) {
        const mockData = createMockData(overrides);
        return {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                return mockData;
            }
        };
    }

    // Track notifications and function calls
    let notifications = [];
    let updateStatsPanelCalled = false;
    let darkOceanUnlocked = false;
    let goldenGlowUnlocked = false;
    let miniGameUnlocked = false;

    function resetTracking() {
        notifications = [];
        updateStatsPanelCalled = false;
        darkOceanUnlocked = false;
        goldenGlowUnlocked = false;
        miniGameUnlocked = false;
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            resetTracking();

            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Clean up any DOM elements from previous tests
            document.querySelectorAll('.mini-cycle-complete-animation, .mini-cycle-milestone').forEach(el => el.remove());

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE LOADING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setCycleCompletionDependencies function exists', () => {
        if (typeof setCycleCompletionDependencies !== 'function') {
            throw new Error('setCycleCompletionDependencies not exported');
        }
    });

    await test('showCompletionAnimation function exists', () => {
        if (typeof showCompletionAnimation !== 'function') {
            throw new Error('showCompletionAnimation not exported');
        }
    });

    await test('incrementCycleCount function exists', () => {
        if (typeof incrementCycleCount !== 'function') {
            throw new Error('incrementCycleCount not exported');
        }
    });

    // === DEPENDENCY INJECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💉 Dependency Injection</h4>';

    // Initialize the module to load MILESTONES before any tests that use incrementCycleCount
    await initCycleCompletion();

    await test('setCycleCompletionDependencies accepts all dependencies', () => {
        const mockAppState = createMockAppStateWithData();

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => { updateStatsPanelCalled = true; },
            unlockDarkOceanTheme: () => { darkOceanUnlocked = true; },
            unlockGoldenGlowTheme: () => { goldenGlowUnlocked = true; },
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });
    });

    await test('setCycleCompletionDependencies merges with existing deps', () => {
        // First set some deps
        setCycleCompletionDependencies({
            AppState: createMockAppStateWithData()
        });

        // Then set more - should merge
        setCycleCompletionDependencies({
            showNotification: (msg) => notifications.push(msg)
        });

        // Should not throw when using later
    });

    // === COMPLETION ANIMATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎬 Completion Animation</h4>';

    await test('showCompletionAnimation creates animation element', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation) {
            throw new Error('Animation element not created');
        }
    });

    await test('showCompletionAnimation element has checkmark', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation.innerHTML.includes('✔')) {
            throw new Error('Animation should contain checkmark');
        }
    });

    await test('showCompletionAnimation element is appended to body', () => {
        showCompletionAnimation();

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (animation.parentElement !== document.body) {
            throw new Error('Animation should be appended to body');
        }
    });

    await test('showCompletionAnimation can be called multiple times', () => {
        showCompletionAnimation();
        showCompletionAnimation();
        showCompletionAnimation();

        const animations = document.querySelectorAll('.mini-cycle-complete-animation');
        if (animations.length !== 3) {
            throw new Error('Should create multiple animation elements');
        }
    });

    // === INCREMENT CYCLE COUNT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔢 Increment Cycle Count</h4>';

    // AppState is required() (STATE_TRUTH_MIGRATION #15). A missing AppState used to log
    // "not ready" and return, so a wiring failure looked like a timing blip and the cycle
    // count silently never moved. It must now throw where it happens.
    await test('incrementCycleCount throws when AppState is not wired', () => {
        setCycleCompletionDependencies({
            AppState: null
        });

        let message = null;
        try {
            incrementCycleCount('test-cycle', {});
        } catch (error) {
            message = error.message;
        }
        if (!message || !message.includes('isReady')) {
            throw new Error(`expected a TypeError reading isReady, got ${message === null ? 'no throw — logged and returned as if merely not ready' : message}`);
        }
    });

    await test('incrementCycleCount updates cycle count', () => {
        let updatedState = null;
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                updatedState = mockData;
                return mockData;
            }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        if (updatedState.data.cycles['default'].cycleCount !== 6) {
            throw new Error(`Expected cycle count 6, got ${updatedState.data.cycles['default'].cycleCount}`);
        }
    });

    await test('incrementCycleCount updates userProgress.cyclesCompleted', () => {
        let updatedState = null;
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 10;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn, immediate) => {
                fn(mockData);
                updatedState = mockData;
                return mockData;
            }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        if (updatedState.userProgress.cyclesCompleted !== 11) {
            throw new Error(`Expected global cycles 11, got ${updatedState.userProgress.cyclesCompleted}`);
        }
    });

    await test('incrementCycleCount shows completion animation', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        const animation = document.querySelector('.mini-cycle-complete-animation');
        if (!animation) {
            throw new Error('Should show completion animation');
        }
    });

    await test('incrementCycleCount calls updateStatsPanel', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => { updateStatsPanelCalled = true; }
        });

        incrementCycleCount('default', {});

        if (!updateStatsPanelCalled) {
            throw new Error('Should call updateStatsPanel');
        }
    });

    await test('incrementCycleCount handles missing active cycle gracefully', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'non-existent';

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('non-existent', {});
    });

    // === MILESTONE UNLOCK TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏆 Milestone Unlocks</h4>';

    await test('surfaces a newly unlocked vocab theme on cycle complete (Dark Ocean)', () => {
        // Rewritten. The old test ('unlocks Dark Ocean theme at 5 global cycles') injected
        // `unlockDarkOceanTheme` and asserted NOTHING — and incrementCycleCount never calls
        // that dep (the string appears nowhere in cycleCompletion.js). Its own comment even
        // admitted the unlock "sees 4, not 5". The REAL path: incrementCycleCount snapshots
        // unlocked theme IDs, runs the vocab-theme manager's checkThemeUnlocks(), diffs, and
        // for anything newly unlocked calls renderVocabThemes() + a themeUnlocked notification.
        // The 5-cycle THRESHOLD itself lives in vocabThemeManager (covered by its own tests);
        // this asserts cycleCompletion's wiring surfaces a theme unlocked during the cycle.
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 4; // becomes 5 after increment
        mockData.data.cycles['default'] = { title: 'Default Cycle', cycleCount: 0, tasks: [] };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        // Faithful vocabThemeManager: nothing unlocked until checkThemeUnlocks() runs,
        // then 'dark-ocean' is unlocked (simulating the 5-cycle threshold vtm owns).
        let unlocked = [];
        const vocabThemeManager = {
            init: () => {},
            getUnlockedThemeIds: () => unlocked.slice(),
            checkThemeUnlocks: () => { unlocked = ['dark-ocean']; },
            getThemeDefinition: (id) => id === 'dark-ocean'
                ? { name: 'Dark Ocean', icons: { celebrate: '🌊' } }
                : null
        };

        const notifications = [];
        let vocabThemesRendered = false;
        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => { notifications.push(msg); },
            updateStatsPanel: () => {},
            checkAchievements: () => {},
            vocabThemeManager,
            renderVocabThemes: () => { vocabThemesRendered = true; }
        });

        incrementCycleCount('default', {});

        // combined.size > 0 (a newly unlocked theme detected) triggers BOTH the themes
        // refresh and a per-theme unlock notification ("{name} theme unlocked!").
        if (!vocabThemesRendered) {
            throw new Error('a newly unlocked vocab theme should trigger renderVocabThemes()');
        }
        if (!notifications.some(m => typeof m === 'string' && m.includes('Dark Ocean'))) {
            throw new Error('the newly unlocked "Dark Ocean" theme should be surfaced via a themeUnlocked notification');
        }
    });

    await test('calls checkAchievements at 50 global cycles for theme unlocks', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 50;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        let achievementsCalled = false;
        let achievementsCycles = 0;

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {},
            checkAchievements: (cycles) => { achievementsCalled = true; achievementsCycles = cycles; }
        });

        incrementCycleCount('default', {});

        if (!achievementsCalled) {
            throw new Error('Should call checkAchievements at 50 cycles for vocab theme unlocks');
        }
        if (achievementsCycles < 50) {
            throw new Error('checkAchievements should receive at least 50 cycles');
        }
    });

    await test('unlocks mini game at 100 global cycles', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 100;
        mockData.settings = { unlockedFeatures: [] };
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => {},
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });

        incrementCycleCount('default', {});

        if (!miniGameUnlocked) {
            throw new Error('Should unlock mini game at 100 cycles');
        }
    });

    await test('does not re-unlock game if already unlocked', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 100;
        mockData.settings = { unlockedFeatures: ['task-order-game'] }; // Already unlocked
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: (msg) => notifications.push(msg),
            updateStatsPanel: () => {},
            unlockMiniGame: () => { miniGameUnlocked = true; }
        });

        incrementCycleCount('default', {});

        if (miniGameUnlocked) {
            throw new Error('Should not re-unlock game if already unlocked');
        }
    });

    // === MILESTONE MESSAGE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎉 Milestone Messages</h4>';

    await test('incrementCycleCount increments the active cycle count and global progress', () => {
        // (Was 'milestone levels are defined correctly', which ran incrementCycleCount and
        // asserted nothing.) Assert the core effect: both counters advance by exactly one.
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 5;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 5,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        if (mockData.data.cycles['default'].cycleCount !== 6) {
            throw new Error(`cycleCount should increment 5→6, got ${mockData.data.cycles['default'].cycleCount}`);
        }
        if (mockData.userProgress.cyclesCompleted !== 6) {
            throw new Error(`global cyclesCompleted should increment 5→6, got ${mockData.userProgress.cyclesCompleted}`);
        }
    });

    await test('does not show milestone for non-milestone counts', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 7; // Not a milestone level
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            showNotification: () => {},
            updateStatsPanel: () => {}
        });

        incrementCycleCount('default', {});

        const milestone = document.querySelector('.mini-cycle-milestone');
        if (milestone) {
            throw new Error('Should not show milestone for non-milestone counts');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('checkMiniCycle throws when AppState is not wired (not the not-ready early return)', () => {
        setCycleCompletionDependencies({
            AppState: null
        });

        let message = null;
        try {
            checkMiniCycle();
        } catch (error) {
            message = error.message;
        }
        if (!message || !message.includes('isReady')) {
            throw new Error(`expected a TypeError reading isReady, got ${message === null ? 'no throw — returned as if merely not ready, so ticking the last task would never complete the cycle' : message}`);
        }
    });

    await test('handles AppState not ready', () => {
        const mockAppState = {
            isReady: () => false,
            get: () => null
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('test', {});
    });

    await test('handles missing state data', () => {
        const mockAppState = {
            isReady: () => true,
            get: () => null
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw
        incrementCycleCount('test', {});
    });

    await test('handles missing unlockDarkOceanTheme function', () => {
        const mockData = createMockData();
        mockData.appState.activeCycleId = 'default';
        mockData.userProgress.cyclesCompleted = 5;
        mockData.data.cycles['default'] = {
            title: 'Default Cycle',
            cycleCount: 0,
            tasks: []
        };

        const mockAppState = {
            isReady: () => true,
            get: () => mockData,
            update: (fn) => { fn(mockData); return mockData; }
        };

        setCycleCompletionDependencies({
            AppState: mockAppState,
            updateStatsPanel: () => {},
            unlockDarkOceanTheme: null // Not provided
        });

        // Should not throw
        incrementCycleCount('default', {});
    });

    // === PROGRESS BAR TESTS ===
    // updateProgressBar reads completion from AppState, not the rendered checkboxes,
    // so every fixture here is state; the DOM only supplies the bar element.
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Progress Bar</h4>';

    // Helper: AppState mock whose active routine ('cycle-main') holds these tasks
    function appStateWithTasks(tasks, cycleOverrides = {}) {
        return createMockAppStateWithData({
            data: { cycles: { 'cycle-main': { tasks, ...cycleOverrides } } }
        });
    }

    // Helper: a rendered task list whose checkboxes are all set to `checked`.
    // Used to make the DOM DISAGREE with state, proving the DOM is not consulted.
    function renderedListWithCheckboxes(count, checked) {
        const list = document.createElement('ul');
        for (let i = 0; i < count; i++) {
            const task = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = checked;
            task.appendChild(checkbox);
            list.appendChild(task);
        }
        return list;
    }

    await test('updateProgressBar function exists', () => {
        if (typeof updateProgressBar !== 'function') {
            throw new Error('updateProgressBar should be exported');
        }
    });

    await test('updateProgressBar sets scaleX(0) when AppState has no data', () => {
        // First run, and the moment after a factory reset (neutralizeAppState
        // nulls the data): there is nothing to count, so the bar must be empty.
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: { isReady: () => false, get: () => null },
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        if (mockProgressBar.style.transform !== 'scaleX(0)') {
            throw new Error(`Expected scaleX(0), got ${mockProgressBar.style.transform}`);
        }
    });

    await test('updateProgressBar handles missing progressBar gracefully', () => {
        setCycleCompletionDependencies({
            AppState: appStateWithTasks([{ id: 't1', text: 'One', completed: true }]),
            getProgressBar: () => null
        });

        // Should not throw
        updateProgressBar();
    });

    await test('updateProgressBar sets scaleX(0) for a routine with no tasks', () => {
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([]),
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        // The module uses transform: scaleX() instead of width
        if (mockProgressBar.style.transform !== 'scaleX(0)') {
            throw new Error(`Expected scaleX(0), got ${mockProgressBar.style.transform}`);
        }
    });

    await test('updateProgressBar calculates correct percentage from AppState', () => {
        const mockProgressBar = document.createElement('div');

        // 4 tasks, 2 completed
        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true },
                { id: 't2', text: 'Two', completed: true },
                { id: 't3', text: 'Three', completed: false },
                { id: 't4', text: 'Four', completed: false }
            ]),
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        // The module uses transform: scaleX() instead of width
        if (mockProgressBar.style.transform !== 'scaleX(0.5)') {
            throw new Error(`Expected scaleX(0.5), got ${mockProgressBar.style.transform}`);
        }
    });

    await test('updateProgressBar sets scaleX(1) when all tasks complete', () => {
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true },
                { id: 't2', text: 'Two', completed: true },
                { id: 't3', text: 'Three', completed: true }
            ]),
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        // The module uses transform: scaleX() instead of width
        if (mockProgressBar.style.transform !== 'scaleX(1)') {
            throw new Error(`Expected scaleX(1), got ${mockProgressBar.style.transform}`);
        }
    });

    await test('updateProgressBar follows AppState even when rendered checkboxes disagree', () => {
        // Both rendered boxes are ticked, but state says neither task is done.
        // A DOM-counting bar would read scaleX(1); the state-reading bar reads 0.
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: false },
                { id: 't2', text: 'Two', completed: false }
            ]),
            getTaskList: () => renderedListWithCheckboxes(2, true),
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        if (mockProgressBar.style.transform !== 'scaleX(0)') {
            throw new Error(`Expected scaleX(0) from state, got ${mockProgressBar.style.transform}`);
        }
    });

    await test('updateProgressBar adds transition for animation', () => {
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([]),
            getProgressBar: () => mockProgressBar
        });

        updateProgressBar();

        // The module uses transition: transform instead of width
        if (!mockProgressBar.style.transition.includes('transform')) {
            throw new Error('Should set transition for smooth animation');
        }
    });

    // === CHECK MINICYCLE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Check MiniCycle</h4>';

    await test('checkMiniCycle function exists', () => {
        if (typeof checkMiniCycle !== 'function') {
            throw new Error('checkMiniCycle should be exported');
        }
    });

    await test('checkMiniCycle defers when AppState not ready', () => {
        const mockAppState = {
            isReady: () => false
        };

        setCycleCompletionDependencies({
            AppState: mockAppState
        });

        // Should not throw, just defer
        checkMiniCycle();
    });

    // checkMiniCycle decides completion and due dates from AppState. Every test sets
    // the deps it relies on explicitly (module DI persists between tests), and the
    // due-date modal mock always answers its callback so the module's one-modal
    // guard (_showingDueDateModal) is released for the next test.

    await test('checkMiniCycle handles AppState with no data', () => {
        let statsPanelUpdated = false;

        setCycleCompletionDependencies({
            AppState: { isReady: () => true, get: () => null },
            getProgressBar: () => document.createElement('div'),
            updateStatsPanel: () => { statsPanelUpdated = true; }
        });

        // Should not throw, and with no routine there is nothing to report on
        checkMiniCycle();

        if (statsPanelUpdated) {
            throw new Error('Should stop before updating stats when there is no active routine');
        }
    });

    await test('checkMiniCycle handles missing active cycle', () => {
        setCycleCompletionDependencies({
            AppState: createMockAppStateWithData({ appState: { activeCycleId: 'does-not-exist' } }),
            getProgressBar: () => document.createElement('div')
        });

        // Should not throw
        checkMiniCycle();
    });

    await test('checkMiniCycle updates progress bar from AppState', () => {
        const mockProgressBar = document.createElement('div');

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true },
                { id: 't2', text: 'Two', completed: false }
            ], { autoReset: false }),
            getProgressBar: () => mockProgressBar,
            updateStatsPanel: () => {}
        });

        checkMiniCycle();

        // The module uses transform: scaleX() instead of width
        if (mockProgressBar.style.transform !== 'scaleX(0.5)') {
            throw new Error(`Should update progress bar from state, got ${mockProgressBar.style.transform}`);
        }
    });

    await test('checkMiniCycle auto-resets when AppState says every task is complete (rendered checkboxes ignored)', async () => {
        let resetCalled = false;
        let modalShown = false;

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true },
                { id: 't2', text: 'Two', completed: true }
            ], { autoReset: true }),
            // The rendered boxes are UNticked — only state says the cycle is done
            getTaskList: () => renderedListWithCheckboxes(2, false),
            getProgressBar: () => document.createElement('div'),
            showConfirmationModal: (config) => { modalShown = true; config.callback(false); },
            resetTasks: () => { resetCalled = true; },
            updateStatsPanel: () => {}
        });

        checkMiniCycle();

        // Wait for setTimeout (1 second)
        await new Promise(resolve => setTimeout(resolve, 1100));

        if (!resetCalled) {
            throw new Error('Should trigger reset when autoReset enabled and all tasks complete in state');
        }
        if (modalShown) {
            throw new Error('Should not show the due-date warning when no task has a due date');
        }
    });

    await test('checkMiniCycle does not reset when AppState has an incomplete task (even if its checkbox is ticked)', async () => {
        let resetCalled = false;

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true },
                { id: 't2', text: 'Two', completed: false }
            ], { autoReset: true }),
            // Every rendered box is ticked, but state still has one task open
            getTaskList: () => renderedListWithCheckboxes(2, true),
            getProgressBar: () => document.createElement('div'),
            showConfirmationModal: (config) => { config.callback(false); },
            resetTasks: () => { resetCalled = true; },
            updateStatsPanel: () => {}
        });

        checkMiniCycle();

        // Longer than the auto-reset delay, so a wrongly scheduled reset would fire
        await new Promise(resolve => setTimeout(resolve, 1100));

        if (resetCalled) {
            throw new Error('Should not reset while a task is incomplete in state');
        }
    });

    await test('checkMiniCycle shows the due-date warning when a task in AppState has a dueDate', () => {
        let modalShown = false;
        let resetCalled = false;

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true, dueDate: '2026-09-20' },
                { id: 't2', text: 'Two', completed: true, dueDate: null }
            ], { autoReset: true }),
            getProgressBar: () => document.createElement('div'),
            showConfirmationModal: (config) => { modalShown = true; config.callback(false); },
            resetTasks: () => { resetCalled = true; },
            updateStatsPanel: () => {}
        });

        checkMiniCycle();

        if (!modalShown) {
            throw new Error('A dueDate in state must trigger the reset warning');
        }
        if (resetCalled) {
            throw new Error('Declining the warning must not reset');
        }
    });

    await test('checkMiniCycle cancelling the due-date warning un-completes the last toggled task', () => {
        const mockAppState = appStateWithTasks([
            { id: 't1', text: 'One', completed: true, dueDate: '2026-09-20' },
            { id: 't2', text: 'Two', completed: true }
        ], { autoReset: true });

        // The row the user just ticked
        const toggledRow = document.createElement('li');
        toggledRow.dataset.taskId = 't2';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        toggledRow.appendChild(checkbox);

        setCycleCompletionDependencies({
            AppState: mockAppState,
            getProgressBar: () => document.createElement('div'),
            showConfirmationModal: (config) => { config.callback(false); },
            resetTasks: () => {},
            updateStatsPanel: () => {}
        });

        checkMiniCycle({ lastToggledElement: toggledRow });

        if (checkbox.checked) {
            throw new Error('Cancelling should untick the last toggled checkbox');
        }
        const task = mockAppState.get().data.cycles['cycle-main'].tasks.find(t => t.id === 't2');
        if (task.completed !== false) {
            throw new Error('Cancelling should mark the last toggled task incomplete in state');
        }
    });

    await test('checkMiniCycle does not reset when autoReset disabled', () => {
        let resetCalled = false;

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: true }
            ], { autoReset: false }),
            getProgressBar: () => document.createElement('div'),
            resetTasks: () => { resetCalled = true; },
            updateStatsPanel: () => {}
        });

        checkMiniCycle();

        if (resetCalled) {
            throw new Error('Should not reset when autoReset is disabled');
        }
    });

    await test('checkMiniCycle calls updateStatsPanel', () => {
        let statsPanelUpdated = false;

        setCycleCompletionDependencies({
            AppState: appStateWithTasks([
                { id: 't1', text: 'One', completed: false }
            ], { autoReset: false }),
            getProgressBar: () => document.createElement('div'),
            updateStatsPanel: () => { statsPanelUpdated = true; }
        });

        checkMiniCycle();

        if (!statsPanelUpdated) {
            throw new Error('Should call updateStatsPanel');
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

    // Clean up DOM elements
    document.querySelectorAll('.mini-cycle-complete-animation, .mini-cycle-milestone').forEach(el => el.remove());

    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
