/**
 * ModalTemplates Tests
 * Tests for modules/boot/modalTemplates.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModalTemplatesTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/boot/modalTemplates.js?v=${cacheBuster}`);
    const { DEFAULT_LABELS, LENS_SENSITIVE_KEYS } = await import(`../modules/labels/defaultLabels.js?v=${cacheBuster}`);

    const getDefaultLabel = (key) => {
        const [cat, name] = key.split('.');
        return DEFAULT_LABELS?.[cat]?.[name];
    };

    resultsDiv.innerHTML = '<h2>ModalTemplates Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('RECURRING_PANEL_HTML is a non-empty string', () => {
        if (typeof mod.RECURRING_PANEL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.RECURRING_PANEL_HTML}`);
        }
        if (mod.RECURRING_PANEL_HTML.length === 0) {
            throw new Error('RECURRING_PANEL_HTML is empty');
        }
    });

    await test('PREFERENCES_MODAL_HTML is a non-empty string', () => {
        if (typeof mod.PREFERENCES_MODAL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.PREFERENCES_MODAL_HTML}`);
        }
        if (mod.PREFERENCES_MODAL_HTML.length === 0) {
            throw new Error('PREFERENCES_MODAL_HTML is empty');
        }
    });

    await test('SETTINGS_MODAL_HTML is a non-empty string', () => {
        if (typeof mod.SETTINGS_MODAL_HTML !== 'string') {
            throw new Error(`Expected string, got ${typeof mod.SETTINGS_MODAL_HTML}`);
        }
        if (mod.SETTINGS_MODAL_HTML.length === 0) {
            throw new Error('SETTINGS_MODAL_HTML is empty');
        }
    });

    resultsDiv.innerHTML += '<h4 class="test-section">🏷️ data-label-key lens sweep (July 2026 audit M2)</h4>';

    // Parse tagged elements out of all three injected templates. The vocab-lens
    // sweep in themeManager._refreshLiveLensLabels() does el.textContent =
    // getLabel(el.dataset.labelKey), so every tag must satisfy the invariants below
    // or it will either silently do nothing or clobber wrong content.
    const allHtml = mod.RECURRING_PANEL_HTML + mod.PREFERENCES_MODAL_HTML + mod.SETTINGS_MODAL_HTML;
    const doc = new DOMParser().parseFromString(`<div>${allHtml}</div>`, 'text/html');
    const tagged = [...doc.querySelectorAll('[data-label-key]')];

    await test('at least one element is tagged (fix present)', () => {
        if (tagged.length === 0) throw new Error('No data-label-key elements — M2 fix missing');
    });

    await test('every data-label-key resolves to a real DEFAULT_LABELS entry', () => {
        const bad = tagged.map(el => el.dataset.labelKey).filter(k => getDefaultLabel(k) === undefined);
        if (bad.length) throw new Error(`Unknown label keys tagged: ${bad.join(', ')}`);
    });

    await test('every data-label-key is lens-sensitive (sweeping a non-lens key is pointless)', () => {
        const notLens = tagged.map(el => el.dataset.labelKey).filter(k => !LENS_SENSITIVE_KEYS.has(k));
        if (notLens.length) throw new Error(`Non-lens keys tagged (won't ever change, drop the tag): ${notLens.join(', ')}`);
    });

    await test('tagged text matches the default label (no interpolation/count baked in)', () => {
        // The sweep overwrites textContent wholesale — if the baked text differs from
        // the pure default label, the element has interpolation/pluralization and must
        // NOT carry the tag (the sweep would drop the dynamic part).
        const mismatched = tagged
            .filter(el => el.textContent.trim() !== String(getDefaultLabel(el.dataset.labelKey)).trim())
            .map(el => `${el.dataset.labelKey}: "${el.textContent.trim()}" ≠ "${getDefaultLabel(el.dataset.labelKey)}"`);
        if (mismatched.length) throw new Error(`Tagged element text is not a pure label: ${mismatched.join(' | ')}`);
    });

    await test('elements with sibling icons wrap the label in a child span (icon-preservation)', () => {
        // A tagged element whose PARENT is a <button> must be an inner span, not the
        // button itself — otherwise the sweep's textContent wipe removes the icon.
        // Assert the two icon buttons keep their <i>/<span class="icon"> sibling.
        for (const id of ['backup-mini-cycles', 'restore-mini-cycles']) {
            const btn = doc.getElementById(id);
            if (!btn) throw new Error(`${id} not found in template`);
            if (btn.hasAttribute('data-label-key')) {
                throw new Error(`${id} is tagged directly — sweep would wipe its icon; wrap the text in a span instead`);
            }
            if (!btn.querySelector('[data-label-key]')) throw new Error(`${id} label span not tagged`);
            if (!btn.querySelector('i')) throw new Error(`${id} lost its icon element`);
        }
    });

    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
