/**
 * UXRatings Tests
 * Tests for modules/features/uxRatings.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runUXRatingsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/features/uxRatings.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>UXRatings Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Minimal DOM fixture mirroring the feedback-form rating markup
    const buildFixture = () => {
        const host = document.createElement('div');
        host.id = 'ux-ratings-test-fixture';
        host.style.display = 'none';
        host.innerHTML = `
            <dialog id="feedback-modal">
                <form id="feedback-form">
                    <div id="feedback-rating-section">
                        <span id="feedback-rating-label"></span>
                        <div id="feedback-star-row" role="radiogroup">
                            ${[1, 2, 3, 4, 5].map(n => `
                                <button type="button" class="feedback-star" data-rating="${n}" role="radio" aria-checked="false"><i class="far fa-star"></i></button>
                            `).join('')}
                        </div>
                        <p id="feedback-rating-prompt"></p>
                        <span id="feedback-tags-label" class="hidden"></span>
                        <div id="feedback-tags-row" class="hidden"></div>
                        <p id="feedback-previous-rating" class="hidden"></p>
                        <input type="hidden" name="rating" id="feedback-rating-value" value="">
                        <input type="hidden" name="rating_tags" id="feedback-rating-tags-value" value="">
                    </div>
                    <textarea id="feedback-text" name="message"></textarea>
                </form>
            </dialog>
        `;
        document.body.appendChild(host);
        return host;
    };

    const makeMockState = () => {
        let state = { userProgress: {} };
        return {
            get: () => state,
            update: (producer, _immediate) => { producer(state); },
            _peek: () => state
        };
    };

    const makeDeps = (mockState) => ({
        AppState: mockState,
        appInit: { waitForCore: () => Promise.resolve() },
        safeAddEventListener: (el, ev, fn, opts) => {
            el.removeEventListener(ev, fn, opts);
            el.addEventListener(ev, fn, opts);
        },
        AppMeta: { version: 'test-1.0' }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setUXRatingsDependencies is exported as a function', () => {
        if (typeof mod.setUXRatingsDependencies !== 'function') throw new Error('Missing export');
    });

    await test('UXRatings class is exported', () => {
        if (typeof mod.UXRatings !== 'function') throw new Error('Missing export');
    });

    await test('initUXRatings is exported as a function', () => {
        if (typeof mod.initUXRatings !== 'function') throw new Error('Missing export');
    });

    await test('getUXRatings is exported as a function', () => {
        if (typeof mod.getUXRatings !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setUXRatingsDependencies accepts mock dependencies', () => {
        mod.setUXRatingsDependencies(makeDeps(makeMockState()));
    });

    await test('init is a no-op when rating markup is absent', async () => {
        mod.setUXRatingsDependencies(makeDeps(makeMockState()));
        const instance = new mod.UXRatings();
        await instance.init(); // No #feedback-rating-section fixture in DOM yet
        if (instance.initialized) throw new Error('Should not initialize without markup');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⭐ Star Rating Behavior</h4>';

    await test('init builds 6 tag buttons and applies labels', async () => {
        const host = buildFixture();
        try {
            mod.setUXRatingsDependencies(makeDeps(makeMockState()));
            const instance = new mod.UXRatings();
            await instance.init();
            const tags = host.querySelectorAll('.feedback-tag');
            if (tags.length !== 6) throw new Error(`Expected 6 tags, got ${tags.length}`);
            const label = host.querySelector('#feedback-rating-label').textContent;
            if (!label) throw new Error('Rating label not applied');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    await test('clicking a star sets hidden input, aria-checked, and reveals tags', async () => {
        const host = buildFixture();
        try {
            mod.setUXRatingsDependencies(makeDeps(makeMockState()));
            const instance = new mod.UXRatings();
            await instance.init();

            host.querySelectorAll('.feedback-star')[3].click(); // 4 stars

            const hidden = host.querySelector('#feedback-rating-value').value;
            if (hidden !== '4/5') throw new Error(`Expected "4/5", got "${hidden}"`);
            const checked = host.querySelectorAll('.feedback-star')[3].getAttribute('aria-checked');
            if (checked !== 'true') throw new Error('aria-checked not set');
            if (host.querySelector('#feedback-tags-row').classList.contains('hidden')) {
                throw new Error('Tags row should be revealed');
            }
            const prompt = host.querySelector('#feedback-rating-prompt').textContent;
            if (!prompt) throw new Error('Adaptive prompt not set');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    await test('toggling tags writes human-readable labels to hidden input', async () => {
        const host = buildFixture();
        try {
            mod.setUXRatingsDependencies(makeDeps(makeMockState()));
            const instance = new mod.UXRatings();
            await instance.init();

            host.querySelectorAll('.feedback-star')[4].click();
            const tags = host.querySelectorAll('.feedback-tag');
            tags[0].click();
            tags[1].click();

            const value = host.querySelector('#feedback-rating-tags-value').value;
            if (!value.includes(',')) throw new Error(`Expected two labels, got "${value}"`);
            if (value.includes('easyToUse')) throw new Error('Should send labels, not internal keys');

            tags[0].click(); // Untoggle
            const after = host.querySelector('#feedback-rating-tags-value').value;
            if (after.includes(',')) throw new Error('Untoggle did not remove the tag');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Persistence</h4>';

    await test('form submit with rating saves to userProgress with capped history', async () => {
        const host = buildFixture();
        try {
            const mockState = makeMockState();
            mod.setUXRatingsDependencies(makeDeps(mockState));
            const instance = new mod.UXRatings();
            await instance.init();

            host.querySelectorAll('.feedback-star')[2].click(); // 3 stars
            host.querySelector('#feedback-form').dispatchEvent(new Event('submit', { cancelable: true }));

            const saved = mockState._peek().userProgress.uxRating;
            if (!saved || saved.stars !== 3) throw new Error('Rating not saved to userProgress');
            if (saved.appVersion !== 'test-1.0') throw new Error('appVersion not stamped');
            if (mockState._peek().userProgress.uxRatingHistory.length !== 1) {
                throw new Error('History entry not recorded');
            }
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    await test('form submit without rating does not touch userProgress', async () => {
        const host = buildFixture();
        try {
            const mockState = makeMockState();
            mod.setUXRatingsDependencies(makeDeps(mockState));
            const instance = new mod.UXRatings();
            await instance.init();

            host.querySelector('#feedback-form').dispatchEvent(new Event('submit', { cancelable: true }));

            if (mockState._peek().userProgress.uxRating) throw new Error('Should not save without rating');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    await test('previous-rating note is shown when a rating exists in state', async () => {
        const host = buildFixture();
        try {
            const mockState = makeMockState();
            mockState._peek().userProgress.uxRating = { stars: 4, timestamp: new Date().toISOString() };
            mod.setUXRatingsDependencies(makeDeps(mockState));
            const instance = new mod.UXRatings();
            await instance.init();

            const note = host.querySelector('#feedback-previous-rating');
            if (note.classList.contains('hidden')) throw new Error('Note should be visible');
            if (!note.textContent.includes('4')) throw new Error('Note should mention the star count');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Reset & Teardown</h4>';

    await test('closing the dialog resets stars, tags, and hidden inputs', async () => {
        const host = buildFixture();
        try {
            mod.setUXRatingsDependencies(makeDeps(makeMockState()));
            const instance = new mod.UXRatings();
            await instance.init();

            host.querySelectorAll('.feedback-star')[4].click();
            host.querySelectorAll('.feedback-tag')[0].click();

            // Simulate dialog close: the module observes the [open] attribute
            const dialog = host.querySelector('#feedback-modal');
            dialog.setAttribute('open', '');
            await new Promise(r => setTimeout(r, 0));
            dialog.removeAttribute('open');
            await new Promise(r => setTimeout(r, 0)); // MutationObserver microtask

            if (host.querySelector('#feedback-rating-value').value !== '') {
                throw new Error('Hidden rating input not cleared');
            }
            if (!host.querySelector('#feedback-tags-row').classList.contains('hidden')) {
                throw new Error('Tags row not re-hidden');
            }
            const checked = host.querySelectorAll('.feedback-star[aria-checked="true"]');
            if (checked.length !== 0) throw new Error('Stars not unchecked');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    await test('destroy() disconnects and allows re-init', async () => {
        const host = buildFixture();
        try {
            mod.setUXRatingsDependencies(makeDeps(makeMockState()));
            const instance = new mod.UXRatings();
            await instance.init();
            instance.destroy();
            if (instance.initialized) throw new Error('destroy() should clear initialized');
            await instance.init();
            if (!instance.initialized) throw new Error('Re-init after destroy failed');
            instance.destroy();
        } finally {
            host.remove();
        }
    });

    // ============================================
    // Harness convention: the automated runner waits for an <h3> containing
    // "Results:" and parses "X/Y" from it — keep this format.
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
