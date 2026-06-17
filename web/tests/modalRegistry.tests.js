/**
 * ModalRegistry Tests
 * Tests for modules/ui/modalRegistry.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runModalRegistryTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/modalRegistry.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>ModalRegistry Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Reset cache + restore real DI deps between/after each behavioral test so
    // we never leave the registry pointing at torn-down fixtures.
    const realDeps = {
        getElementById: (id) => document.getElementById(id),
        querySelector: (sel) => document.querySelector(sel)
    };
    const resetRegistry = () => {
        mod.clearModalCache();
        mod.setModalRegistryDependencies(realDeps);
    };
    resetRegistry();

    // ── Module Loading (keep original smoke checks) ──────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('MODAL_DEFS is an exported object with entries', () => {
        if (typeof mod.MODAL_DEFS !== 'object' || mod.MODAL_DEFS === null) {
            throw new Error(`Expected object, got ${typeof mod.MODAL_DEFS}`);
        }
        if (Object.keys(mod.MODAL_DEFS).length === 0) {
            throw new Error('MODAL_DEFS has no entries');
        }
    });

    await test('MODAL_NAMES is an array with entries', () => {
        if (!Array.isArray(mod.MODAL_NAMES)) {
            throw new Error(`Expected array, got ${typeof mod.MODAL_NAMES}`);
        }
        if (mod.MODAL_NAMES.length === 0) {
            throw new Error('MODAL_NAMES is empty');
        }
    });

    await test('setModalRegistryDependencies is an exported function', () => {
        if (typeof mod.setModalRegistryDependencies !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.setModalRegistryDependencies}`);
        }
    });

    await test('getModal is an exported function', () => {
        if (typeof mod.getModal !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.getModal}`);
        }
    });

    // ── MODAL_DEFS / MODAL_NAMES integrity ───────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🗂️ Definitions integrity</h4>';

    await test('MODAL_NAMES exactly matches MODAL_DEFS keys', () => {
        const defKeys = Object.keys(mod.MODAL_DEFS).sort();
        const names = [...mod.MODAL_NAMES].sort();
        if (defKeys.join(',') !== names.join(',')) {
            throw new Error(`MODAL_NAMES drift: defs=[${defKeys}] names=[${names}]`);
        }
    });

    await test('every MODAL_DEFS entry has a resolved (non-undefined) key', () => {
        for (const [name, def] of Object.entries(mod.MODAL_DEFS)) {
            if (def.key === undefined || def.key === null) {
                throw new Error(`Modal "${name}" has unresolved key (DOM_ID missing?)`);
            }
            if (def.method !== 'id' && def.method !== 'selector') {
                throw new Error(`Modal "${name}" has invalid method "${def.method}"`);
            }
        }
    });

    await test('taskOptionsCustomizer is marked cacheable:false (dynamic modal)', () => {
        if (mod.MODAL_DEFS.taskOptionsCustomizer?.cacheable !== false) {
            throw new Error('taskOptionsCustomizer must be cacheable:false — it is destroyed/recreated');
        }
    });

    await test('static modals do not set cacheable:false', () => {
        // help is static/persistent; feedback/settings are static dialogs
        ['feedback', 'about', 'settings', 'help'].forEach(name => {
            if (mod.MODAL_DEFS[name]?.cacheable === false) {
                throw new Error(`Static modal "${name}" should be cacheable`);
            }
        });
    });

    // ── getModal: lookup + caching behavior ──────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 getModal lookup & caching</h4>';

    await test('getModal returns the matching DOM element by id', () => {
        resetRegistry();
        const el = document.createElement('dialog');
        el.id = mod.MODAL_DEFS.feedback.key;
        document.body.appendChild(el);
        try {
            const got = mod.getModal('feedback');
            if (got !== el) throw new Error('did not return the element matching the modal id');
        } finally {
            document.body.removeChild(el);
            resetRegistry();
        }
    });

    await test('unknown modal name returns null (no throw)', () => {
        resetRegistry();
        const got = mod.getModal('definitely-not-a-modal');
        if (got !== null) throw new Error('expected null for unknown modal, got ' + got);
    });

    await test('static modal is cached: returns stale element after DOM removal', () => {
        resetRegistry();
        const el = document.createElement('dialog');
        el.id = mod.MODAL_DEFS.about.key;
        document.body.appendChild(el);
        try {
            const first = mod.getModal('about'); // caches
            if (first !== el) throw new Error('first lookup wrong');
            document.body.removeChild(el); // gone from DOM
            const second = mod.getModal('about'); // should still be cached el
            if (second !== el) throw new Error('cache did not return stale element');
        } finally {
            if (el.parentNode) document.body.removeChild(el);
            resetRegistry();
        }
    });

    await test('dynamic modal (cacheable:false) always re-queries the DOM', () => {
        resetRegistry();
        const key = mod.MODAL_DEFS.taskOptionsCustomizer.key;
        const el1 = document.createElement('dialog');
        el1.id = key;
        document.body.appendChild(el1);
        try {
            const first = mod.getModal('taskOptionsCustomizer');
            if (first !== el1) throw new Error('first dynamic lookup wrong');
            // Simulate destroy + recreate
            document.body.removeChild(el1);
            const el2 = document.createElement('dialog');
            el2.id = key;
            document.body.appendChild(el2);
            const second = mod.getModal('taskOptionsCustomizer');
            if (second !== el2) throw new Error('dynamic modal returned stale element — cache bypass broken');
            document.body.removeChild(el2);
        } finally {
            resetRegistry();
        }
    });

    await test('null element is NOT cached (retries on next call)', () => {
        resetRegistry();
        const key = mod.MODAL_DEFS.themes.key;
        // First call: element missing → returns null, must not poison cache
        const first = mod.getModal('themes');
        if (first !== null) throw new Error('expected null when element absent');
        // Now add it; a fresh lookup must find it (proves null wasn't cached)
        const el = document.createElement('dialog');
        el.id = key;
        document.body.appendChild(el);
        try {
            const second = mod.getModal('themes');
            if (second !== el) throw new Error('null was cached — element added later not found');
        } finally {
            document.body.removeChild(el);
            resetRegistry();
        }
    });

    // ── invalidateModal / clearModalCache ────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🧹 cache invalidation</h4>';

    await test('invalidateModal forces a fresh re-query for that modal', () => {
        resetRegistry();
        const key = mod.MODAL_DEFS.reminders.key;
        const el1 = document.createElement('dialog');
        el1.id = key;
        document.body.appendChild(el1);
        try {
            mod.getModal('reminders'); // cache el1
            document.body.removeChild(el1);
            const el2 = document.createElement('dialog');
            el2.id = key;
            document.body.appendChild(el2);
            mod.invalidateModal('reminders'); // drop stale cache
            const got = mod.getModal('reminders');
            if (got !== el2) throw new Error('invalidateModal did not force re-query');
            document.body.removeChild(el2);
        } finally {
            resetRegistry();
        }
    });

    await test('clearModalCache drops all cached entries', () => {
        resetRegistry();
        const fEl = document.createElement('dialog');
        fEl.id = mod.MODAL_DEFS.feedback.key;
        const aEl = document.createElement('dialog');
        aEl.id = mod.MODAL_DEFS.about.key;
        document.body.append(fEl, aEl);
        try {
            mod.getModal('feedback');
            mod.getModal('about');
            // Remove originals, add replacements
            document.body.removeChild(fEl);
            document.body.removeChild(aEl);
            const fEl2 = document.createElement('dialog');
            fEl2.id = mod.MODAL_DEFS.feedback.key;
            const aEl2 = document.createElement('dialog');
            aEl2.id = mod.MODAL_DEFS.about.key;
            document.body.append(fEl2, aEl2);
            mod.clearModalCache();
            if (mod.getModal('feedback') !== fEl2) throw new Error('feedback still cached after clear');
            if (mod.getModal('about') !== aEl2) throw new Error('about still cached after clear');
            document.body.removeChild(fEl2);
            document.body.removeChild(aEl2);
        } finally {
            resetRegistry();
        }
    });

    // ── DI: getModal uses injected lookup fns ────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔌 dependency injection</h4>';

    await test('getModal routes id lookups through injected getElementById', () => {
        const sentinel = document.createElement('dialog');
        let calledWith = null;
        mod.clearModalCache();
        mod.setModalRegistryDependencies({
            getElementById: (id) => { calledWith = id; return sentinel; },
            querySelector: () => null
        });
        try {
            const got = mod.getModal('settings');
            if (got !== sentinel) throw new Error('did not use injected getElementById');
            if (calledWith !== mod.MODAL_DEFS.settings.key) {
                throw new Error(`injected fn called with wrong id: ${calledWith}`);
            }
        } finally {
            resetRegistry();
        }
    });

    resetRegistry();

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
