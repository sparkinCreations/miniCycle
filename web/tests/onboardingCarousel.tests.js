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

    await test('REGRESSION (a11y): advancing announces "Slide N of M: <title>" through the live region', async () => {
        document.getElementById('live-region')?.remove();
        const region = document.createElement('div'); region.id = 'live-region';   // DOM_IDS.LIVE_REGION
        document.body.appendChild(region);
        const m = makeManager();
        m._firstRunWelcomeSlides = [{ title: 'One', message: 'a' }, { title: 'Two|Lines', message: 'b' }, { title: 'Three', message: 'c' }];
        m._firstRunWelcomeTitleEl = document.createElement('h2');
        m._firstRunWelcomeMessageEl = document.createElement('div');
        m._firstRunWelcomeBanner = document.createElement('div');
        const c = new OnboardingCarousel(m);
        try {
            c._advanceFirstRunWelcomeSlide();
            await new Promise(r => setTimeout(r, 450)); // fade (300ms) + announce's animation frame
            const spoken = region.textContent;
            if (!/slide 2 of 3/i.test(spoken)) throw new Error(`expected "Slide 2 of 3", live region says "${spoken}"`);
            if (!/Two Lines/.test(spoken)) throw new Error(`title should follow the position with | turned into a space, got "${spoken}"`);
        } finally {
            if (m._firstRunWelcomeSlideTimer) clearTimeout(m._firstRunWelcomeSlideTimer);
            region.remove();
        }
    });

    await test('the corner dismiss button says "Skip" until the last slide, then "Done"', () => {
        const m = makeManager();
        m._firstRunWelcomeSlides = [{ title: 'One', message: 'a' }, { title: 'Two', message: 'b' }, { title: 'All Set!', message: 'c' }];
        m._firstRunWelcomeBanner = document.createElement('div');
        const btn = document.createElement('button');
        btn.id = 'first-run-welcome-dismiss';   // DOM_IDS.FIRST_RUN_WELCOME_DISMISS
        btn.textContent = 'Skip';
        btn.setAttribute('aria-label', 'Skip welcome');
        m._firstRunWelcomeBanner.appendChild(btn);
        const c = new OnboardingCarousel(m);
        try {
            m._firstRunWelcomeSlideIndex = 0;
            c._scheduleFirstRunWelcomeAdvance();
            if (btn.textContent !== 'Skip') throw new Error(`slide 1 should keep "Skip", got "${btn.textContent}"`);
            if (!/skip/i.test(btn.getAttribute('aria-label'))) throw new Error('slide 1 aria-label should say skip');
            m._firstRunWelcomeSlideIndex = 2;
            c._scheduleFirstRunWelcomeAdvance();
            if (btn.textContent !== 'Done') throw new Error(`last slide should say "Done", got "${btn.textContent}"`);
            if (!/done/i.test(btn.getAttribute('aria-label'))) throw new Error('last slide aria-label should say done');
            m._firstRunWelcomeSlideIndex = 1;
            c._scheduleFirstRunWelcomeAdvance();
            if (btn.textContent !== 'Skip') throw new Error('replaying back to an earlier slide must restore "Skip"');
        } finally {
            if (m._firstRunWelcomeSlideTimer) clearTimeout(m._firstRunWelcomeSlideTimer);
        }
    });

    await test('To-Do mode: the first CLEAR pushes the celebration slides (titled "First Clear Complete!"); a cycle still titles "First Cycle Complete!"', () => {
        // The watcher only looked at cycleCount, which To-Do mode never
        // increments — so "All Set!" was unreachable there.
        const run = (routineBefore, routineAfter) => {
            const subs = new Map();
            let store = { appState: { activeRoutineId: 'c1' }, data: { routine: { c1: routineBefore } } };
            const m = makeManager();
            Object.defineProperty(m, 'deps', { get: () => ({ AppState: { get: () => store, subscribe: (k, fn) => subs.set(k, fn), unsubscribe: (k) => subs.delete(k) }, showCycleCreationModal: () => {} }) });
            m._firstRunWelcomeSlides = [{ title: '1' }, { title: '2' }, { title: '3' }, { title: 'Try it' }];
            m._firstRunWelcomeSlideIndex = 3;
            const c = new OnboardingCarousel(m);
            c._setupFirstRunWelcomeCycleWatch();
            store = { appState: { activeRoutineId: 'c1' }, data: { routine: { c1: routineAfter } } };
            subs.get('firstRunWelcome:cycleCompletion')?.(store);
            if (m._firstRunWelcomeSlideTimer) clearTimeout(m._firstRunWelcomeSlideTimer);
            return m._firstRunWelcomeSlides.map(s => s.title);
        };
        const todo = run({ tasks: [], deleteCheckedTasks: true, cycleCount: 0, clearedTasks: { totalCleared: 0 } },
                         { tasks: [], deleteCheckedTasks: true, cycleCount: 0, clearedTasks: { totalCleared: 2 } });
        if (todo.length !== 6) throw new Error(`a To-Do clear should push slides 5 & 6, got ${todo.length} slides`);
        if (todo[4] !== 'First Clear Complete!') throw new Error(`To-Do celebration title wrong: "${todo[4]}"`);
        const cycle = run({ tasks: [], autoReset: true, cycleCount: 0 }, { tasks: [], autoReset: true, cycleCount: 1 });
        if (cycle[4] !== 'First Cycle Complete!') throw new Error(`cycle celebration title wrong: "${cycle[4]}"`);
        const autoClear = run({ tasks: [], autoReset: true, cycleCount: 0, clearedTasks: { totalCleared: 0 } },
                              { tasks: [], autoReset: true, cycleCount: 0, clearedTasks: { totalCleared: 1 } });
        if (autoClear.length !== 4) throw new Error('a clear in a CYCLE mode must not count as the first success');
    });

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
