/**
 * LabelResolver Tests
 * Tests for getLabel(), getIcon(), hasLabel(), interpolation, pluralization, and theme overrides
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';
import { hasGlobal } from './helpers/testContext.js';

export async function runLabelResolverTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/labels/labelResolver.js?v=${cacheBuster}`);
    const {
        getLabel, getIcon, getLabelOrFallback, hasLabel,
        isLensSensitive, getKeysInCategory, getLensSensitiveKeys,
        getLabels, getCategoryLabels, getLabelDiagnostics,
        setLabelResolverDependencies
    } = mod;

    const defaultLabelsMod = await import(`../modules/labels/defaultLabels.js?v=${cacheBuster}`);
    const { DEFAULT_LABELS, LENS_SENSITIVE_KEYS } = defaultLabelsMod;

    resultsDiv.innerHTML = '<h2>LabelResolver Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Reset DI to ensure clean state — no active lens
    setLabelResolverDependencies({ getActiveLens: null, getRoutineLens: null }, { replace: true });

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('getLabel is a function', () => {
        if (typeof getLabel !== 'function') throw new Error('getLabel not a function');
    });

    await test('getIcon is a function', () => {
        if (typeof getIcon !== 'function') throw new Error('getIcon not a function');
    });

    await test('hasLabel is a function', () => {
        if (typeof hasLabel !== 'function') throw new Error('hasLabel not a function');
    });

    await test('getLabelOrFallback is a function', () => {
        if (typeof getLabelOrFallback !== 'function') throw new Error('getLabelOrFallback not a function');
    });

    await test('setLabelResolverDependencies is a function', () => {
        if (typeof setLabelResolverDependencies !== 'function') throw new Error('setter not a function');
    });

    // ============================================
    // ⚡ SIMPLE LOOKUPS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ Simple Lookups</h4>';

    await test('getLabel resolves a simple string key', () => {
        const result = getLabel('action.addTask');
        if (result !== 'Add task') throw new Error(`Expected "Add task", got "${result}"`);
    });

    await test('getLabel resolves mode labels', () => {
        const result = getLabel('mode.auto');
        if (result !== 'Auto Cycle') throw new Error(`Expected "Auto Cycle", got "${result}"`);
    });

    await test('getLabel returns key for unknown category', () => {
        const result = getLabel('nonexistent.key');
        if (result !== 'nonexistent.key') throw new Error(`Expected key back, got "${result}"`);
    });

    await test('getLabel returns key for unknown key in valid category', () => {
        const result = getLabel('action.totallyFakeKey');
        if (result !== 'action.totallyFakeKey') throw new Error(`Expected key back, got "${result}"`);
    });

    await test('getLabel returns key for single-part key (no dot)', () => {
        const result = getLabel('noDot');
        if (result !== 'noDot') throw new Error(`Expected key back, got "${result}"`);
    });

    // ============================================
    // 📐 PLURALIZATION
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📐 Pluralization</h4>';

    await test('getLabel returns singular form for count=1', () => {
        const result = getLabel('noun.task', { count: 1 });
        if (result !== 'task') throw new Error(`Expected "task", got "${result}"`);
    });

    await test('getLabel returns plural form for count>1', () => {
        const result = getLabel('noun.task', { count: 5 });
        if (result !== 'tasks') throw new Error(`Expected "tasks", got "${result}"`);
    });

    await test('getLabel returns plural form for count=0', () => {
        const result = getLabel('noun.task', { count: 0 });
        if (result !== 'tasks') throw new Error(`Expected "tasks", got "${result}"`);
    });

    await test('getLabel defaults to count=1 (singular)', () => {
        const result = getLabel('noun.cycle');
        if (result !== 'cycle') throw new Error(`Expected "cycle", got "${result}"`);
    });

    await test('pluralization works for routines', () => {
        const singular = getLabel('noun.routine', { count: 1 });
        const plural = getLabel('noun.routine', { count: 3 });
        if (singular !== 'routine') throw new Error(`Expected "routine", got "${singular}"`);
        if (plural !== 'routines') throw new Error(`Expected "routines", got "${plural}"`);
    });

    // ============================================
    // 🔤 INTERPOLATION
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔤 Interpolation</h4>';

    await test('getLabel interpolates variables', () => {
        const result = getLabel('notify.taskRenamed', { vars: { name: 'Buy milk' } });
        if (!result.includes('Buy milk')) throw new Error(`Interpolation failed: "${result}"`);
    });

    await test('getLabel leaves unmatched placeholders as-is', () => {
        // Use a key with {name} but don't provide it
        const result = getLabel('notify.exportSuccess', { vars: {} });
        if (!result.includes('{name}')) throw new Error(`Should leave {name} as-is: "${result}"`);
    });

    await test('getLabel interpolates count in pluralized nouns', () => {
        // Pluralized nouns get count passed through to interpolation
        const result = getLabel('noun.task', { count: 3 });
        // noun.task is { one: 'task', other: 'tasks' } — no {count} template, but should still work
        if (result !== 'tasks') throw new Error(`Expected "tasks", got "${result}"`);
    });

    // ============================================
    // 🔍 UTILITY FUNCTIONS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Utility Functions</h4>';

    await test('hasLabel returns true for existing key', () => {
        if (!hasLabel('action.addTask')) throw new Error('Should find action.addTask');
    });

    await test('hasLabel returns false for missing key', () => {
        if (hasLabel('fake.nonexistent')) throw new Error('Should not find fake.nonexistent');
    });

    await test('hasLabel returns false for invalid format', () => {
        if (hasLabel('noDot')) throw new Error('Should return false for no-dot key');
    });

    await test('getLabelOrFallback returns label when key exists', () => {
        const result = getLabelOrFallback('action.addTask', 'FALLBACK');
        if (result === 'FALLBACK') throw new Error('Should not use fallback');
        if (result !== 'Add task') throw new Error(`Expected "Add task", got "${result}"`);
    });

    await test('getLabelOrFallback returns fallback for missing key', () => {
        const result = getLabelOrFallback('fake.missing', 'FALLBACK');
        if (result !== 'FALLBACK') throw new Error(`Expected "FALLBACK", got "${result}"`);
    });

    await test('isLensSensitive returns true for sensitive key', () => {
        // Pick a known lens-sensitive key
        const keys = getLensSensitiveKeys();
        if (keys.length === 0) throw new Error('No lens-sensitive keys found');
        if (!isLensSensitive(keys[0])) throw new Error(`${keys[0]} should be lens-sensitive`);
    });

    await test('isLensSensitive returns false for non-sensitive key', () => {
        if (isLensSensitive('button.save')) throw new Error('button.save should not be lens-sensitive');
    });

    await test('getKeysInCategory returns keys for valid category', () => {
        const keys = getKeysInCategory('action');
        if (!Array.isArray(keys) || keys.length === 0) throw new Error('Should return action keys');
        if (!keys[0].startsWith('action.')) throw new Error('Keys should be dot-path format');
    });

    await test('getKeysInCategory returns empty for invalid category', () => {
        const keys = getKeysInCategory('nonexistent');
        if (keys.length !== 0) throw new Error('Should return empty array');
    });

    await test('getLensSensitiveKeys returns array of strings', () => {
        const keys = getLensSensitiveKeys();
        if (!Array.isArray(keys)) throw new Error('Should return array');
        if (keys.length === 0) throw new Error('Should have sensitive keys');
        if (typeof keys[0] !== 'string') throw new Error('Keys should be strings');
    });

    // ============================================
    // 📦 BATCH OPERATIONS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Batch Operations</h4>';

    await test('getLabels resolves multiple keys at once', () => {
        const result = getLabels(['action.addTask', 'mode.auto']);
        if (result['action.addTask'] !== 'Add task') throw new Error('addTask not resolved');
        if (result['mode.auto'] !== 'Auto Cycle') throw new Error('mode.auto not resolved');
    });

    await test('getCategoryLabels returns all keys in category', () => {
        const result = getCategoryLabels('mode');
        if (!result.auto || !result.manual || !result.todo) {
            throw new Error('Missing expected mode keys');
        }
    });

    await test('getCategoryLabels returns empty for invalid category', () => {
        const result = getCategoryLabels('nonexistent');
        if (Object.keys(result).length !== 0) throw new Error('Should be empty');
    });

    // ============================================
    // 📊 DIAGNOSTICS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Diagnostics</h4>';

    await test('getLabelDiagnostics returns valid data', () => {
        const diag = getLabelDiagnostics();
        if (typeof diag.categories !== 'number' || diag.categories < 10) {
            throw new Error(`Expected 10+ categories, got ${diag.categories}`);
        }
        if (typeof diag.totalKeys !== 'number' || diag.totalKeys < 100) {
            throw new Error(`Expected 100+ keys, got ${diag.totalKeys}`);
        }
        if (typeof diag.lensSensitiveKeys !== 'number') {
            throw new Error('Missing lensSensitiveKeys count');
        }
    });

    // ============================================
    // 🎨 THEME OVERRIDE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Theme Override</h4>';

    await test('getLabel uses theme override when lens is active', () => {
        const mockTheme = {
            labels: { 'action.addTask': 'Add habit' },
            icons: {}
        };
        setLabelResolverDependencies({
            getActiveLens: () => mockTheme,
            getRoutineLens: null
        }, { replace: true });

        const result = getLabel('action.addTask');
        if (result !== 'Add habit') throw new Error(`Expected "Add habit", got "${result}"`);

        // Cleanup
        setLabelResolverDependencies({ getActiveLens: null, getRoutineLens: null }, { replace: true });
    });

    await test('getLabel falls through to default when theme has no override', () => {
        const mockTheme = { labels: {}, icons: {} };
        setLabelResolverDependencies({
            getActiveLens: () => mockTheme,
            getRoutineLens: null
        }, { replace: true });

        const result = getLabel('mode.auto');
        if (result !== 'Auto Cycle') throw new Error(`Expected "Auto Cycle", got "${result}"`);

        // Cleanup
        setLabelResolverDependencies({ getActiveLens: null, getRoutineLens: null }, { replace: true });
    });

    await test('getIcon uses theme icon override', () => {
        const mockTheme = {
            labels: {},
            icons: { cycleComplete: '💪' }
        };
        setLabelResolverDependencies({
            getActiveLens: () => mockTheme,
            getRoutineLens: null
        }, { replace: true });

        const result = getIcon('cycleComplete');
        if (result !== '💪') throw new Error(`Expected "💪", got "${result}"`);

        // Cleanup
        setLabelResolverDependencies({ getActiveLens: null, getRoutineLens: null }, { replace: true });
    });

    await test('getLabel uses routineLens when routineId is provided', () => {
        const mockRoutineTheme = {
            labels: { 'noun.task': { one: 'workout', other: 'workouts' } },
            icons: {}
        };
        setLabelResolverDependencies({
            getActiveLens: null,
            getRoutineLens: (id) => id === 'routine-1' ? mockRoutineTheme : null
        }, { replace: true });

        const result = getLabel('noun.task', { count: 1, routineId: 'routine-1' });
        if (result !== 'workout') throw new Error(`Expected "workout", got "${result}"`);

        // Cleanup
        setLabelResolverDependencies({ getActiveLens: null, getRoutineLens: null }, { replace: true });
    });

    // ============================================
    // ⚠️ ERROR HANDLING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('getLabel handles null options gracefully', () => {
        // Should not throw
        const result = getLabel('action.addTask', {});
        if (typeof result !== 'string') throw new Error('Should return string');
    });

    await test('getLabel handles empty string key', () => {
        const result = getLabel('');
        if (result !== '') throw new Error('Should return empty key back');
    });

    // ============================================
    // 📊 RESULTS
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
