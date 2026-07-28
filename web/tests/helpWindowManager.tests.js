/**
 * HelpWindowManager Tests
 * Tests for modules/ui/helpWindowManager.js
 *
 * Tests help window functionality:
 * - Module exports and DI
 * - HelpWindowManager class
 * - Show/hide functionality
 * - Status message generation
 * - Mode descriptions
 * - Cycle completion messages
 * - Event listeners
 */

import {
    setupTestEnvironment,
    createMockData
} from './testHelpers.js';

import {
    setHelpWindowManagerDependencies,
    HelpWindowManager,
    initHelpWindowManager,
    getHelpWindowManager
} from '../modules/ui/helpWindowManager.js';

export async function runHelpWindowManagerTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>HelpWindowManager Tests</h2><h3>Setting up mocks...</h3>';

    const env = await setupTestEnvironment();

    // Set up HelpWindowManager module dependencies
    setHelpWindowManagerDependencies({
        safeAddEventListener: env.deps.safeAddEventListener,
        getModal: (name) => name === 'help' ? document.getElementById('help-window') : null
    });

    // Initialize HelpWindowManager to trigger dynamic imports (loads getObjectSizeBytes, formatBytes, etc.)
    await initHelpWindowManager();

    resultsDiv.innerHTML = '<h2>HelpWindowManager Tests</h2><h3>Running tests...</h3>';
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

    // Create help window element for testing
    let helpWindowEl = null;
    let taskListEl = null;

    function setupTestDOM() {
        // Create help window element
        helpWindowEl = document.getElementById('help-window');
        if (!helpWindowEl) {
            helpWindowEl = document.createElement('div');
            helpWindowEl.id = 'help-window';
            helpWindowEl.style.display = 'none';
            document.body.appendChild(helpWindowEl);
        }

        // Create task list element
        taskListEl = document.getElementById('taskList');
        if (!taskListEl) {
            taskListEl = document.createElement('div');
            taskListEl.id = 'taskList';
            document.body.appendChild(taskListEl);
        }

        // Clear contents
        helpWindowEl.innerHTML = '';
        helpWindowEl.className = '';
        taskListEl.innerHTML = '';
    }

    function cleanupTestDOM() {
        if (helpWindowEl && helpWindowEl.parentNode) {
            helpWindowEl.parentNode.removeChild(helpWindowEl);
        }
        if (taskListEl && taskListEl.parentNode) {
            taskListEl.parentNode.removeChild(taskListEl);
        }
    }

    // Helper to create mock AppState
    function createMockAppState(cycleCount = 0, activeCycleId = 'cycle-main') {
        return {
            isReady: () => true,
            get: () => ({
                appState: { activeCycleId },
                data: {
                    cycles: {
                        [activeCycleId]: {
                            id: activeCycleId,
                            name: 'Test Cycle',
                            cycleCount: cycleCount,
                            tasks: []
                        }
                    }
                }
            })
        };
    }

    // Helper to add mock tasks to DOM
    function addMockTasks(count, completedCount = 0) {
        taskListEl.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const task = document.createElement('div');
            task.className = 'task';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = i < completedCount;
            task.appendChild(checkbox);
            taskListEl.appendChild(task);
        }
    }

    async function test(name, testFn) {
        total.count++;
        try {
            localStorage.clear();
            setupTestDOM();

            const mockSchemaData = createMockData();
            localStorage.setItem('miniCycleData', JSON.stringify(mockSchemaData));

            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    // === MODULE EXPORTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Exports</h4>';

    await test('setHelpWindowManagerDependencies is a function', () => {
        if (typeof setHelpWindowManagerDependencies !== 'function') {
            throw new Error('setHelpWindowManagerDependencies should be a function');
        }
    });

    await test('HelpWindowManager constructs an instance', () => {
        if (!(new HelpWindowManager() instanceof HelpWindowManager)) {
            throw new Error('HelpWindowManager should construct an instance');
        }
    });

    await test('initHelpWindowManager resolves the same singleton each call', async () => {
        const a = await initHelpWindowManager();
        const b = await initHelpWindowManager();
        if (!(a instanceof HelpWindowManager)) throw new Error('init should resolve a HelpWindowManager');
        if (a !== b) throw new Error('init should return the same singleton on repeat calls');
    });

    await test('getHelpWindowManager returns the initialized singleton', async () => {
        const inited = await initHelpWindowManager();
        if (getHelpWindowManager() !== inited) {
            throw new Error('getHelpWindowManager should return the singleton created by init');
        }
    });

    // === CLASS INSTANTIATION ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    // NOTE: because the harness wires getModal('help') → the #help-window element,
    // the constructor's init() actually RUNS. So a freshly-constructed manager already
    // holds concrete state (initialized=true, isVisible=true, a rendered welcome message).
    // These tests assert those concrete values instead of mere property presence.

    await test('constructing a HelpWindowManager runs init() and marks it initialized', () => {
        const manager = new HelpWindowManager();
        if (!(manager instanceof HelpWindowManager)) throw new Error('should be a HelpWindowManager');
        if (manager.initialized !== true) throw new Error('constructor init() should set initialized=true');
    });

    await test('helpWindow references the #help-window element', () => {
        const manager = new HelpWindowManager();
        if (manager.helpWindow !== document.getElementById('help-window')) {
            throw new Error('helpWindow should reference the resolved #help-window element');
        }
    });

    await test('isVisible is true right after init() renders the welcome message', () => {
        const manager = new HelpWindowManager();
        if (manager.isVisible !== true) throw new Error('init() should leave the window visible');
        if (!helpWindowEl.classList.contains('show')) throw new Error('init() should add the show class');
    });

    await test('currentMessage holds the rendered welcome text', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.currentMessage !== 'string' || manager.currentMessage.trim() === '') {
            throw new Error('init() should populate currentMessage with a non-empty welcome string');
        }
        // The welcome text is actually rendered into the help window.
        if (!helpWindowEl.textContent.includes(manager.currentMessage)) {
            throw new Error('the rendered help window should contain currentMessage');
        }
    });

    await test('isShowingCycleComplete starts false', () => {
        if (new HelpWindowManager().isShowingCycleComplete !== false) {
            throw new Error('isShowingCycleComplete should initialize to false');
        }
    });

    await test('isShowingModeDescription starts false', () => {
        if (new HelpWindowManager().isShowingModeDescription !== false) {
            throw new Error('isShowingModeDescription should initialize to false');
        }
    });

    await test('initialized is true after construction', () => {
        if (new HelpWindowManager().initialized !== true) {
            throw new Error('a constructed manager should report initialized=true');
        }
    });

    // === METHODS EXIST ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Methods</h4>';

    await test('init is idempotent (guard prevents a second run)', () => {
        const manager = new HelpWindowManager();   // init() already ran
        manager.currentMessage = '__SENTINEL__';
        manager.init();                            // guard at source:138 should return early
        if (manager.currentMessage !== '__SENTINEL__') {
            throw new Error('a second init() should no-op, not overwrite currentMessage with the welcome text');
        }
    });

    await test('setupEventListeners wires task handlers + a MutationObserver (once)', () => {
        const manager = new HelpWindowManager();   // init() already called setupEventListeners()
        if (manager._eventListenersInitialized !== true) throw new Error('should flag listeners initialized');
        if (typeof manager._changeHandler !== 'function') throw new Error('_changeHandler should be wired');
        if (typeof manager._clickHandler !== 'function') throw new Error('_clickHandler should be wired');
        if (!(manager._taskListObserver instanceof MutationObserver)) throw new Error('_taskListObserver should be a MutationObserver');

        // Idempotency: a repeat call must not replace the existing handlers (source:162 guard).
        const prevChange = manager._changeHandler;
        const prevObserver = manager._taskListObserver;
        manager.setupEventListeners();
        if (manager._changeHandler !== prevChange) throw new Error('repeat setup must not re-create _changeHandler');
        if (manager._taskListObserver !== prevObserver) throw new Error('repeat setup must not re-create the observer');
    });

    await test('show method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.show !== 'function') {
            throw new Error('show should be a function');
        }
    });

    await test('hide method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.hide !== 'function') {
            throw new Error('hide should be a function');
        }
    });

    await test('showConstantMessage renders status and makes the window visible', () => {
        const manager = new HelpWindowManager();
        // Put it in a hidden state so show() actually does something (source:651 early-returns if visible).
        manager.hide();
        manager.isVisible = false;
        helpWindowEl.classList.remove('show', 'hide');

        manager.showConstantMessage();

        if (manager.isVisible !== true) throw new Error('showConstantMessage should show the window');
        if (!helpWindowEl.classList.contains('show')) throw new Error('showConstantMessage should add the show class');
        if (helpWindowEl.textContent.trim() === '') throw new Error('showConstantMessage should render status content');
    });

    await test('updateConstantMessage no-ops while a cycle-complete message is showing', () => {
        const manager = new HelpWindowManager();
        // Guard at source:259 — must not overwrite the cycle-complete message.
        manager.isShowingCycleComplete = true;
        manager.updateContent('__CYCLE_COMPLETE__');
        const before = helpWindowEl.innerHTML;

        manager.updateConstantMessage();

        if (helpWindowEl.innerHTML !== before) {
            throw new Error('updateConstantMessage should not re-render while isShowingCycleComplete is true');
        }
    });

    await test('showModeDescription method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.showModeDescription !== 'function') {
            throw new Error('showModeDescription should be a function');
        }
    });

    await test('showCycleCompleteMessage method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.showCycleCompleteMessage !== 'function') {
            throw new Error('showCycleCompleteMessage should be a function');
        }
    });

    await test('getCurrentStatusMessage method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.getCurrentStatusMessage !== 'function') {
            throw new Error('getCurrentStatusMessage should be a function');
        }
    });

    await test('updateContent method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.updateContent !== 'function') {
            throw new Error('updateContent should be a function');
        }
    });

    await test('destroy method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.destroy !== 'function') {
            throw new Error('destroy should be a function');
        }
    });

    // === SHOW/HIDE FUNCTIONALITY ===
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ Show/Hide</h4>';

    await test('show makes a hidden window visible again', () => {
        const manager = new HelpWindowManager();
        // init() leaves it visible, so show() would early-return (source:651). Hide first so
        // this actually exercises show()'s state transition rather than trivially passing.
        manager.hide();
        manager.isVisible = false;
        helpWindowEl.classList.remove('show', 'hide');

        manager.show();

        if (!manager.isVisible) throw new Error('isVisible should be true after show()');
        if (!helpWindowEl.classList.contains('show')) throw new Error('show() should add the show class');
    });

    await test('show adds show class', () => {
        const manager = new HelpWindowManager();
        manager.show();

        if (!helpWindowEl.classList.contains('show')) {
            throw new Error('Should add show class');
        }
    });

    await test('show does not manipulate display (uses opacity via CSS)', () => {
        const manager = new HelpWindowManager();
        manager.show();

        // Implementation uses opacity via CSS classes, not display toggle (to prevent CLS)
        // Just verify show class is added and isVisible is set
        if (!helpWindowEl.classList.contains('show')) {
            throw new Error('Should add show class');
        }
        if (!manager.isVisible) {
            throw new Error('Should set isVisible to true');
        }
    });

    await test('hide sets isVisible to false', () => {
        const manager = new HelpWindowManager();
        manager.show();
        manager.hide();

        if (manager.isVisible !== false) {
            throw new Error('isVisible should be false after hide()');
        }
    });

    await test('hide adds hide class', () => {
        const manager = new HelpWindowManager();
        manager.show();
        manager.hide();

        if (!helpWindowEl.classList.contains('hide')) {
            throw new Error('Should add hide class');
        }
    });

    await test('hide removes show class', () => {
        const manager = new HelpWindowManager();
        manager.show();
        manager.hide();

        if (helpWindowEl.classList.contains('show')) {
            throw new Error('Should remove show class');
        }
    });

    await test('show is a no-op when already visible (DOM untouched)', () => {
        const manager = new HelpWindowManager();   // already visible after init()
        manager.show();
        const initialHTML = helpWindowEl.innerHTML;
        manager.show(); // guard at source:651 should early-return

        if (!manager.isVisible) throw new Error('Should still be visible');
        // The captured HTML is the whole point — the guard must leave content unchanged.
        if (helpWindowEl.innerHTML !== initialHTML) throw new Error('a redundant show() must not mutate the window');
    });

    await test('hide is a no-op when already hidden (guard untouched DOM)', () => {
        const manager = new HelpWindowManager();
        // Force the not-visible state so hide()'s guard (source:672) is the path under test.
        manager.isVisible = false;
        helpWindowEl.classList.remove('show', 'hide');
        const initialHTML = helpWindowEl.innerHTML;

        manager.hide();

        if (manager.isVisible !== false) throw new Error('Should remain not visible');
        if (helpWindowEl.classList.contains('hide')) throw new Error('guarded hide() must not add the hide class');
        if (helpWindowEl.innerHTML !== initialHTML) throw new Error('guarded hide() must not mutate the window');
    });

    // === STATUS MESSAGES ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Status Messages</h4>';

    await test('getCurrentStatusMessage returns parts object', () => {
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (typeof parts !== 'object' || parts === null) {
            throw new Error('Should return a parts object, not a string');
        }
        // The function always returns icon/body/size/cta (source:575-593); the old check
        // omitted cta, so a dropped cta key would have slipped through.
        if (!('icon' in parts) || !('body' in parts) || !('size' in parts) || !('cta' in parts)) {
            throw new Error('Parts must have icon, body, size, and cta keys');
        }
    });

    await test('status message shows no tasks message when empty', () => {
        const manager = new HelpWindowManager();
        // taskListEl is empty
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('Add your first task')) {
            throw new Error('Should show add first task message in body');
        }
    });

    await test('status message uses 📝 icon when empty', () => {
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (parts.icon !== '📝') {
            throw new Error(`Empty list icon should be 📝, got: ${parts.icon}`);
        }
    });

    await test('status message shows remaining tasks count', () => {
        addMockTasks(5, 2); // 5 tasks, 2 completed = 3 remaining
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('3 tasks remaining')) {
            throw new Error('Should show 3 tasks remaining in body');
        }
    });

    await test('status message shows singular task remaining', () => {
        addMockTasks(3, 2); // 3 tasks, 2 completed = 1 remaining
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('1 task remaining')) {
            throw new Error('Should show 1 task remaining (singular) in body');
        }
    });

    await test('status message shows all tasks complete', () => {
        addMockTasks(3, 3); // 3 tasks, all completed
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('All tasks complete')) {
            throw new Error('Should show all tasks complete in body');
        }
    });

    await test('status message uses 🎉 icon when all complete', () => {
        addMockTasks(3, 3);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (parts.icon !== '🎉') {
            throw new Error(`All-complete icon should be 🎉, got: ${parts.icon}`);
        }
    });

    await test('status message uses 📋 icon when tasks remain', () => {
        addMockTasks(3, 1); // 2 remaining
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (parts.icon !== '📋') {
            throw new Error(`In-progress icon should be 📋, got: ${parts.icon}`);
        }
    });

    await test('status message includes cycle count from AppState', () => {
        setHelpWindowManagerDependencies({
            AppState: createMockAppState(5)
        });

        addMockTasks(3, 1);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.cta.includes('5 cycles completed')) {
            throw new Error('Should show 5 cycles completed in cta');
        }
    });

    await test('status message shows singular cycle', () => {
        setHelpWindowManagerDependencies({
            AppState: createMockAppState(1)
        });

        addMockTasks(3, 3);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.cta.includes('1 cycle completed')) {
            throw new Error('Should show 1 cycle completed (singular) in cta');
        }
    });

    await test('status message shows first cycle prompt when zero cycles', () => {
        setHelpWindowManagerDependencies({
            AppState: createMockAppState(0)
        });

        addMockTasks(3, 1);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.cta.includes('Complete your first cycle')) {
            throw new Error('Should prompt for first cycle in cta');
        }
    });

    // === PARTS RENDERING & XSS ESCAPING ===
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Parts Rendering & XSS</h4>';

    await test('_renderStatusContent escapes script tags in body', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({
            icon: '📋',
            body: '<script>alert(1)</script>',
            size: ''
        });
        if (helpWindowEl.innerHTML.includes('<script>')) {
            throw new Error('Body must not render raw <script> tags');
        }
        if (!helpWindowEl.innerHTML.includes('&lt;script&gt;')) {
            throw new Error('Body should be HTML-entity-escaped');
        }
    });

    await test('_renderStatusContent escapes HTML in size', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({
            icon: '📋',
            body: 'safe text',
            size: '<img src=x onerror=alert(1)>'
        });
        if (helpWindowEl.querySelector('img')) {
            throw new Error('Size must not render raw event handlers');
        }
    });

    await test('_renderStatusContent escapes HTML in icon', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({
            icon: '<img src=x onerror=alert(1)>',
            body: 'safe',
            size: ''
        });
        if (helpWindowEl.querySelector('img')) {
            throw new Error('Icon must not render raw event handlers');
        }
    });

    await test('_renderStatusContent wraps icon in .help-window-icon span', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({ icon: '📋', body: 'test', size: '' });
        if (!helpWindowEl.querySelector('.help-window-icon')) {
            throw new Error('Icon should be wrapped in .help-window-icon span');
        }
    });

    await test('_renderStatusContent wraps size in .help-window-size span', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({ icon: '📋', body: 'test', size: '~1.2 KB' });
        if (!helpWindowEl.querySelector('.help-window-size')) {
            throw new Error('Size should be wrapped in .help-window-size span');
        }
    });

    await test('_renderStatusContent omits icon span when icon is empty', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({ icon: '', body: 'test', size: '~1 KB' });
        if (helpWindowEl.querySelector('.help-window-icon')) {
            throw new Error('Icon span should be omitted when icon is empty');
        }
    });

    await test('_renderStatusContent omits size span when size is empty', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({ icon: '📋', body: 'test', size: '' });
        if (helpWindowEl.querySelector('.help-window-size')) {
            throw new Error('Size span should be omitted when size is empty');
        }
    });

    await test('_renderStatusContent renders body text', () => {
        const manager = new HelpWindowManager();
        manager._renderStatusContent({ icon: '📋', body: 'hello world', size: '' });
        if (!helpWindowEl.textContent.includes('hello world')) {
            throw new Error('Body text should be visible in rendered content');
        }
    });

    // === MODE DESCRIPTIONS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Mode Descriptions</h4>';

    await test('showModeDescription sets isShowingModeDescription', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('auto-cycle');

        if (!manager.isShowingModeDescription) {
            throw new Error('isShowingModeDescription should be true');
        }
    });

    await test('showModeDescription shows auto-cycle description', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('auto-cycle');

        if (!helpWindowEl.innerHTML.includes('Auto Cycle Mode')) {
            throw new Error('Should show Auto Cycle Mode title');
        }
        if (!helpWindowEl.innerHTML.includes('automatically reset')) {
            throw new Error('Should show auto-cycle description');
        }
    });

    await test('showModeDescription shows manual-cycle description', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('manual-cycle');

        if (!helpWindowEl.innerHTML.includes('Manual Cycle Mode')) {
            throw new Error('Should show Manual Cycle Mode title');
        }
    });

    await test('showModeDescription shows todo-mode description', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('todo-mode');

        if (!helpWindowEl.innerHTML.includes('To-Do Mode')) {
            throw new Error('Should show To-Do Mode title');
        }
    });

    await test('showModeDescription defaults to auto-cycle for unknown mode', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('unknown-mode');

        if (!helpWindowEl.innerHTML.includes('Auto Cycle Mode')) {
            throw new Error('Should default to Auto Cycle Mode');
        }
    });

    await test('showModeDescription shows help window if hidden', () => {
        const manager = new HelpWindowManager();
        manager.isVisible = false;
        manager.showModeDescription('auto-cycle');

        if (!manager.isVisible) {
            throw new Error('Should show help window');
        }
    });

    // === CYCLE COMPLETION ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎉 Cycle Completion</h4>';

    await test('showCycleCompleteMessage sets isShowingCycleComplete', () => {
        const manager = new HelpWindowManager();
        manager.showCycleCompleteMessage();

        if (!manager.isShowingCycleComplete) {
            throw new Error('isShowingCycleComplete should be true');
        }
    });

    await test('showCycleCompleteMessage shows completion message', () => {
        const manager = new HelpWindowManager();
        manager.showCycleCompleteMessage();

        if (!helpWindowEl.innerHTML.includes('Cycle Complete')) {
            throw new Error('Should show Cycle Complete message');
        }
    });

    await test('showCycleCompleteMessage clears mode description timeout', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('auto-cycle');

        // Should have a timeout set
        if (!manager.modeDescriptionTimeout) {
            throw new Error('Mode description timeout should be set');
        }

        manager.showCycleCompleteMessage();

        if (manager.modeDescriptionTimeout) {
            throw new Error('Mode description timeout should be cleared');
        }
        if (manager.isShowingModeDescription) {
            throw new Error('isShowingModeDescription should be false');
        }
    });

    // === UPDATE CONTENT ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔄 Update Content</h4>';

    await test('updateContent sets innerHTML', () => {
        const manager = new HelpWindowManager();
        manager.updateContent('Test message');

        if (!helpWindowEl.innerHTML.includes('Test message')) {
            throw new Error('Should set content');
        }
    });

    await test('updateConstantMessage does not update during cycle complete', () => {
        const manager = new HelpWindowManager();
        manager.showCycleCompleteMessage();
        const cycleCompleteHTML = helpWindowEl.innerHTML;

        manager.updateConstantMessage();

        if (helpWindowEl.innerHTML !== cycleCompleteHTML) {
            throw new Error('Should not update during cycle complete');
        }
    });

    await test('updateConstantMessage does not update during mode description', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('auto-cycle');
        const modeHTML = helpWindowEl.innerHTML;

        manager.updateConstantMessage();

        if (helpWindowEl.innerHTML !== modeHTML) {
            throw new Error('Should not update during mode description');
        }
    });

    // === DESTROY ===
    resultsDiv.innerHTML += '<h4 class="test-section">🗑️ Cleanup</h4>';

    await test('destroy clears mode description timeout', () => {
        const manager = new HelpWindowManager();
        manager.showModeDescription('auto-cycle');

        if (!manager.modeDescriptionTimeout) {
            throw new Error('Should have timeout before destroy');
        }

        manager.destroy();

        if (manager.modeDescriptionTimeout !== null) {
            throw new Error('Should clear timeout on destroy');
        }
    });

    await test('destroy tears down timers, listeners and observer (idempotently)', () => {
        const manager = new HelpWindowManager();
        manager.destroy();
        manager.destroy();   // second call must be safe AND leave the cleared state

        // Source:680-733 — destroy nulls handlers/observer, empties pending timeouts, resets flags.
        if (manager.modeDescriptionTimeout !== null) throw new Error('modeDescriptionTimeout should be cleared');
        if (manager._pendingTimeouts.length !== 0) throw new Error('_pendingTimeouts should be emptied');
        if (manager._changeHandler !== null) throw new Error('_changeHandler should be nulled');
        if (manager._taskListObserver !== null) throw new Error('_taskListObserver should be disconnected + nulled');
        if (manager._eventListenersInitialized !== false) throw new Error('_eventListenersInitialized should reset to false');
        if (manager.sideLayoutEnabled !== false) throw new Error('sideLayoutEnabled should reset to false');
    });

    // === DEPENDENCY INJECTION ===
    resultsDiv.innerHTML += '<h4 class="test-section">💉 Dependency Injection</h4>';

    await test('setHelpWindowManagerDependencies accepts loadMiniCycleData', () => {
        const mockLoader = () => ({
            cycles: { 'cycle-main': { cycleCount: 10 } },
            activeCycle: 'cycle-main'
        });

        setHelpWindowManagerDependencies({
            loadMiniCycleData: mockLoader,
            AppState: null // Clear AppState to use loadMiniCycleData
        });

        addMockTasks(3, 1);
        const manager = new HelpWindowManager();
        const message = manager.getCurrentStatusMessage();

        if (!message.cta.includes('10 cycles')) {
            throw new Error('Should use loadMiniCycleData for cycle count');
        }
    });

    await test('AppState takes precedence over loadMiniCycleData', () => {
        setHelpWindowManagerDependencies({
            loadMiniCycleData: () => ({
                cycles: { 'cycle-main': { cycleCount: 5 } },
                activeCycle: 'cycle-main'
            }),
            AppState: createMockAppState(20)
        });

        addMockTasks(3, 1);
        const manager = new HelpWindowManager();
        const message = manager.getCurrentStatusMessage();

        if (!message.cta.includes('20 cycles')) {
            throw new Error('AppState should take precedence');
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

    cleanupTestDOM();
    restoreOriginalData();

    return { passed: passed.count, total: total.count };
}
