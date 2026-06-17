/**
 * IconInit Tests
 * Tests for modules/utils/iconInit.js
 *
 * Behavioral coverage for the Font-Awesome → inline-SVG replacement helpers:
 *   - replaceFAIcon: <i class="fas fa-trash"> → <span class="icon"><svg>…
 *   - replaceAllFAIcons: bulk replacement + count
 *   - createIcon: build span from FA class string
 *   - iconHTML: HTML string for innerHTML
 *   - guard / no-op paths (null, unknown icon names)
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runIconInitTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/utils/iconInit.js?v=${cacheBuster}`);
    const { replaceFAIcon, replaceAllFAIcons, createIcon, iconHTML, initIcons, ICONS } = mod;

    resultsDiv.innerHTML = '<h2>IconInit Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Pick an icon name known to exist in ICONS for positive cases.
    const KNOWN = 'trash';

    function makeFA(className) {
        const i = document.createElement('i');
        i.className = className;
        return i;
    }

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('exports replaceFAIcon, replaceAllFAIcons, createIcon, iconHTML, initIcons', () => {
        for (const fn of [replaceFAIcon, replaceAllFAIcons, createIcon, iconHTML, initIcons]) {
            if (typeof fn !== 'function') throw new Error('missing export');
        }
    });

    await test('re-exports ICONS map with the known test icon', () => {
        if (!ICONS || typeof ICONS !== 'object') throw new Error('ICONS not exported');
        if (typeof ICONS[KNOWN] !== 'string') throw new Error(`ICONS["${KNOWN}"] missing`);
    });

    // ── replaceFAIcon ────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔁 replaceFAIcon</h4>';

    await test('replaces <i class="fas fa-trash"> with span.icon containing an svg', () => {
        const host = document.createElement('div');
        const i = makeFA(`fas fa-${KNOWN}`);
        host.appendChild(i);
        document.body.appendChild(host);
        const span = replaceFAIcon(i);
        const result = host.querySelector('span.icon');
        cleanupHost(host);
        if (!span) throw new Error('returned null');
        if (span.tagName !== 'SPAN') throw new Error('not a span');
        if (!span.classList.contains('icon')) throw new Error('missing .icon class');
        if (span.getAttribute('aria-hidden') !== 'true') throw new Error('missing aria-hidden');
        if (!span.querySelector('svg')) throw new Error('no svg appended');
        if (result !== span) throw new Error('span not inserted into DOM in place of <i>');
    });

    await test('original <i> is removed from the DOM after replacement', () => {
        const host = document.createElement('div');
        const i = makeFA(`fas fa-${KNOWN}`);
        host.appendChild(i);
        document.body.appendChild(host);
        replaceFAIcon(i);
        const stillHasI = !!host.querySelector('i');
        cleanupHost(host);
        if (stillHasI) throw new Error('<i> should have been replaced');
    });

    await test('preserves non-FA custom classes on the new span', () => {
        const host = document.createElement('div');
        const i = makeFA(`fas fa-${KNOWN} my-custom-class another`);
        host.appendChild(i);
        document.body.appendChild(host);
        const span = replaceFAIcon(i);
        cleanupHost(host);
        if (!span.classList.contains('my-custom-class')) throw new Error('lost my-custom-class');
        if (!span.classList.contains('another')) throw new Error('lost another');
        if (span.classList.contains('fas')) throw new Error('should strip fas');
        if (span.className.includes('fa-')) throw new Error('should strip fa- classes');
    });

    await test('skips fa-solid/fa-regular/fa-brands modifier classes when finding name', () => {
        const host = document.createElement('div');
        // fa-solid must be skipped so it lands on fa-trash
        const i = makeFA(`fa-solid fa-${KNOWN}`);
        host.appendChild(i);
        document.body.appendChild(host);
        const span = replaceFAIcon(i);
        cleanupHost(host);
        if (!span || !span.querySelector('svg')) throw new Error('should resolve to trash icon');
    });

    await test('returns null for null element (no throw)', () => {
        if (replaceFAIcon(null) !== null) throw new Error('expected null');
    });

    await test('returns null for element without className', () => {
        const el = document.createElement('i');
        el.className = '';
        if (replaceFAIcon(el) !== null) throw new Error('expected null for empty className');
    });

    await test('returns null and does NOT replace for unknown icon name', () => {
        const host = document.createElement('div');
        const i = makeFA('fas fa-this-icon-does-not-exist-xyz');
        host.appendChild(i);
        document.body.appendChild(host);
        const result = replaceFAIcon(i);
        const stillHasI = !!host.querySelector('i');
        cleanupHost(host);
        if (result !== null) throw new Error('unknown icon should return null');
        if (!stillHasI) throw new Error('unknown icon should leave <i> untouched');
    });

    // ── replaceAllFAIcons ────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔂 replaceAllFAIcons</h4>';

    await test('replaces every known FA icon in a container and returns the count', () => {
        const host = document.createElement('div');
        host.appendChild(makeFA(`fas fa-${KNOWN}`));
        host.appendChild(makeFA('far fa-plus'));
        host.appendChild(makeFA('fa fa-check-circle'));
        document.body.appendChild(host);
        const count = replaceAllFAIcons(host);
        const spans = host.querySelectorAll('span.icon');
        const remainingI = host.querySelectorAll('i').length;
        cleanupHost(host);
        if (count !== 3) throw new Error('expected count 3, got ' + count);
        if (spans.length !== 3) throw new Error('expected 3 spans, got ' + spans.length);
        if (remainingI !== 0) throw new Error('expected 0 <i> left, got ' + remainingI);
    });

    await test('count excludes unknown icons (only successful replacements counted)', () => {
        const host = document.createElement('div');
        host.appendChild(makeFA(`fas fa-${KNOWN}`));
        host.appendChild(makeFA('fas fa-totally-unknown-icon'));
        document.body.appendChild(host);
        const count = replaceAllFAIcons(host);
        const remainingI = host.querySelectorAll('i').length;
        cleanupHost(host);
        if (count !== 1) throw new Error('expected count 1, got ' + count);
        if (remainingI !== 1) throw new Error('unknown <i> should remain, got ' + remainingI + ' left');
    });

    await test('returns 0 for container with no FA icons', () => {
        const host = document.createElement('div');
        host.appendChild(document.createElement('span'));
        document.body.appendChild(host);
        const count = replaceAllFAIcons(host);
        cleanupHost(host);
        if (count !== 0) throw new Error('expected 0, got ' + count);
    });

    // ── createIcon ───────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ createIcon</h4>';

    await test('creates span.icon with svg for a known FA class string', () => {
        const span = createIcon(`fas fa-${KNOWN}`);
        if (span.tagName !== 'SPAN') throw new Error('not a span');
        if (!span.classList.contains('icon')) throw new Error('missing .icon');
        if (span.getAttribute('aria-hidden') !== 'true') throw new Error('missing aria-hidden');
        if (!span.querySelector('svg')) throw new Error('no svg');
    });

    await test('returns an empty span.icon (no svg) for unknown icon name', () => {
        const span = createIcon('fas fa-not-a-real-icon-zzz');
        if (span.tagName !== 'SPAN') throw new Error('not a span');
        if (!span.classList.contains('icon')) throw new Error('missing .icon');
        if (span.querySelector('svg')) throw new Error('unknown icon should not contain svg');
    });

    // ── iconHTML ─────────────────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📝 iconHTML</h4>';

    await test('returns wrapped HTML string for a known icon', () => {
        const html = iconHTML(KNOWN);
        if (typeof html !== 'string') throw new Error('not a string');
        if (!html.startsWith('<span class="icon" aria-hidden="true">')) throw new Error('wrong wrapper: ' + html.slice(0, 40));
        if (!html.includes('<svg')) throw new Error('missing svg markup');
        if (!html.endsWith('</span>')) throw new Error('not closed properly');
    });

    await test('returns empty string for unknown icon name', () => {
        if (iconHTML('definitely-not-an-icon') !== '') throw new Error('expected empty string');
    });

    await test('iconHTML embeds the same SVG as the ICONS map', () => {
        const html = iconHTML(KNOWN);
        if (!html.includes(ICONS[KNOWN])) throw new Error('html should contain raw ICONS svg');
    });

    // ── initIcons (smoke: runs without throwing on an isolated subtree) ───────
    resultsDiv.innerHTML += '<h4 class="test-section">🚀 initIcons</h4>';

    await test('initIcons runs without throwing', () => {
        // initIcons targets document.body; just assert it does not throw.
        initIcons();
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };

    function cleanupHost(host) {
        if (host && host.parentNode) host.parentNode.removeChild(host);
    }
}
