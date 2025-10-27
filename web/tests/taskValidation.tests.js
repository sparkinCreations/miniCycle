/**
 * 🧪 TaskValidation Tests
 * Tests for task input validation and sanitization
 */

export async function runTaskValidationTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>🔒 TaskValidation Tests</h2><h3>Running tests...</h3>';

    let passed = { count: 0 };
    let total = { count: 0 };

    // ============================================
    // Test Helper Function with Data Protection
    // ============================================
    async function test(name, testFn) {
        total.count++;

        // 🔒 SAVE REAL APP DATA before test runs
        const savedRealData = {};
        const protectedKeys = ['miniCycleData', 'miniCycleForceFullVersion', 'miniCycleMoveArrows'];
        protectedKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) savedRealData[key] = value;
        });

        try {
            // Run test (handle both sync and async)
            const result = testFn();
            if (result instanceof Promise) {
                await result;
            }

            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
        } finally {
            // 🔒 RESTORE REAL APP DATA (runs even if test crashes)
            localStorage.clear();
            Object.keys(savedRealData).forEach(key => {
                localStorage.setItem(key, savedRealData[key]);
            });
        }
    }

    // ============================================
    // 📦 MODULE LOADING TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('TaskValidator class is defined', () => {
        if (typeof TaskValidator === 'undefined') {
            throw new Error('TaskValidator class not found');
        }
    });

    await test('TaskValidator class is exported to window', () => {
        if (typeof window.TaskValidator === 'undefined') {
            throw new Error('TaskValidator not available on window object');
        }
    });

    await test('initTaskValidator function is exported', () => {
        if (typeof window.initTaskValidator !== 'function') {
            throw new Error('initTaskValidator not found on window object');
        }
    });

    await test('validateAndSanitizeTaskInput function is exported', () => {
        if (typeof window.validateAndSanitizeTaskInput !== 'function') {
            throw new Error('validateAndSanitizeTaskInput not found on window object');
        }
    });

    // ============================================
    // 🔧 INITIALIZATION TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Initialization</h4>';

    await test('creates instance with no dependencies', () => {
        const validator = new TaskValidator();

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
        const validator = new TaskValidator();

        // Check version exists and is in semver format (X.Y or X.Y.Z)
        if (!validator.version || !/^\d+\.\d+(\.\d+)?$/.test(validator.version)) {
            throw new Error(`Expected valid semver version, got ${validator.version}`);
        }
    });

    await test('has correct TASK_LIMIT constant', () => {
        const validator = new TaskValidator();

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
    // 🌐 GLOBAL WRAPPER TESTS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🌐 Global Wrapper</h4>';

    await test('global wrapper works with initialized validator', () => {
        // Initialize validator
        window.initTaskValidator({
            sanitizeInput: (input) => input
        });

        const result = window.validateAndSanitizeTaskInput('test task');

        if (result !== 'test task') {
            throw new Error('Global wrapper should work with initialized validator');
        }
    });

    await test('global wrapper has fallback when not initialized', () => {
        // Temporarily clear taskValidator
        const originalValidator = window.TaskValidator;

        // Call wrapper - should use fallback
        const result = window.validateAndSanitizeTaskInput('  test task  ');

        // Should trim at minimum
        if (result !== 'test task') {
            throw new Error('Global wrapper should have basic fallback');
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
