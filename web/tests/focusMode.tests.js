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
            'toggle-input-bar', 'toggle-dark-mode', 'uncheck-all', 'delete-all',
            'settings', 'exit'
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

    await test('init() inserts a separator between each group (4 separators total)', () => {
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

        // Groups: routine | view | bulk | leave | exit → 4 separators
        if (separators.length !== 4) {
            throw new Error(`Expected 4 separators, got ${separators.length}`);
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

    // Focus View makes the ⋯ menu the ONLY menu — focus-mode.css gives the main
    // ☰ button `pointer-events: none` and stacks this trigger over it. Settings
    // was the one ☰ entry with no counterpart here, so a routine run in Focus
    // View had to be abandoned to reach it.
    await test('settings action clicks the existing open-settings button', () => {
        let clicked = false;
        setupDOMScaffold();
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'open-settings';
        settingsBtn.addEventListener('click', () => { clicked = true; });
        document.body.appendChild(settingsBtn);

        mod.setFocusModeDependencies({
            AppState: createMockAppState(),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn)
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance._handleMenuAction('settings');
        instance.destroy();
        settingsBtn.remove();
        teardownDOMScaffold();

        if (!clicked) throw new Error('Existing open-settings button should have been clicked');
    });

    await test('settings sits in its own group, separated from bulk ops and exit', () => {
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

        const menu = document.getElementById('focus-mode-menu');
        const kids = Array.from(menu.children);
        const idx = kids.findIndex(el => el.dataset && el.dataset.action === 'settings');
        const prevIsSeparator = idx > 0 && kids[idx - 1].getAttribute('role') === 'separator';
        const nextIsSeparator = idx >= 0 && idx + 1 < kids.length &&
            kids[idx + 1].getAttribute('role') === 'separator';
        instance.destroy();
        teardownDOMScaffold();

        if (idx < 0) throw new Error('settings item not found in the menu');
        // A group of one: separators on both sides. Grouping it with the bulk
        // ops would file "open a settings panel" next to "delete all tasks".
        if (!prevIsSeparator) throw new Error('settings should be separated from the bulk group above it');
        if (!nextIsSeparator) throw new Error('settings should be separated from exit below it');
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

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔕 Deactivate Notification Gating</h4>';

    /**
     * On first focus-view exit, onboardingManager shows its own "Welcome to
     * Home View" notification with a CTA — focusMode's own "Back to Home View"
     * toast would be redundant noise. Gate is `state.settings.onboardingCompleted`:
     *   • false → suppress the toast (first exit)
     *   • true  → show the toast (every subsequent exit)
     */
    await test('deactivate suppresses notification on first exit (onboardingCompleted=false)', () => {
        setupDOMScaffold();
        const notificationCalls = [];
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                settings: { focusModeActive: true, onboardingCompleted: false }
            }),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            showNotification: (msg, type, duration) => {
                notificationCalls.push({ msg, type, duration });
            }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance.activate(true);  // silent — don't pollute the call log
        notificationCalls.length = 0;  // clear any stragglers
        instance.deactivate();
        instance.destroy();
        teardownDOMScaffold();

        if (notificationCalls.length !== 0) {
            throw new Error(
                `Expected zero notifications on first exit, got ${notificationCalls.length}: ` +
                JSON.stringify(notificationCalls)
            );
        }
    });

    await test('deactivate shows notification on subsequent exits (onboardingCompleted=true)', () => {
        setupDOMScaffold();
        const notificationCalls = [];
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                settings: { focusModeActive: true, onboardingCompleted: true }
            }),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            showNotification: (msg, type, duration) => {
                notificationCalls.push({ msg, type, duration });
            }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance.activate(true);
        notificationCalls.length = 0;
        instance.deactivate();
        instance.destroy();
        teardownDOMScaffold();

        if (notificationCalls.length !== 1) {
            throw new Error(
                `Expected exactly one notification on subsequent exit, got ${notificationCalls.length}: ` +
                JSON.stringify(notificationCalls)
            );
        }
    });

    /**
     * create/sample first-run landings mark onboardingCompleted=true upfront, so
     * onboardingCompleted alone can't detect their first (graduation) exit.
     * startFocusViewForNewRoutine sets firstRunFocusExitPending for exactly that —
     * deactivate must treat it as a first exit and suppress the toast.
     */
    await test('deactivate suppresses notification on create/sample first exit (firstRunFocusExitPending=true)', () => {
        setupDOMScaffold();
        const notificationCalls = [];
        mod.setFocusModeDependencies({
            AppState: createMockAppState({
                settings: { focusModeActive: true, onboardingCompleted: true, firstRunFocusExitPending: true }
            }),
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            showNotification: (msg, type, duration) => {
                notificationCalls.push({ msg, type, duration });
            }
        });
        const instance = new mod.FocusMode();
        instance.init();
        instance.activate(true);
        notificationCalls.length = 0;
        instance.deactivate();
        instance.destroy();
        teardownDOMScaffold();

        if (notificationCalls.length !== 0) {
            throw new Error(
                `Expected zero notifications on create/sample first exit, got ${notificationCalls.length}: ` +
                JSON.stringify(notificationCalls)
            );
        }
    });

    await test('deactivate consumes firstRunFocusExitPending so the next exit toasts', () => {
        setupDOMScaffold();
        const notificationCalls = [];
        const appState = createMockAppState({
            settings: { focusModeActive: true, onboardingCompleted: true, firstRunFocusExitPending: true }
        });
        mod.setFocusModeDependencies({
            AppState: appState,
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            getBody: () => document.body,
            safeAddEventListener: (el, evt, fn) => el.addEventListener(evt, fn),
            showNotification: (msg, type, duration) => {
                notificationCalls.push({ msg, type, duration });
            }
        });
        const instance = new mod.FocusMode();
        instance.init();

        // First exit — suppressed AND the one-shot flag consumed.
        instance.activate(true);
        notificationCalls.length = 0;
        instance.deactivate();
        if (appState.get().settings.firstRunFocusExitPending !== false) {
            throw new Error('firstRunFocusExitPending should be cleared after the first exit');
        }
        if (notificationCalls.length !== 0) {
            throw new Error(`First exit should be silent, got ${notificationCalls.length}`);
        }

        // Second exit — flag gone, onboardingCompleted still true → toast shows.
        instance.activate(true);
        notificationCalls.length = 0;
        instance.deactivate();
        instance.destroy();
        teardownDOMScaffold();

        if (notificationCalls.length !== 1) {
            throw new Error(`Expected one notification on the second (normal) exit, got ${notificationCalls.length}`);
        }
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
    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ _updateActionButtonAria</h4>';

    /**
     * Build a fresh FocusMode instance ready to exercise the action-button
     * methods. Caller decides _active. Returns { instance, cleanup }.
     */
    function createReadyInstance() {
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
        return {
            instance,
            cleanup: () => {
                document.body.classList.remove('todo-mode-mode', 'auto-cycle-mode', 'manual-cycle-mode');
                instance.destroy();
                teardownDOMScaffold();
            }
        };
    }

    await test('inactive state: clears data-label and uses enter aria', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = false;
        instance._button.setAttribute('data-label', 'leftover');
        instance._updateActionButtonAria();
        const hasDataLabel = instance._button.hasAttribute('data-label');
        const ariaLabel = instance._button.getAttribute('aria-label') || '';
        cleanup();
        if (hasDataLabel) throw new Error('data-label should be removed when inactive');
        if (!ariaLabel.toLowerCase().includes('focus')) {
            throw new Error('aria-label should be the enter-focus label, got: ' + ariaLabel);
        }
    });

    await test('todo-mode override sets clear labels and themed data-label', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        instance._updateActionButtonAria('todo-mode');
        const dataLabel = instance._button.getAttribute('data-label') || '';
        const ariaLabel = instance._button.getAttribute('aria-label') || '';
        cleanup();
        if (!dataLabel.toLowerCase().includes('clear')) {
            throw new Error('data-label should contain "Clear" for todo mode, got: ' + dataLabel);
        }
        if (!ariaLabel.toLowerCase().includes('clear')) {
            throw new Error('aria-label should describe clear action, got: ' + ariaLabel);
        }
    });

    await test('manual-cycle override sets cycle labels and themed data-label', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        instance._updateActionButtonAria('manual-cycle');
        const dataLabel = instance._button.getAttribute('data-label') || '';
        const ariaLabel = instance._button.getAttribute('aria-label') || '';
        cleanup();
        if (!dataLabel.toLowerCase().includes('cycle')) {
            throw new Error('data-label should contain "Cycle" for manual mode, got: ' + dataLabel);
        }
        if (!ariaLabel.toLowerCase().includes('cycle')) {
            throw new Error('aria-label should describe cycle action, got: ' + ariaLabel);
        }
    });

    await test('reads mode from body class when no override given', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        document.body.classList.add('todo-mode-mode');
        instance._updateActionButtonAria();
        const dataLabel = instance._button.getAttribute('data-label') || '';
        cleanup();
        if (!dataLabel.toLowerCase().includes('clear')) {
            throw new Error('Should read todo-mode from body class, got: ' + dataLabel);
        }
    });

    await test('explicit override takes precedence over body class', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        // Body says todo, override says manual-cycle — override wins.
        document.body.classList.add('todo-mode-mode');
        instance._updateActionButtonAria('manual-cycle');
        const dataLabel = instance._button.getAttribute('data-label') || '';
        cleanup();
        if (!dataLabel.toLowerCase().includes('cycle') ||
            dataLabel.toLowerCase().includes('clear')) {
            throw new Error('Override should win over body class; got: ' + dataLabel);
        }
    });

    await test('auto-cycle is a no-op (button hidden by CSS, labels stay intact)', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        instance._updateActionButtonAria('manual-cycle');
        const before = instance._button.getAttribute('data-label');
        instance._updateActionButtonAria('auto-cycle');
        const after = instance._button.getAttribute('data-label');
        cleanup();
        if (before !== after) {
            throw new Error(`auto-cycle should not change labels; before="${before}" after="${after}"`);
        }
    });

    await test('refreshActionButton() delegates to _updateActionButtonAria', () => {
        const { instance, cleanup } = createReadyInstance();
        instance._active = true;
        let called = 0;
        const original = instance._updateActionButtonAria.bind(instance);
        instance._updateActionButtonAria = function (...args) {
            called++;
            return original(...args);
        };
        instance.refreshActionButton();
        cleanup();
        if (called !== 1) {
            throw new Error(`refreshActionButton should call _updateActionButtonAria once, got ${called}`);
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Branding stays visible in focus view</h4>';

    // The header BRANDING is deliberately exempt from the chrome focus view hides.
    // It can only be exempt if the header's chrome CHILDREN are hidden rather than
    // .fixed-header-container itself: a descendant can override an ancestor's
    // `visibility`, but never its `opacity`, and `inert` on an ancestor cannot be
    // cancelled from within. Re-adding the container to the list silently re-hides
    // the logo.
    //
    // These build their own fixture on purpose. The harness page has no app header,
    // so an earlier version of these guards querySelector'd null and skipped every
    // assertion — they passed even with the container put back, which is a test that
    // cannot fail. Injecting deps that resolve against the fixture makes them real.

    const withHeaderFixture = (fn) => {
        const host = document.createElement('div');
        host.innerHTML =
            '<div class="fixed-header-container">' +
              '<header class="mini-cycle-header-row">' +
                '<div class="header-branding"><img class="header-logo" alt="miniCycle"></div>' +
                '<button class="menu-button">☰</button>' +
              '</header>' +
              '<div class="mode-selector-wrapper"></div>' +
              '<div id="saving-indicator"></div>' +
            '</div>';
        document.body.appendChild(host);
        const deps = {
            querySelector: (sel) => host.querySelector(sel),
            getElementById: (id) => host.querySelector(`#${id}`),
            getBody: () => document.body,
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            safeAddEventListener: () => {}
        };
        try {
            mod.setFocusModeDependencies(deps);
            const focusMode = new mod.FocusMode();
            return fn(focusMode, host);
        } finally {
            host.remove();
        }
    };

    await test('the header container itself is never made inert', () => {
        withHeaderFixture((focusMode, host) => {
            const els = focusMode._getInertChromeElements();
            const container = host.querySelector('.fixed-header-container');
            if (!container) throw new Error('fixture broken — no container to assert against');
            if (els.includes(container)) {
                throw new Error(
                    'fixed-header-container is back in the inert list — inertness inherits and cannot ' +
                    'be cancelled by .header-branding, so the logo is hidden from assistive tech again'
                );
            }
        });
    });

    await test('branding is not inside anything focus view hides', () => {
        withHeaderFixture((focusMode, host) => {
            const branding = host.querySelector('.header-branding');
            if (!branding) throw new Error('fixture broken — no branding to assert against');
            for (const hidden of focusMode._getInertChromeElements()) {
                if (hidden.contains(branding)) {
                    throw new Error(
                        'the logo sits inside an element focus view hides — opacity and inert both ' +
                        'inherit, so it cannot be exempted from within'
                    );
                }
            }
        });
    });

    await test('the header chrome children are still hidden', () => {
        withHeaderFixture((focusMode, host) => {
            const els = focusMode._getInertChromeElements();
            for (const sel of ['.menu-button', '.mode-selector-wrapper']) {
                const el = host.querySelector(sel);
                if (!el) throw new Error(`fixture broken — ${sel} missing`);
                if (!els.includes(el)) {
                    throw new Error(`${sel} dropped from the inert list — focus view would leave it tabbable`);
                }
            }
        });
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
