/**
 * SettingsUIManager Tests
 * Tests for modules/ui/settingsUIManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runSettingsUIManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/settingsUIManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>SettingsUIManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setSettingsUIManagerDependencies is exported as a function', () => {
        if (typeof mod.setSettingsUIManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('setupSettingsMenu is exported as a function', () => {
        if (typeof mod.setupSettingsMenu !== 'function') throw new Error('Missing export');
    });

    await test('initAllToggles is exported as a function', () => {
        if (typeof mod.initAllToggles !== 'function') throw new Error('Missing export');
    });

    await test('setupDarkModeToggle is exported as a function', () => {
        if (typeof mod.setupDarkModeToggle !== 'function') throw new Error('Missing export');
    });

    // ============================================
    // 🎚️ Toggle setup behavior (loadMiniCycleData-driven initial state)
    // These read saved settings and reflect them onto the DOM. Each clears the
    // module idempotency guards via _resetForTesting() and cleans up the classes/
    // CSS vars it applied so tests stay isolated.
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎚️ Toggle Setup Behavior</h4>';

    const wire = (loadMiniCycleData) => mod.setSettingsUIManagerDependencies({
        loadMiniCycleData,
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
        showNotification: () => {}
    });

    await test('setupReducedMotionToggle reflects saved state onto toggle + root classes', () => {
        mod._resetForTesting();
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.id = 'toggle-reduced-motion';
        document.body.appendChild(toggle);
        try {
            wire(() => ({ settings: { reducedMotion: true } }));
            mod.setupReducedMotionToggle();
            if (toggle.checked !== true) throw new Error('toggle should be checked when reducedMotion is saved true');
            if (!document.body.classList.contains('reduced-motion')) throw new Error('body should get reduced-motion class');
            if (!document.documentElement.classList.contains('reduced-motion')) throw new Error('root should get reduced-motion class');
        } finally {
            toggle.remove();
            document.body.classList.remove('reduced-motion');
            document.documentElement.classList.remove('reduced-motion');
        }
    });

    await test('setupHighContrastToggle reflects saved state onto toggle + body class', () => {
        mod._resetForTesting();
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.id = 'toggle-high-contrast';
        document.body.appendChild(toggle);
        try {
            wire(() => ({ settings: { highContrast: true } }));
            mod.setupHighContrastToggle();
            if (toggle.checked !== true) throw new Error('toggle should be checked when highContrast is saved true');
            if (!document.body.classList.contains('high-contrast')) throw new Error('body should get high-contrast class');
        } finally {
            toggle.remove();
            document.body.classList.remove('high-contrast');
        }
    });

    await test('setupFontSizeSelect applies the saved size to the select + --font-size-base', () => {
        mod._resetForTesting();
        const select = document.createElement('select');
        select.id = 'font-size-select';
        [16, 20].forEach(v => { const o = document.createElement('option'); o.value = String(v); select.appendChild(o); });
        document.body.appendChild(select);
        try {
            wire(() => ({ settings: { fontSize: '20' } }));
            mod.setupFontSizeSelect();
            if (select.value !== '20') throw new Error(`select should show saved size, got "${select.value}"`);
            // Source: non-default sizes set the root CSS var to `${size}px`.
            if (document.documentElement.style.getPropertyValue('--font-size-base') !== '20px') {
                throw new Error(`--font-size-base should be 20px, got "${document.documentElement.style.getPropertyValue('--font-size-base')}"`);
            }
        } finally {
            select.remove();
            document.documentElement.style.removeProperty('--font-size-base');
        }
    });

    await test('applyPriorityColor sets the global var and each task colored var', () => {
        // No idempotency guard / no listener — purely loadMiniCycleData-driven.
        mod.setSettingsUIManagerDependencies({
            loadMiniCycleData: () => ({
                settings: { priorityColor: '#ff0000' },
                activeCycle: 'c1',
                cycles: { c1: { tasks: [{ id: 't1', highPriority: true, priorityColor: '#00ff00' }] } }
            })
        });
        const el = document.createElement('div');
        el.setAttribute('data-task-id', 't1');
        document.body.appendChild(el);
        try {
            mod.applyPriorityColor();
            if (document.documentElement.style.getPropertyValue('--priority-color') !== '#ff0000') {
                throw new Error('global --priority-color should be applied from settings');
            }
            if (el.style.getPropertyValue('--task-priority-color') !== '#00ff00') {
                throw new Error('per-task --task-priority-color should be applied from the task color');
            }
        } finally {
            el.remove();
            document.documentElement.style.removeProperty('--priority-color');
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 syncCurrentSettingsToStorage</h4>';

    await test('syncCurrentSettingsToStorage writes toggle states into the active cycle', async () => {
        const autoReset = document.createElement('input');
        autoReset.type = 'checkbox'; autoReset.id = 'toggleAutoReset'; autoReset.checked = true;
        const delChecked = document.createElement('input');
        delChecked.type = 'checkbox'; delChecked.id = 'deleteCheckedTasks'; delChecked.checked = false;
        document.body.appendChild(autoReset);
        document.body.appendChild(delChecked);

        // AppState is resolved as a FACTORY here (_deps.AppState?.()), and update() mutates
        // state.data.cycles[activeCycle]. Capture that state so we can assert the writes.
        const captured = { data: { cycles: { c1: {} } } };
        mod.setSettingsUIManagerDependencies({
            loadMiniCycleData: () => ({ cycles: { c1: {} }, activeCycle: 'c1' }),
            AppState: () => ({ isReady: () => true, update: async (fn) => fn(captured) })
        });

        try {
            await mod.syncCurrentSettingsToStorage();
            if (captured.data.cycles.c1.autoReset !== true) throw new Error('autoReset should mirror the checked toggle');
            if (captured.data.cycles.c1.deleteCheckedTasks !== false) throw new Error('deleteCheckedTasks should mirror the unchecked toggle');
        } finally {
            autoReset.remove();
            delChecked.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('injected dependencies actually take effect (not just no-throw)', () => {
        // Prove the injected loadMiniCycleData is the one applyPriorityColor reads.
        let loaderCalled = false;
        mod.setSettingsUIManagerDependencies({
            loadMiniCycleData: () => { loaderCalled = true; return { settings: {} }; }
        });
        mod.applyPriorityColor();
        if (!loaderCalled) throw new Error('applyPriorityColor should call the injected loadMiniCycleData');
    });

    await test('setSettingsUIManagerDependencies(null) preserves previously injected deps', () => {
        let loaderCalled = false;
        mod.setSettingsUIManagerDependencies({ loadMiniCycleData: () => { loaderCalled = true; return { settings: {} }; } });
        mod.setSettingsUIManagerDependencies(null); // no-op in diBase — must not wipe deps
        mod.applyPriorityColor();
        if (!loaderCalled) throw new Error('a null DI call should not clear the previously injected loadMiniCycleData');
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
