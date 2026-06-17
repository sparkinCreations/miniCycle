/**
 * PanelVisibilityHelpers Tests
 * Tests for modules/ui/panelVisibilityHelpers.js
 */
import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runPanelVisibilityHelpersTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/panelVisibilityHelpers.js?v=${cacheBuster}`);
    const constants = await import(`../modules/core/constants.js?v=${cacheBuster}`);
    const { DOM_IDS, DOM_CLASSES } = constants;

    resultsDiv.innerHTML = '<h2>PanelVisibilityHelpers Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ── Fixtures: the four checkbox toggles + clean body state ────────────────
    const TOGGLE_IDS = [
        DOM_IDS.TOGGLE_HELP_WINDOW,
        DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW,
        DOM_IDS.TOGGLE_QUICK_ACTIONS,
        DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS
    ];
    const created = [];
    function makeToggles() {
        TOGGLE_IDS.forEach(id => {
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('input');
                el.type = 'checkbox';
                el.id = id;
                document.body.appendChild(el);
                created.push(el);
            }
        });
    }
    function cleanup() {
        created.forEach(el => { if (el.parentNode) el.remove(); });
        created.length = 0;
        document.body.classList.remove(DOM_CLASSES.HIDE_HELP_WINDOW, DOM_CLASSES.HIDE_QUICK_ACTIONS);
    }
    const checked = (id) => document.getElementById(id).checked;
    const hasClass = (c) => document.body.classList.contains(c);

    // Minimal AppState mock with in-memory state
    const makeAppState = (initial = { settings: {} }) => {
        const state = initial;
        return { get: () => state, update: (fn) => { fn(state); }, isReady: () => true };
    };

    // ── Module Loading (keep original smoke checks) ──────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('Module loads without error', () => {
        if (!mod) throw new Error('Module is falsy');
    });

    await test('applyHelpWindowVisibility is an exported function', () => {
        if (typeof mod.applyHelpWindowVisibility !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.applyHelpWindowVisibility}`);
        }
    });

    await test('applyQuickActionsVisibility is an exported function', () => {
        if (typeof mod.applyQuickActionsVisibility !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.applyQuickActionsVisibility}`);
        }
    });

    await test('loadPanelVisibility is an exported function', () => {
        if (typeof mod.loadPanelVisibility !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.loadPanelVisibility}`);
        }
    });

    await test('resetPanelVisibility is an exported function', () => {
        if (typeof mod.resetPanelVisibility !== 'function') {
            throw new Error(`Expected function, got ${typeof mod.resetPanelVisibility}`);
        }
    });

    // ── applyHelpWindowVisibility ────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">❓ applyHelpWindowVisibility</h4>';

    await test('visible=false ADDS hide class; visible=true REMOVES it', () => {
        makeToggles();
        try {
            mod.applyHelpWindowVisibility(false);
            if (!hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('hide class not added when hidden');
            mod.applyHelpWindowVisibility(true);
            if (hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('hide class not removed when visible');
        } finally { cleanup(); }
    });

    await test('syncs BOTH help checkboxes to the visible value', () => {
        makeToggles();
        try {
            mod.applyHelpWindowVisibility(false);
            if (checked(DOM_IDS.TOGGLE_HELP_WINDOW) !== false) throw new Error('pref toggle not synced');
            if (checked(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW) !== false) throw new Error('settings toggle not synced');
            mod.applyHelpWindowVisibility(true);
            if (checked(DOM_IDS.TOGGLE_HELP_WINDOW) !== true) throw new Error('pref toggle not re-synced');
            if (checked(DOM_IDS.SETTINGS_TOGGLE_HELP_WINDOW) !== true) throw new Error('settings toggle not re-synced');
        } finally { cleanup(); }
    });

    await test('persists showHelpWindow into state.settings.customColors when AppState passed', () => {
        makeToggles();
        const as = makeAppState({ settings: {} });
        try {
            mod.applyHelpWindowVisibility(false, as);
            if (as.get().settings.customColors.showHelpWindow !== false) {
                throw new Error('did not persist false');
            }
            mod.applyHelpWindowVisibility(true, as);
            if (as.get().settings.customColors.showHelpWindow !== true) {
                throw new Error('did not persist true');
            }
        } finally { cleanup(); }
    });

    await test('does not touch state when AppState omitted (no throw)', () => {
        makeToggles();
        try {
            mod.applyHelpWindowVisibility(true); // must not throw without AppState
        } finally { cleanup(); }
    });

    await test('bootstraps customColors object if absent', () => {
        const as = makeAppState({ settings: {} }); // no customColors
        makeToggles();
        try {
            mod.applyHelpWindowVisibility(false, as);
            if (typeof as.get().settings.customColors !== 'object') {
                throw new Error('customColors was not created');
            }
        } finally { cleanup(); }
    });

    // ── applyQuickActionsVisibility ──────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">⚡ applyQuickActionsVisibility</h4>';

    await test('toggles hide-quick-actions class and both QA checkboxes', () => {
        makeToggles();
        const as = makeAppState({ settings: {} });
        try {
            mod.applyQuickActionsVisibility(false, as);
            if (!hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('hide class not added');
            if (checked(DOM_IDS.TOGGLE_QUICK_ACTIONS) !== false) throw new Error('pref QA toggle not synced');
            if (checked(DOM_IDS.SETTINGS_TOGGLE_QUICK_ACTIONS) !== false) throw new Error('settings QA toggle not synced');
            if (as.get().settings.customColors.showQuickActions !== false) throw new Error('not persisted');
        } finally { cleanup(); }
    });

    await test('help and quick-actions are independent (no cross-talk)', () => {
        makeToggles();
        try {
            mod.applyHelpWindowVisibility(false);
            mod.applyQuickActionsVisibility(true);
            if (!hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('help should stay hidden');
            if (hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('QA should be visible');
        } finally { cleanup(); }
    });

    // ── loadPanelVisibility ──────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">📥 loadPanelVisibility</h4>';

    await test('undefined customColors → both visible (default-on semantics)', () => {
        makeToggles();
        try {
            mod.loadPanelVisibility(undefined);
            if (hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('help should default visible');
            if (hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('QA should default visible');
            if (checked(DOM_IDS.TOGGLE_HELP_WINDOW) !== true) throw new Error('help toggle should default checked');
            if (checked(DOM_IDS.TOGGLE_QUICK_ACTIONS) !== true) throw new Error('QA toggle should default checked');
        } finally { cleanup(); }
    });

    await test('only !== false hides — falsy-but-not-false stays visible', () => {
        makeToggles();
        try {
            // showHelpWindow undefined → visible; showQuickActions explicitly false → hidden
            mod.loadPanelVisibility({ showQuickActions: false });
            if (hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('help (undefined) should be visible');
            if (!hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('QA (false) should be hidden');
        } finally { cleanup(); }
    });

    await test('explicit true keeps panels visible', () => {
        makeToggles();
        document.body.classList.add(DOM_CLASSES.HIDE_HELP_WINDOW, DOM_CLASSES.HIDE_QUICK_ACTIONS);
        try {
            mod.loadPanelVisibility({ showHelpWindow: true, showQuickActions: true });
            if (hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('help should be shown');
            if (hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('QA should be shown');
        } finally { cleanup(); }
    });

    // ── resetPanelVisibility ─────────────────────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">♻️ resetPanelVisibility</h4>';

    await test('removes both hide classes and re-checks all four toggles', () => {
        makeToggles();
        document.body.classList.add(DOM_CLASSES.HIDE_HELP_WINDOW, DOM_CLASSES.HIDE_QUICK_ACTIONS);
        TOGGLE_IDS.forEach(id => { document.getElementById(id).checked = false; });
        try {
            mod.resetPanelVisibility();
            if (hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) throw new Error('help hide class not removed');
            if (hasClass(DOM_CLASSES.HIDE_QUICK_ACTIONS)) throw new Error('QA hide class not removed');
            TOGGLE_IDS.forEach(id => {
                if (checked(id) !== true) throw new Error(`toggle ${id} not reset to checked`);
            });
        } finally { cleanup(); }
    });

    // ── robustness: missing checkbox elements ────────────────────────────────
    resultsDiv.innerHTML += '<h4 class="test-section">🛡️ missing-element guards</h4>';

    await test('apply* still toggles body class when checkboxes are absent (no throw)', () => {
        cleanup(); // ensure no toggle elements exist
        try {
            mod.applyHelpWindowVisibility(false);
            if (!hasClass(DOM_CLASSES.HIDE_HELP_WINDOW)) {
                throw new Error('body class should toggle even without checkboxes');
            }
        } finally { cleanup(); }
    });

    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
