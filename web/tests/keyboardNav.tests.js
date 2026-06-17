/**
 * KeyboardNav Tests
 * Tests for modules/utils/keyboardNav.js
 *
 * Pure roving-tabindex helpers. Tests build real DOM fixtures and assert:
 *   - return value (whether a nav key was handled)
 *   - tabindex roving (focused = "0", others = "-1")
 *   - which element ends up focused
 *   - preventDefault behavior
 *   - guard / no-op paths (non-nav keys, empty container, target not in list)
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runKeyboardNavTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/keyboardNav.js?v=${cacheBuster}`);
    const { handleVerticalArrowNav, handleHorizontalArrowNav, handleGridArrowNav } = mod;

    resultsDiv.innerHTML = '<h2>KeyboardNav Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── helpers ──────────────────────────────────────────────────────────────
    // Build a container with N items. skipHidden defaults to false in tests so
    // offsetParent (unreliable in headless) is not consulted.
    function makeList(n, { tag = 'button', cls = 'item', start = 0 } = {}) {
        const container = document.createElement('div');
        for (let i = 0; i < n; i++) {
            const el = document.createElement(tag);
            el.className = cls;
            el.textContent = `item ${i}`;
            el.setAttribute('tabindex', i === start ? '0' : '-1');
            container.appendChild(el);
        }
        document.body.appendChild(container);
        return container;
    }

    function fakeEvent(key, target) {
        let prevented = false;
        return {
            key,
            target,
            preventDefault: () => { prevented = true; },
            wasPrevented: () => prevented
        };
    }

    function tabindexes(container, sel = '.item') {
        return Array.from(container.querySelectorAll(sel)).map(e => e.getAttribute('tabindex'));
    }

    function cleanup(container) {
        if (container && container.parentNode) container.parentNode.removeChild(container);
    }

    // Roving tabindex is the deterministic contract: the focus target gets
    // tabindex="0", all others get "-1". (document.activeElement is unreliable
    // in headless Chromium when the window itself is not focused, so we assert
    // on tabindex instead.)
    function focusedIndex(container, sel = '.item') {
        const items = Array.from(container.querySelectorAll(sel));
        return items.findIndex(e => e.getAttribute('tabindex') === '0');
    }

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('all three handlers are exported functions', () => {
        for (const fn of [handleVerticalArrowNav, handleHorizontalArrowNav, handleGridArrowNav]) {
            if (typeof fn !== 'function') throw new Error('handler not a function');
        }
    });

    // ── handleVerticalArrowNav ───────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⬇️ handleVerticalArrowNav</h4>';

    await test('ArrowDown moves focus to next item and roves tabindex', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowDown', items[0]);
        const handled = handleVerticalArrowNav(ev, c, '.item', { skipHidden: false });
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('should return true');
        if (!ev.wasPrevented()) throw new Error('should preventDefault on move');
        if (ti[0] !== '-1' || ti[1] !== '0' || ti[2] !== '-1') throw new Error('tabindex roving wrong: ' + ti.join(','));
    });

    await test('ArrowUp moves focus to previous item', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowUp', items[2]);
        const handled = handleVerticalArrowNav(ev, c, '.item', { skipHidden: false });
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('should return true');
        if (ti[1] !== '0') throw new Error('item[1] should have tabindex 0: ' + ti.join(','));
    });

    await test('Home jumps to first item, End jumps to last', () => {
        const c = makeList(4);
        const items = c.querySelectorAll('.item');
        handleVerticalArrowNav(fakeEvent('Home', items[2]), c, '.item', { skipHidden: false });
        if (focusedIndex(c) !== 0) { cleanup(c); throw new Error('Home should focus first'); }
        handleVerticalArrowNav(fakeEvent('End', items[0]), c, '.item', { skipHidden: false });
        const ok = focusedIndex(c) === 3;
        cleanup(c);
        if (!ok) throw new Error('End should focus last');
    });

    await test('no wrap (default): ArrowDown at last item stays put, still returns true', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        items[2].setAttribute('tabindex', '0');
        const ev = fakeEvent('ArrowDown', items[2]);
        const handled = handleVerticalArrowNav(ev, c, '.item', { skipHidden: false });
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('key matched → should return true');
        // next === current → moveFocus returns early WITHOUT preventDefault, no rove
        if (ev.wasPrevented()) throw new Error('no-movement should not preventDefault');
        if (ti[2] !== '0') throw new Error('last item should keep tabindex 0: ' + ti.join(','));
    });

    await test('wrap:true ArrowDown from last item wraps to first', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        items[2].setAttribute('tabindex', '0');
        const ev = fakeEvent('ArrowDown', items[2]);
        handleVerticalArrowNav(ev, c, '.item', { wrap: true, skipHidden: false });
        const ok = focusedIndex(c) === 0;
        cleanup(c);
        if (!ok) throw new Error('should wrap to first item');
    });

    await test('wrap:true ArrowUp from first item wraps to last', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowUp', items[0]);
        handleVerticalArrowNav(ev, c, '.item', { wrap: true, skipHidden: false });
        const ok = focusedIndex(c) === 2;
        cleanup(c);
        if (!ok) throw new Error('should wrap to last item');
    });

    await test('non-navigation key (Tab) is ignored → returns false, no preventDefault', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('Tab', items[0]);
        const handled = handleVerticalArrowNav(ev, c, '.item', { skipHidden: false });
        cleanup(c);
        if (handled !== false) throw new Error('non-nav key should return false');
        if (ev.wasPrevented()) throw new Error('should not preventDefault for ignored key');
    });

    await test('ArrowLeft is NOT handled by vertical nav', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const handled = handleVerticalArrowNav(fakeEvent('ArrowLeft', items[0]), c, '.item', { skipHidden: false });
        cleanup(c);
        if (handled !== false) throw new Error('vertical nav should ignore ArrowLeft');
    });

    await test('empty container returns false', () => {
        const c = document.createElement('div');
        document.body.appendChild(c);
        const handled = handleVerticalArrowNav(fakeEvent('ArrowDown', c), c, '.item', { skipHidden: false });
        cleanup(c);
        if (handled !== false) throw new Error('empty list should return false');
    });

    await test('target outside item set returns false', () => {
        const c = makeList(3);
        const stranger = document.createElement('button');
        stranger.className = 'item';
        document.body.appendChild(stranger); // matches selector but not inside container
        const handled = handleVerticalArrowNav(fakeEvent('ArrowDown', stranger), c, '.item', { skipHidden: false });
        cleanup(c);
        stranger.remove();
        if (handled !== false) throw new Error('off-list target should return false');
    });

    await test('uses event.target.closest — works when target is a child of an item', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const child = document.createElement('span');
        items[0].appendChild(child);
        const ev = fakeEvent('ArrowDown', child); // target is the inner span
        const handled = handleVerticalArrowNav(ev, c, '.item', { skipHidden: false });
        const ok = handled === true && focusedIndex(c) === 1;
        cleanup(c);
        if (!ok) throw new Error('closest() should resolve span up to its .item');
    });

    // ── handleHorizontalArrowNav ─────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">➡️ handleHorizontalArrowNav</h4>';

    await test('ArrowRight moves to next item', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowRight', items[0]);
        const handled = handleHorizontalArrowNav(ev, c, '.item', { skipHidden: false });
        const ok = handled === true && focusedIndex(c) === 1;
        cleanup(c);
        if (!ok) throw new Error('ArrowRight should move to next');
    });

    await test('ArrowLeft moves to previous item', () => {
        const c = makeList(3, { start: 2 });
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowLeft', items[2]);
        handleHorizontalArrowNav(ev, c, '.item', { skipHidden: false });
        const ok = focusedIndex(c) === 1;
        cleanup(c);
        if (!ok) throw new Error('ArrowLeft should move to previous');
    });

    await test('default wrap:true — ArrowRight from last wraps to first', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        items[2].setAttribute('tabindex', '0');
        const ev = fakeEvent('ArrowRight', items[2]);
        handleHorizontalArrowNav(ev, c, '.item', { skipHidden: false }); // wrap defaults true
        const ok = focusedIndex(c) === 0;
        cleanup(c);
        if (!ok) throw new Error('horizontal default should wrap');
    });

    await test('wrap:false — ArrowLeft at first stays put', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowLeft', items[0]);
        const handled = handleHorizontalArrowNav(ev, c, '.item', { wrap: false, skipHidden: false });
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('should return true (key matched)');
        if (ti[0] !== '0') throw new Error('first item should stay focused: ' + ti.join(','));
    });

    await test('ArrowDown is NOT handled by horizontal nav', () => {
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const handled = handleHorizontalArrowNav(fakeEvent('ArrowDown', items[0]), c, '.item', { skipHidden: false });
        cleanup(c);
        if (handled !== false) throw new Error('horizontal nav should ignore ArrowDown');
    });

    await test('horizontal uses exact target match (indexOf), not closest', () => {
        // Unlike vertical, horizontal indexes event.target directly.
        const c = makeList(3);
        const items = c.querySelectorAll('.item');
        const child = document.createElement('span');
        items[0].appendChild(child);
        const handled = handleHorizontalArrowNav(fakeEvent('ArrowRight', child), c, '.item', { skipHidden: false });
        cleanup(c);
        if (handled !== false) throw new Error('child span is not in items → should return false');
    });

    // ── handleGridArrowNav ───────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">▦ handleGridArrowNav</h4>';

    await test('non-grid key returns false', () => {
        const c = makeList(4);
        const items = c.querySelectorAll('.item');
        const handled = handleGridArrowNav(fakeEvent('Enter', items[0]), c, '.item');
        cleanup(c);
        if (handled !== false) throw new Error('Enter should not be handled');
    });

    await test('target not in grid returns false', () => {
        const c = makeList(4);
        const outside = document.createElement('button');
        outside.className = 'item';
        document.body.appendChild(outside);
        const handled = handleGridArrowNav(fakeEvent('ArrowRight', outside), c, '.item');
        cleanup(c);
        outside.remove();
        if (handled !== false) throw new Error('off-grid target should return false');
    });

    await test('ArrowRight moves to next cell (handled)', () => {
        const c = makeList(4);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowRight', items[0]);
        const handled = handleGridArrowNav(ev, c, '.item');
        const ok = handled === true && focusedIndex(c) === 1;
        cleanup(c);
        if (!ok) throw new Error('ArrowRight should focus next cell');
    });

    await test('ArrowLeft clamps at index 0 (no wrap)', () => {
        const c = makeList(4);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowLeft', items[0]);
        const handled = handleGridArrowNav(ev, c, '.item');
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('key matched → true');
        if (ev.wasPrevented()) throw new Error('no movement → no preventDefault');
        if (ti[0] !== '0') throw new Error('should clamp at first: ' + ti.join(','));
    });

    await test('ArrowRight clamps at last cell', () => {
        const c = makeList(4);
        const items = c.querySelectorAll('.item');
        items[3].setAttribute('tabindex', '0');
        const ev = fakeEvent('ArrowRight', items[3]);
        const handled = handleGridArrowNav(ev, c, '.item');
        const ti = tabindexes(c);
        cleanup(c);
        if (handled !== true) throw new Error('key matched → true');
        if (ti[3] !== '0') throw new Error('should clamp at last: ' + ti.join(','));
    });

    await test('Home focuses first cell, End focuses last cell', () => {
        const c = makeList(5);
        const items = c.querySelectorAll('.item');
        handleGridArrowNav(fakeEvent('End', items[0]), c, '.item');
        if (focusedIndex(c) !== 4) { cleanup(c); throw new Error('End should focus last'); }
        handleGridArrowNav(fakeEvent('Home', items[4]), c, '.item');
        const ok = focusedIndex(c) === 0;
        cleanup(c);
        if (!ok) throw new Error('Home should focus first');
    });

    await test('single-cell grid: ArrowDown clamps, cols defaults to length', () => {
        const c = makeList(1);
        const items = c.querySelectorAll('.item');
        const ev = fakeEvent('ArrowDown', items[0]);
        const handled = handleGridArrowNav(ev, c, '.item');
        cleanup(c);
        if (handled !== true) throw new Error('key matched → true');
        // only one cell — nowhere to move, no throw
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
