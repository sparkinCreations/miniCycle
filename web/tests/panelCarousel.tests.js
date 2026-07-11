/**
 * PanelCarousel Tests
 * Tests for modules/ui/panelCarousel.js — the indexed panel registry that
 * generalizes the task-view ↔ stats-panel switcher (FOCUS_TASK_VIEW_PLAN
 * Phase 0). Pure class, so tests build DOM fixtures directly.
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runPanelCarouselTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { PanelCarousel } = await import(`../modules/ui/panelCarousel.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>PanelCarousel Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ------------------------------------------------------------------
    // Fixture: N panels + dots, registered in order. First panel is active.
    // ------------------------------------------------------------------
    const buildCarousel = (ids, hooks = {}) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const carousel = new PanelCarousel();
        const els = {};
        for (const id of ids) {
            const el = document.createElement('section');
            el.id = `pc-${id}`;
            const dot = document.createElement('button');
            dot.setAttribute('aria-controls', id);
            host.append(el, dot);
            els[id] = { el, dot };
            carousel.register({
                id,
                element: el,
                dot,
                onShow: hooks.onShow ? () => hooks.onShow(id) : null,
                onHide: hooks.onHide ? () => hooks.onHide(id) : null
            });
        }
        return { carousel, els, cleanup: () => host.remove() };
    };

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Registration & ordering</h4>';

    await test('registration order defines index order; first panel starts active', () => {
        const { carousel, cleanup } = buildCarousel(['a', 'b', 'c']);
        try {
            if (carousel.getActiveIndex() !== 0) throw new Error('Initial active index should be 0');
            if (carousel.getActiveId() !== 'a') throw new Error('Initial active id should be first registered');
        } finally { cleanup(); }
    });

    await test('register without id or element is ignored', () => {
        const carousel = new PanelCarousel();
        carousel.register({ id: 'x' });               // no element
        carousel.register({ element: document.createElement('div') }); // no id
        if (carousel.panels.length !== 0) throw new Error('Invalid registrations were accepted');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🧭 navigate / goTo / cycleNext</h4>';

    await test('navigate(+1/-1) moves and returns {id,index}; clamps to null at ends', () => {
        const { carousel, cleanup } = buildCarousel(['a', 'b']);
        try {
            const fwd = carousel.navigate(1);
            if (!fwd || fwd.id !== 'b' || fwd.index !== 1) throw new Error(`navigate(1) → ${JSON.stringify(fwd)}`);
            const clamped = carousel.navigate(1);
            if (clamped !== null) throw new Error('navigate(1) at end should return null (never undefined)');
            const back = carousel.navigate(-1);
            if (!back || back.id !== 'a') throw new Error('navigate(-1) should return to first panel');
            if (carousel.navigate(-1) !== null) throw new Error('navigate(-1) at start should clamp to null');
        } finally { cleanup(); }
    });

    await test('goTo works by id and by index; unknown target returns null', () => {
        const { carousel, cleanup } = buildCarousel(['a', 'b', 'c']);
        try {
            if (carousel.goTo('c')?.index !== 2) throw new Error('goTo by id failed');
            if (carousel.goTo(0)?.id !== 'a') throw new Error('goTo by index failed');
            if (carousel.goTo('nope') !== null) throw new Error('goTo unknown id should return null');
            if (carousel.goTo(99) !== null) throw new Error('goTo out-of-range index should return null');
        } finally { cleanup(); }
    });

    await test('cycleNext advances and wraps (two panels = the historical toggle)', () => {
        const { carousel, cleanup } = buildCarousel(['a', 'b']);
        try {
            if (carousel.cycleNext()?.id !== 'b') throw new Error('cycleNext should advance');
            if (carousel.cycleNext()?.id !== 'a') throw new Error('cycleNext should wrap to start');
        } finally { cleanup(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ DOM state (classes, inert, dots)</h4>';

    await test('active panel gets show class + inert=false; others hide + inert=true', () => {
        const { carousel, els, cleanup } = buildCarousel(['a', 'b']);
        try {
            carousel.navigate(1);
            if (!els.b.el.classList.contains('show') || els.b.el.inert) throw new Error('Active panel state wrong');
            if (!els.a.el.classList.contains('hide') || !els.a.el.inert) throw new Error('Inactive panel state wrong');
        } finally { cleanup(); }
    });

    await test('hidden panels get directional classes relative to the active panel', () => {
        const { carousel, els, cleanup } = buildCarousel(['a', 'b', 'c']);
        try {
            carousel.goTo('b'); // middle active: a is left, c is right
            if (!els.a.el.classList.contains('hide-left')) throw new Error('Lower-index panel should get hide-left');
            if (!els.c.el.classList.contains('hide-right')) throw new Error('Higher-index panel should get hide-right');
            carousel.goTo('a'); // first active: b and c both right
            if (!els.b.el.classList.contains('hide-right') || !els.c.el.classList.contains('hide-right')) {
                throw new Error('Panels right of active should get hide-right');
            }
            if (els.a.el.classList.contains('hide-left') || els.a.el.classList.contains('hide-right')) {
                throw new Error('Active panel must carry no directional class');
            }
        } finally { cleanup(); }
    });

    await test('dots track active state with class AND aria-selected', () => {
        const { carousel, els, cleanup } = buildCarousel(['a', 'b']);
        try {
            carousel.navigate(1);
            if (!els.b.dot.classList.contains('active')) throw new Error('Active dot missing class');
            if (els.b.dot.getAttribute('aria-selected') !== 'true') throw new Error('Active dot aria-selected wrong');
            if (els.a.dot.classList.contains('active')) throw new Error('Inactive dot kept active class');
            if (els.a.dot.getAttribute('aria-selected') !== 'false') throw new Error('Inactive dot aria-selected wrong');
        } finally { cleanup(); }
    });

    await test('initTo sets index + inert + dots but writes NO show/hide classes and fires NO callbacks', () => {
        let showCalls = 0;
        const { carousel, els, cleanup } = buildCarousel(['a', 'b'], { onShow: () => showCalls++ });
        try {
            carousel.initTo('a');
            if (showCalls !== 0) throw new Error('initTo must not fire onShow');
            if (els.a.el.classList.contains('show') || els.b.el.classList.contains('hide')) {
                throw new Error('initTo must not write show/hide classes (boot markup owns first paint)');
            }
            if (!els.b.el.inert || els.a.el.inert) throw new Error('initTo inert state wrong');
            if (!els.a.dot.classList.contains('active')) throw new Error('initTo dot state wrong');
        } finally { cleanup(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔗 Callbacks</h4>';

    await test('onShow fires for target (even re-shown); onHide only on actual change', () => {
        const shows = [], hides = [];
        const { carousel, cleanup } = buildCarousel(['a', 'b'], {
            onShow: (id) => shows.push(id),
            onHide: (id) => hides.push(id)
        });
        try {
            carousel.goTo('b');   // a→b: hide a, show b
            carousel.goTo('b');   // re-show b: show b only (idempotent re-show, historical behavior)
            if (shows.join(',') !== 'b,b') throw new Error(`onShow calls: ${shows}`);
            if (hides.join(',') !== 'a') throw new Error(`onHide calls: ${hides}`);
        } finally { cleanup(); }
    });

    await test('a throwing onShow does not break the switch', () => {
        const carousel = new PanelCarousel();
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
            const mk = () => { const e = document.createElement('div'); host.appendChild(e); return e; };
            carousel.register({ id: 'a', element: mk() });
            carousel.register({ id: 'b', element: mk(), onShow: () => { throw new Error('boom'); } });
            const result = carousel.navigate(1);
            if (!result || carousel.getActiveId() !== 'b') throw new Error('Switch should survive a throwing callback');
        } finally { host.remove(); }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🚧 Enable gates (Phase 2 groundwork)</h4>';

    await test('setPanelEnabled(false) makes a panel unreachable; navigate skips over it', () => {
        const { carousel, cleanup } = buildCarousel(['a', 'b', 'c']);
        try {
            carousel.setPanelEnabled('b', false);
            const result = carousel.navigate(1);
            if (result?.id !== 'c') throw new Error(`navigate should skip disabled panel, landed on ${result?.id}`);
            if (carousel.goTo('b') !== null) throw new Error('goTo a disabled panel should return null');
        } finally { cleanup(); }
    });

    await test('isEnabled() dynamic gate is checked lazily at navigation time', () => {
        const carousel = new PanelCarousel();
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
            let gateOpen = false;
            const mk = () => { const e = document.createElement('div'); host.appendChild(e); return e; };
            carousel.register({ id: 'gated', element: mk(), isEnabled: () => gateOpen });
            carousel.register({ id: 'main', element: mk() });
            carousel.initTo('main');
            if (carousel.navigate(-1) !== null) throw new Error('Closed gate should block navigation');
            gateOpen = true;
            if (carousel.navigate(-1)?.id !== 'gated') throw new Error('Open gate should allow navigation');
        } finally { host.remove(); }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    return { passed: passed.count, total: total.count };
}
