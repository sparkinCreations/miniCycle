/**
 * StatsPanel Module Tests (Schema 2.5)
 * Tests for the stats panel manager and view switching functionality
 *
 * Updated for Playwright compatibility - uses DI to inject mock appInit
 */

// Module-level variables for dynamic imports
let StatsPanelManager, setStatsPanelDependencies;
let AchievementsManager, setAchievementsManagerDependencies;

// Helper to create complete AppState mock (outside function scope)
function createMockAppState(mockData) {
    return {
        isReady: () => true,
        get: () => mockData,
        update: (updateFn, immediate) => {
            updateFn(mockData);
            if (immediate) {
                localStorage.setItem('miniCycleData', JSON.stringify(mockData));
            }
        }
    };
}

// Mock appInit that resolves immediately (no hanging in Playwright)
function createMockAppInit() {
    return {
        waitForCore: () => Promise.resolve(),
        isCoreReady: () => true,
        markCoreSystemsReady: () => Promise.resolve()
    };
}

export async function runStatsPanelTests(resultsDiv) {
    // Dynamic import with cache busting
    const cacheBuster = window.testCacheBuster || Date.now();
    const module = await import(`../modules/features/statsPanel.js?v=${cacheBuster}`);
    StatsPanelManager = module.StatsPanelManager;
    setStatsPanelDependencies = module.setStatsPanelDependencies;

    // Import achievementsManager for badge tests (badge UI was moved there)
    const achievementsModule = await import(`../modules/features/achievementsManager.js?v=${cacheBuster}`);
    AchievementsManager = achievementsModule.AchievementsManager;
    setAchievementsManagerDependencies = achievementsModule.setAchievementsManagerDependencies;

    // Initialize achievementsManager to load MILESTONES from constants.js (needed for badge theme classes)
    if (achievementsModule.initAchievementsManager) {
        await achievementsModule.initAchievementsManager();
    }

    resultsDiv.innerHTML = '<h2>📊 StatsPanel Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ✅ Inject mock appInit via DI to avoid hanging in Playwright
    setStatsPanelDependencies({
        appInit: createMockAppInit(),
        getModal: () => document.createElement('div')
    });
    console.log('✅ Test environment: Mock appInit injected via DI');

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

        try {
            // Create fresh mock Schema 2.5 data for each test
            const mockSchemaData = {
                metadata: {
                    version: "2.5",
                    lastModified: Date.now()
                },
                settings: {
                    darkMode: false,
                    theme: 'default',
                    unlockedThemes: ['default'],
                    unlockedFeatures: []
                },
                data: {
                    cycles: {
                        'cycle1': {
                            id: 'cycle1',
                            title: 'Test Cycle',
                            tasks: [
                                { id: 'task1', text: 'Task 1', completed: false },
                                { id: 'task2', text: 'Task 2', completed: true }
                            ],
                            cycleCount: 10
                        }
                    }
                },
                appState: {
                    activeCycleId: 'cycle1'
                },
                userProgress: {
                    rewardMilestones: []
                }
            };
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            // Mock AppState globally for all tests to prevent errors
            window.AppState = createMockAppState(mockSchemaData);

            // Create minimal DOM structure for tests
            createTestDOM();

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // Cleanup test environment
            delete window.AppState;
            cleanupTestDOM();

            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('creates instance successfully', () => {
        const statsPanel = new StatsPanelManager();

        if (!statsPanel || typeof statsPanel.updateStatsPanel !== 'function') {
            throw new Error('StatsPanelManager not properly initialized');
        }
    });

    await test('accepts dependency injection', () => {
        const mockDeps = {
            showNotification: (msg) => msg,
            loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData')),
            updateThemeColor: () => {}
        };

        const statsPanel = new StatsPanelManager(mockDeps);

        if (!statsPanel || !statsPanel.dependencies.showNotification) {
            throw new Error('Dependency injection failed');
        }
    });

    await test('caches DOM elements to the real nodes', () => {
        const statsPanel = new StatsPanelManager();
        const el = statsPanel.elements;

        // The old check only proved `elements` was an object — it would pass even if
        // cacheElements() resolved nothing. Assert the cache actually holds the live DOM
        // nodes it is supposed to drive (unique IDs → identity comparison is exact).
        if (el.statsPanel !== document.getElementById('stats-panel')) throw new Error('statsPanel node not cached');
        if (el.taskView !== document.getElementById('task-view')) throw new Error('taskView node not cached');
        if (el.taskList !== document.getElementById('taskList')) throw new Error('taskList node not cached');
        if (el.totalTasks !== document.getElementById('total-tasks')) throw new Error('totalTasks node not cached');
        if (el.completionRate !== document.getElementById('completion-rate')) throw new Error('completionRate node not cached');
        // dots is a live NodeList captured from the panel markup.
        if (!el.dots || el.dots.length < 2) throw new Error(`expected the nav dots cached, got length ${el.dots?.length}`);
    });

    await test('initializes with correct state', () => {
        const statsPanel = new StatsPanelManager();
        const state = statsPanel.getState();

        if (state.isStatsVisible !== false) {
            throw new Error('Initial state should have stats hidden');
        }

        if (state.isSwiping !== false) {
            throw new Error('Initial state should not be swiping');
        }
    });

    // === VIEW SWITCHING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ View Switching</h4>';

    await test('shows task view correctly', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;  // D-03: view methods live in the gestures sub-module
        statsPanel.showTaskView();

        const taskView = document.getElementById('task-view');
        const statsView = document.getElementById('stats-panel');

        if (!taskView.classList.contains('show')) {
            throw new Error('Task view should be visible');
        }

        if (statsView.classList.contains('show')) {
            throw new Error('Stats panel should be hidden');
        }

        if (statsPanel.isStatsVisible()) {
            throw new Error('State should show stats as not visible');
        }
    });

    await test('shows stats panel correctly', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;
        statsPanel.showStatsPanel();

        const taskView = document.getElementById('task-view');
        const statsView = document.getElementById('stats-panel');

        if (taskView.classList.contains('show')) {
            throw new Error('Task view should be hidden');
        }

        if (!statsView.classList.contains('show')) {
            throw new Error('Stats panel should be visible');
        }

        if (!statsPanel.isStatsVisible()) {
            throw new Error('State should show stats as visible');
        }
    });

    await test('toggles between views', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;

        statsPanel.showStatsPanel();
        if (!statsPanel.isStatsVisible()) {
            throw new Error('Stats should be visible after showing');
        }

        statsPanel.showTaskView();
        if (statsPanel.isStatsVisible()) {
            throw new Error('Stats should not be visible after hiding');
        }
    });

    // === STATS CALCULATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📈 Stats Calculation</h4>';

    // These previously-removed tests are restored by injecting AppState into the module
    // deps. Without it, updateStatsPanel() early-returns at `if (!AppState)` and never
    // writes the counters — which is why the old "handles zero tasks" test passed
    // trivially (the DOM kept its initial 0 / 0% regardless of the math).

    // Task counts must come from STATE, not the DOM (features-review finding:
    // the old DOM-count path saw only rendered tasks and its TTL cache was
    // never invalidated externally). State says 4 tasks / 3 completed while
    // the DOM is left EMPTY — if the numbers land, they came from state.
    const statsMockState = (tasks) => ({
        data: { cycles: { c1: { tasks, cycleCount: 0, deleteCheckedTasks: false } } },
        appState: { activeCycleId: 'c1' },
        userProgress: { cyclesCompleted: 0, totalTasksCompleted: 0 },
        settings: {}
    });
    const statsMockAppState = (tasks) => ({
        isReady: () => true,
        get: () => statsMockState(tasks),
        update: () => {}
    });

    await test('counts tasks and computes completion rate from STATE (DOM empty)', async () => {
        setStatsPanelDependencies({ AppState: statsMockAppState([
            { id: 't1', text: 'a', completed: true },
            { id: 't2', text: 'b', completed: true },
            { id: 't3', text: 'c', completed: true },
            { id: 't4', text: 'd', completed: false }
        ]) });
        try {
            const taskList = document.getElementById('taskList');
            taskList.innerHTML = ''; // deliberately empty — DOM must be ignored

            const statsPanel = new StatsPanelManager();  // caches deps incl. injected AppState
            await statsPanel.updateStatsPanel();

            const total = document.getElementById('total-tasks').textContent;
            const completed = document.getElementById('completed-tasks').textContent;
            const rate = document.getElementById('completion-rate').textContent;

            if (total !== '4') throw new Error(`total-tasks should be 4 (from state), got "${total}"`);
            if (completed !== '3') throw new Error(`completed-tasks should be 3 (from state), got "${completed}"`);
            // Source: ((completed/total)*100).toFixed(1) + "%" → 75.0%
            if (rate !== '75.0%') throw new Error(`completion-rate should be 75.0%, got "${rate}"`);
        } finally {
            setStatsPanelDependencies({ AppState: null });  // don't leak into later tests
        }
    });

    await test('handles zero tasks gracefully (real 0% branch)', async () => {
        setStatsPanelDependencies({ AppState: statsMockAppState([]) });
        try {
            const taskList = document.getElementById('taskList');
            taskList.innerHTML = '';

            const statsPanel = new StatsPanelManager();
            await statsPanel.updateStatsPanel();

            const totalTasks = document.getElementById('total-tasks');
            const completedTasks = document.getElementById('completed-tasks');
            const completionRate = document.getElementById('completion-rate');

            // With AppState present, updateStatsPanel actually writes these — the totalTasks>0
            // ternary must resolve to "0%", not divide-by-zero.
            if (totalTasks.textContent !== '0') throw new Error(`Should show 0 total tasks, got "${totalTasks.textContent}"`);
            if (completedTasks.textContent !== '0') throw new Error(`Should show 0 completed, got "${completedTasks.textContent}"`);
            if (completionRate.textContent !== '0%') throw new Error(`Should show 0% completion rate, got "${completionRate.textContent}"`);
        } finally {
            setStatsPanelDependencies({ AppState: null });
        }
    });

    // === BADGE TESTS ===
    // Note: Badge UI was moved from statsPanel to achievementsManager
    resultsDiv.innerHTML += '<h4 class="test-section">🏆 Badge Updates (via AchievementsManager)</h4>';

    // Create mock data for achievementsManager tests
    const badgeTestMockData = {
        schemaVersion: 2.5,
        settings: { theme: 'light', darkMode: false },
        data: { cycles: {} },
        appState: { activeCycleId: 'test-cycle' },
        userProgress: { cyclesCompleted: 0, totalTasksCompleted: 0, rewardMilestones: [] },
        achievements: { unlocked: [], seen: {} }
    };

    // Inject mock dependencies for achievementsManager
    setAchievementsManagerDependencies({
        AppState: createMockAppState(badgeTestMockData),
        appInit: createMockAppInit(),
        showNotification: () => {}
    });

    await test('updates badges based on cycle count', () => {
        const achievementsManager = new AchievementsManager();
        achievementsManager.updateBadges(10);

        const badge5 = document.querySelector('[data-milestone="5"]');
        const badge50 = document.querySelector('[data-milestone="50"]');

        if (!badge5.classList.contains('unlocked')) {
            throw new Error('Badge for 5 cycles should be unlocked');
        }

        if (badge50.classList.contains('unlocked')) {
            throw new Error('Badge for 50 cycles should not be unlocked yet');
        }
    });

    await test('applies theme classes to unlocked badges', () => {
        const achievementsManager = new AchievementsManager();
        achievementsManager.updateBadges(100);

        const badge5 = document.querySelector('[data-milestone="5"]');
        const badge100 = document.querySelector('[data-milestone="100"]');

        if (!badge5.classList.contains('unlocked')) {
            throw new Error('Badge 5 should be unlocked at 100 cycles');
        }

        if (!badge100.classList.contains('game-unlocked')) {
            throw new Error('Badge 100 should have game-unlocked class');
        }
    });

    // === THEME UNLOCK TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Unlock</h4>';

    await test('displays correct theme unlock messages', async () => {
        // Inject vocabThemeManager via module-level DI (constructor doesn't merge deps)
        const mockVtm = {
            getUnlockedThemeIds: () => ['classic'],
            getNextLockedTheme: (cycles) => cycles < 5 ? { id: 'habit-tracker', name: 'Habit Tracker', unlockAt: { cycles: 5 }, icons: { celebrate: '🔥' } } : null,
            getThemeDefinition: (id) => id === 'classic' ? { id: 'classic', name: 'Classic', icons: {} } : null
        };
        setStatsPanelDependencies({ vocabThemeManager: mockVtm });
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;  // D-03: rewards sub-module loads async
        const milestoneUnlocks = { taskOrderGame: false };

        statsPanel._rewards.updateThemeMessages(3, milestoneUnlocks);

        const goldenMessage = document.getElementById('golden-unlock-message');
        if (!goldenMessage.textContent.includes('2') || !goldenMessage.textContent.includes('Habit Tracker')) {
            throw new Error('Should show correct cycles remaining for next vocab theme');
        }
        // Clean up: remove vtm from module deps
        setStatsPanelDependencies({ vocabThemeManager: null });
    });

    await test('shows unlocked message for completed milestones', async () => {
        // Inject vtm with Habit Tracker unlocked (5 cycles met)
        const mockVtm = {
            getUnlockedThemeIds: () => ['classic', 'habit-tracker'],
            getNextLockedTheme: (cycles) => cycles < 25 ? { id: 'fitness', name: 'Fitness', unlockAt: { cycles: 25 }, icons: { celebrate: '💪' } } : null,
            getThemeDefinition: (id) => {
                const defs = {
                    'habit-tracker': { id: 'habit-tracker', name: 'Habit Tracker', icons: { celebrate: '🔥' } }
                };
                return defs[id] || null;
            }
        };
        setStatsPanelDependencies({ vocabThemeManager: mockVtm });
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;
        const milestoneUnlocks = { taskOrderGame: false };

        statsPanel._rewards.updateThemeMessages(10, milestoneUnlocks);

        const themeMessage = document.getElementById('theme-unlock-message');
        if (!themeMessage.textContent.includes('Habit Tracker')) {
            throw new Error('Should show unlocked theme name');
        }

        if (!themeMessage.classList.contains('unlocked-message')) {
            throw new Error('Should have unlocked-message class');
        }
        setStatsPanelDependencies({ vocabThemeManager: null });
    });

    await test('shows next vocab theme when some are unlocked', async () => {
        // Inject vtm — Habit Tracker unlocked, Fitness is next
        const mockVtm = {
            getUnlockedThemeIds: () => ['classic', 'habit-tracker'],
            getNextLockedTheme: (cycles) => ({ id: 'fitness', name: 'Fitness', unlockAt: { cycles: 25 }, icons: { celebrate: '💪' } }),
            getThemeDefinition: (id) => id === 'habit-tracker' ? { id: 'habit-tracker', name: 'Habit Tracker', icons: { celebrate: '🔥' } } : null
        };
        setStatsPanelDependencies({ vocabThemeManager: mockVtm });
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;
        const milestoneUnlocks = { taskOrderGame: false };

        statsPanel._rewards.updateThemeMessages(10, milestoneUnlocks);

        const goldenMessage = document.getElementById('golden-unlock-message');
        if (!goldenMessage.textContent.includes('Fitness')) {
            throw new Error('Should show next vocab theme name');
        }
        setStatsPanelDependencies({ vocabThemeManager: null });
    });

    // === NAVIGATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Navigation</h4>';

    await test('updates navigation dots correctly', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;

        statsPanel.showTaskView();
        statsPanel._gestures.updateNavDots();

        const dots = document.querySelectorAll('.dot');
        if (!dots[0].classList.contains('active')) {
            throw new Error('First dot should be active on task view');
        }

        if (dots[1].classList.contains('active')) {
            throw new Error('Second dot should not be active on task view');
        }
    });

    await test('handles dot clicks', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;

        statsPanel._gestures.handleDotClick(1);
        if (!statsPanel.isStatsVisible()) {
            throw new Error('Clicking second dot should show stats');
        }

        statsPanel._gestures.handleDotClick(0);
        if (statsPanel.isStatsVisible()) {
            throw new Error('Clicking first dot should show tasks');
        }
    });

    // === FALLBACK TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Fallback Methods</h4>';

    await test('uses fallback notification when dependency missing', () => {
        const statsPanel = new StatsPanelManager({});

        // Should not throw error
        statsPanel.dependencies.showNotification('Test message', 'info');
    });

    await test('uses fallback data loader when dependency missing', () => {
        const statsPanel = new StatsPanelManager({});

        // Should not throw error
        const data = statsPanel.dependencies.loadMiniCycleData();
    });

    await test('uses fallback overlay check when dependency missing', () => {
        const statsPanel = new StatsPanelManager({});

        // Should not throw error
        const isActive = statsPanel.dependencies.isOverlayActive();

        if (typeof isActive !== 'boolean') {
            throw new Error('Should return boolean');
        }
    });

    // === STATE MANAGEMENT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ State Management</h4>';

    await test('getState returns current state', () => {
        const statsPanel = new StatsPanelManager();
        const state = statsPanel.getState();

        if (!state || typeof state !== 'object') {
            throw new Error('Should return state object');
        }

        if (!state.hasOwnProperty('isStatsVisible')) {
            throw new Error('State should have isStatsVisible property');
        }
    });

    await test('isStatsVisible returns correct value', async () => {
        const statsPanel = new StatsPanelManager();
        await statsPanel.initPromise;

        if (statsPanel.isStatsVisible() !== false) {
            throw new Error('Should initially return false');
        }

        statsPanel.showStatsPanel();
        if (statsPanel.isStatsVisible() !== true) {
            throw new Error('Should return true after showing stats');
        }
    });

    await test('getModuleInfo returns module information', () => {
        const statsPanel = new StatsPanelManager();
        const info = statsPanel.getModuleInfo();

        if (info.name !== 'StatsPanelManager') {
            throw new Error('Should return correct module name');
        }

        if (!info.version) {
            throw new Error('Should include version');
        }

        if (!info.state) {
            throw new Error('Should include state');
        }
    });

    // === ERROR HANDLING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('handles missing DOM elements gracefully', () => {
        // Remove critical elements
        document.getElementById('stats-panel')?.remove();
        document.getElementById('task-view')?.remove();

        const statsPanel = new StatsPanelManager();

        // Should not throw error
        statsPanel.showTaskView();
        statsPanel.showStatsPanel();
    });

    await test('handles updateStatsPanel without AppState', async () => {
        delete window.AppState;

        const statsPanel = new StatsPanelManager({
            loadMiniCycleData: () => JSON.parse(localStorage.getItem('miniCycleData'))
        });

        // ⏳ Wait for async init() to complete (constructor calls this.init() without awaiting)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Should not throw error
        await statsPanel.updateStatsPanel();
    });

    await test('handles updateStatsPanel with missing data', async () => {
        localStorage.removeItem('miniCycleData');

        const statsPanel = new StatsPanelManager({
            loadMiniCycleData: () => null
        });

        // ⏳ Wait for async init() to complete (constructor calls this.init() without awaiting)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Should not throw error
        await statsPanel.updateStatsPanel();
    });

    // === CAROUSEL NAVIGATION DELEGATE ===
    // moduleLoader wires gesturePanelManager's onNavigate to
    // statsPanelManager.navigatePanels(). gesturePanelManager reads an
    // `undefined` result as "carousel not available" and falls back to its
    // legacy BINARY task<->stats path — so a missing delegate here does not
    // throw, it silently reverts every gesture to two-panel behavior. That is
    // exactly what shipped: the focus task panel could not be reached by
    // swipe, and swiping out of it skipped the task view and landed on stats.

    await test('exposes navigatePanels (moduleLoader wires onNavigate to it)', () => {
        const statsPanel = new StatsPanelManager();
        if (typeof statsPanel.navigatePanels !== 'function') {
            throw new Error(
                'navigatePanels is declared in this module\'s manifest `provides` and consumed by ' +
                'moduleLoader; without the delegate gestures fall back to the legacy binary path'
            );
        }
    });

    await test('navigatePanels forwards direction and returns the carousel result', async () => {
        const statsPanel = new StatsPanelManager();
        await new Promise(resolve => setTimeout(resolve, 200));

        const seen = [];
        const landed = { id: 'focus-task-panel', index: 0 };
        statsPanel._gestures = { navigatePanels: (d) => { seen.push(d); return landed; } };

        const result = statsPanel.navigatePanels(-1);
        if (seen.length !== 1 || seen[0] !== -1) {
            throw new Error(`Expected direction -1 forwarded once, got ${JSON.stringify(seen)}`);
        }
        // Must return the result, NOT undefined — undefined is the signal that
        // makes gesturePanelManager abandon the carousel.
        if (result !== landed) {
            throw new Error(`Expected the carousel result to be returned, got ${JSON.stringify(result)}`);
        }
    });

    await test('navigatePanels returns undefined when the sub-module is absent', async () => {
        // Deliberate: no sub-module means no carousel, so gesturePanelManager
        // SHOULD fall back to its legacy path rather than treat it as a clamp.
        const statsPanel = new StatsPanelManager();
        await new Promise(resolve => setTimeout(resolve, 200));
        statsPanel._gestures = null;
        if (statsPanel.navigatePanels(1) !== undefined) {
            throw new Error('Expected undefined (fall back), not null (clamped)');
        }
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}

// Helper functions for test setup
function createTestDOM() {
    // Create container for test elements (don't modify body.innerHTML to avoid detaching resultsDiv)
    const container = document.createElement('div');
    container.id = 'test-container';
    container.innerHTML = `
        <div id="stats-panel" class="hide">
            <div id="total-tasks">0</div>
            <div id="completed-tasks">0</div>
            <div id="completion-rate">0%</div>
            <div id="mini-cycle-count">0</div>
            <div id="stats-progress-bar" style="width: 0%"></div>
            <div id="theme-unlock-message"></div>
            <div id="golden-unlock-message"></div>
            <div id="game-unlock-message"></div>
            <div id="theme-unlock-status"></div>
        </div>
        <div id="task-view" class="show">
            <div id="taskList"></div>
            <button id="addTask">Add Task</button>
        </div>
        <div id="live-region"></div>
        <button id="slide-left">←</button>
        <button id="slide-right">→</button>
        <!-- dots carry aria-controls like the real markup — the carousel
             matches dots to panels by aria-controls, not array position -->
        <div class="dot" aria-controls="task-view"></div>
        <div class="dot" aria-controls="stats-panel"></div>
        <div class="badge" data-milestone="5"></div>
        <div class="badge" data-milestone="50"></div>
        <div class="badge" data-milestone="100"></div>
        <div id="themes-modal" style="display: none;"></div>
        <button id="open-themes-panel"></button>
        <button id="close-themes-btn"></button>
        <button id="quick-dark-toggle"></button>
    `;
    document.body.appendChild(container);
}

function cleanupTestDOM() {
    // Remove the test container (much cleaner than removing individual elements)
    document.getElementById('test-container')?.remove();
}
