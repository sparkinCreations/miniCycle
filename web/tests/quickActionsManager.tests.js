/**
 * QuickActionsManager Tests
 * Tests for modules/ui/quickActionsManager.js
 */

import { setupTestEnvironment, createProtectedTest } from './testHelpers.js';

export async function runQuickActionsManagerTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/ui/quickActionsManager.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>QuickActionsManager Tests</h2><h3>Running tests...</h3>';
    let passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">📦 Module Loading</h4>';

    await test('setQuickActionsManagerDependencies is exported as a function', () => {
        if (typeof mod.setQuickActionsManagerDependencies !== 'function') throw new Error('Missing export');
    });

    await test('QuickActionsManager class is exported', () => {
        if (typeof mod.QuickActionsManager !== 'function') throw new Error('Missing class export');
    });

    await test('initQuickActionsManager is exported as a function', () => {
        if (typeof mod.initQuickActionsManager !== 'function') throw new Error('Missing export');
    });

    await test('trackAction is exported as a function', () => {
        if (typeof mod.trackAction !== 'function') throw new Error('Missing export');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚙️ DI Setup</h4>';

    await test('setQuickActionsManagerDependencies accepts an object without throwing', () => {
        mod.setQuickActionsManagerDependencies({});
    });

    await test('setQuickActionsManagerDependencies accepts mock dependencies', () => {
        mod.setQuickActionsManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🏗️ Class Instantiation</h4>';

    await test('QuickActionsManager can be instantiated with empty deps', () => {
        mod.setQuickActionsManagerDependencies({
            AppState: { get: () => ({ settings: {} }), update: () => {} },
            showNotification: () => {},
            safeAddEventListener: () => {}
        });
        const instance = new mod.QuickActionsManager();
        if (!instance) throw new Error('Failed to create instance');
    });

    await test('Instance has init method', () => {
        const instance = new mod.QuickActionsManager();
        if (typeof instance.init !== 'function') throw new Error('Missing init method');
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">⚠️ Error Handling</h4>';

    await test('setQuickActionsManagerDependencies handles null gracefully', () => {
        try {
            mod.setQuickActionsManagerDependencies(null);
        } catch (e) {
            // Acceptable to throw on null — should not crash the module
        }
    });

    // ============================================
    // 🧪 Behavior coverage (view cycling, usage tracking, dispatch, rendering)
    // Uses constructor DI with an inspectable AppState. We call methods DIRECTLY and
    // never call init() — init() attaches a global capture-phase document listener
    // (actionUsage.js) that isn't torn down and would leak across tests.
    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧪 Behavior Coverage</h4>';

    function freshInstance({ quickActions, overrides = {}, notifications = [] } = {}) {
        const state = {
            settings: quickActions ? { quickActions: JSON.parse(JSON.stringify(quickActions)) } : {}
        };
        const deps = {
            AppState: { get: () => state, update: (fn) => fn(state) },
            showNotification: (msg, type) => notifications.push({ msg, type }),
            hideMainMenu: () => {},
            getElementById: (id) => document.getElementById(id),
            safeAddEventListener: (el, ev, fn) => el?.addEventListener?.(ev, fn),
            ...overrides
        };
        const inst = new mod.QuickActionsManager(deps);
        return { inst, state, notifications };
    }

    const baseQA = () => ({ pinned: ['stats', null, null, null, null], counts: {}, recent: [], activeView: 'pinned' });

    await test('cycleView advances the active view and persists it (with wraparound)', () => {
        const { inst, state } = freshInstance({ quickActions: { ...baseQA(), activeView: 'pinned' } });
        const view = () => state.settings.quickActions.activeView;
        inst.cycleView('next'); if (view() !== 'recent') throw new Error('next from pinned → recent');
        inst.cycleView('next'); if (view() !== 'frequent') throw new Error('next → frequent');
        inst.cycleView('next'); if (view() !== 'pinned') throw new Error('next wraps frequent → pinned');
        inst.cycleView('prev'); if (view() !== 'frequent') throw new Error('prev from pinned wraps → frequent');
    });

    await test('a view tip notification fires once then stays silent', () => {
        const notifications = [];
        const { inst, state } = freshInstance({ quickActions: { ...baseQA(), activeView: 'pinned' }, notifications });
        inst.cycleView('next'); // → recent (first landing)
        if (state.settings.quickActionsTipRecent !== true) throw new Error('recent tip-seen flag should be set');
        if (notifications.length === 0) throw new Error('the recent tip should fire on first landing');
        inst.cycleView('next'); // frequent
        inst.cycleView('next'); // pinned
        const before = notifications.length;
        inst.cycleView('next'); // recent again — must be silent (already seen)
        if (notifications.length !== before) throw new Error('the recent tip must not fire a second time');
    });

    await test('trackAction increments counts and keeps a deduped MRU recent list', () => {
        const { inst, state } = freshInstance({ quickActions: baseQA() });
        inst.trackAction('stats');
        inst.trackAction('stats');
        inst.trackAction('history');
        const qa = state.settings.quickActions;
        if (qa.counts.stats !== 2) throw new Error(`stats count should be 2, got ${qa.counts.stats}`);
        if (qa.counts.history !== 1) throw new Error('history count should be 1');
        if (qa.recent[0] !== 'history' || qa.recent[1] !== 'stats') throw new Error(`recent MRU order wrong: ${JSON.stringify(qa.recent)}`);
        if (qa.recent.length !== 2) throw new Error('recent should dedupe stats to one entry');
        inst.trackAction('not-a-real-action');   // junk id → no-op
        if (qa.recent.length !== 2) throw new Error('an unknown action id should be ignored');
    });

    await test("executeAction('stats') shows stats, hides the menu, records usage; unknown id no-ops", () => {
        let statsShown = 0, menuHidden = 0;
        const { inst, state } = freshInstance({
            quickActions: baseQA(),
            overrides: { showStatsPanel: () => { statsShown++; }, hideMainMenu: () => { menuHidden++; } }
        });
        inst.executeAction('stats');
        if (statsShown !== 1) throw new Error('showStatsPanel should be called once');
        if (menuHidden !== 1) throw new Error('hideMainMenu should be called once');
        if (state.settings.quickActions.counts.stats !== 1) throw new Error('usage should be recorded');
        inst.executeAction('definitely-not-an-action');
        if (statsShown !== 1) throw new Error('an unknown action id should be a no-op');
    });

    await test("executeAction('stats') warns and skips recording when showStatsPanel is missing", () => {
        const notifications = [];
        const { inst, state } = freshInstance({ quickActions: baseQA(), notifications }); // no showStatsPanel
        inst.executeAction('stats');
        if (!notifications.some(n => n.type === 'warning')) throw new Error('missing dep should surface a warning notification');
        if (state.settings.quickActions.counts.stats) throw new Error('usage must NOT be recorded when the action cannot execute');
    });

    await test("executeAction('reminders') clicks the real button instead of opening the modal itself", async () => {
        // The modal's own opener (reminders.js openRemindersModal) is the ONLY caller of
        // loadRemindersSettings(). Calling modal.showModal() from here skipped it, so the
        // panel showed an un-hydrated form and the next save wrote HTML defaults over the
        // stored settings. Delegating to the button keeps hydration on the path.
        let showModalCalls = 0, buttonClicks = 0;
        const modal = { open: false, showModal() { showModalCalls++; this.open = true; } };

        const btn = document.createElement('button');
        btn.id = 'open-reminders-modal';
        btn.addEventListener('click', () => { buttonClicks++; });
        document.body.appendChild(btn);
        try {
            const { inst, state } = freshInstance({
                quickActions: baseQA(),
                overrides: { getModal: () => modal, hideMainMenu: () => {} }
            });
            inst.executeAction('reminders');
            await new Promise(r => setTimeout(r, 20));   // the case defers with setTimeout(0)

            if (buttonClicks !== 1) throw new Error(`the real open button should be clicked once, got ${buttonClicks}`);
            if (showModalCalls !== 0) throw new Error('the panel must NOT call modal.showModal() itself — that bypasses settings hydration');
            // Usage now comes from actionUsage's delegated listener, so executeAction must
            // not also record it or every panel-opened reminder counts twice.
            if (state.settings.quickActions.counts.reminders) {
                throw new Error('executeAction must not record usage for reminders — the delegated button listener does');
            }
        } finally {
            btn.remove();
        }
    });

    await test('pinAction and unpinAction write the pinned slot', () => {
        const { inst, state } = freshInstance({ quickActions: baseQA() });
        inst.pinAction(2, 'history');
        if (state.settings.quickActions.pinned[2] !== 'history') throw new Error('pinAction should set the slot');
        inst.unpinAction(2);
        if (state.settings.quickActions.pinned[2] !== null) throw new Error('unpinAction should clear the slot');
    });

    await test('_ensureData seeds the default quickActions when absent', () => {
        const { inst, state } = freshInstance({}); // no quickActions
        inst._ensureData();
        const qa = state.settings.quickActions;
        if (!qa) throw new Error('quickActions should be seeded');
        if (qa.pinned[0] !== 'stats') throw new Error('default should pin stats first');
        if (qa.activeView !== 'recent') throw new Error('default activeView should be recent');
    });

    await test('_renderPinnedSlots renders 5 slots — filled first, empty rest, tabindex set', () => {
        const container = document.createElement('div');
        container.id = 'quick-actions-slots';   // DOM_IDS.QUICK_ACTIONS_SLOTS
        document.body.appendChild(container);
        try {
            const { inst } = freshInstance({ quickActions: { ...baseQA(), activeView: 'pinned' } });
            inst._renderPanel('quick-actions-slots');
            const slots = container.querySelectorAll('.quick-actions-slot');
            if (slots.length !== 5) throw new Error(`expected 5 slots, got ${slots.length}`);
            if (!slots[0].classList.contains('filled') || slots[0].dataset.actionId !== 'stats') throw new Error('slot 0 should be the filled stats slot');
            if (slots[0].getAttribute('tabindex') !== '0') throw new Error('slot 0 should be tabbable (tabindex=0)');
            if (!slots[1].classList.contains('empty') || slots[1].getAttribute('tabindex') !== '-1') throw new Error('slot 1 should be an empty, non-tabbable slot');
        } finally {
            container.remove();
        }
    });

    await test('_renderFrequentActions shows only actions >= the min-use threshold, sorted desc', () => {
        const container = document.createElement('div');
        container.id = 'quick-actions-slots';
        document.body.appendChild(container);
        try {
            const { inst } = freshInstance({
                quickActions: { pinned: [], counts: { stats: 5, history: 2, settings: 4, help: 3 }, recent: [], activeView: 'frequent' }
            });
            inst._renderPanel('quick-actions-slots');
            const ids = [...container.querySelectorAll('.quick-actions-slot')].map(s => s.dataset.actionId);
            // history (2) is below the 3-use threshold → excluded; the rest sort descending by count.
            if (ids.join(',') !== 'stats,settings,help') throw new Error(`frequent view wrong: got [${ids.join(',')}]`);
        } finally {
            container.remove();
        }
    });

    // ============================================
    resultsDiv.innerHTML += '<h4 class="test-section">🕘 Recent view</h4>';

    // Drive the renderer directly with a stubbed data source — the panel itself
    // renders lazily and needs the whole app up, which tells us nothing about
    // these two behaviours.
    const renderRecentWith = (recent) => {
        const mgr = new mod.QuickActionsManager({});
        mgr._getData = () => ({ pinned: ['stats', null, null, null, null], counts: {}, recent, activeView: 'recent' });
        const container = document.createElement('div');
        document.body.appendChild(container);
        try {
            mgr._renderRecentActions(container);
            return [...container.querySelectorAll('.quick-actions-slot')].map(e => e.title || '?');
        } finally {
            document.body.removeChild(container);
        }
    };

    // Slicing to SLOT_COUNT before dropping unknown ids meant one retired action
    // in the newest five left a hole, even with valid entries below it.
    await test('a retired action id does not leave a gap in the recent view', () => {
        const slots = renderRecentWith(['settings', 'a-retired-action', 'history', 'themes', 'games', 'help']);
        if (slots.length !== 5) {
            throw new Error(`expected 5 filled slots, got ${slots.length}: ${JSON.stringify(slots)}`);
        }
    });

    await test('recent view still caps at the slot count', () => {
        const slots = renderRecentWith(['settings', 'history', 'themes', 'games', 'help', 'feedback', 'search']);
        if (slots.length !== 5) throw new Error(`expected 5, got ${slots.length}`);
    });

    // `recent` survives reloads and comes back through a restored backup, so
    // these ids can reach the registry lookup. A plain object literal would
    // answer them from Object.prototype (CLAUDE.md #18) and _createFilledSlot
    // would then read .labelKey off a native function.
    await test('prototype-inherited ids in recent are ignored, not rendered', () => {
        const slots = renderRecentWith(['constructor', '__proto__', 'toString', 'valueOf', 'settings', 'history']);
        if (slots.length !== 2) {
            throw new Error(`expected only the 2 real actions, got ${slots.length}: ${JSON.stringify(slots)}`);
        }
    });

    await test('a recent list of nothing but junk renders the empty state', () => {
        const slots = renderRecentWith(['constructor', 'not-an-action']);
        if (slots.length !== 0) throw new Error(`expected 0 slots, got ${slots.length}`);
    });

    // ============================================
    const percentage = Math.round((passed.count / total.count) * 100);
    resultsDiv.innerHTML += `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    if (passed.count === total.count) {
        resultsDiv.innerHTML += '<div class="result pass">✅ All tests passed!</div>';
    } else {
        resultsDiv.innerHTML += `<div class="result fail">⚠️ ${total.count - passed.count} test(s) failed</div>`;
    }
    return { passed: passed.count, total: total.count };
}
