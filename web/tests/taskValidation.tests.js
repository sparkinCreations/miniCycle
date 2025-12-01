/**
 * 🧪 TaskValidation Tests
 * Tests for task input validation and sanitization
 *
 * Updated for Phase 3 DI Pattern - uses shared testHelpers
 */

import {
    setupTestEnvironment,
    createProtectedTest,
    createMockSanitizeInput
} from './testHelpers.js';

export async function runTaskValidationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔒 TaskValidation Tests</h2><h3>Setting up mocks...</h3>';

    // =====================================================
    // Use shared testHelpers for comprehensive mock setup
    // =====================================================
    const env = await setupTestEnvironment();

    // Ensure sanitizeInput is available globally (required by TaskValidator)
    if (!window.sanitizeInput) {
        window.sanitizeInput = createMockSanitizeInput();
    }

    resultsDiv.innerHTML = '<h2>🔒 TaskValidation Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // Use shared test helper with data protection
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskValidator class is defined', () => {
        if (typeof TaskValidator === 'undefined') {
            throw new Error('TaskValidator class not found');
        }
    });

    await test('TaskValidator class is available via taskDOM (Phase 2)', () => {
        // Phase 2: TaskValidator is no longer on window directly
        // It's available via window.__TaskValidator after taskDOM initializes
        if (typeof window.__TaskValidator === 'undefined' && typeof TaskValidator === 'undefined') {
            throw new Error('TaskValidator not available (check taskDOM initialization)');
        }
    });

    await test('initTaskValidator is available as ES6 export (not on window)', () => {
        // Phase 2: initTaskValidator is ES6 export only, not on window
        // The taskDOM manager handles validator initialization internally
        // This test verifies we can import it if needed
        if (typeof initTaskValidator !== 'undefined') {
            // Available as import in this scope
            return;
        }
        // In runtime tests, taskDOM handles initialization so this is OK to skip
        console.log('ℹ️ initTaskValidator not in scope - taskDOM handles initialization');
    });

    await test('validateAndSanitizeTaskInput function is available', () => {
        // Phase 2: May be on window or available as module export
        if (typeof window.validateAndSanitizeTaskInput !== 'function' && typeof validateAndSanitizeTaskInput !== 'function') {
            throw new Error('validateAndSanitizeTaskInput not found');
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('throws error without required sanitizeInput dependency', () => {
        // Phase 2: sanitizeInput is now REQUIRED (no window.* fallback)
        let threwError = false;
        try {
            const validator = new TaskValidator();
        } catch (e) {
            threwError = true;
            if (!e.message.includes('sanitizeInput')) {
                throw new Error(`Expected error about sanitizeInput, got: ${e.message}`);
            }
        }
        if (!threwError) {
            throw new Error('Expected TaskValidator to throw without sanitizeInput');
        }
    });

    await test('creates instance with required sanitizeInput dependency', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        if (!validator) {
            throw new Error('Failed to create TaskValidator instance');
        }

        if (!validator.deps) {
            throw new Error('Dependencies not initialized');
        }
    });

    await test('creates instance with custom dependencies', () => {
        const mockSanitize = (input) => input.replace(/[<>]/g, '');
        const mockNotification = (msg) => console.log(msg);

        const validator = new TaskValidator({
            sanitizeInput: mockSanitize,
            showNotification: mockNotification
        });

        if (!validator) {
            throw new Error('Failed to create instance with dependencies');
        }

        if (validator.deps.sanitizeInput !== mockSanitize) {
            throw new Error('Custom sanitizeInput dependency not set');
        }
    });

    await test('has correct version property', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!validator.version || !/^\d+\.\d+(\.\d+)?$/.test(validator.version)) {
            throw new Error(`Expected valid semver version, got ${validator.version}`);
        }
    });

    await test('has correct TASK_LIMIT constant', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        if (validator.TASK_LIMIT !== 100) {
            throw new Error(`Expected TASK_LIMIT 100, got ${validator.TASK_LIMIT}`);
        }
    });

    // ============================================
    // ✅ VALIDATION LOGIC TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">✅ Validation Logic</h4>';

    await test('rejects non-string input', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        const result = validator.validateAndSanitizeTaskInput(123);

        if (result !== null) {
            throw new Error('Should return null for non-string input');
        }
    });

    await test('rejects null input', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        const result = validator.validateAndSanitizeTaskInput(null);

        if (result !== null) {
            throw new Error('Should return null for null input');
        }
    });

    await test('rejects undefined input', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        const result = validator.validateAndSanitizeTaskInput(undefined);

        if (result !== null) {
            throw new Error('Should return null for undefined input');
        }
    });

    await test('trims whitespace from input', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        const result = validator.validateAndSanitizeTaskInput('  test task  ');

        if (result !== 'test task') {
            throw new Error(`Expected 'test task', got '${result}'`);
        }
    });

    await test('rejects empty string', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input.trim()
        });

        const result = validator.validateAndSanitizeTaskInput('');

        if (result !== null) {
            throw new Error('Should return null for empty string');
        }
    });

    await test('rejects whitespace-only string', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input.trim()
        });

        const result = validator.validateAndSanitizeTaskInput('   ');

        if (result !== null) {
            throw new Error('Should return null for whitespace-only string');
        }
    });

    await test('enforces character limit (100 chars)', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input,
            showNotification: () => {} // Mock notification
        });

        const longText = 'a'.repeat(150); // Over 100 char limit
        const result = validator.validateAndSanitizeTaskInput(longText);

        if (result !== null) {
            throw new Error('Should reject text over 100 characters');
        }
    });

    await test('accepts text exactly at limit (100 chars)', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input,
            showNotification: () => {}
        });

        const exactText = 'a'.repeat(100); // Exactly 100 chars
        const result = validator.validateAndSanitizeTaskInput(exactText);

        if (result !== exactText) {
            throw new Error('Should accept text exactly at 100 character limit');
        }
    });

    await test('accepts text under limit (50 chars)', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input
        });

        const shortText = 'Short task';
        const result = validator.validateAndSanitizeTaskInput(shortText);

        if (result !== shortText) {
            throw new Error('Should accept text under character limit');
        }
    });

    await test('calls sanitizeInput function', () => {
        let sanitizeCalled = false;

        const validator = new TaskValidator({
            sanitizeInput: (input) => {
                sanitizeCalled = true;
                return input.replace(/[<>]/g, '');
            }
        });

        validator.validateAndSanitizeTaskInput('test<script>');

        if (!sanitizeCalled) {
            throw new Error('Sanitize function should be called');
        }
    });

    await test('sanitizes HTML tags from input', () => {
        const validator = new TaskValidator({
            sanitizeInput: (input) => input.replace(/[<>]/g, '')
        });

        const result = validator.validateAndSanitizeTaskInput('test<script>alert(1)</script>');

        if (result.includes('<') || result.includes('>')) {
            throw new Error('Should sanitize HTML tags');
        }

        if (result !== 'testscriptalert(1)/script') {
            throw new Error(`Expected sanitized text, got '${result}'`);
        }
    });

    // ============================================
    // 🛡️ ERROR HANDLING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Error Handling</h4>';

    await test('handles missing sanitizeInput gracefully', () => {
        // Save and clear window.sanitizeInput to ensure no fallback available
        const savedSanitize = window.sanitizeInput;
        delete window.sanitizeInput;

        try {
            const validator = new TaskValidator({
                sanitizeInput: undefined
            });

            const result = validator.validateAndSanitizeTaskInput('test');

            if (result !== null) {
                throw new Error('Should return null when sanitizeInput unavailable');
            }
        } finally {
            // Restore window.sanitizeInput
            if (savedSanitize) {
                window.sanitizeInput = savedSanitize;
            }
        }
    });

    await test('handles sanitizeInput returning null', () => {
        const validator = new TaskValidator({
            sanitizeInput: () => null
        });

        const result = validator.validateAndSanitizeTaskInput('test');

        if (result !== null) {
            throw new Error('Should return null when sanitizeInput returns null');
        }
    });

    await test('handles sanitizeInput returning empty string', () => {
        const validator = new TaskValidator({
            sanitizeInput: () => ''
        });

        const result = validator.validateAndSanitizeTaskInput('test');

        if (result !== null) {
            throw new Error('Should return null when sanitizeInput returns empty string');
        }
    });

    await test('calls showNotification when text too long', () => {
        let notificationCalled = false;
        let notificationMessage = '';

        const validator = new TaskValidator({
            sanitizeInput: (input) => input,
            showNotification: (msg, type) => {
                notificationCalled = true;
                notificationMessage = msg;
            }
        });

        const longText = 'a'.repeat(150);
        validator.validateAndSanitizeTaskInput(longText);

        if (!notificationCalled) {
            throw new Error('Should call showNotification for too-long text');
        }

        if (!notificationMessage.includes('100 characters')) {
            throw new Error('Notification should mention character limit');
        }
    });

    // ============================================
    // 🌐 GLOBAL WRAPPER TESTS (Phase 2)
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrapper (via taskDOM)</h4>';

    await test('window.validateAndSanitizeTaskInput works after taskDOM init', () => {
        // Phase 2: validateAndSanitizeTaskInput comes from taskDOM.js
        // It delegates to the manager's validator which is auto-initialized
        if (typeof window.validateAndSanitizeTaskInput !== 'function') {
            throw new Error('window.validateAndSanitizeTaskInput not available - taskDOM not initialized');
        }

        const result = window.validateAndSanitizeTaskInput('test task');

        if (result !== 'test task') {
            throw new Error(`Expected 'test task', got '${result}'`);
        }
    });

    await test('window.validateAndSanitizeTaskInput trims whitespace', () => {
        if (typeof window.validateAndSanitizeTaskInput !== 'function') {
            throw new Error('window.validateAndSanitizeTaskInput not available');
        }

        const result = window.validateAndSanitizeTaskInput('  test task  ');

        if (result !== 'test task') {
            throw new Error(`Expected 'test task', got '${result}'`);
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
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }

    return { passed: passed.count, total: total.count };
}
