/**
 * RoutineSwitcher Actions Tests
 *
 * The destructive half of the routine switcher: delete, duplicate, download,
 * rename, and the inline-edit flow rename runs through.
 *
 * WRITTEN BEFORE THE EXTRACTION, like the other switcher suites — and this is
 * the one where it matters most. These operations DELETE and OVERWRITE the
 * user's routines. Before this file, `routineSwitcher.tests.js` covered exactly
 * one of them (a single delete happy path), so ~590 lines of destructive code
 * had no net under it.
 *
 * Every guard is tested individually because they are the difference between
 * "nothing happens" and "the wrong routine is destroyed":
 *   - nothing selected            → notify, and DO NOT mutate
 *   - AppState not ready          → notify, and DO NOT mutate
 *   - selection points at a routine that no longer exists → notify, no mutation
 *   - confirmation declined       → routine survives
 *   - duplicate gets a unique name rather than colliding
 *   - rename applies to the routine the user selected, not the active one
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineSwitcherActionsTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const mod = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);
    const { RoutineSwitcher, initRoutineSwitcher } = mod;

    // Duplicate/rename reach getUniqueCycleName and getObjectSizeBytes, module
    // bindings that only exist after init runs its dynamic imports. Without this
    // those tests throw on an undefined function instead of asserting.
    await initRoutineSwitcher({
        safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
        getModal: () => null
    });

    resultsDiv.innerHTML = '<h2>🗂️ RoutineSwitcher Actions Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    function cleanupDom() {
        document.querySelectorAll('[data-cycle-key]').forEach(el => el.remove());
    }

    /**
     * An instance with a selectable routine list and a controllable confirm.
     * `confirmAnswer` decides what the confirmation modal reports back.
     */
    function setup({ cycles, selectedKey, activeCycleId = 'a', confirmAnswer = true, appReady = true } = {}) {
        cleanupDom();
        // userProgress is read by duplicate (totalCyclesCreated); the lifecycle
        // hooks are awaited with .catch(), so they must return promises. Both
        // learned from running these tests against the pre-split code.
        const state = {
            data: { cycles: structuredClone(cycles) },
            appState: { activeCycleId },
            settings: {},
            userProgress: {},
            // duplicate increments state.metadata.totalCyclesCreated — not
            // userProgress, as I first assumed. Learned by running these against
            // the pre-split code.
            metadata: { totalCyclesCreated: 0 }
        };
        const calls = { notifications: [], confirms: [], deleted: [], renamed: [] };

        if (selectedKey) {
            const item = document.createElement('div');
            item.className = 'mini-cycle-switch-item';
            item.dataset.cycleKey = selectedKey;
            document.body.appendChild(item);
        }

        const instance = new RoutineSwitcher({
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            querySelectorAll: (sel) => document.querySelectorAll(sel),
            getBody: () => document.body,
            sanitizeInput: (s) => s,
            AppState: {
                isReady: () => appReady,
                get: () => state,
                update: (producer) => producer(state)
            },
            showNotification: (msg) => calls.notifications.push(String(msg)),
            showConfirmationModal: (opts) => {
                calls.confirms.push(opts);
                opts.callback?.(confirmAnswer);
            },
            showPromptModal: (opts) => opts.callback?.(opts.defaultValue),
            onCycleDeleted: (k) => { calls.deleted.push(k); return Promise.resolve(); },
            onCycleRenamed: (a, b) => { calls.renamed.push([a, b]); return Promise.resolve(); },
            loadMiniCycle: () => {}
        });
        // Selection is tracked on the instance, not read from the DOM class.
        instance._selectedCycleKey = selectedKey ?? null;
        // Keep the modal/list plumbing inert — these tests are about the mutations.
        instance.hideSwitchMiniCycleModal = () => {};
        instance.loadMiniCycleList = () => {};
        instance.updatePreview = () => {};
        return { instance, state, calls, cycleKeys: () => Object.keys(state.data.cycles) };
    }

    const TWO = { a: { title: 'Alpha', tasks: [] }, b: { title: 'Beta', tasks: [] } };
    const settle = (ms = 950) => new Promise(r => setTimeout(r, ms));

    // =========================================================
    // 🗑️ Delete
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🗑️ Delete</h4>';

    await test('deletes the SELECTED routine, not the active one', async () => {
        const { instance, state, cycleKeys } = setup({ cycles: TWO, selectedKey: 'b', activeCycleId: 'a' });
        instance.deleteMiniCycle();
        await settle();
        if (cycleKeys().includes('b')) throw new Error('the selected routine survived');
        if (!cycleKeys().includes('a')) throw new Error('the ACTIVE routine was deleted instead');
        if (state.appState.activeCycleId !== 'a') throw new Error('active routine should be untouched');
        cleanupDom();
    });

    await test('declining the confirmation leaves the routine alone', async () => {
        const { instance, cycleKeys } = setup({ cycles: TWO, selectedKey: 'b', confirmAnswer: false });
        instance.deleteMiniCycle();
        await settle(400);
        if (!cycleKeys().includes('b')) throw new Error('a declined delete still removed the routine');
        cleanupDom();
    });

    await test('the confirmation is flagged destructive', async () => {
        const { instance, calls } = setup({ cycles: TWO, selectedKey: 'b' });
        instance.deleteMiniCycle();
        await settle(300);
        if (calls.confirms.length !== 1) throw new Error('expected one confirmation');
        if (calls.confirms[0].destructive !== true) throw new Error('delete must be destructive:true');
        cleanupDom();
    });

    await test('nothing selected: notifies and mutates nothing', async () => {
        const { instance, calls, cycleKeys } = setup({ cycles: TWO, selectedKey: null });
        instance.deleteMiniCycle();
        await settle(300);
        if (cycleKeys().length !== 2) throw new Error('nothing should have been deleted');
        if (calls.notifications.length === 0) throw new Error('the user should be told why nothing happened');
        cleanupDom();
    });

    await test('AppState not ready: notifies and mutates nothing', async () => {
        const { instance, calls, cycleKeys } = setup({ cycles: TWO, selectedKey: 'b', appReady: false });
        instance.deleteMiniCycle();
        await settle(300);
        if (cycleKeys().length !== 2) throw new Error('nothing should have been deleted');
        if (calls.notifications.length === 0) throw new Error('expected a not-ready notification');
        cleanupDom();
    });

    await test('a selection pointing at a missing routine deletes nothing', async () => {
        const { instance, calls, cycleKeys } = setup({ cycles: TWO, selectedKey: 'ghost' });
        instance.deleteMiniCycle();
        await settle(300);
        if (cycleKeys().length !== 2) throw new Error('a stale selection must not delete a real routine');
        if (calls.notifications.length === 0) throw new Error('expected an invalid-selection notification');
        cleanupDom();
    });

    // =========================================================
    // 📑 Duplicate
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">📑 Duplicate</h4>';

    await test('duplicating adds a routine without touching the original', async () => {
        const { instance, state, cycleKeys } = setup({
            cycles: { a: { title: 'Alpha', tasks: [{ id: 't', text: 'x', completed: false }] } },
            selectedKey: 'a'
        });
        instance.duplicateMiniCycle();
        await settle(600);
        if (cycleKeys().length !== 2) throw new Error(`expected 2 routines, got ${cycleKeys().length}`);
        if (state.data.cycles.a.title !== 'Alpha') throw new Error('the original was modified');
        cleanupDom();
    });

    await test('the duplicate gets a distinct name', async () => {
        const { instance, state } = setup({ cycles: { a: { title: 'Alpha', tasks: [] } }, selectedKey: 'a' });
        instance.duplicateMiniCycle();
        await settle(600);
        const titles = Object.values(state.data.cycles).map(c => c.title);
        if (new Set(titles).size !== titles.length) throw new Error(`duplicate name collision: ${titles}`);
        cleanupDom();
    });

    await test('nothing selected: duplicate notifies and adds nothing', async () => {
        const { instance, calls, cycleKeys } = setup({ cycles: TWO, selectedKey: null });
        instance.duplicateMiniCycle();
        await settle(300);
        if (cycleKeys().length !== 2) throw new Error('nothing should have been added');
        if (calls.notifications.length === 0) throw new Error('expected a select-first notification');
        cleanupDom();
    });

    // =========================================================
    // ✏️ Rename
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">✏️ Rename</h4>';

    await test('nothing selected: rename notifies and changes nothing', async () => {
        const { instance, calls, state } = setup({ cycles: TWO, selectedKey: null });
        instance.renameMiniCycle();
        await settle(300);
        if (state.data.cycles.a.title !== 'Alpha') throw new Error('a title changed with nothing selected');
        if (calls.notifications.length === 0) throw new Error('expected a select-first notification');
        cleanupDom();
    });

    await test('AppState not ready: rename notifies and changes nothing', async () => {
        const { instance, calls, state } = setup({ cycles: TWO, selectedKey: 'b', appReady: false });
        instance.renameMiniCycle();
        await settle(300);
        if (state.data.cycles.b.title !== 'Beta') throw new Error('a title changed while state was not ready');
        if (calls.notifications.length === 0) throw new Error('expected a not-ready notification');
        cleanupDom();
    });

    await test('_commitRename RE-KEYS the routine under its new name', async () => {
        // Signature is (oldKey, rawNewName, oldName) — three args. The producer
        // writes cycles[newName] and deletes cycles[oldKey], so the storage key
        // and the title move together.
        const { instance, state, cycleKeys } = setup({ cycles: TWO, selectedKey: 'b', activeCycleId: 'a' });
        instance._commitRename('b', 'Renamed Beta', 'Beta');
        await settle(400);
        if (cycleKeys().includes('b')) throw new Error('the old key should be gone');
        if (!cycleKeys().includes('Renamed Beta')) throw new Error(`re-key failed: ${cycleKeys()}`);
        if (state.data.cycles['Renamed Beta'].title !== 'Renamed Beta') throw new Error('title not updated');
        if (state.data.cycles.a.title !== 'Alpha') throw new Error('the wrong routine was renamed');
        cleanupDom();
    });

    await test('renaming the ACTIVE routine follows it to the new key', async () => {
        const { instance, state } = setup({ cycles: TWO, selectedKey: 'a', activeCycleId: 'a' });
        instance._commitRename('a', 'Alpha Renamed', 'Alpha');
        await settle(400);
        if (state.appState.activeCycleId !== 'Alpha Renamed') {
            throw new Error(`activeCycleId is "${state.appState.activeCycleId}" — it would now point at nothing`);
        }
        cleanupDom();
    });

    await test('a colliding rename keeps both routines, uniquifying the KEY', async () => {
        // Uniqueness is enforced on the storage KEY, not the display title:
        // getUniqueCycleName is given the cycles map (minus the routine being
        // renamed). Two routines may therefore end up showing the same title
        // when their keys differ — surprising, but not data loss, and not
        // something to change inside an extraction.
        const { instance, cycleKeys } = setup({ cycles: { Alpha: { title: 'Alpha', tasks: [] }, b: { title: 'Beta', tasks: [] } }, selectedKey: 'b' });
        instance._commitRename('b', 'Alpha', 'Beta');
        await settle(400);
        if (cycleKeys().length !== 2) throw new Error(`a colliding rename lost a routine: ${cycleKeys()}`);
        if (new Set(cycleKeys()).size !== 2) throw new Error('keys collided');
        cleanupDom();
    });

    // =========================================================
    // 💾 Download
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">💾 Download</h4>';

    await test('nothing selected: download notifies and does not mutate', async () => {
        const { instance, calls, state } = setup({ cycles: TWO, selectedKey: null });
        instance.downloadMiniCycle();
        await settle(300);
        if (Object.keys(state.data.cycles).length !== 2) throw new Error('download must not mutate');
        if (calls.notifications.length === 0) throw new Error('expected a select-first notification');
        cleanupDom();
    });

    cleanupDom();

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
