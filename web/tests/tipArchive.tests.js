/**
 * TipArchive Tests
 *
 * Covers the two things that can silently break this feature:
 *   1. loading-tips.json's SHAPE. It is a two-pool object, not the bare array it
 *      used to be. The pre-boot rotator in miniCycle.html and this module are two
 *      independent readers of the same file; a shape regression breaks both, and
 *      neither throws — tips are decorative, so the failure mode is silence.
 *   2. AUDIENCE correctness. Instructional tips ("click your progress badge") are
 *      false on the first-run screen, where the user has no badge and no tasks.
 *      That was a live bug on minicycle.app before the pools were split.
 */

import { createProtectedTest } from './testHelpers.js';

export async function runTipArchiveTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/tipArchive.js?v=${cacheBuster}`);
    const { tipArchive, setTipArchiveDependencies } = mod;

    resultsDiv.innerHTML = '<h2>TipArchive Tests</h2><h3>Running tests...</h3>';

    const passed = { count: 0 };
    const total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    setTipArchiveDependencies({ showNotification: () => {}, hideMainMenu: () => {} });

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('tipArchive singleton is exported', () => {
        if (!tipArchive || typeof tipArchive !== 'object') throw new Error('tipArchive not exported as an object');
    });

    await test('setTipArchiveDependencies is exported', () => {
        if (typeof setTipArchiveDependencies !== 'function') throw new Error('DI setter not exported');
    });

    await test('exposes init/destroy so moduleLoader can manage it', () => {
        if (typeof tipArchive.init !== 'function') throw new Error('init() missing — loader will not initialise it');
        if (typeof tipArchive.destroy !== 'function') throw new Error('destroy() missing — destroyAllModules() cannot tear it down');
    });

    // ============================================
    // 📄 TIP FILE SHAPE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📄 Tip File Shape</h4>';

    // Same root-absolute URL the module uses, so the test exercises the real path.
    const raw = await (await fetch(`/modules/labels/loading-tips.json?v=${cacheBuster}`)).json();

    await test('loading-tips.json is an object with firstRun and inApp pools', () => {
        if (Array.isArray(raw)) throw new Error('still a bare array — the pre-boot rotator expects {firstRun, inApp}');
        if (!Array.isArray(raw.firstRun)) throw new Error('firstRun pool missing or not an array');
        if (!Array.isArray(raw.inApp)) throw new Error('inApp pool missing or not an array');
    });

    await test('both pools are non-empty', () => {
        if (!raw.firstRun.length) throw new Error('firstRun pool is empty — the first-run screen would show no tips');
        if (!raw.inApp.length) throw new Error('inApp pool is empty — every later boot would show no tips');
    });

    await test('every tip is a non-blank string', () => {
        [...raw.firstRun, ...raw.inApp].forEach((tip) => {
            if (typeof tip !== 'string' || !tip.trim()) throw new Error(`non-string or blank tip: ${JSON.stringify(tip)}`);
        });
    });

    await test('no tip appears in both pools', () => {
        const dupes = raw.firstRun.filter((tip) => raw.inApp.indexOf(tip) !== -1);
        if (dupes.length) throw new Error(`tip in both pools: ${dupes[0]}`);
    });

    // ============================================
    // 🎯 AUDIENCE CORRECTNESS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Audience Correctness</h4>';

    await test('firstRun tips never point at UI a brand-new user does not have', () => {
        // A first-run user has no tasks, no routine, no stats and no progress
        // badge. These substrings are the shapes that were actually wrong on the
        // live first-run screen (Sep 2026), not a general style rule.
        const forbidden = [
            'progress badge', 'task history', 'stats modal', 'folder button',
            'Drag tasks', 'Long-press a task', 'your routine as a', 'broom button'
        ];
        raw.firstRun.forEach((tip) => {
            forbidden.forEach((phrase) => {
                if (tip.toLowerCase().indexOf(phrase.toLowerCase()) !== -1) {
                    throw new Error(`firstRun tip references absent UI ("${phrase}"): ${tip}`);
                }
            });
        });
    });

    // ============================================
    // 🧹 LIFECYCLE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Lifecycle</h4>';

    await test('openModal builds a deck of every tip and shows one', async () => {
        await tipArchive.openModal();
        const dialog = document.getElementById('tip-archive-modal');
        if (!dialog) throw new Error('modal was not appended to the document');

        const expected = raw.firstRun.length + raw.inApp.length;
        if (tipArchive._deck.length !== expected) {
            throw new Error(`deck holds ${tipArchive._deck.length} tips, expected ${expected}`);
        }
        if (!document.getElementById('tip-archive-text').textContent.trim()) {
            throw new Error('no tip text rendered');
        }
        if (document.getElementById('tip-archive-position').textContent.trim() !== `1 of ${expected}`) {
            throw new Error('position counter wrong on open');
        }
        tipArchive.closeModal();
        if (document.getElementById('tip-archive-modal')) throw new Error('dialog survived closeModal — it leaks listeners');
    });

    await test('the deck holds every tip exactly once', async () => {
        await tipArchive.openModal();
        const texts = tipArchive._deck.map((c) => c.text).sort();
        const source = [...raw.firstRun, ...raw.inApp].sort();
        tipArchive.closeModal();
        if (texts.join('|') !== source.join('|')) throw new Error('shuffle lost, duplicated or altered tips');
    });

    await test('next and previous wrap in both directions', async () => {
        await tipArchive.openModal();
        const total = tipArchive._deck.length;
        const posText = () => document.getElementById('tip-archive-position').textContent.trim();

        document.getElementById('tip-archive-next').click();
        if (posText() !== `2 of ${total}`) throw new Error(`next gave "${posText()}"`);
        document.getElementById('tip-archive-prev').click();
        if (posText() !== `1 of ${total}`) throw new Error(`prev gave "${posText()}"`);
        document.getElementById('tip-archive-prev').click();
        if (posText() !== `${total} of ${total}`) throw new Error(`prev from the first card should wrap, gave "${posText()}"`);
        tipArchive.closeModal();
    });

    await test('manual navigation pauses the rotation', async () => {
        await tipArchive.openModal();
        if (tipArchive._paused) throw new Error('should start playing');
        document.getElementById('tip-archive-next').click();
        if (!tipArchive._paused) throw new Error('pressing next must stop the auto-advance under the reader');
        if (tipArchive._timer) throw new Error('rotation timer still running after pause');
        tipArchive.closeModal();
    });

    await test('closeModal stops the rotation timer', async () => {
        await tipArchive.openModal();
        if (!tipArchive._timer) throw new Error('rotation did not start');
        tipArchive.closeModal();
        if (tipArchive._timer) throw new Error('timer survived close — it would step a detached element forever');
    });

    await test('tip text renders as text, never as markup', async () => {
        await tipArchive.openModal();
        const injected = document.getElementById('tip-archive-text').children.length;
        tipArchive.closeModal();
        if (injected) throw new Error('tip text produced child elements — textContent was bypassed');
    });

    // ============================================
    // 🚨 STALE / MALFORMED TIP FILE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🚨 Stale or Malformed Tip File</h4>';

    // These exercise the module's OWN fetch, which the shape tests above do not:
    // they read the file directly off the server. A service worker holding the
    // pre-split BARE ARRAY produced a modal with a heading, an intro and zero
    // tips — no error, no warning, nothing to diagnose (observed Sep 2026).
    const withStubbedTips = async (payload, fn) => {
        const realFetch = window.fetch;
        window.fetch = (url, ...rest) => String(url).includes('loading-tips.json')
            ? Promise.resolve(new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }))
            : realFetch(url, ...rest);
        try {
            tipArchive._tips = null; // drop the cache so the stub is actually read
            await fn();
        } finally {
            window.fetch = realFetch;
            tipArchive._tips = null;
        }
    };

    await test('a stale BARE ARRAY opens no modal and reports the failure', async () => {
        let notified = null;
        setTipArchiveDependencies({ showNotification: (msg) => { notified = msg; }, hideMainMenu: () => {} });

        await withStubbedTips(['old tip A', 'old tip B'], async () => {
            await tipArchive.openModal();
            if (document.getElementById('tip-archive-modal')) {
                throw new Error('opened an EMPTY modal — a shape mismatch must surface, not render nothing');
            }
            if (!notified) throw new Error('no notification raised for an unusable tip file');
        });
    });

    await test('an object with two empty pools is treated as a failure', async () => {
        let notified = null;
        setTipArchiveDependencies({ showNotification: (msg) => { notified = msg; }, hideMainMenu: () => {} });

        await withStubbedTips({ firstRun: [], inApp: [] }, async () => {
            await tipArchive.openModal();
            if (document.getElementById('tip-archive-modal')) throw new Error('opened a modal with no tips in it');
            if (!notified) throw new Error('no notification raised for empty pools');
        });
    });

    await test('one populated pool is still enough to open', async () => {
        setTipArchiveDependencies({ showNotification: () => {}, hideMainMenu: () => {} });

        await withStubbedTips({ firstRun: ['only tip'], inApp: [] }, async () => {
            await tipArchive.openModal();
            const dialog = document.getElementById('tip-archive-modal');
            if (!dialog) throw new Error('a single populated pool should still render');
            if (tipArchive._deck.length !== 1) throw new Error('expected exactly 1 tip in the deck');
            tipArchive.closeModal();
        });
    });

    await test('closeModal is safe to call when nothing is open', () => {
        tipArchive.closeModal();
        tipArchive.closeModal();
    });

    await test('init() labels the button WITHOUT destroying its icon', async () => {
        // iconInit.js swaps <i class="fas ..."> for <span class="icon"><svg/></span>,
        // which is the FIRST span in the button. Targeting spans positionally wiped
        // the SVG and produced "TipsTips" (observed Sep 2026), so pin the structure.
        const btn = document.createElement('button');
        btn.id = 'open-tip-archive';
        btn.innerHTML = '<span class="icon" aria-hidden="true">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg></span>' +
            '<span class="menu-item-label">Tips</span>';
        document.body.appendChild(btn);

        try {
            tipArchive.initialized = false;
            await tipArchive.init();

            if (!btn.querySelector('.icon svg')) throw new Error('init() destroyed the button icon');
            const label = btn.querySelector('.menu-item-label');
            if (!label || !label.textContent.trim()) throw new Error('label span was not populated');
            if (btn.querySelectorAll('span').length !== 2) throw new Error('button structure changed unexpectedly');
            if (btn.textContent.trim() !== label.textContent.trim()) {
                throw new Error(`button text duplicated: "${btn.textContent.trim()}"`);
            }
        } finally {
            tipArchive.destroy();
            btn.remove();
        }
    });

    await test('destroy() clears cached tips and the initialized flag', () => {
        tipArchive.destroy();
        if (tipArchive.initialized) throw new Error('initialized still true after destroy()');
        if (tipArchive.modalOverlay) throw new Error('modalOverlay still held after destroy()');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round((passed.count / total.count) * 100)}%)</h3>`;

    // Return the counts: the automated runner scores on this, not on the DOM.
    return { passed: passed.count, total: total.count };
}
