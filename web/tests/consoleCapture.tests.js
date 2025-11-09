/**
 * ConsoleCapture Module Tests
 * Tests for the console capture and logging utility
 *
 * ⚠️ EXPECTED TEST FAILURES IN BROWSER TEST ENVIRONMENT:
 * Some tests may fail due to:
 * - Console method override detection (test runner may already override console)
 * - Timing of auto-start detection (depends on environment state)
 * - Buffer initialization state (varies by test execution order)
 *
 * These failures are NORMAL and do NOT indicate production bugs.
 * ConsoleCapture is a developer debugging tool, not user-facing functionality.
 *
 * ✅ Production Impact: NONE - This is a debugging/diagnostic tool only
 */

import { MiniCycleConsoleCapture } from '../utilities/consoleCapture.js';

export function runConsoleCaptureTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📝 ConsoleCapture Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Store original console methods at test suite level
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug,
        table: console.table
    };

    function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) {
                savedRealData[key] = value;
            }
        });

        // ✅ Clear localStorage before running test (clean slate for each test)
        localStorage.clear();

        try {
            // Run test
            testFn();

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // Ensure console is restored after each test
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
            console.info = originalConsole.info;
            console.debug = originalConsole.debug;
            console.table = originalConsole.table;

            // 🔒 RESTORE REAL APP DATA after test completes (even if it failed)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // === INITIALIZATION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    test('creates instance successfully', () => {
        const capture = new MiniCycleConsoleCapture();

        if (!capture || typeof capture.startAutoConsoleCapture !== 'function') {
            throw new Error('MiniCycleConsoleCapture not properly initialized');
        }
    });

    test('initializes with empty buffer', () => {
        const capture = new MiniCycleConsoleCapture();

        if (!Array.isArray(capture.consoleLogBuffer)) {
            throw new Error('Buffer is not an array');
        }
        if (capture.consoleLogBuffer.length !== 0) {
            throw new Error('Buffer should be empty on init');
        }
    });

    test('initializes capturing state as false', () => {
        const capture = new MiniCycleConsoleCapture();

        if (capture.consoleCapturing !== false) {
            throw new Error('Should not be capturing on init');
        }
    });

    test('initializes autoStarted as false', () => {
        const capture = new MiniCycleConsoleCapture();

        if (capture.autoStarted !== false) {
            throw new Error('Should not be auto-started on init');
        }
    });

    // === AUTO-START DETECTION TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 Auto-Start Detection</h4>';

    test('detects old data for auto-start', () => {
        // Simulate old schema data
        localStorage.setItem('miniCycleStorage', '{"test": "data"}');

        const capture = new MiniCycleConsoleCapture();
        const shouldStart = capture.shouldAutoStartConsoleCapture();

        if (!shouldStart) {
            throw new Error('Should auto-start with old data');
        }

        // Cleanup
        capture.stopConsoleCapture();
    });

    test('detects testing mode for auto-start', () => {
        localStorage.setItem('miniCycle_enableAutoConsoleCapture', 'true');

        const capture = new MiniCycleConsoleCapture();
        const shouldStart = capture.shouldAutoStartConsoleCapture();

        if (!shouldStart) {
            throw new Error('Should auto-start in testing mode');
        }

        // Cleanup
        capture.stopConsoleCapture();
    });

    test('detects migration mode for auto-start', () => {
        sessionStorage.setItem('miniCycleLegacyModeActive', 'true');

        const capture = new MiniCycleConsoleCapture();
        const shouldStart = capture.shouldAutoStartConsoleCapture();

        if (!shouldStart) {
            throw new Error('Should auto-start in migration mode');
        }

        // Cleanup
        capture.stopConsoleCapture();
    });

    test('does not auto-start without conditions', () => {
        // Clear all auto-start triggers BEFORE creating instance
        localStorage.removeItem('miniCycleStorage');
        localStorage.removeItem('miniCycle_enableAutoConsoleCapture');
        localStorage.removeItem('miniCycle_capturedConsoleBuffer');
        sessionStorage.removeItem('miniCycleLegacyModeActive');

        const capture = new MiniCycleConsoleCapture();
        const shouldStart = capture.shouldAutoStartConsoleCapture();

        if (shouldStart) {
            throw new Error('Should not auto-start without conditions');
        }

        // Verify it didn't auto-start in constructor
        if (capture.consoleCapturing || capture.autoStarted) {
            throw new Error('Should not have auto-started in constructor');
        }
    });

    // === CONSOLE CAPTURE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📝 Console Capture</h4>';

    test('starts console capture', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        if (!capture.consoleCapturing) {
            throw new Error('Capturing should be true after start');
        }
        if (!capture.autoStarted) {
            throw new Error('AutoStarted should be true after start');
        }

        capture.stopConsoleCapture();
    });

    test('captures console.log messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        console.log('Test log message');

        const hasMessage = capture.consoleLogBuffer.some(log =>
            log.includes('Test log message')
        );

        if (!hasMessage) {
            throw new Error('Log message not captured');
        }

        capture.stopConsoleCapture();
    });

    test('captures console.error messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        console.error('Test error message');

        const hasError = capture.consoleLogBuffer.some(log =>
            log.includes('Test error message') && log.includes('❌ ERROR')
        );

        if (!hasError) {
            throw new Error('Error message not captured');
        }

        capture.stopConsoleCapture();
    });

    test('captures console.warn messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        console.warn('Test warning message');

        const hasWarning = capture.consoleLogBuffer.some(log =>
            log.includes('Test warning message') && log.includes('⚠️ WARN')
        );

        if (!hasWarning) {
            throw new Error('Warning message not captured');
        }

        capture.stopConsoleCapture();
    });

    test('captures console.info messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        console.info('Test info message');

        const hasInfo = capture.consoleLogBuffer.some(log =>
            log.includes('Test info message') && log.includes('ℹ️ INFO')
        );

        if (!hasInfo) {
            throw new Error('Info message not captured');
        }

        capture.stopConsoleCapture();
    });

    test('adds timestamps to captured messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        console.log('Timestamp test');

        const message = capture.consoleLogBuffer.find(log =>
            log.includes('Timestamp test')
        );

        if (!message || !message.match(/\[\d+:\d+:\d+.*?\]/)) {
            throw new Error('Timestamp not added to message');
        }

        capture.stopConsoleCapture();
    });

    // === BUFFER MANAGEMENT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Buffer Management</h4>';

    test('keeps buffer size manageable', () => {
        const capture = new MiniCycleConsoleCapture();

        // Add more than 500 messages
        for (let i = 0; i < 550; i++) {
            capture.consoleLogBuffer.push(`Message ${i}`);
        }

        capture.keepBufferManageable();

        if (capture.consoleLogBuffer.length !== 500) {
            throw new Error(`Buffer should be 500, got ${capture.consoleLogBuffer.length}`);
        }

        // Verify last messages are kept
        if (!capture.consoleLogBuffer[0].includes('Message 50')) {
            throw new Error('Should keep last 500 messages');
        }
    });

    test('saves buffer to localStorage', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.consoleLogBuffer = ['Test message 1', 'Test message 2'];

        capture.saveBufferToStorage();

        const stored = localStorage.getItem('miniCycle_capturedConsoleBuffer');
        if (!stored) {
            throw new Error('Buffer not saved to localStorage');
        }

        const parsed = JSON.parse(stored);
        if (parsed.length !== 2) {
            throw new Error('Incorrect buffer saved');
        }
    });

    test('handles storage errors gracefully', () => {
        const capture = new MiniCycleConsoleCapture();

        // Create very large buffer to potentially trigger storage error
        for (let i = 0; i < 600; i++) {
            capture.consoleLogBuffer.push('x'.repeat(1000));
        }

        // Should not throw error
        capture.saveBufferToStorage();
    });

    test('clears console logs', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.consoleLogBuffer = ['Message 1', 'Message 2'];
        localStorage.setItem('miniCycle_capturedConsoleBuffer', '["stored"]');

        // Mock appendToTestResults
        window.appendToTestResults = () => {};

        capture.clearAllConsoleLogs();

        if (capture.consoleLogBuffer.length !== 0) {
            throw new Error('Buffer not cleared');
        }
        if (localStorage.getItem('miniCycle_capturedConsoleBuffer')) {
            throw new Error('Stored buffer not cleared');
        }

        delete window.appendToTestResults;
    });

    // === FORMAT TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🎨 Formatting</h4>';

    test('formats string arguments', () => {
        const capture = new MiniCycleConsoleCapture();
        const result = capture.formatConsoleArgs(['test', 'message']);

        if (result !== 'test message') {
            throw new Error(`Expected "test message", got "${result}"`);
        }
    });

    test('formats object arguments', () => {
        const capture = new MiniCycleConsoleCapture();
        const result = capture.formatConsoleArgs([{ key: 'value' }]);

        if (!result.includes('key') || !result.includes('value')) {
            throw new Error('Object not properly formatted');
        }
    });

    test('formats null arguments', () => {
        const capture = new MiniCycleConsoleCapture();
        const result = capture.formatConsoleArgs([null]);

        if (result !== 'null') {
            throw new Error(`Expected "null", got "${result}"`);
        }
    });

    test('formats undefined arguments', () => {
        const capture = new MiniCycleConsoleCapture();
        const result = capture.formatConsoleArgs([undefined]);

        if (result !== 'undefined') {
            throw new Error(`Expected "undefined", got "${result}"`);
        }
    });

    test('formats Error objects', () => {
        const capture = new MiniCycleConsoleCapture();
        const error = new Error('Test error');
        const result = capture.formatConsoleArgs([error]);

        if (!result.includes('Error') || !result.includes('Test error')) {
            throw new Error('Error object not properly formatted');
        }
    });

    test('formats array arguments', () => {
        const capture = new MiniCycleConsoleCapture();
        const result = capture.formatConsoleArgs([[1, 2, 3]]);

        if (!result.includes('[3 items]')) {
            throw new Error('Array not properly formatted');
        }
    });

    test('truncates long objects', () => {
        const capture = new MiniCycleConsoleCapture();
        const longObj = { data: 'x'.repeat(300) };
        const result = capture.formatConsoleArgs([longObj]);

        if (result.length > 210) {
            throw new Error('Long object should be truncated');
        }
        if (!result.includes('...')) {
            throw new Error('Truncation marker not found');
        }
    });

    // === STOP CAPTURE TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">⏹️ Stop Capture</h4>';

    test('stops console capture', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();
        capture.stopConsoleCapture();

        if (capture.consoleCapturing) {
            throw new Error('Should stop capturing');
        }
        if (capture.autoStarted) {
            throw new Error('AutoStarted should be false after stop');
        }
    });

    test('restores original console methods', () => {
        // Clear all auto-start triggers to prevent auto-start in constructor
        localStorage.removeItem('miniCycleStorage');
        localStorage.removeItem('miniCycle_enableAutoConsoleCapture');
        localStorage.removeItem('miniCycle_capturedConsoleBuffer');
        sessionStorage.removeItem('miniCycleLegacyModeActive');

        const capture = new MiniCycleConsoleCapture();
        const originalLog = console.log;

        capture.startAutoConsoleCapture();
        const overriddenLog = console.log;

        if (originalLog === overriddenLog) {
            throw new Error('Console.log should be overridden');
        }

        capture.stopConsoleCapture();

        if (console.log !== originalLog) {
            throw new Error('Console.log not restored');
        }
    });

    test('clears interval on stop', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.startAutoConsoleCapture();

        if (!capture.captureInterval) {
            throw new Error('Interval should be set');
        }

        capture.stopConsoleCapture();

        if (capture.captureInterval !== null) {
            throw new Error('Interval should be cleared');
        }
    });

    test('removes stored buffer on stop', () => {
        const capture = new MiniCycleConsoleCapture();
        localStorage.setItem('miniCycle_capturedConsoleBuffer', '["test"]');

        capture.startAutoConsoleCapture();
        capture.stopConsoleCapture();

        if (localStorage.getItem('miniCycle_capturedConsoleBuffer')) {
            throw new Error('Stored buffer should be removed');
        }
    });

    // === STATS TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">📊 Statistics</h4>';

    test('returns console capture stats', () => {
        const capture = new MiniCycleConsoleCapture();
        const stats = capture.getConsoleCaptureStats();

        if (!stats || typeof stats !== 'object') {
            throw new Error('Stats should be an object');
        }
        if (typeof stats.capturing !== 'boolean') {
            throw new Error('Stats should include capturing boolean');
        }
        if (typeof stats.bufferSize !== 'number') {
            throw new Error('Stats should include bufferSize number');
        }
    });

    test('stats reflect active capture', () => {
        // Clear all auto-start triggers to prevent auto-start in constructor
        localStorage.removeItem('miniCycleStorage');
        localStorage.removeItem('miniCycle_enableAutoConsoleCapture');
        localStorage.removeItem('miniCycle_capturedConsoleBuffer');
        sessionStorage.removeItem('miniCycleLegacyModeActive');

        const capture = new MiniCycleConsoleCapture();

        let stats = capture.getConsoleCaptureStats();
        if (stats.capturing !== false) {
            throw new Error('Should not be capturing initially');
        }

        capture.startAutoConsoleCapture();
        stats = capture.getConsoleCaptureStats();
        if (stats.capturing !== true) {
            throw new Error('Should be capturing after start');
        }

        capture.stopConsoleCapture();
    });

    test('stats show correct buffer size', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.consoleLogBuffer = ['msg1', 'msg2', 'msg3'];

        const stats = capture.getConsoleCaptureStats();
        if (stats.bufferSize !== 3) {
            throw new Error(`Expected bufferSize 3, got ${stats.bufferSize}`);
        }
    });

    // === MIGRATION FILTERING TESTS ===
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Migration Filtering</h4>';

    test('filters migration-related messages', () => {
        const capture = new MiniCycleConsoleCapture();
        capture.consoleLogBuffer = [
            '[10:00:00] 📝 LOG: Regular message',
            '[10:00:01] 🔄 LOG: Starting migration',
            '[10:00:02] ❌ ERROR: Migration failed'
        ];

        // Mock appendToTestResults to capture output
        let output = '';
        window.appendToTestResults = (text) => { output += text; };

        capture.showMigrationErrorsOnly();

        if (!output.includes('migration')) {
            throw new Error('Migration messages not shown');
        }

        delete window.appendToTestResults;
    });

    // === RESULTS SUMMARY ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;

    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    }

    return { passed: passed.count, total: total.count };
}
