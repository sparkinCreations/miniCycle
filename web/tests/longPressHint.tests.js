/**
 * LongPressHint Tests
 * Tests for modules/utils/longPressHint.js
 *
 * The gesture contract for icon-only touch controls: a HOLD names the control
 * and activates nothing; a TAP still activates it. Both halves matter — a guard
 * that swallows every click would "fix" the hold by breaking the button.
 *
 * These assert the half a browser test cannot see cheaply: that the capture
 * guard fires before the button's own handler, that it is scoped to the element
 * that was held, and that it expires. The real-app behaviour (bubble position,
 * top-layer parenting inside a <dialog>) is measured by
 * tests/automated/probes/long-press-hint.cjs, which drives the running app.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runLongPressHintTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/longPressHint.js?v=${cacheBuster}`);
    const {
        attachLongPressHint, suppressNextClick, showLongPressHint,
        hideLongPressHint, resetLongPressHints
    } = mod;
    const { UI_TIMEOUTS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>LongPressHint Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const HOLD = UI_TIMEOUTS.LONG_PRESS_HINT + 120;

    function makeButton() {
        const btn = document.createElement('button');
        btn.textContent = 'icon';
        document.body.appendChild(btn);
        return btn;
    }

    // Synthesise the sequence a browser produces: touchstart, dwell, touchend,
    // then the compatibility click. `Touch` is not constructible everywhere, so
    // dispatch bare TouchEvents — the module only reads the event type.
    function touch(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }
    const wait = ms => new Promise(r => setTimeout(r, ms));

    function cleanup(...els) {
        els.forEach(el => el?.remove());
        resetLongPressHints();
    }

    await test('a hold suppresses the click that follows it', async () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);
        const detach = attachLongPressHint(btn, { getText: () => 'Rename routine' });

        touch(btn, 'touchstart');
        await wait(HOLD);
        touch(btn, 'touchend');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        detach();
        cleanup(btn);
        if (ran !== 0) throw new Error(`held button ran its action ${ran} time(s); must be 0`);
    });

    await test('a tap still activates the control', async () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);
        const detach = attachLongPressHint(btn, { getText: () => 'Rename routine' });

        touch(btn, 'touchstart');
        await wait(60);                       // well under the hold threshold
        touch(btn, 'touchend');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        detach();
        cleanup(btn);
        if (ran !== 1) throw new Error(`tapped button ran its action ${ran} time(s); must be 1`);
    });

    await test('the hold shows the hint with the resolved text', async () => {
        const btn = makeButton();
        const detach = attachLongPressHint(btn, { getText: () => 'Duplicate routine' });

        touch(btn, 'touchstart');
        await wait(HOLD);
        const hint = document.getElementById('long-press-hint');
        const text = hint?.textContent;
        const visible = hint?.classList.contains('visible');
        touch(btn, 'touchend');

        detach();
        cleanup(btn);
        if (text !== 'Duplicate routine') throw new Error(`hint text was ${String(text)}`);
        if (!visible) throw new Error('hint was not marked visible');
    });

    await test('getText resolves at press time, not at attach time', async () => {
        const btn = makeButton();
        let label = 'first';
        const detach = attachLongPressHint(btn, { getText: () => label });

        label = 'second';                     // e.g. the language changed
        touch(btn, 'touchstart');
        await wait(HOLD);
        const text = document.getElementById('long-press-hint')?.textContent;
        touch(btn, 'touchend');

        detach();
        cleanup(btn);
        if (text !== 'second') throw new Error(`hint showed "${String(text)}" — stale label`);
    });

    await test('moving the finger cancels the hint and leaves the click alone', async () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);
        const detach = attachLongPressHint(btn, { getText: () => 'Delete routine' });

        touch(btn, 'touchstart');
        await wait(80);
        touch(btn, 'touchmove');              // turned into a scroll
        await wait(HOLD);
        touch(btn, 'touchend');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        const shown = document.getElementById('long-press-hint')?.classList.contains('visible');
        detach();
        cleanup(btn);
        if (shown) throw new Error('a scroll should not raise the hint');
        if (ran !== 1) throw new Error(`scrolled press ran the action ${ran} time(s); must be 1`);
    });

    await test('onLongPress replaces the built-in bubble', async () => {
        const btn = makeButton();
        let calls = 0;
        const detach = attachLongPressHint(btn, { onLongPress: () => calls++ });

        touch(btn, 'touchstart');
        await wait(HOLD);
        const bubble = document.getElementById('long-press-hint');
        touch(btn, 'touchend');

        detach();
        cleanup(btn);
        if (calls !== 1) throw new Error(`onLongPress called ${calls} time(s); must be 1`);
        if (bubble) throw new Error('built-in bubble was created despite onLongPress');
    });

    await test('suppression is scoped to the element that was held', () => {
        const held = makeButton();
        const other = makeButton();
        let otherRan = 0;
        other.addEventListener('click', () => otherRan++);

        suppressNextClick(held);
        other.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        cleanup(held, other);
        if (otherRan !== 1) throw new Error('a hold on one control swallowed another control\'s click');
    });

    await test('suppression covers a child of the held element', () => {
        const btn = makeButton();
        const icon = document.createElement('span');
        btn.appendChild(icon);
        let ran = 0;
        btn.addEventListener('click', () => ran++);

        suppressNextClick(btn);
        // The touch lands on the icon, so the click target is the child.
        icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        cleanup(btn);
        if (ran !== 0) throw new Error('click on the icon inside a held button was not suppressed');
    });

    await test('suppression expires so the next real tap works', async () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);

        suppressNextClick(btn);
        await wait(UI_TIMEOUTS.LONG_PRESS_CLICK_GUARD + 80);
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        cleanup(btn);
        if (ran !== 1) throw new Error('suppression outlived its window and ate a genuine tap');
    });

    await test('only ONE click is swallowed per hold', () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);

        suppressNextClick(btn);
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));  // swallowed
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));  // must land

        cleanup(btn);
        if (ran !== 1) throw new Error(`second click ran ${ran} time(s); one hold must swallow exactly one click`);
    });

    await test('detach stops the control from raising hints', async () => {
        const btn = makeButton();
        let ran = 0;
        btn.addEventListener('click', () => ran++);
        const detach = attachLongPressHint(btn, { getText: () => 'Delete routine' });
        detach();

        touch(btn, 'touchstart');
        await wait(HOLD);
        touch(btn, 'touchend');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        const shown = document.getElementById('long-press-hint')?.classList.contains('visible');
        cleanup(btn);
        if (shown) throw new Error('detached control still raised a hint');
        if (ran !== 1) throw new Error('detached control still had its click suppressed');
    });

    await test('the hint dismisses itself on the next touch anywhere', async () => {
        const btn = makeButton();
        const detach = attachLongPressHint(btn, { getText: () => 'Stats' });

        touch(btn, 'touchstart');
        await wait(HOLD);
        touch(btn, 'touchend');
        const shown = document.getElementById('long-press-hint')?.classList.contains('visible');

        // Past the arming delay, so this is a genuinely new interaction rather
        // than the tail of the press that raised the hint.
        await wait(UI_TIMEOUTS.HINT_DISMISS_ARM + 60);
        document.dispatchEvent(new Event('touchstart', { bubbles: true }));
        await wait(30);
        const stillShown = document.getElementById('long-press-hint')?.classList.contains('visible');

        detach();
        cleanup(btn);
        if (!shown) throw new Error('hint never appeared');
        if (stillShown) throw new Error('hint outlived the next touch — a hint that never leaves is a bug');
    });

    await test('a touch inside the arming window cannot dismiss the hint', async () => {
        const btn = makeButton();
        const detach = attachLongPressHint(btn, { getText: () => 'Stats' });

        touch(btn, 'touchstart');
        // Land between the hint appearing and its dismissal listener arming —
        // that gap is what stops the raising press from closing what it opened.
        await wait(UI_TIMEOUTS.LONG_PRESS_HINT + 20);
        document.dispatchEvent(new Event('touchstart', { bubbles: true }));
        await wait(20);
        const stillShown = document.getElementById('long-press-hint')?.classList.contains('visible');

        detach();
        cleanup(btn);
        if (!stillShown) throw new Error('hint was dismissed inside its own arming window');
    });

    await test('hide clears the visible state', () => {
        const btn = makeButton();
        showLongPressHint(btn, 'Stats');
        const wasVisible = document.getElementById('long-press-hint')?.classList.contains('visible');
        hideLongPressHint();
        const nowVisible = document.getElementById('long-press-hint')?.classList.contains('visible');
        cleanup(btn);
        if (!wasVisible) throw new Error('hint never became visible');
        if (nowVisible) throw new Error('hint stayed visible after hide');
    });

    await test('attaching to a missing element is a no-op, not a throw', () => {
        const detach = attachLongPressHint(null, { getText: () => 'x' });
        if (typeof detach !== 'function') throw new Error('should still return a detach function');
        detach();
        suppressNextClick(null);   // must not throw either
        resetLongPressHints();
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += '<div class="result fail">⚠️ Some tests failed</div>';
    }
    return { passed: passed.count, total: total.count };
}
