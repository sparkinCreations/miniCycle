/**
 * ActionUsage Tests
 * Tests for modules/ui/actionUsage.js — the single source of truth for Quick Actions
 * recently/frequently-used tracking + the delegated button-click listener.
 */

import { createProtectedTest } from './testHelpers.js';

export async function runActionUsageTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/actionUsage.js?v=${cacheBuster}`);
    const {
        recordActionUsage, MAX_RECENT, ACTION_BUTTON_MAP, VALID_ACTION_IDS,
        actionIdForClick, setupActionUsageTracking, teardownActionUsageTracking
    } = mod;

    resultsDiv.innerHTML = '<h2>ActionUsage Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // Minimal AppState mock: holds state, update(fn) mutates it synchronously.
    const makeAppState = (initial = {}) => {
        const state = initial;
        return { get: () => state, update: (fn) => { fn(state); }, isReady: () => true };
    };

    // ── recordActionUsage: persistence ───────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📊 recordActionUsage</h4>';

    await test('counts increment on each call', () => {
        const as = makeAppState({ settings: {} });
        recordActionUsage(as, 'stats');
        if (as.get().settings.quickActions.counts.stats !== 1) throw new Error('expected 1');
        recordActionUsage(as, 'stats');
        if (as.get().settings.quickActions.counts.stats !== 2) throw new Error('expected 2');
    });

    await test('recent is MRU (front = newest)', () => {
        const as = makeAppState({ settings: {} });
        recordActionUsage(as, 'history');
        recordActionUsage(as, 'stats');
        const r = as.get().settings.quickActions.recent;
        if (r[0] !== 'stats' || r[1] !== 'history') throw new Error('MRU order wrong: ' + r.join(','));
    });

    await test('recent dedups (moves to front, no duplicate)', () => {
        const as = makeAppState({ settings: {} });
        ['settings', 'history', 'settings'].forEach(id => recordActionUsage(as, id));
        const r = as.get().settings.quickActions.recent;
        if (r.length !== 2 || r[0] !== 'settings' || r[1] !== 'history') throw new Error('dedup wrong: ' + r.join(','));
    });

    await test(`recent caps at MAX_RECENT (${MAX_RECENT})`, () => {
        const as = makeAppState({ settings: {} });
        [...VALID_ACTION_IDS].slice(0, 12).forEach(id => recordActionUsage(as, id));
        if (as.get().settings.quickActions.recent.length !== MAX_RECENT) {
            throw new Error('cap wrong: ' + as.get().settings.quickActions.recent.length);
        }
    });

    await test('unknown action id is a no-op (writes nothing)', () => {
        const as = makeAppState({ settings: {} });
        recordActionUsage(as, 'not-a-real-action');
        if (as.get().settings.quickActions) throw new Error('should not create quickActions for junk id');
    });

    await test('bootstraps settings.quickActions when missing', () => {
        const as = makeAppState({});
        recordActionUsage(as, 'stats');
        const qa = as.get().settings.quickActions;
        if (!qa || !qa.counts || !qa.recent) throw new Error('did not bootstrap state');
    });

    await test('null/undefined AppState is a no-op (no throw)', () => {
        recordActionUsage(null, 'stats');
        recordActionUsage(undefined, 'stats');
    });

    // ── button map + click resolution ────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🔘 button map</h4>';

    await test('ACTION_BUTTON_MAP has no undefined keys (all DOM_IDS resolved)', () => {
        if (Object.prototype.hasOwnProperty.call(ACTION_BUTTON_MAP, 'undefined')) {
            throw new Error('a DOM_ID resolved to undefined → map collision');
        }
        if (Object.keys(ACTION_BUTTON_MAP).length < 20) {
            throw new Error('map too small: ' + Object.keys(ACTION_BUTTON_MAP).length);
        }
    });

    await test('actionIdForClick maps a button click to its action', () => {
        const btn = document.createElement('button');
        btn.id = 'history-btn';
        document.body.appendChild(btn);
        const id = actionIdForClick({ target: btn });
        document.body.removeChild(btn);
        if (id !== 'history') throw new Error('expected history, got ' + id);
    });

    await test('actionIdForClick returns null for non-action elements', () => {
        const div = document.createElement('div');
        div.id = 'random-thing-not-an-action';
        document.body.appendChild(div);
        const id = actionIdForClick({ target: div });
        document.body.removeChild(div);
        if (id !== null) throw new Error('expected null, got ' + id);
    });

    // A mapped button can carry its own id-bearing children — the input
    // toggle's text label, the achievements count badge. Resolving to the
    // NEAREST [id] ancestor stopped at those, missed the map, and dropped the
    // click. Measured before the fix: clicking #toggle-task-input-btn recorded,
    // clicking its label did not — and the label is the larger tap target.
    await test('actionIdForClick sees through an id-bearing child of a mapped button', () => {
        const btn = document.createElement('button');
        btn.id = 'toggle-task-input-btn';
        const label = document.createElement('span');
        label.id = 'toggle-task-input-text';
        label.textContent = 'Hide Task Input';
        btn.appendChild(label);
        document.body.appendChild(btn);
        const id = actionIdForClick({ target: label });
        document.body.removeChild(btn);
        if (id !== 'toggle-input') throw new Error('expected toggle-input from the inner label, got ' + id);
    });

    await test('actionIdForClick sees through a nested unmapped wrapper', () => {
        const btn = document.createElement('button');
        btn.id = 'achievement-badges-btn';
        const wrap = document.createElement('span');
        wrap.id = 'some-unmapped-wrapper';
        const badge = document.createElement('span');
        badge.id = 'achievement-count-badge';
        wrap.appendChild(badge);
        btn.appendChild(wrap);
        document.body.appendChild(btn);
        const id = actionIdForClick({ target: badge });
        document.body.removeChild(btn);
        if (id !== 'achievements') throw new Error('expected achievements through two unmapped ids, got ' + id);
    });

    // `el.id` is DOM-controlled and ACTION_BUTTON_MAP is a plain object literal,
    // so a truthiness lookup answers 'constructor' from Object.prototype
    // (CLAUDE.md #18) and would hand a function back as an action id.
    await test('actionIdForClick ignores prototype-inherited ids', () => {
        const results = [];
        for (const junk of ['constructor', 'toString', 'valueOf', '__proto__']) {
            const el = document.createElement('div');
            el.id = junk;
            document.body.appendChild(el);
            results.push([junk, actionIdForClick({ target: el })]);
            document.body.removeChild(el);
        }
        // Report with String(), not JSON.stringify: these resolve to FUNCTIONS
        // (Object, Object.prototype.toString, …) and JSON renders a function as
        // null, which makes a real failure read as a pass-shaped value.
        const bad = results.filter(([, id]) => id !== null);
        if (bad.length) {
            throw new Error('prototype keys resolved: ' +
                bad.map(([k, v]) => `${k} → ${typeof v} ${String(v).slice(0, 30)}`).join('; '));
        }
    });

    // ── delegated listener (the core fix) ────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🎯 delegated listener</h4>';

    await test('listener records a button click (covers direct + panel synthetic click)', () => {
        const as = makeAppState({ settings: {} });
        const btn = document.createElement('button');
        btn.id = 'open-settings';
        document.body.appendChild(btn);
        setupActionUsageTracking(as);
        btn.click(); // element.click() === what the panel does AND what a user does
        teardownActionUsageTracking();
        document.body.removeChild(btn);
        if (as.get().settings.quickActions?.counts?.settings !== 1) {
            throw new Error('expected settings count 1, got ' + as.get().settings.quickActions?.counts?.settings);
        }
    });

    await test('one button click records exactly once (no double-count)', () => {
        const as = makeAppState({ settings: {} });
        const btn = document.createElement('button');
        btn.id = 'history-btn';
        document.body.appendChild(btn);
        setupActionUsageTracking(as);
        btn.click();
        teardownActionUsageTracking();
        document.body.removeChild(btn);
        if (as.get().settings.quickActions.counts.history !== 1) {
            throw new Error('expected exactly 1, got ' + as.get().settings.quickActions.counts.history);
        }
    });

    await test('non-action button click records nothing', () => {
        const as = makeAppState({ settings: {} });
        const btn = document.createElement('button');
        btn.id = 'some-unrelated-button';
        document.body.appendChild(btn);
        setupActionUsageTracking(as);
        btn.click();
        teardownActionUsageTracking();
        document.body.removeChild(btn);
        if (as.get().settings.quickActions) throw new Error('non-action click should record nothing');
    });

    // ── results ──────────────────────────────────────────────────────────────
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
