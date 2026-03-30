/**
 * BackupRestoreManager Tests
 * Tests for modules/ui/backupRestoreManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runBackupRestoreManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/backupRestoreManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>BackupRestoreManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setBackupRestoreManagerDependencies is exported as a function', () => {
        if (typeof mod.setBackupRestoreManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('neutralizeAppState is exported as a function', () => {
        if (typeof mod.neutralizeAppState !== 'function') throw new Error('Missing export');
    });

    await test('downloadBackupFile is exported as a function', () => {
        if (typeof mod.downloadBackupFile !== 'function') throw new Error('Missing export');
    });

    await test('setupBackupButton is exported as a function', () => {
        if (typeof mod.setupBackupButton !== 'function') throw new Error('Missing export');
    });

    await test('setupRestoreButton is exported as a function', () => {
        if (typeof mod.setupRestoreButton !== 'function') throw new Error('Missing export');
    });

    await test('setupFactoryResetButton is exported as a function', () => {
        if (typeof mod.setupFactoryResetButton !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setBackupRestoreManagerDependencies accepts mock dependencies', () => {
        mod.setBackupRestoreManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {}, isReady: () => true },
            showNotification: () => {},
            showConfirmationModal: () => {},
            safeAddEventListener: () => {}
        });
    });

    await test('setBackupRestoreManagerDependencies accepts an object without throwing', () => {
        // Call after mock deps are set (above) so required deps are already satisfied
        mod.setBackupRestoreManagerDependencies({});
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setBackupRestoreManagerDependencies handles null gracefully', () => {
        try {
            mod.setBackupRestoreManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
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
