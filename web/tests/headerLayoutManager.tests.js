/**
 * HeaderLayoutManager Browser Tests (DI-Pure)
 * Test functions for module-test-suite.html
 *
 * Verifies the header-measurement contract that the responsive layout relies on:
 * the module publishes the live `.fixed-header-container` height to the
 * `--header-total-height` CSS variable (which #app-container padding and
 * #task-view centering consume), keeps it in sync, and tears down cleanly.
 *
 * Uses fixture elements (the test page has no real app header) so the
 * measurement logic is exercised deterministically without async ResizeObserver
 * timing in the core assertions.
 */

let initHeaderLayout = null;
let measureHeaderHeight = null;
let destroyHeaderLayout = null;
let HEADER_HEIGHT_VAR = null;

const HEADER_CLASS = 'fixed-header-container';

export async function runHeaderLayoutManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📐 HeaderLayoutManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        const module = await import(`../modules/ui/headerLayoutManager.js?v=${cacheBuster}`);
        initHeaderLayout = module.initHeaderLayout;
        measureHeaderHeight = module.measureHeaderHeight;
        destroyHeaderLayout = module.destroyHeaderLayout;
        HEADER_HEIGHT_VAR = module.HEADER_HEIGHT_VAR;
        resultsDiv.innerHTML = '<h2>📐 HeaderLayoutManager Tests (DI-Pure)</h2><h3>Running tests...</h3>';
    } catch (e) {
        resultsDiv.innerHTML = `<h2>📐 HeaderLayoutManager Tests</h2><div class="result fail">❌ Failed to import module: ${e.message}</div>`;
        return { passed: 0, total: 1 };
    }

    const passed = { count: 0 };
    const total = { count: 0 };

    // ---- helpers -----------------------------------------------------------

    function readVar() {
        return document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR).trim();
    }
    function clearVar() {
        document.documentElement.style.removeProperty(HEADER_HEIGHT_VAR);
    }
    function makeHeader(heightPx) {
        const el = document.createElement('div');
        el.className = HEADER_CLASS;
        // Absolute so it never disturbs the test-page flow; explicit box so
        // getBoundingClientRect().height is deterministic.
        el.style.cssText = `position:absolute;top:-9999px;left:0;width:100px;height:${heightPx}px;box-sizing:border-box;`;
        document.body.appendChild(el);
        return el;
    }
    function removeHeaders() {
        document.querySelectorAll(`.${HEADER_CLASS}`).forEach(el => el.remove());
    }

    async function test(name, testFn) {
        total.count++;
        try {
            const result = testFn();
            if (result instanceof Promise) await result;
            resultsDiv.innerHTML += `<div class="result pass">✅ ${name}</div>`;
            passed.count++;
        } catch (error) {
            resultsDiv.innerHTML += `<div class="result fail">❌ ${name}: ${error.message}</div>`;
            console.error(`Test failed: ${name}`, error);
        } finally {
            // Isolate every test: stop observers/listeners, drop fixtures + var.
            try { destroyHeaderLayout(); } catch (_e) { /* ignore */ }
            removeHeaders();
            clearVar();
        }
    }

    function assert(cond, msg) {
        if (!cond) throw new Error(msg);
    }

    // ---- exports -----------------------------------------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">🔧 Exports</h4>';

    await test('module exports initHeaderLayout / measureHeaderHeight / destroyHeaderLayout', () => {
        assert(typeof initHeaderLayout === 'function', 'initHeaderLayout missing');
        assert(typeof measureHeaderHeight === 'function', 'measureHeaderHeight missing');
        assert(typeof destroyHeaderLayout === 'function', 'destroyHeaderLayout missing');
    });

    await test('HEADER_HEIGHT_VAR is the documented CSS variable name', () => {
        assert(HEADER_HEIGHT_VAR === '--header-total-height', `expected --header-total-height, got ${HEADER_HEIGHT_VAR}`);
    });

    // ---- measureHeaderHeight ----------------------------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">📏 measureHeaderHeight</h4>';

    await test('returns 0 and sets no variable when no header exists', () => {
        removeHeaders();
        clearVar();
        const h = measureHeaderHeight();
        assert(h === 0, `expected 0, got ${h}`);
        assert(readVar() === '', `expected unset var, got "${readVar()}"`);
    });

    await test('publishes the measured header height to the CSS variable', () => {
        makeHeader(150);
        const h = measureHeaderHeight();
        assert(h === 150, `expected 150, got ${h}`);
        assert(readVar() === '150px', `expected 150px, got "${readVar()}"`);
    });

    await test('re-measure reflects a changed header height', () => {
        const el = makeHeader(120);
        assert(measureHeaderHeight() === 120, 'initial measure should be 120');
        assert(readVar() === '120px', `expected 120px, got "${readVar()}"`);
        el.style.height = '64px';
        const h = measureHeaderHeight();
        assert(h === 64, `expected 64 after resize, got ${h}`);
        assert(readVar() === '64px', `expected 64px after resize, got "${readVar()}"`);
    });

    // ---- initHeaderLayout / destroyHeaderLayout ---------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">🔌 init / destroy lifecycle</h4>';

    await test('initHeaderLayout returns false and warns when header is absent', () => {
        removeHeaders();
        const ok = initHeaderLayout();
        assert(ok === false, `expected false, got ${ok}`);
    });

    await test('initHeaderLayout returns true and publishes the variable', () => {
        makeHeader(99);
        const ok = initHeaderLayout();
        assert(ok === true, `expected true, got ${ok}`);
        assert(readVar() === '99px', `expected 99px, got "${readVar()}"`);
    });

    await test('initHeaderLayout is idempotent (safe to call twice)', () => {
        makeHeader(88);
        initHeaderLayout();
        // Second call must not throw or duplicate observers.
        initHeaderLayout();
        assert(readVar() === '88px', `expected 88px, got "${readVar()}"`);
    });

    await test('ResizeObserver keeps the variable in sync with the live header', async () => {
        const el = makeHeader(100);
        initHeaderLayout();
        assert(readVar() === '100px', `expected 100px, got "${readVar()}"`);
        el.style.height = '140px';
        // ResizeObserver fires async — give it a couple frames.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 50));
        assert(readVar() === '140px', `expected 140px after observed resize, got "${readVar()}"`);
    });

    await test('destroyHeaderLayout stops updates and is idempotent', async () => {
        const el = makeHeader(100);
        initHeaderLayout();
        assert(readVar() === '100px', 'pre-destroy var should be 100px');
        destroyHeaderLayout();
        destroyHeaderLayout(); // second call must not throw
        // After teardown, a header change must NOT auto-update the variable.
        el.style.height = '300px';
        window.dispatchEvent(new Event('resize'));
        await new Promise(r => setTimeout(r, 60));
        assert(readVar() === '100px', `expected var to stay 100px after destroy, got "${readVar()}"`);
    });

    // ---- summary -----------------------------------------------------------

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += `<div class="result pass">🎉 All HeaderLayoutManager tests passed!</div>`;
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }

    return { passed: passed.count, total: total.count };
}
