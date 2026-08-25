/**
 * Onboarding Carousel Tests
 *
 * The first-run welcome carousel extracted from onboardingManager.js in
 * Priority 8 step 3 (LARGE_MODULE_SPLITS_PLAN.md).
 *
 * onboardingManager.tests.js drives the welcome LIFECYCLE through the manager and
 * was left untouched — those 47 tests still passing is the evidence the move
 * preserved behaviour. This file covers what they cannot: the seam.
 *
 * The carousel is the widest of the three onboarding extractions — 22 instance
 * fields, none of which moved. Every test here asserts something that only breaks
 * if the ownership boundary is wired wrongly.
 */
import { createProtectedTest } from './testHelpers.js';

export async function runOnboardingCarouselTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { OnboardingCarousel } = await import(`../modules/ui/onboardingCarousel.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>🎠 Onboarding Carousel Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    /** Stand-in manager. Carousel STATE lives here, exactly as in the real one. */
    function makeManager() {
        return {
            _firstRunWelcomeBanner: null,
            _firstRunWelcomeSlides: [],
            _firstRunWelcomeSlideIndex: 0,
            _firstRunWelcomeSlideTimer: null,
            _firstRunWelcomePaused: false,
            _firstRunWelcomeToggleMode: null,
            _firstRunWelcomeMessageEl: null,
            _firstRunWelcomeTitleEl: null,
            _firstRunWelcomeBodyCleanup: null,
            _demo: { _buildCycleDemo() {}, _buildTryItDynamic() {} },
            get deps() { return { AppState: { get: () => ({}) }, showCycleCreationModal: () => {} }; }
        };
    }

    await test('carousel STATE stays on the manager, not on the sub-module', () => {
        // 22 fields, none migrated — the manager's destroy() still clears every
        // timer, observer and handler it always cleared. A field that quietly
        // moved here would leave destroy() reaching for something that no longer
        // exists, and nothing would say so.
        const m = makeManager();
        const c = new OnboardingCarousel(m);
        for (const key of ['_firstRunWelcomeBanner', '_firstRunWelcomeSlides',
                           '_firstRunWelcomeSlideIndex', '_firstRunWelcomeSlideTimer',
                           '_firstRunWelcomePaused', '_firstRunWelcomeBodyCleanup']) {
            if (Object.prototype.hasOwnProperty.call(c, key)) {
                throw new Error(`${key} must live on the manager, not the sub-module`);
            }
        }
        if (c.m !== m) throw new Error('the sub-module must hold the manager back-reference');
    });

    await test('the message setter writes through to the element', () => {
        const m = makeManager();
        const c = new OnboardingCarousel(m);
        const el = document.createElement('div');
        document.body.appendChild(el);
        try {
            c._setFirstRunWelcomeMessageText(el, 'hello');
            if (!el.textContent.includes('hello')) {
                throw new Error(`expected the text to be written, got "${el.textContent}"`);
            }
        } finally { el.remove(); }
    });

    await test('the message setter splits on | and lifts a trailing arrow into its own span', () => {
        // Real behaviour, not an invented contract. An earlier version of this test
        // asserted the setter no-ops on a null element; it does not, and it should
        // not — every caller passes a live element, and a guard there would hide
        // broken wiring rather than surface it (rule 19). This asserts what the
        // method actually does, and it crosses the seam: onboardingDemo reaches it
        // through the manager's delegator.
        const c = new OnboardingCarousel(makeManager());
        const el = document.createElement('div');
        document.body.appendChild(el);
        try {
            c._setFirstRunWelcomeMessageText(el, 'first|second ↓');
            const ps = el.querySelectorAll('p');
            if (ps.length !== 2) throw new Error(`expected 2 paragraphs from one pipe, got ${ps.length}`);
            if (ps[0].textContent !== 'first') throw new Error(`first paragraph wrong: "${ps[0].textContent}"`);
            const arrow = el.querySelector('.first-run-welcome__arrow');
            if (!arrow) throw new Error('a trailing arrow should be lifted into its own span for CSS to animate');
            if (arrow.getAttribute('aria-hidden') !== 'true') {
                throw new Error('the decorative arrow must be hidden from assistive tech');
            }
        } finally { el.remove(); }
    });

    await test('advance scheduling reads and writes the timer field ON THE MANAGER', () => {
        // The seam that matters most: the scheduler is called from onboardingSplash
        // through the manager's delegator, and its timer must land where destroy()
        // looks for it.
        const m = makeManager();
        m._firstRunWelcomeSlides = [{ title: 'a' }, { title: 'b' }];
        const c = new OnboardingCarousel(m);
        try {
            c._scheduleFirstRunWelcomeAdvance();
            if (Object.prototype.hasOwnProperty.call(c, '_firstRunWelcomeSlideTimer')) {
                throw new Error('the timer must be stored on the manager, not the sub-module');
            }
        } finally {
            if (m._firstRunWelcomeSlideTimer) clearTimeout(m._firstRunWelcomeSlideTimer);
        }
    });

    await test('hiding a carousel that was never shown is inert', () => {
        const m = makeManager();
        const c = new OnboardingCarousel(m);
        c._hideFirstRunWelcome();          // must not throw with no banner present
        if (m._firstRunWelcomeBanner) throw new Error('nothing should have been created');
    });

    await test('pause toggling flips the manager-held flag, not a local one', () => {
        const m = makeManager();
        const c = new OnboardingCarousel(m);
        const before = m._firstRunWelcomePaused;
        c._toggleFirstRunWelcomePause();
        if (m._firstRunWelcomePaused === before) {
            throw new Error('the paused flag on the MANAGER should have flipped');
        }
        if (Object.prototype.hasOwnProperty.call(c, '_firstRunWelcomePaused')) {
            throw new Error('the sub-module must not shadow the paused flag');
        }
        if (m._firstRunWelcomeSlideTimer) clearTimeout(m._firstRunWelcomeSlideTimer);
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
