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

    await test('HelpWindowManager class exists', () => {
        if (typeof HelpWindowManager !== 'function') {
            throw new Error('HelpWindowManager should be a class/function');
        }
    });

    await test('initHelpWindowManager is a function', () => {
        if (typeof initHelpWindowManager !== 'function') {
            throw new Error('initHelpWindowManager should be a function');
        }
    });

    await test('getHelpWindowManager is a function', () => {
        if (typeof getHelpWindowManager !== 'function') {
            throw new Error('getHelpWindowManager should be a function');
        }
    });

    // === CLASS INSTANTIATION ===
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('HelpWindowManager can be instantiated', () => {
        const manager = new HelpWindowManager();
        if (!manager) {
            throw new Error('Should create HelpWindowManager instance');
        }
    });

    await test('HelpWindowManager has helpWindow property', () => {
        const manager = new HelpWindowManager();
        // helpWindow should reference the DOM element (or null if not found)
        if (!('helpWindow' in manager)) {
            throw new Error('Should have helpWindow property');
        }
    });

    await test('HelpWindowManager has isVisible property', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.isVisible !== 'boolean') {
            throw new Error('isVisible should be a boolean');
        }
    });

    await test('HelpWindowManager has currentMessage property', () => {
        const manager = new HelpWindowManager();
        if (!('currentMessage' in manager)) {
            throw new Error('Should have currentMessage property');
        }
    });

    await test('HelpWindowManager has isShowingCycleComplete property', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.isShowingCycleComplete !== 'boolean') {
            throw new Error('isShowingCycleComplete should be a boolean');
        }
    });

    await test('HelpWindowManager has isShowingModeDescription property', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.isShowingModeDescription !== 'boolean') {
            throw new Error('isShowingModeDescription should be a boolean');
        }
    });

    await test('HelpWindowManager has initialized property', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.initialized !== 'boolean') {
            throw new Error('initialized should be a boolean');
        }
    });

    // === METHODS EXIST ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Methods</h4>';

    await test('init method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.init !== 'function') {
            throw new Error('init should be a function');
        }
    });

    await test('setupEventListeners method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.setupEventListeners !== 'function') {
            throw new Error('setupEventListeners should be a function');
        }
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

    await test('showConstantMessage method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.showConstantMessage !== 'function') {
            throw new Error('showConstantMessage should be a function');
        }
    });

    await test('updateConstantMessage method exists', () => {
        const manager = new HelpWindowManager();
        if (typeof manager.updateConstantMessage !== 'function') {
            throw new Error('updateConstantMessage should be a function');
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

    await test('show makes window visible', () => {
        const manager = new HelpWindowManager();
        manager.show();

        if (!manager.isVisible) {
            throw new Error('isVisible should be true after show()');
        }
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

    await test('show does nothing if already visible', () => {
        const manager = new HelpWindowManager();
        manager.show();
        const initialHTML = helpWindowEl.innerHTML;
        manager.show(); // Call again

        // Should not throw and should still be visible
        if (!manager.isVisible) {
            throw new Error('Should still be visible');
        }
    });

    await test('hide does nothing if not visible', () => {
        const manager = new HelpWindowManager();
        // Don't call show first
        manager.hide();

        // Should not throw
        if (manager.isVisible !== false) {
            throw new Error('Should remain not visible');
        }
    });

    // === STATUS MESSAGES ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Status Messages</h4>';

    await test('getCurrentStatusMessage returns parts object', () => {
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (typeof parts !== 'object' || parts === null) {
            throw new Error('Should return a parts object, not a string');
        }
        if (!('icon' in parts) || !('body' in parts) || !('size' in parts)) {
            throw new Error('Parts must have icon, body, and size keys');
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

        if (!parts.body.includes('5 cycles completed')) {
            throw new Error('Should show 5 cycles completed in body');
        }
    });

    await test('status message shows singular cycle', () => {
        setHelpWindowManagerDependencies({
            AppState: createMockAppState(1)
        });

        addMockTasks(3, 3);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('1 cycle completed')) {
            throw new Error('Should show 1 cycle completed (singular) in body');
        }
    });

    await test('status message shows first cycle prompt when zero cycles', () => {
        setHelpWindowManagerDependencies({
            AppState: createMockAppState(0)
        });

        addMockTasks(3, 1);
        const manager = new HelpWindowManager();
        const parts = manager.getCurrentStatusMessage();

        if (!parts.body.includes('Complete your first cycle')) {
            throw new Error('Should prompt for first cycle in body');
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

    await test('destroy is safe to call multiple times', () => {
        const manager = new HelpWindowManager();
        manager.destroy();
        manager.destroy();
        // Should not throw
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

        if (!message.body.includes('10 cycles')) {
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

        if (!message.body.includes('20 cycles')) {
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
