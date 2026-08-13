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
let measureNavDotsClearance = null;
let destroyHeaderLayout = null;
let HEADER_HEIGHT_VAR = null;
let NAV_DOTS_CLEARANCE_VAR = null;

const HEADER_CLASS = 'fixed-header-container';
const NAV_DOTS_ID = 'nav-dots';

export async function runHeaderLayoutManagerTests(resultsDiv) {
    resultsDiv.innerHTML = '<h2>📐 HeaderLayoutManager Tests (DI-Pure)</h2><h3>Loading module...</h3>';

    try {
        const cacheBuster = window.testCacheBuster || Date.now();
        const module = await import(`../modules/ui/headerLayoutManager.js?v=${cacheBuster}`);
        initHeaderLayout = module.initHeaderLayout;
        measureHeaderHeight = module.measureHeaderHeight;
        measureNavDotsClearance = module.measureNavDotsClearance;
        destroyHeaderLayout = module.destroyHeaderLayout;
        HEADER_HEIGHT_VAR = module.HEADER_HEIGHT_VAR;
        NAV_DOTS_CLEARANCE_VAR = module.NAV_DOTS_CLEARANCE_VAR;
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

    function readNavVar() {
        return document.documentElement.style.getPropertyValue(NAV_DOTS_CLEARANCE_VAR).trim();
    }
    function clearNavVar() {
        document.documentElement.style.removeProperty(NAV_DOTS_CLEARANCE_VAR);
    }
    // Fixed to the viewport bottom like the real nav dots; clearance the module
    // computes = innerHeight - rect.top = heightPx + bottomPx, independent of
    // the viewport height — so assertions are deterministic.
    function makeNavDots(heightPx, bottomPx) {
        const el = document.createElement('nav');
        el.id = NAV_DOTS_ID;
        el.style.cssText = `position:fixed;bottom:${bottomPx}px;left:0;width:100px;height:${heightPx}px;box-sizing:border-box;`;
        document.body.appendChild(el);
        return el;
    }
    function removeNavDots() {
        const el = document.getElementById(NAV_DOTS_ID);
        if (el) el.remove();
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
            // Isolate every test: stop observers/listeners, drop fixtures + vars.
            try { destroyHeaderLayout(); } catch (_e) { /* ignore */ }
            removeHeaders();
            removeNavDots();
            clearVar();
            clearNavVar();
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

    // ---- measureNavDotsClearance ------------------------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">⚓ measureNavDotsClearance</h4>';

    await test('exports measureNavDotsClearance and NAV_DOTS_CLEARANCE_VAR', () => {
        assert(typeof measureNavDotsClearance === 'function', 'measureNavDotsClearance missing');
        assert(NAV_DOTS_CLEARANCE_VAR === '--nav-dots-clearance', `expected --nav-dots-clearance, got ${NAV_DOTS_CLEARANCE_VAR}`);
    });

    await test('returns 0 and sets no variable when nav dots are absent', () => {
        removeNavDots();
        clearNavVar();
        const c = measureNavDotsClearance();
        assert(c === 0, `expected 0, got ${c}`);
        assert(readNavVar() === '', `expected unset var, got "${readNavVar()}"`);
    });

    await test('publishes the bottom-band clearance (height + bottom offset)', () => {
        makeNavDots(48, 35); // 48px tall, 35px off the bottom → clearance 83
        const c = measureNavDotsClearance();
        assert(c === 83, `expected 83, got ${c}`);
        assert(readNavVar() === '83px', `expected 83px, got "${readNavVar()}"`);
    });

    await test('re-measure reflects a moved/resized nav-dots band', () => {
        const el = makeNavDots(40, 20); // clearance 60
        assert(measureNavDotsClearance() === 60, 'initial clearance should be 60');
        el.style.height = '50px';
        el.style.bottom = '30px'; // clearance 80
        assert(measureNavDotsClearance() === 80, `expected 80 after move, got ${readNavVar()}`);
    });

    await test('initHeaderLayout publishes BOTH header and nav-dots variables', () => {
        makeHeader(120);
        makeNavDots(48, 35);
        const ok = initHeaderLayout();
        assert(ok === true, `expected true, got ${ok}`);
        assert(readVar() === '120px', `expected header 120px, got "${readVar()}"`);
        assert(readNavVar() === '83px', `expected nav clearance 83px, got "${readNavVar()}"`);
    });

    await test('destroy stops nav-dots updates too', async () => {
        const el = makeNavDots(48, 35);
        makeHeader(100);
        initHeaderLayout();
        assert(readNavVar() === '83px', 'pre-destroy nav var should be 83px');
        destroyHeaderLayout();
        el.style.height = '120px'; // would be clearance 155 if still observed
        window.dispatchEvent(new Event('resize'));
        await new Promise(r => setTimeout(r, 60));
        assert(readNavVar() === '83px', `expected nav var to stay 83px after destroy, got "${readNavVar()}"`);
    });

    // ---- foreground resume -------------------------------------------------

    resultsDiv.innerHTML += '<h4 class="test-section">👀 Resume re-measure</h4>';

    // Run init with ResizeObserver suppressed, so these assert the RESUME path
    // specifically. With observers attached the RO would catch the height change
    // itself and the test would pass whether or not the listener exists.
    const withoutResizeObserver = async (fn) => {
        const real = window.ResizeObserver;
        window.ResizeObserver = undefined;
        try { return await fn(); }
        finally { window.ResizeObserver = real; }
    };

    await test('re-measures when the app returns to the foreground', async () => {
        // An installed PWA can be suspended and restored with a different
        // env(safe-area-inset-top) than it had when it went away, and iOS does not
        // reliably deliver a resize or an observer callback across that transition.
        // Without a visibilitychange listener the published var keeps describing
        // the old chrome until relaunch.
        const el = makeHeader(120);
        makeNavDots(30, 20);   // both fixtures present so the settle loop exits
        await withoutResizeObserver(async () => {
            initHeaderLayout();
            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => requestAnimationFrame(r));
        });
        assert(readVar() === '120px', `setup: expected 120px, got "${readVar()}"`);

        el.style.height = '190px';
        await new Promise(r => requestAnimationFrame(r));
        assert(readVar() === '120px', 'setup: var moved without a resume signal');

        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise(r => requestAnimationFrame(r));

        assert(readVar() === '190px',
            `expected the resume re-measure to publish 190px, got "${readVar()}"`);
    });

    await test('destroy removes the visibility listener', async () => {
        const el = makeHeader(120);
        makeNavDots(30, 20);   // both fixtures present so the settle loop exits
        await withoutResizeObserver(async () => {
            initHeaderLayout();
            await new Promise(r => requestAnimationFrame(r));
            await new Promise(r => requestAnimationFrame(r));
        });

        destroyHeaderLayout();
        el.style.height = '190px';
        await new Promise(r => requestAnimationFrame(r));
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise(r => requestAnimationFrame(r));

        assert(readVar() === '120px',
            `listener outlived destroy(): var moved to "${readVar()}"`);
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
