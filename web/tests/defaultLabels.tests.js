/**
 * DefaultLabels Tests
 * Structural validation of the label registry — ensures all categories exist,
 * keys follow conventions, pluralization objects are well-formed, and no keys are missing.
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runDefaultLabelsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/labels/defaultLabels.js?v=${cacheBuster}`);
    const { DEFAULT_LABELS, LENS_SENSITIVE_KEYS } = mod;

    resultsDiv.innerHTML = '<h2>DefaultLabels Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('DEFAULT_LABELS is exported', () => {
        if (!DEFAULT_LABELS || typeof DEFAULT_LABELS !== 'object') {
            throw new Error('DEFAULT_LABELS not exported or not an object');
        }
    });

    await test('LENS_SENSITIVE_KEYS is exported as a Set', () => {
        if (!(LENS_SENSITIVE_KEYS instanceof Set)) {
            throw new Error('LENS_SENSITIVE_KEYS is not a Set');
        }
    });

    await test('DEFAULT_LABELS is frozen (immutable)', () => {
        if (!Object.isFrozen(DEFAULT_LABELS)) {
            throw new Error('DEFAULT_LABELS should be frozen');
        }
    });

    // ============================================
    // 📂 CATEGORY STRUCTURE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📂 Category Structure</h4>';

    const expectedCategories = [
        'noun', 'mode', 'action', 'button', 'nav', 'help', 'notify',
        'empty', 'settings', 'stats', 'history', 'achievement', 'icons'
    ];

    await test('has all expected core categories', () => {
        const missing = expectedCategories.filter(c => !DEFAULT_LABELS[c]);
        if (missing.length > 0) {
            throw new Error(`Missing categories: ${missing.join(', ')}`);
        }
    });

    await test('has at least 20 categories', () => {
        const count = Object.keys(DEFAULT_LABELS).length;
        if (count < 20) throw new Error(`Expected 20+ categories, got ${count}`);
    });

    await test('every category is an object', () => {
        for (const [cat, obj] of Object.entries(DEFAULT_LABELS)) {
            if (typeof obj !== 'object' || obj === null) {
                throw new Error(`Category "${cat}" is not an object`);
            }
        }
    });

    await test('every category is frozen', () => {
        for (const [cat, obj] of Object.entries(DEFAULT_LABELS)) {
            if (!Object.isFrozen(obj)) {
                throw new Error(`Category "${cat}" is not frozen`);
            }
        }
    });

    // ============================================
    // 📐 NOUN PLURALIZATION
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📐 Noun Pluralization</h4>';

    await test('noun.task has one/other pluralization', () => {
        const t = DEFAULT_LABELS.noun.task;
        if (!t || typeof t !== 'object' || !t.one || !t.other) {
            throw new Error('noun.task missing one/other');
        }
    });

    await test('noun.cycle has one/other pluralization', () => {
        const c = DEFAULT_LABELS.noun.cycle;
        if (!c || typeof c !== 'object' || !c.one || !c.other) {
            throw new Error('noun.cycle missing one/other');
        }
    });

    await test('noun.routine has one/other pluralization', () => {
        const r = DEFAULT_LABELS.noun.routine;
        if (!r || typeof r !== 'object' || !r.one || !r.other) {
            throw new Error('noun.routine missing one/other');
        }
    });

    await test('all pluralized nouns have both one and other', () => {
        const nouns = DEFAULT_LABELS.noun;
        const broken = [];
        for (const [key, val] of Object.entries(nouns)) {
            if (typeof val === 'object' && val !== null) {
                if (!('one' in val) || !('other' in val)) {
                    broken.push(key);
                }
            }
        }
        if (broken.length > 0) {
            throw new Error(`Nouns missing one/other: ${broken.join(', ')}`);
        }
    });

    // ============================================
    // 🔑 KEY CONVENTIONS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔑 Key Conventions</h4>';

    await test('no unexpected empty string values', () => {
        // Some keys intentionally use empty strings (e.g., onboarding spacers)
        const allowedEmpty = ['onboarding.step3Desc2'];
        const empties = [];
        for (const [cat, obj] of Object.entries(DEFAULT_LABELS)) {
            for (const [key, val] of Object.entries(obj)) {
                if (val === '' && !allowedEmpty.includes(`${cat}.${key}`)) {
                    empties.push(`${cat}.${key}`);
                }
            }
        }
        if (empties.length > 0) {
            throw new Error(`Empty string values: ${empties.slice(0, 5).join(', ')}`);
        }
    });

    await test('all string values are trimmed (no leading/trailing whitespace)', () => {
        const untrimmed = [];
        for (const [cat, obj] of Object.entries(DEFAULT_LABELS)) {
            for (const [key, val] of Object.entries(obj)) {
                if (typeof val === 'string' && val !== val.trim()) {
                    untrimmed.push(`${cat}.${key}`);
                }
            }
        }
        if (untrimmed.length > 0) {
            throw new Error(`Untrimmed values: ${untrimmed.slice(0, 5).join(', ')}`);
        }
    });

    await test('total key count is 400+', () => {
        let count = 0;
        for (const obj of Object.values(DEFAULT_LABELS)) {
            count += Object.keys(obj).length;
        }
        if (count < 400) throw new Error(`Expected 400+ keys, got ${count}`);
    });

    // ============================================
    // 🎯 LENS-SENSITIVE KEYS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Lens-Sensitive Keys</h4>';

    await test('LENS_SENSITIVE_KEYS has entries', () => {
        if (LENS_SENSITIVE_KEYS.size === 0) {
            throw new Error('LENS_SENSITIVE_KEYS is empty');
        }
    });

    await test('most lens-sensitive keys exist in DEFAULT_LABELS', () => {
        // Known stale keys from removed themes (Dark Ocean, Golden Glow) and renamed onboarding keys
        const knownStale = new Set([
            'unlock.darkOcean', 'unlock.goldenGlow',
            'onboarding.step3Item1', 'onboarding.step3Item2',
            'onboarding.step3Item3', 'onboarding.step3Item4'
        ]);
        const missing = [];
        for (const key of LENS_SENSITIVE_KEYS) {
            if (knownStale.has(key)) continue;
            const parts = key.split('.');
            if (parts.length < 2) { missing.push(key); continue; }
            const cat = parts[0];
            const labelKey = parts.slice(1).join('.');
            if (!DEFAULT_LABELS[cat] || !(labelKey in DEFAULT_LABELS[cat])) {
                missing.push(key);
            }
        }
        if (missing.length > 0) {
            throw new Error(`Lens-sensitive keys not in DEFAULT_LABELS: ${missing.slice(0, 5).join(', ')}`);
        }
    });

    await test('lens-sensitive keys use dot-path format', () => {
        for (const key of LENS_SENSITIVE_KEYS) {
            if (!key.includes('.')) {
                throw new Error(`Key "${key}" missing dot separator`);
            }
        }
    });

    // ============================================
    // 🔗 CRITICAL KEYS EXIST
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Critical Keys Exist</h4>';

    const criticalKeys = [
        'action.addTask', 'action.completeCycle', 'action.clearCompletedTasks',
        'button.save', 'button.cancel', 'button.close',
        'notify.cycleComplete', 'notify.taskRenamed',
        'help.addFirstTask', 'empty.noTasks',
        'icons.cycleComplete', 'icons.darkMode', 'icons.celebrate'
    ];

    await test('all critical keys exist', () => {
        const missing = [];
        for (const key of criticalKeys) {
            const parts = key.split('.');
            const cat = parts[0];
            const labelKey = parts.slice(1).join('.');
            if (!DEFAULT_LABELS[cat] || !(labelKey in DEFAULT_LABELS[cat])) {
                missing.push(key);
            }
        }
        if (missing.length > 0) {
            throw new Error(`Missing critical keys: ${missing.join(', ')}`);
        }
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
