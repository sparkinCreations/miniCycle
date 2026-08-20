/**
 * CollapsibleSections Tests
 * Tests for modules/utils/collapsibleSections.js
 *
 * The accordion behaviour shared by the main menu, the settings modal and the
 * personalization modal. Tests build real DOM fixtures and assert:
 *   - the `collapsed` class and `aria-expanded` never drift apart
 *   - exclusivity: opening one section closes its siblings
 *   - non-exclusive mode leaves siblings alone (the setting turned off)
 *   - sections outside `siblings` are never swept (the live preview)
 *   - the setting's default and its resistance to junk values
 */
import { createProtectedTest } from './testHelpers.js';

export async function runCollapsibleSectionsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/collapsibleSections.js?v=${cacheBuster}`);
    const {
        isSectionExpanded, setSectionExpanded, toggleSectionExpanded,
        collapseAllSections, usesExclusiveSections
    } = mod;

    resultsDiv.innerHTML = '<h2>CollapsibleSections Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const HEADER = '.sec-header';

    // Build N sections, all collapsed unless listed in `open`.
    function makeSections(n, open = []) {
        const root = document.createElement('div');
        for (let i = 0; i < n; i++) {
            const sec = document.createElement('div');
            sec.className = 'sec';
            sec.dataset.section = `s${i}`;
            const isOpen = open.includes(i);
            if (!isOpen) sec.classList.add('collapsed');
            const header = document.createElement('div');
            header.className = 'sec-header';
            header.setAttribute('aria-expanded', String(isOpen));
            sec.appendChild(header);
            root.appendChild(sec);
        }
        document.body.appendChild(root);
        return root;
    }
    const secs = (root) => Array.from(root.querySelectorAll('.sec'));
    const openNames = (root) => secs(root).filter(s => !s.classList.contains('collapsed')).map(s => s.dataset.section);
    const arias = (root) => secs(root).map(s => s.querySelector(HEADER).getAttribute('aria-expanded'));
    const cleanup = (root) => root?.parentNode?.removeChild(root);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('exports the five helpers', () => {
        for (const fn of ['isSectionExpanded', 'setSectionExpanded', 'toggleSectionExpanded',
                          'collapseAllSections', 'usesExclusiveSections']) {
            if (typeof mod[fn] !== 'function') throw new Error(`${fn} is not exported as a function`);
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🎛️ Setting</h4>';

    // Absent key must read as ON: a routine that has never seen this setting
    // gets the accordion.
    await test('usesExclusiveSections defaults ON for absent settings', () => {
        if (!usesExclusiveSections(undefined)) throw new Error('undefined settings should be exclusive');
        if (!usesExclusiveSections({})) throw new Error('empty settings should be exclusive');
    });

    await test('usesExclusiveSections is OFF only for an explicit false', () => {
        if (usesExclusiveSections({ oneMenuSectionAtATime: false })) throw new Error('explicit false should be non-exclusive');
        if (!usesExclusiveSections({ oneMenuSectionAtATime: true })) throw new Error('explicit true should be exclusive');
    });

    // Compared against `false`, not coerced — a half-written or junk value must
    // not silently read as "off".
    await test('a junk stored value does not read as OFF', () => {
        for (const junk of [null, 0, '', 'false', NaN]) {
            if (!usesExclusiveSections({ oneMenuSectionAtATime: junk })) {
                throw new Error(`junk value ${JSON.stringify(junk)} disabled the accordion`);
            }
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🪗 Accordion</h4>';

    await test('opening a section closes its siblings', () => {
        const root = makeSections(3, [0]);
        setSectionExpanded(secs(root)[2], true, { siblings: secs(root), headerSelector: HEADER });
        const open = openNames(root);
        cleanup(root);
        if (open.length !== 1 || open[0] !== 's2') throw new Error(`expected only s2 open, got ${open.join(',')}`);
    });

    await test('aria-expanded follows the collapsed class on every section touched', () => {
        const root = makeSections(3, [0]);
        setSectionExpanded(secs(root)[2], true, { siblings: secs(root), headerSelector: HEADER });
        const a = arias(root);
        cleanup(root);
        // s0 was swept closed, s2 opened. A section whose class and aria drift
        // apart is what makes a collapsible lie to a screen reader.
        if (a.join(',') !== 'false,false,true') throw new Error(`aria-expanded was ${a.join(',')}, expected false,false,true`);
    });

    await test('closing a section does not disturb siblings', () => {
        const root = makeSections(3, [1]);
        setSectionExpanded(secs(root)[1], false, { siblings: secs(root), headerSelector: HEADER });
        const open = openNames(root);
        cleanup(root);
        if (open.length !== 0) throw new Error(`expected nothing open, got ${open.join(',')}`);
    });

    await test('toggle flips state and still sweeps siblings', () => {
        const root = makeSections(3, [0]);
        const applied = toggleSectionExpanded(secs(root)[1], { siblings: secs(root), headerSelector: HEADER });
        const open = openNames(root);
        cleanup(root);
        if (applied !== true) throw new Error('toggle should report the applied state');
        if (open.join(',') !== 's1') throw new Error(`expected only s1 open, got ${open.join(',')}`);
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🔀 Non-exclusive mode</h4>';

    await test('exclusive:false leaves siblings open', () => {
        const root = makeSections(3, [0]);
        setSectionExpanded(secs(root)[2], true, { siblings: secs(root), headerSelector: HEADER, exclusive: false });
        const open = openNames(root);
        cleanup(root);
        if (open.join(',') !== 's0,s2') throw new Error(`expected s0,s2 open, got ${open.join(',')}`);
    });

    // How the personalization modal keeps its live preview out of the accordion:
    // the preview is simply not in `siblings`.
    await test('a section absent from siblings is never swept closed', () => {
        const root = makeSections(3, [0, 1]);
        const group = [secs(root)[1], secs(root)[2]];   // s0 deliberately excluded
        setSectionExpanded(secs(root)[2], true, { siblings: group, headerSelector: HEADER });
        const open = openNames(root);
        cleanup(root);
        if (!open.includes('s0')) throw new Error('a section outside the group was closed');
        if (open.includes('s1')) throw new Error('a section inside the group was not closed');
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🧹 Collapse all</h4>';

    await test('collapseAllSections closes everything and syncs aria', () => {
        const root = makeSections(4, [0, 2, 3]);
        collapseAllSections(secs(root), HEADER);
        const open = openNames(root);
        const a = arias(root);
        cleanup(root);
        if (open.length !== 0) throw new Error(`expected nothing open, got ${open.join(',')}`);
        if (a.some(v => v !== 'false')) throw new Error(`aria-expanded not all false: ${a.join(',')}`);
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ Guards</h4>';

    await test('a null section is a no-op, not a throw', () => {
        if (setSectionExpanded(null, true, { headerSelector: HEADER }) !== false) {
            throw new Error('null section should report false');
        }
        if (isSectionExpanded(null) !== false) throw new Error('isSectionExpanded(null) should be false');
    });

    await test('a section with no matching header still updates its class', () => {
        const root = document.createElement('div');
        const sec = document.createElement('div');
        sec.className = 'sec collapsed';
        root.appendChild(sec);
        document.body.appendChild(root);
        setSectionExpanded(sec, true, { siblings: [sec], headerSelector: '.nope' });
        const opened = !sec.classList.contains('collapsed');
        cleanup(root);
        if (!opened) throw new Error('missing header should not block the class change');
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
