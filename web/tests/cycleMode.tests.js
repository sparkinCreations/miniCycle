/**
 * CycleMode Tests
 * Tests for modules/utils/cycleMode.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runCycleModeTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/cycleMode.js?v=${cacheBuster}`);
    const { getCycleMode, getAllDoneHintKey } = mod;
    const { DEFAULT_LABELS } = await import(`../modules/labels/defaultLabels.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>CycleMode Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('exports getCycleMode and getAllDoneHintKey as functions', () => {
        if (typeof getCycleMode !== 'function') throw new Error(`getCycleMode: ${typeof getCycleMode}`);
        if (typeof getAllDoneHintKey !== 'function') throw new Error(`getAllDoneHintKey: ${typeof getAllDoneHintKey}`);
    });

    // ── getCycleMode ─────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 getCycleMode</h4>';

    await test('neither flag set is manual', () => {
        if (getCycleMode({}) !== 'manual') throw new Error(getCycleMode({}));
        if (getCycleMode({ autoReset: false, deleteCheckedTasks: false }) !== 'manual') {
            throw new Error('explicit false flags should still be manual');
        }
    });

    await test('autoReset is auto', () => {
        if (getCycleMode({ autoReset: true }) !== 'auto') throw new Error(getCycleMode({ autoReset: true }));
    });

    await test('deleteCheckedTasks is todo', () => {
        if (getCycleMode({ deleteCheckedTasks: true }) !== 'todo') {
            throw new Error(getCycleMode({ deleteCheckedTasks: true }));
        }
    });

    await test('deleteCheckedTasks wins when both flags are set', () => {
        // A To-Do routine DELETES finished tasks; there is nothing left to reset,
        // so the todo reading has to take precedence.
        if (getCycleMode({ autoReset: true, deleteCheckedTasks: true }) !== 'todo') {
            throw new Error('todo must win over auto');
        }
    });

    await test('missing cycle falls back to manual rather than throwing', () => {
        for (const bad of [null, undefined]) {
            if (getCycleMode(bad) !== 'manual') throw new Error(`Expected manual for ${bad}`);
        }
    });

    // ── getAllDoneHintKey ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">✅ getAllDoneHintKey</h4>';

    await test('auto-cycle does NOT name a button', () => {
        // The regression this module exists for: auto-cycle hides the
        // complete/cycle button in BOTH surfaces (taskUI.checkCompleteAllButton
        // skips it, focusMode hides the floating button via CSS), so the old
        // binary branch pointed users at a control that is not on screen.
        const key = getAllDoneHintKey({ autoReset: true });
        if (key === 'focusTask.allDoneHintCycle') {
            throw new Error('auto-cycle must not be told to press the cycle button');
        }
        if (key !== 'focusTask.allDoneHintAuto') throw new Error(`Unexpected key: ${key}`);
        const text = DEFAULT_LABELS.focusTask.allDoneHintAuto;
        if (/button/i.test(text)) {
            throw new Error(`auto hint must not mention a button, got: "${text}"`);
        }
    });

    await test('manual cycle names the cycle button', () => {
        if (getAllDoneHintKey({}) !== 'focusTask.allDoneHintCycle') {
            throw new Error(getAllDoneHintKey({}));
        }
    });

    await test('to-do mode names the clear button', () => {
        if (getAllDoneHintKey({ deleteCheckedTasks: true }) !== 'focusTask.allDoneHintTodo') {
            throw new Error(getAllDoneHintKey({ deleteCheckedTasks: true }));
        }
    });

    await test('every mode maps to a label key that actually exists', () => {
        // A typo'd key would silently render the key string to the user.
        for (const cycle of [{}, { autoReset: true }, { deleteCheckedTasks: true }]) {
            const key = getAllDoneHintKey(cycle);
            const value = key.split('.').reduce((o, k) => o?.[k], DEFAULT_LABELS);
            if (typeof value !== 'string' || !value) {
                throw new Error(`${key} does not resolve to a label`);
            }
        }
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    return { passed: passed.count, total: total.count };
}
