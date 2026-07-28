/**
 * DataSanitizer Tests
 * Tests for sanitizeText() and sanitizeImportedData() — security-critical input sanitization
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runDataSanitizerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/dataSanitizer.js?v=${cacheBuster}`);
    const { sanitizeText, sanitizeImportedData, setDataSanitizerDependencies } = mod;

    resultsDiv.innerHTML = '<h2>DataSanitizer Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Mock sanitizeInput that strips HTML tags
    const mockSanitizeInput = (text) => {
        if (typeof text !== 'string') return '';
        return text.replace(/<[^>]*>/g, '').trim();
    };

    setDataSanitizerDependencies({ sanitizeInput: mockSanitizeInput });

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('sanitizeText is exported', () => {
        if (typeof sanitizeText !== 'function') throw new Error('sanitizeText not a function');
    });

    await test('sanitizeImportedData is exported', () => {
        if (typeof sanitizeImportedData !== 'function') throw new Error('sanitizeImportedData not a function');
    });

    await test('setDataSanitizerDependencies is exported', () => {
        if (typeof setDataSanitizerDependencies !== 'function') throw new Error('DI setter not exported');
    });

    // ============================================
    // 🧹 sanitizeText
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 sanitizeText</h4>';

    await test('sanitizeText returns clean text unchanged', () => {
        const result = sanitizeText('Buy groceries');
        if (result !== 'Buy groceries') throw new Error(`Expected "Buy groceries", got "${result}"`);
    });

    await test('sanitizeText strips HTML tags', () => {
        const result = sanitizeText('<script>alert("xss")</script>Buy milk');
        if (result.includes('<script>')) throw new Error('HTML not stripped');
        if (!result.includes('Buy milk')) throw new Error('Clean text lost');
    });

    await test('sanitizeText calls sanitizeInput dep', () => {
        let called = false;
        setDataSanitizerDependencies({ sanitizeInput: (t) => { called = true; return t; } });
        sanitizeText('test');
        if (!called) throw new Error('sanitizeInput should be called');
        // Restore default mock
        setDataSanitizerDependencies({ sanitizeInput: mockSanitizeInput });
    });

    await test('sanitizeText handles empty string', () => {
        const result = sanitizeText('');
        if (result !== '') throw new Error('Empty string should return empty');
    });

    await test('sanitizeText handles null/undefined', () => {
        const result1 = sanitizeText(null);
        const result2 = sanitizeText(undefined);
        if (typeof result1 !== 'string') throw new Error('null should return string');
        if (typeof result2 !== 'string') throw new Error('undefined should return string');
    });

    // ============================================
    // 📦 sanitizeImportedData
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 sanitizeImportedData</h4>';

    await test('sanitizeImportedData handles Schema 2.5 backup format', () => {
        // sanitizeImportedData expects backup format: schemaVersion + miniCycleData as JSON string
        const stateData = {
            metadata: { version: '2.5', schemaVersion: '2.5' },
            settings: { theme: 'default' },
            data: {
                cycles: {
                    'cycle-1': {
                        metadata: { title: '<b>My Routine</b>' },
                        tasks: [
                            { id: 'task-1', text: '<script>alert("xss")</script>Clean house', completed: false }
                        ]
                    }
                }
            },
            appState: { activeCycleId: 'cycle-1' }
        };

        const backupData = {
            schemaVersion: '2.5',
            miniCycleData: JSON.stringify(stateData)
        };

        const result = sanitizeImportedData(backupData);
        if (!result) throw new Error('Should return sanitized data');

        // Parse back the sanitized miniCycleData
        const sanitized = JSON.parse(result.miniCycleData);
        const task = sanitized.data.cycles['cycle-1'].tasks[0];
        if (task.text.includes('<script>')) {
            throw new Error('Task text should be sanitized');
        }
    });

    await test('sanitizeImportedData handles invalid input without crashing', () => {
        // An unrecognized shape ({}) matches no sanitize branch — it must return the object
        // WITHOUT throwing. The old test wrapped the call in try/catch and asserted nothing.
        const result = sanitizeImportedData({});
        if (result === undefined) throw new Error('should return the (untouched) input');
    });

    await test('sanitizeImportedData preserves valid task fields while sanitizing text', () => {
        // Must use the BACKUP shape {schemaVersion, miniCycleData}. The old test passed
        // Schema-2.5 STATE shape, which matches NO sanitize branch — so nothing ran and it
        // only asserted input == input (a tautology).
        const stateData = {
            data: { cycles: { 'cycle-1': { title: 'Test', tasks: [
                { id: 'task-1', text: '  Valid task  ', completed: true, priority: true }
            ] } } },
            appState: { activeCycleId: 'cycle-1' }
        };
        const backupData = { schemaVersion: '2.5', miniCycleData: JSON.stringify(stateData) };

        const result = sanitizeImportedData(backupData);
        const task = JSON.parse(result.miniCycleData).data.cycles['cycle-1'].tasks[0];

        // The injected sanitizeInput actually ran (mock strips tags + trims) → text is trimmed.
        if (task.text !== 'Valid task') throw new Error(`text should be sanitized/trimmed, got '${task.text}'`);
        // Non-text fields survive sanitization.
        if (task.id !== 'task-1') throw new Error('Task ID should be preserved');
        if (task.completed !== true) throw new Error('Completed status should be preserved');
        if (task.priority !== true) throw new Error('Priority should be preserved');
    });

    await test('sanitizeImportedData handles empty cycles gracefully', () => {
        const backupData = { schemaVersion: '2.5', miniCycleData: JSON.stringify({ data: { cycles: {} }, appState: {} }) };
        const result = sanitizeImportedData(backupData);
        // The Schema-2.5 branch runs with no cycles to sanitize; the payload round-trips intact.
        const sanitized = JSON.parse(result.miniCycleData);
        if (!sanitized.data || typeof sanitized.data.cycles !== 'object') {
            throw new Error('empty-cycles payload should round-trip through sanitization');
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
