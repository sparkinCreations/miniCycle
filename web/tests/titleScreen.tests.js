/**
 * TitleScreen (Welcome Screen) Tests
 *
 * The failure modes this guards, all of which are silent:
 *   1. A delegation target that is not a real DOM_IDS entry. `DOM_IDS.TYPO` is
 *      `undefined`, `getElementById(undefined)` returns null, and the button
 *      does nothing. Hit for real during development: IMPORT_MINI_CYCLE was used
 *      before it existed in constants.js.
 *   2. Reusing `.first-run-choice`, which critical.css hides unless <html> has
 *      `mc-first-run` — invisible to exactly the returning users it is for.
 *   3. The label overwriting iconInit's <span class="icon"> and eating the glyph.
 *   4. Listeners surviving close() on a detached dialog.
 */

import { createProtectedTest } from './testHelpers.js';

export async function runTitleScreenTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/titleScreen.js?v=${cacheBuster}`);
    const { titleScreen, setTitleScreenDependencies } = mod;
    const { DOM_IDS } = await import(`../modules/core/constants.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>TitleScreen (Welcome Screen) Tests</h2><h3>Running tests...</h3>';

    const passed = { count: 0 };
    const total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /** Minimal AppState stand-in: ready flag + a settings object we can inspect. */
    const makeAppState = (ready = true, settings = {}) => ({
        _settings: settings,
        _updates: 0,
        isReady: () => ready,
        get: () => (ready ? { settings } : null),
        update(producer) {
            this._updates++;
            producer({ settings: this._settings });
        }
    });

    let appState = makeAppState();
    const wire = (state) => {
        appState = state;
        setTitleScreenDependencies({
            AppState: appState,
            safeAddEventListener: (el, type, fn) => el.addEventListener(type, fn),
            showNotification: () => {},
            hideMainMenu: () => {}
        });
    };
    wire(makeAppState());

    // ============================================
    // 📦 MODULE LOADING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('titleScreen singleton is exported', () => {
        if (!titleScreen || typeof titleScreen !== 'object') throw new Error('titleScreen not exported as an object');
    });

    await test('setTitleScreenDependencies is exported', () => {
        if (typeof setTitleScreenDependencies !== 'function') throw new Error('DI setter not exported');
    });

    await test('exposes init/destroy so moduleLoader can manage it', () => {
        if (typeof titleScreen.init !== 'function') throw new Error('init() missing');
        if (typeof titleScreen.destroy !== 'function') throw new Error('destroy() missing');
    });

    // ============================================
    // 🎯 DELEGATION TARGETS
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 Delegation Targets</h4>';

    await test('every delegated DOM_IDS entry is a real, non-empty id', () => {
        // The Welcome Screen never reimplements these actions — it clicks the
        // control that already owns them. A missing constant is `undefined`, and
        // getElementById(undefined) fails silently.
        const targets = [
            'NEW_MINI_CYCLE', 'OPEN_MINI_CYCLE', 'IMPORT_MINI_CYCLE',
            'OPEN_USER_MANUAL', 'MENU_OPEN_TITLE_SCREEN'
        ];
        targets.forEach((key) => {
            const value = DOM_IDS[key];
            if (typeof value !== 'string' || !value) {
                throw new Error(`DOM_IDS.${key} is ${JSON.stringify(value)} — delegation would silently no-op`);
            }
        });
    });

    // ============================================
    // 🖼️ RENDERING
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🖼️ Rendering</h4>';

    await test('open() renders three primary actions plus the recovery link', () => {
        titleScreen.open();
        const dialog = document.getElementById(DOM_IDS.TITLE_SCREEN);
        try {
            if (!dialog) throw new Error('overlay was not appended');
            const actions = dialog.querySelectorAll('.first-run-btn');
            if (actions.length !== 3) throw new Error(`expected 3 primary actions, got ${actions.length}`);
            // Import is a recovery path and must stay visually demoted.
            const importBtn = document.getElementById(DOM_IDS.TITLE_SCREEN_IMPORT_BACKUP);
            if (!importBtn) throw new Error('import action missing');
            if (importBtn.classList.contains('first-run-btn')) {
                throw new Error('import is styled as a primary action — it is a recovery path');
            }
            if (!importBtn.classList.contains('first-run-restore')) {
                throw new Error('import does not carry the low-key recovery styling');
            }
            const legal = dialog.querySelectorAll('.title-screen-legal a');
            if (legal.length !== 4) throw new Error(`expected 4 legal links, got ${legal.length}`);
            actions.forEach((a) => {
                if (!a.textContent.trim()) throw new Error('an action rendered with no label');
            });
        } finally {
            titleScreen.close();
        }
    });

    await test('does NOT use .first-run-choice, which critical.css hides', () => {
        // html:not(.mc-first-run) .first-run-choice { display: none } — a returning
        // user never carries that class, so this surface would never be seen.
        titleScreen.open();
        const dialog = document.getElementById(DOM_IDS.TITLE_SCREEN);
        const usesHiddenClass = !!dialog.querySelector('.first-run-choice')
            || dialog.classList.contains('first-run-choice');
        titleScreen.close();
        if (usesHiddenClass) throw new Error('.first-run-choice is hidden without html.mc-first-run');
    });

    await test('the credit line links to the company and the product page', () => {
        titleScreen.open();
        const dialog = document.getElementById(DOM_IDS.TITLE_SCREEN);
        const credit = dialog.querySelector('.title-screen-credit');
        const hrefs = credit ? [...credit.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [];
        const year = String(new Date().getFullYear());
        const hasYear = credit && credit.textContent.includes(year);
        titleScreen.close();
        if (!credit) throw new Error('credit line missing');
        if (!hrefs.some((h) => /sparkincreations/i.test(h))) throw new Error('no company link');
        if (!hrefs.some((h) => /product\.html/.test(h))) throw new Error('no product page link');
        if (!hasYear) throw new Error(`credit does not show the current year (${year}) — is it baked?`);
    });

    await test('external links carry rel="noopener noreferrer"', () => {
        titleScreen.open();
        const dialog = document.getElementById(DOM_IDS.TITLE_SCREEN);
        const bad = [...dialog.querySelectorAll('a[target="_blank"]')]
            .filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel));
        titleScreen.close();
        if (bad.length) throw new Error(`${bad.length} target=_blank link(s) missing rel protection`);
    });

    // ============================================
    // 🧹 LIFECYCLE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Lifecycle</h4>';

    await test('close() removes the overlay from the document', () => {
        titleScreen.open();
        if (!document.getElementById(DOM_IDS.TITLE_SCREEN)) throw new Error('did not open');
        titleScreen.close();
        if (document.getElementById(DOM_IDS.TITLE_SCREEN)) throw new Error('overlay survived close — it leaks listeners');
    });

    await test('open() twice does not stack two overlays', () => {
        titleScreen.open();
        titleScreen.open();
        const count = document.querySelectorAll(`#${DOM_IDS.TITLE_SCREEN}`).length;
        titleScreen.close();
        if (count !== 1) throw new Error(`${count} overlays in the document`);
    });

    await test('close() is safe when nothing is open', () => {
        titleScreen.close();
        titleScreen.close();
        if (titleScreen.overlay !== null) throw new Error('overlay reference left dangling');
        if (document.getElementById(DOM_IDS.TITLE_SCREEN)) throw new Error('a redundant close left an overlay behind');
    });

    await test('init() labels the menu button WITHOUT destroying its icon', async () => {
        const btn = document.createElement('button');
        btn.id = DOM_IDS.MENU_OPEN_TITLE_SCREEN;
        btn.innerHTML = '<span class="icon" aria-hidden="true">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg></span>' +
            '<span class="menu-item-label">Welcome Screen</span>';
        document.body.appendChild(btn);
        try {
            titleScreen.initialized = false;
            await titleScreen.init();
            if (!btn.querySelector('.icon svg')) throw new Error('init() destroyed the button icon');
            const label = btn.querySelector('.menu-item-label');
            if (!label.textContent.trim()) throw new Error('label span not populated');
            if (btn.textContent.trim() !== label.textContent.trim()) {
                throw new Error(`button text duplicated: "${btn.textContent.trim()}"`);
            }
        } finally {
            titleScreen.destroy();
            btn.remove();
        }
    });

    await test('destroy() closes the overlay and clears the initialized flag', () => {
        titleScreen.open();
        titleScreen.destroy();
        if (titleScreen.initialized) throw new Error('initialized still true after destroy()');
        if (document.getElementById(DOM_IDS.TITLE_SCREEN)) throw new Error('overlay survived destroy()');
    });

    // ============================================
    // 💾 PARKED-SURFACE PERSISTENCE
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Parked-Surface Persistence</h4>';

    await test('opening records the surface, closing records the routine', () => {
        wire(makeAppState(true, {}));
        titleScreen.open();
        if (appState._settings.lastSurface !== 'titleScreen') {
            throw new Error(`open() stored ${JSON.stringify(appState._settings.lastSurface)}`);
        }
        titleScreen.close();
        if (appState._settings.lastSurface !== 'routine') {
            throw new Error(`close() stored ${JSON.stringify(appState._settings.lastSurface)}`);
        }
    });

    await test('nothing is written before state is ready', () => {
        // AppState.update() is a documented no-op on a first run: it warns and
        // returns WITHOUT running the producer. Calling it anyway would look
        // like it worked, so the module must not call it at all.
        wire(makeAppState(false, {}));
        titleScreen.open();
        titleScreen.close();
        if (appState._updates !== 0) throw new Error(`update() called ${appState._updates}x before state was ready`);
        if ('lastSurface' in appState._settings) throw new Error('wrote a surface with no state to write to');
    });

    await test('init() restores the overlay only when it was the parked surface', async () => {
        wire(makeAppState(true, { lastSurface: 'routine' }));
        titleScreen.initialized = false;
        await titleScreen.init();
        const openedForRoutine = !!document.getElementById(DOM_IDS.TITLE_SCREEN);
        titleScreen.destroy();

        wire(makeAppState(true, { lastSurface: 'titleScreen' }));
        titleScreen.initialized = false;
        await titleScreen.init();
        const openedForParked = !!document.getElementById(DOM_IDS.TITLE_SCREEN);
        titleScreen.destroy();

        if (openedForRoutine) throw new Error('restored the overlay for a user who left on their routine');
        if (!openedForParked) throw new Error('did NOT restore the overlay for a user who parked here');
    });

    await test('a first-run user is never restored into the overlay', async () => {
        wire(makeAppState(false, {}));
        titleScreen.initialized = false;
        await titleScreen.init();
        const opened = !!document.getElementById(DOM_IDS.TITLE_SCREEN);
        titleScreen.destroy();
        if (opened) throw new Error('opened the overlay for a user with no state');
    });

    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${Math.round((passed.count / total.count) * 100)}%)</h3>`;

    // Return the counts: the automated runner scores on this, not on the DOM.
    return { passed: passed.count, total: total.count };
}
