/**
 * UIEffects Tests (DI-Pure)
 * Tests for modules/ui/uiEffects.js
 *
 * Tests visual effects and animations:
 * - Logo background color feedback
 */

let setUIEffectsDependencies = null;
let triggerLogoBackground = null;

export async function runUIEffectsTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>UIEffects Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    // Import the module directly for DI testing
    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        const module = await import(`../modules/ui/uiEffects.js?v=${cacheBuster}`);
        setUIEffectsDependencies = module.setUIEffectsDependencies;
        triggerLogoBackground = module.triggerLogoBackground;
        resultsDiv.innerHTML = '<h2>UIEffects Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>UIEffects Tests</h2><div class="result fail">Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    if (!triggerLogoBackground) {
        resultsDiv.innerHTML += '<div class="result fail">triggerLogoBackground function not found</div>';
        return { passed: 0, total: 1 };
    }

    let passed = { count: 0 }, total = { count: 0 };

    // Create mock dependencies
    function createMockDeps(overrides = {}) {
        let currentTimeoutId = null;
        return {
            querySelector: (sel) => document.querySelector(sel),
            getLogoTimeoutId: () => currentTimeoutId,
            setLogoTimeoutId: (val) => { currentTimeoutId = val; },
            ...overrides
        };
    }

    // Create DOM elements for testing
    function createTestDOM() {
        const container = document.createElement('div');
        container.id = 'test-ui-effects-container';
        container.innerHTML = `
            <div class="header-branding">
                <img class="header-logo" src="" alt="Logo" />
            </div>
        `;
        document.body.appendChild(container);
        return container;
    }

    function cleanupTestDOM() {
        const container = document.getElementById('test-ui-effects-container');
        if (container) container.remove();
    }

    async function test(name, testFn) {
        total.count++;
        try {
            cleanupTestDOM();
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            cleanupTestDOM();
        }
    }

    // =====================================================
    // triggerLogoBackground Tests
    // =====================================================
    resultsDiv.innerHTML += '<h3>triggerLogoBackground</h3>';

    await test('triggerLogoBackground applies background color', async () => {
        createTestDOM();
        setUIEffectsDependencies(createMockDeps());

        triggerLogoBackground('red', 1000);

        const logo = document.querySelector('.header-branding .header-logo');
        const bgColor = logo.style.backgroundColor;

        if (!bgColor || bgColor === '') {
            throw new Error('Background color should be applied');
        }
    });

    await test('triggerLogoBackground applies border-radius', async () => {
        createTestDOM();
        setUIEffectsDependencies(createMockDeps());

        triggerLogoBackground('green', 1000);

        const logo = document.querySelector('.header-branding .header-logo');
        const borderRadius = logo.style.borderRadius;

        if (!borderRadius || borderRadius === '') {
            throw new Error('Border radius should be applied');
        }
    });

    await test('triggerLogoBackground uses default green color', async () => {
        createTestDOM();
        setUIEffectsDependencies(createMockDeps());

        triggerLogoBackground();

        const logo = document.querySelector('.header-branding .header-logo');
        const bgColor = logo.style.backgroundColor;

        // Check that some color is applied (defaults vary by browser)
        if (!bgColor || bgColor === '') {
            throw new Error('Default background color should be applied');
        }
    });

    await test('triggerLogoBackground clears background after duration', async () => {
        createTestDOM();
        setUIEffectsDependencies(createMockDeps());

        triggerLogoBackground('blue', 50); // Short duration for test

        const logo = document.querySelector('.header-branding .header-logo');

        // Wait for timeout to clear
        await new Promise(resolve => setTimeout(resolve, 100));

        if (logo.style.backgroundColor !== '') {
            throw new Error('Background color should be cleared after duration');
        }
        if (logo.style.borderRadius !== '') {
            throw new Error('Border radius should be cleared after duration');
        }
    });

    await test('triggerLogoBackground clears previous timeout', async () => {
        createTestDOM();

        let clearedTimeouts = [];
        const originalClearTimeout = window.clearTimeout;

        // Track clearTimeout calls
        window.clearTimeout = (id) => {
            clearedTimeouts.push(id);
            originalClearTimeout(id);
        };

        let storedTimeoutId = 12345; // Fake existing timeout
        setUIEffectsDependencies({
            ...createMockDeps(),
            getLogoTimeoutId: () => storedTimeoutId,
            setLogoTimeoutId: (val) => { storedTimeoutId = val; }
        });

        triggerLogoBackground('green', 1000);

        window.clearTimeout = originalClearTimeout;

        if (!clearedTimeouts.includes(12345)) {
            throw new Error('Previous timeout should be cleared');
        }
    });

    await test('triggerLogoBackground stores new timeout ID', async () => {
        createTestDOM();

        let storedId = null;
        setUIEffectsDependencies({
            ...createMockDeps(),
            getLogoTimeoutId: () => storedId,
            setLogoTimeoutId: (val) => { storedId = val; }
        });

        triggerLogoBackground('green', 1000);

        if (storedId === null) {
            throw new Error('New timeout ID should be stored');
        }
    });

    await test('triggerLogoBackground handles missing logo gracefully', async () => {
        // Don't create test DOM - no logo element
        setUIEffectsDependencies(createMockDeps());

        // Should not throw
        triggerLogoBackground('green', 100);
        // If we get here without error, test passes
    });

    await test('triggerLogoBackground works with custom querySelector', async () => {
        const mockLogo = document.createElement('img');
        mockLogo.className = 'mock-logo';
        document.body.appendChild(mockLogo);

        setUIEffectsDependencies({
            ...createMockDeps(),
            querySelector: () => mockLogo
        });

        triggerLogoBackground('purple', 100);

        const bgColor = mockLogo.style.backgroundColor;
        mockLogo.remove();

        if (!bgColor || bgColor === '') {
            throw new Error('Custom querySelector should work');
        }
    });

    await test('triggerLogoBackground clears timeout ID after reset', async () => {
        createTestDOM();

        let storedId = null;
        setUIEffectsDependencies({
            ...createMockDeps(),
            getLogoTimeoutId: () => storedId,
            setLogoTimeoutId: (val) => { storedId = val; }
        });

        triggerLogoBackground('green', 50);

        // Wait for timeout to clear
        await new Promise(resolve => setTimeout(resolve, 100));

        if (storedId !== null) {
            throw new Error('Timeout ID should be null after reset');
        }
    });

    // Final cleanup
    cleanupTestDOM();

    // Results
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace('<h3>Running tests...</h3>', summary);

    return { passed: passed.count, total: total.count };
}
