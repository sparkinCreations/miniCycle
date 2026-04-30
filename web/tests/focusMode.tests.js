/**
 * FocusMode Tests
 * Tests for modules/ui/focusMode.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runFocusModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/focusMode.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>FocusMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setFocusModeDependencies is exported as a function', () => {
        if (typeof mod.setFocusModeDependencies !== 'function') throw new Error('Missing export');
    });

    await test('FocusMode class is exported', () => {
        if (typeof mod.FocusMode !== 'function') throw new Error('Missing class export');
    });

    await test('initFocusMode is exported as a function', () => {
        if (typeof mod.initFocusMode !== 'function') throw new Error('Missing export');
    });

    await test('getFocusMode is exported as a function', () => {
        if (typeof mod.getFocusMode !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setFocusModeDependencies accepts an object without throwing', () => {
        mod.setFocusModeDependencies({});
    });

    await test('setFocusModeDependencies accepts mock dependencies', () => {
        mod.setFocusModeDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            getElementById: (id) => document.getElementById(id),
            getBody: () => document.body,
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('FocusMode can be instantiated', () => {
        const instance = new mod.FocusMode();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has init method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    await test('Instance has activate method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.activate !== 'function') throw new Error('Missing activate method');
    });

    await test('Instance has deactivate method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.deactivate !== 'function') throw new Error('Missing deactivate method');
    });

    await test('Instance has toggle method', () => {
        const instance = new mod.FocusMode();
        if (typeof instance.toggle !== 'function') throw new Error('Missing toggle method');
    });

    await test('Instance has initialized property defaulting to false', () => {
        const instance = new mod.FocusMode();
        if (instance.initialized !== false) throw new Error('initialized should default to false');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('Constructor does not throw with no arguments', () => {
        try {
            new mod.FocusMode();
        } catch (e) {
            throw new Error('Constructor should not throw: ' + e.message);
        }
    });

    await test('setFocusModeDependencies handles null gracefully', () => {
        try {
            mod.setFocusModeDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    // ============================================
    // Helpers for the menu / mode tests below
    // ============================================
    function createMockAppState(overrides = {}) {
        const state = {
            appState: { activeCycleId: 'cycle-1' },
            data: { cycles: { 'cycle-1': { autoReset: false, deleteCheckedTasks: false } } },
            settings: { focusModeActive: false },
            ...overrides
        };
        return {
            isReady: () => true,
            get: () => state,
            update: (producer) => producer(state)
        };
    }

    /**
     * Build a minimal DOM scaffold so init() can run successfully.
     * Returns the elements in case a test wants to assert on them.
     */
    function setupDOMScaffold() {
        // Clean any leftovers from earlier runs
        for (const id of [
            'task-view', 'taskList', 'mode-selector',
            'empty-state', 'undo-redo-buttons', 'nav-dots',
            'focus-mode-btn', 'focus-mode-menu-btn', 'focus-mode-menu',
            'focus-mode-mode-modal', 'focus-mode-mode-modal-backdrop',
            'focus-mode-mode-done-btn'
        ]) {
            document.getElementById(id)?.remove();
        }

        const taskView = document.createElement('div');
        taskView.id = 'task-view';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        taskView.appendChild(progressContainer);

        const taskList = document.createElement('div');
        taskList.id = 'taskList';
        taskView.appendChild(taskList);

        const emptyState = document.createElement('div');
        emptyState.id = 'empty-state';
        emptyState.innerHTML = '<div class="empty-state-hint">Press the + button</div>';
        taskView.appendChild(emptyState);

        document.body.appendChild(taskView);

        const modeSelector = document.createElement('select');
        modeSelector.id = 'mode-selector';
        for (const v of ['auto-cycle', 'manual-cycle', 'todo-mode']) {
            const opt = document.createElement('option');
            opt.value = v;
            modeSelector.appendChild(opt);
        }
        document.body.appendChild(modeSelector);

        const undoRedo = document.createElement('div');
        undoRedo.id = 'undo-redo-buttons';
        document.body.appendChild(undoRedo);

        const navDots = document.createElement('nav');
        navDots.id = 'nav-dots';
        document.body.appendChild(navDots);

        return { taskView, taskList, emptyState, modeSelector, undoRedo, navDots };
    }

    function teardownDOMScaffold() {
        for (const id of [
            'task-view', 'mode-selector', 'undo-redo-buttons', 'nav-dots',
            'focus-mode-mode-modal', 'focus-mode-mode-modal-backdrop',
            'focus-mode-menu', 'focus-mode-menu-btn'
        ]) {
            document.getElementById(id)?.remove();
        }
    }

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 _getCurrentMode</h4>';

    await test('_getCurrentMode returns "todo-mode" when deleteCheckedTasks is true', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                data: { cycles: { 'cycle-1': { autoReset: true, deleteCheckedTasks: true } } }
            })
        });
        const instance = new mod.FocusMode();
        const result = instance._getCurrentMode();
        teardownDOMScaffold();
        if (result !== 'todo-mode') throw new Error(`Expected todo-mode, got: ${result}`);
    });

    await test('_getCurrentMode returns "auto-cycle" when autoReset true and deleteCheckedTasks false', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                data: { cycles: { 'cycle-1': { autoReset: true, deleteCheckedTasks: false } } }
            })
        });
        const instance = new mod.FocusMode();
        const result = instance._getCurrentMode();
        teardownDOMScaffold();
        if (result !== 'auto-cycle') throw new Error(`Expected auto-cycle, got: ${result}`);
    });

    await test('_getCurrentMode returns "manual-cycle" when both flags false', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                data: { cycles: { 'cycle-1': { autoReset: false, deleteCheckedTasks: false } } }
            })
        });
        const instance = new mod.FocusMode();
        const result = instance._getCurrentMode();
        teardownDOMScaffold();
        if (result !== 'manual-cycle') throw new Error(`Expected manual-cycle, got: ${result}`);
    });

    await test('_getCurrentMode defaults to "manual-cycle" when state is unavailable', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: { isReady: () => false, get: () => null, update: () => {} }
        });
        const instance = new mod.FocusMode();
        const result = instance._getCurrentMode();
        teardownDOMScaffold();
        if (result !== 'manual-cycle') throw new Error(`Expected manual-cycle fallback, got: ${result}`);
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📋 Menu Structure</h4>';

    await test('init() creates menu with the expected action items in order', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const menuItems = document.querySelectorAll('.focus-mode-menu-item');
        const actions = Array.from(menuItems).map(el => el.dataset.action);
        const expected = [
            'switch-mode', 'switch-routines', 'create-routine',
            'toggle-input-bar', 'uncheck-all', 'delete-all', 'exit'
        ];
        instance.destroy();
        teardownDOMScaffold();

        if (actions.length !== expected.length) {
            throw new Error(`Expected ${expected.length} items, got ${actions.length}: ${actions.join(', ')}`);
        }
        for (let i = 0; i < expected.length; i++) {
            if (actions[i] !== expected[i]) {
                throw new Error(`Item ${i}: expected "${expected[i]}", got "${actions[i]}"`);
            }
        }
    });

    await test('init() inserts a separator between each group (3 separators total)', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const separators = document.querySelectorAll('.focus-mode-menu-separator');
        instance.destroy();
        teardownDOMScaffold();

        // Groups: routine | view | bulk | exit → 3 separators
        if (separators.length !== 3) {
            throw new Error(`Expected 3 separators, got ${separators.length}`);
        }
    });

    await test('separators have role="separator" for ARIA', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const seps = document.querySelectorAll('.focus-mode-menu-separator');
        const allHaveRole = Array.from(seps).every(s => s.getAttribute('role') === 'separator');
        instance.destroy();
        teardownDOMScaffold();

        if (!allHaveRole) throw new Error('All separators must have role="separator"');
    });

    await test('Delete all item carries the destructive modifier class', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const deleteItem = document.querySelector('[data-action="delete-all"]');
        const hasClass = deleteItem?.classList.contains('focus-mode-menu-item--destructive');
        instance.destroy();
        teardownDOMScaffold();

        if (!hasClass) throw new Error('Delete all should have focus-mode-menu-item--destructive class');
    });

    await test('Non-destructive items do NOT carry the destructive modifier class', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const otherItems = document.querySelectorAll(
            '.focus-mode-menu-item:not([data-action="delete-all"])'
        );
        const anyHasDestructive = Array.from(otherItems).some(el =>
            el.classList.contains('focus-mode-menu-item--destructive')
        );
        instance.destroy();
        teardownDOMScaffold();

        if (anyHasDestructive) throw new Error('Only delete-all should have the destructive class');
    });

    await test('Mode item exists with the FOCUS_MODE_MODE_ITEM id', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();

        const modeItem = document.getElementById('focus-mode-mode-item');
        instance.destroy();
        teardownDOMScaffold();

        if (!modeItem) throw new Error('Mode item should be findable by id "focus-mode-mode-item"');
        if (modeItem.dataset.action !== 'switch-mode') {
            throw new Error('Mode item should have data-action="switch-mode"');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎬 _handleMenuAction Dispatch</h4>';

    await test('switch-routines action calls switchMiniCycle dep', () => {
        let called = false;
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            switchMiniCycle: () => { called = true; }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('switch-routines');
        instance.destroy();
        teardownDOMScaffold();
        if (!called) throw new Error('switchMiniCycle dep should have been called');
    });

    await test('create-routine action calls createNewMiniCycle dep', () => {
        let called = false;
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            createNewMiniCycle: () => { called = true; }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('create-routine');
        instance.destroy();
        teardownDOMScaffold();
        if (!called) throw new Error('createNewMiniCycle dep should have been called');
    });

    await test('uncheck-all action calls clearAllTasks dep', () => {
        let called = false;
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            clearAllTasks: () => { called = true; }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('uncheck-all');
        instance.destroy();
        teardownDOMScaffold();
        if (!called) throw new Error('clearAllTasks dep should have been called');
    });

    await test('delete-all action calls deleteAllTasks dep (delegates confirmation)', () => {
        let called = false;
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            deleteAllTasks: () => { called = true; }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('delete-all');
        instance.destroy();
        teardownDOMScaffold();
        if (!called) throw new Error('deleteAllTasks dep should have been called');
    });

    await test('toggle-input-bar action clicks the existing toggle button', () => {
        let clicked = false;
        setupDOMScaffold();
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-task-input-btn';
        toggleBtn.addEventListener('click', () => { clicked = true; });
        document.body.appendChild(toggleBtn);

        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('toggle-input-bar');
        instance.destroy();
        toggleBtn.remove();
        teardownDOMScaffold();

        if (!clicked) throw new Error('Existing toggle-task-input-btn should have been clicked');
    });

    await test('exit action calls deactivate', () => {
        let deactivated = false;
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState({ settings: { focusModeActive: true } }),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();
        // Spy on deactivate
        const original = instance.deactivate.bind(instance);
        instance.deactivate = () => { deactivated = true; original(); };
        instance._handleMenuAction('exit');
        instance.destroy();
        teardownDOMScaffold();
        if (!deactivated) throw new Error('exit action should call deactivate');
    });

    await test('switch-mode action opens the mode-switch modal', () => {
        setupDOMScaffold();
        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            getActiveElement: () => document.activeElement,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('switch-mode');
        const modal = document.getElementById('focus-mode-mode-modal');
        const wasOpened = modal && modal.hidden === false;
        instance._closeModeModal();
        instance.destroy();
        teardownDOMScaffold();
        if (!wasOpened) throw new Error('switch-mode should open the mode modal');
    });

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
