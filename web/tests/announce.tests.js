/**
 * Announce Tests
 * Tests for modules/utils/announce.js — the single screen-reader announcement path.
 */

import { createProtectedTest } from './testHelpers.js';

export async function runAnnounceTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/announce.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>Announce Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /** Isolated #live-region plus a recorder of every value it takes. */
    function buildRegion() {
        document.getElementById('announce-probe-root')?.remove();
        const root = document.createElement('div');
        root.id = 'announce-probe-root';
        root.innerHTML = '<div id="live-region"></div>';
        document.body.appendChild(root);
        const region = root.querySelector('#live-region');
        const seen = [];
        const obs = new MutationObserver(() => seen.push(region.textContent));
        obs.observe(region, { childList: true, characterData: true, subtree: true });
        return {
            region, seen,
            getElementById: (id) => (id === 'live-region' ? region : null),
            // Two frames: one for the clear, one for the write.
            settle: () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
            cleanup: () => { obs.disconnect(); root.remove(); }
        };
    }

    await test('announce is exported as a function', () => {
        if (typeof mod.announce !== 'function') throw new Error('Missing export');
    });

    await test('the SAME message twice still produces a fresh empty -> text transition', async () => {
        // The bug this module exists for. Assigning identical text is a DOM
        // change (textContent replaces the node) but NOT a change a screen
        // reader re-reads, so the second announcement is silently skipped.
        // Clearing first makes every announcement an empty -> text transition.
        const h = buildRegion();
        try {
            mod.announce('Cycle complete!', { getElementById: h.getElementById });
            await h.settle();
            mod.announce('Cycle complete!', { getElementById: h.getElementById });
            await h.settle();

            if (h.region.textContent !== 'Cycle complete!') {
                throw new Error(`region should end on the message, got "${h.region.textContent}"`);
            }
            if (!h.seen.includes('')) {
                throw new Error('region was never cleared between announcements — a screen reader '
                    + `would not re-read identical text. Saw: ${JSON.stringify(h.seen)}`);
            }
            const firstMsg = h.seen.indexOf('Cycle complete!');
            const clearAfter = h.seen.indexOf('', firstMsg);
            if (firstMsg === -1 || clearAfter === -1 || h.seen.indexOf('Cycle complete!', clearAfter) === -1) {
                throw new Error(`expected message -> "" -> message, got ${JSON.stringify(h.seen)}`);
            }
        } finally {
            h.cleanup();
        }
    });

    await test('returns false and does not throw when there is no live region', () => {
        const result = mod.announce('anything', { getElementById: () => null });
        if (result !== false) throw new Error(`expected false, got ${result}`);
    });

    await test('an empty message is ignored', () => {
        const h = buildRegion();
        try {
            if (mod.announce('', { getElementById: h.getElementById }) !== false) {
                throw new Error('empty message should be refused');
            }
        } finally {
            h.cleanup();
        }
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
