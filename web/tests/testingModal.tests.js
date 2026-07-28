/**
 * Testing Modal Tests
 *
 * Tests for the REAL testing-modal module functions in modules/testing/*:
 * - Core: escapeHtml, appendToTestResults / clearTestResults
 * - Diagnostics: checkDataIntegrity, validateSchema, showAppInfo, showStorageInfo
 * - Debug: getServiceWorkerInfo
 *
 * History: this suite previously re-implemented the integrity/repair/debug-report
 * logic INLINE inside each test and asserted its own copy (and asserted a mock
 * BackupManager returned what the mock defined) — it never loaded modules/testing/*,
 * so it proved nothing about the product. It now drives the real functions and asserts
 * their real output, so a regression in the testing modal would actually fail here.
 */

export async function runTestingModalTests(resultsDiv, isPartOfSuite = false) {
    resultsDiv.innerHTML = '<h2>Testing Modal Tests</h2><h3>Loading real modules...</h3>';
    let passed = { count: 0 }, total = { count: 0 };

    // --- Load the REAL testing-modal modules under test -------------------------
    // NOTE: import WITHOUT a ?v= cache-buster. The diagnostics/debug sub-modules import
    // testing-modal-core.js unversioned (`from './testing-modal-core.js'`), so a
    // cache-busted core here would be a DIFFERENT instance than the one they read —
    // our setTestingModalCoreDependencies() would wire deps the sub-modules never see.
    let core, diagnostics, debug;
    try {
        core = await import('../modules/testing/testing-modal-core.js');
        diagnostics = await import('../modules/testing/testing-modal-diagnostics.js');
        debug = await import('../modules/testing/testing-modal-debug.js');
    } catch (e) {
        resultsDiv.innerHTML = `<h2>Testing Modal Tests</h2><div class="result fail">Failed to import modules/testing/*: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    const { escapeHtml, appendToTestResults, clearTestResults, setTestingModalCoreDependencies } = core;
    const { checkDataIntegrity, validateSchema, showAppInfo, showStorageInfo } = diagnostics;
    const { getServiceWorkerInfo } = debug;

    // DOM_IDS.TESTING_OUTPUT === 'testing-output' — the element the modules write into.
    const OUTPUT_ID = 'testing-output';

    // Configurable mock AppState — tests swap `mockState` to exercise integrity branches.
    function cleanState() {
        return {
            metadata: { version: '2.5-test', schemaVersion: '2.5', lastModified: Date.now() },
            data: {
                cycles: {
                    'test-cycle': {
                        title: 'Test Routine',
                        schemaVersion: 2.5,
                        tasks: [
                            { id: 't1', text: 'Task one', completed: false },
                            { id: 't2', text: 'Task two', completed: true }
                        ]
                    }
                }
            },
            appState: { activeCycleId: 'test-cycle' },
            settings: {}
        };
    }
    let mockState = cleanState();
    const mockAppState = {
        isReady: () => true,
        get: () => mockState,
        update: (fn) => fn(mockState)
    };

    // Wire the real core deps once (sub-modules read AppState via getDeps()).
    setTestingModalCoreDependencies({
        AppState: mockAppState,
        showNotification: () => {},
        notifications: null
    });

    // Ensure the output element exists; track whether we created it so cleanup is exact.
    let createdOutput = false;
    function ensureOutput() {
        let el = document.getElementById(OUTPUT_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = OUTPUT_ID;
            document.body.appendChild(el);
            createdOutput = true;
        }
        el.textContent = '';
        return el;
    }
    function outputText() {
        return document.getElementById(OUTPUT_ID)?.textContent || '';
    }

    async function test(name, testFn) {
        total.count++;
        try {
            mockState = cleanState();  // reset per test
            ensureOutput();
            await testFn();
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        }
    }

    resultsDiv.innerHTML = '<h2>Testing Modal Tests</h2><h3>Running tests...</h3>';

    // =====================================================
    // Core: escapeHtml (pure)
    // =====================================================
    resultsDiv.innerHTML += '<h4>🔒 escapeHtml (XSS-safe)</h4>';

    await test('escapeHtml neutralizes angle brackets', () => {
        if (escapeHtml('<script>alert(1)</script>') !== '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;') {
            throw new Error(`got "${escapeHtml('<script>alert(1)</script>')}"`);
        }
    });

    await test('escapeHtml escapes ampersand, quotes, apostrophe and slash', () => {
        if (escapeHtml('a & b') !== 'a &amp; b') throw new Error('& not escaped');
        if (escapeHtml('say "hi"') !== 'say &quot;hi&quot;') throw new Error('double quote not escaped');
        if (escapeHtml("it's") !== 'it&#x27;s') throw new Error('apostrophe not escaped');
        if (escapeHtml('a/b') !== 'a&#x2F;b') throw new Error('slash not escaped');
    });

    await test('escapeHtml returns non-strings unchanged', () => {
        if (escapeHtml(42) !== 42) throw new Error('number should pass through');
        if (escapeHtml(null) !== null) throw new Error('null should pass through');
    });

    // =====================================================
    // Core: appendToTestResults / clearTestResults (DOM contract)
    // =====================================================
    resultsDiv.innerHTML += '<h4>📝 Results Output</h4>';

    await test('appendToTestResults concatenates into the output element', () => {
        appendToTestResults('line-a\n');
        appendToTestResults('line-b\n');
        const text = outputText();
        if (!text.includes('line-a') || !text.includes('line-b')) throw new Error(`missing appended text: "${text}"`);
        if (text.indexOf('line-a') > text.indexOf('line-b')) throw new Error('append order should be preserved');
    });

    await test('clearTestResults empties the output element', () => {
        appendToTestResults('something\n');
        if (outputText() === '') throw new Error('precondition: output should be non-empty');
        clearTestResults();
        if (outputText() !== '') throw new Error('clearTestResults should empty the output');
    });

    // =====================================================
    // Diagnostics: checkDataIntegrity (real, async — setTimeout 1000ms)
    // =====================================================
    resultsDiv.innerHTML += '<h4>🔍 checkDataIntegrity</h4>';

    await test('checkDataIntegrity reports PASSED for a valid Schema 2.5 state', async () => {
        checkDataIntegrity();
        await new Promise(r => setTimeout(r, 1200));
        if (!outputText().includes('PASSED')) throw new Error(`expected PASSED, got: "${outputText()}"`);
    });

    await test('checkDataIntegrity detects a task with a missing id', async () => {
        delete mockState.data.cycles['test-cycle'].tasks[0].id;
        checkDataIntegrity();
        await new Promise(r => setTimeout(r, 1200));
        if (!outputText().includes('Missing task ID')) throw new Error(`expected "Missing task ID", got: "${outputText()}"`);
    });

    await test('checkDataIntegrity detects a cycle with a missing title', async () => {
        delete mockState.data.cycles['test-cycle'].title;
        checkDataIntegrity();
        await new Promise(r => setTimeout(r, 1200));
        if (!outputText().includes('Missing title')) throw new Error(`expected "Missing title", got: "${outputText()}"`);
    });

    await test('checkDataIntegrity detects a cycle whose tasks is not an array', async () => {
        mockState.data.cycles['test-cycle'].tasks = 'not-an-array';
        checkDataIntegrity();
        await new Promise(r => setTimeout(r, 1200));
        if (!outputText().includes('not an array')) throw new Error(`expected "not an array", got: "${outputText()}"`);
    });

    // =====================================================
    // Diagnostics: validateSchema (real, async — setTimeout 800ms)
    // =====================================================
    resultsDiv.innerHTML += '<h4>🧬 validateSchema</h4>';

    await test('validateSchema reports the analysis with the real task total', async () => {
        validateSchema();
        await new Promise(r => setTimeout(r, 1000));
        const text = outputText();
        if (!text.includes('Schema Analysis')) throw new Error('expected Schema Analysis header');
        // cleanState has 2 tasks across 1 routine.
        if (!text.includes('Total Tasks: 2')) throw new Error(`expected 2 total tasks, got: "${text}"`);
        if (!text.includes('Total Routines: 1')) throw new Error('expected 1 routine');
    });

    await test('validateSchema flags cycles with an old per-cycle schemaVersion', async () => {
        mockState.data.cycles['test-cycle'].schemaVersion = 2.0;  // < 2.5 → needs migration
        validateSchema();
        await new Promise(r => setTimeout(r, 1000));
        if (!outputText().includes('Cycles needing migration: 1')) {
            throw new Error(`expected 1 cycle needing migration, got: "${outputText()}"`);
        }
    });

    // =====================================================
    // Diagnostics: showAppInfo / showStorageInfo (real, sync)
    // =====================================================
    resultsDiv.innerHTML += '<h4>ℹ️ Info Displays</h4>';

    await test('showAppInfo prints version + schema from metadata', () => {
        showAppInfo();
        const text = outputText();
        if (!text.includes('2.5-test')) throw new Error(`expected metadata version, got: "${text}"`);
        if (!text.includes('Schema Version: 2.5')) throw new Error('expected schema version line');
        if (!text.includes('miniCycle')) throw new Error('expected app name');
    });

    await test('showStorageInfo prints key count and usage', () => {
        showStorageInfo();
        const text = outputText();
        if (!text.includes('Available Keys:')) throw new Error('expected key count line');
        if (!text.includes('Storage Used:')) throw new Error('expected storage used line');
        if (!/Usage: [\d.]+%/.test(text)) throw new Error(`expected a usage percentage, got: "${text}"`);
    });

    // =====================================================
    // Debug: getServiceWorkerInfo (real, async — returns a promise)
    // =====================================================
    resultsDiv.innerHTML += '<h4>⚙️ getServiceWorkerInfo</h4>';

    await test('getServiceWorkerInfo resolves the documented info shape', async () => {
        const info = await getServiceWorkerInfo();
        if (!info || typeof info !== 'object') throw new Error('should resolve an object');
        if (typeof info.supported !== 'boolean') throw new Error('supported should be a boolean');
        if (typeof info.registered !== 'boolean') throw new Error('registered should be a boolean');
        // These keys are always present in the returned shape (null when unknown).
        for (const key of ['state', 'scope', 'version', 'scriptURL', 'updateAvailable', 'error']) {
            if (!(key in info)) throw new Error(`missing key: ${key}`);
        }
    });

    // --- Cleanup ---------------------------------------------------------------
    if (createdOutput) document.getElementById(OUTPUT_ID)?.remove();

    // === RESULTS ===
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">🎉 All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
