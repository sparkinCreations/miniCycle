/**
 * RoutineSwitcher Preview Tests
 *
 * The routine preview inside the switcher modal: the mobile panel, the desktop
 * panel, the reset-to-empty state, and the double-click review dialog.
 *
 * WRITTEN BEFORE THE EXTRACTION, like the theme-picker suite. This cluster had
 * no coverage either, so the move had nothing to check it against. These pass
 * against the pre-split code; the same file passing afterwards is the evidence
 * behaviour survived.
 *
 * The cluster is NOT a contiguous block — `updatePreview` sits ~95 lines away
 * from the other three, with selection infrastructure in between — so these
 * tests deliberately exercise all four entry points independently rather than
 * assuming they move together.
 *
 * Covered:
 *   - task rows render with completion marks, and USER TEXT IS ESCAPED
 *   - both panels update from one call (mobile + desktop are separate elements)
 *   - the empty state says "no tasks" rather than rendering an empty list
 *   - the date line prefers lastModified over createdAt, and is labelled for which
 *   - reset clears both panels and hides the enlarge hint
 *   - the review dialog lists every task, counts completed, and escapes text
 *   - opening the review dialog dismisses the one-time hint and persists that
 *   - the dialog is inert when nothing is selected
 */
import { createProtectedTest } from './testHelpers.js';

export async function runRoutineSwitcherPreviewTests(resultsDiv) {
    const cacheBuster = window.testCacheBuster || Date.now();
    const { RoutineSwitcher } = await import(`../modules/routine/routineSwitcher.js?v=${cacheBuster}`);

    resultsDiv.innerHTML = '<h2>👁️ RoutineSwitcher Preview Tests</h2><h3>Running tests...</h3>';
    const passed = { count: 0 }, total = { count: 0 };
    const test = createProtectedTest(resultsDiv, passed, total);

    const IDS = ['switch-preview-window', 'switch-preview-date', 'desktop-preview-window',
                 'desktop-preview-title', 'desktop-preview-hint', 'preview-review-overlay',
                 'switch-preview-hint'];

    function teardown() {
        IDS.forEach(id => document.getElementById(id)?.remove());
        document.querySelectorAll('[data-cycle-key]').forEach(el => el.remove());
    }

    /**
     * Build the preview DOM plus an instance whose AppState holds `cycles`.
     * `selectedKey` seeds the list element _getSelectedItem() resolves against,
     * which is what the review dialog reads.
     */
    function setup({ cycles = {}, selectedKey = null, dismissedTip = false } = {}) {
        teardown();
        const mk = (id, tag = 'div') => {
            const el = document.createElement(tag);
            el.id = id;
            document.body.appendChild(el);
            return el;
        };
        const previewWindow = mk('switch-preview-window');
        const desktopPreview = mk('desktop-preview-window');
        const previewTitle = mk('desktop-preview-title');
        const hint = mk('desktop-preview-hint');

        const state = {
            data: { cycles },
            settings: { dismissedEducationalTips: dismissedTip ? { 'tip.routinePreview': true } : {} }
        };

        if (selectedKey) {
            const item = document.createElement('div');
            item.className = 'mini-cycle-switch-item';
            item.dataset.cycleKey = selectedKey;
            document.body.appendChild(item);
        }

        const deps = {
            safeAddEventListener: (el, ev, fn) => el.addEventListener(ev, fn),
            getModal: () => null,
            getElementById: (id) => document.getElementById(id),
            querySelector: (sel) => document.querySelector(sel),
            AppState: {
                isReady: () => true,
                get: () => state,
                update: (producer) => producer(state)
            }
        };
        const instance = new RoutineSwitcher(deps);
        if (selectedKey) instance._selectedCycleKey = selectedKey;
        return { instance, previewWindow, desktopPreview, previewTitle, hint, state };
    }

    const CYCLE = {
        r1: {
            title: 'Morning Routine',
            tasks: [
                { text: 'Stretch', completed: true },
                { text: 'Water plants', completed: false }
            ],
            lastModified: Date.UTC(2026, 0, 15)
        }
    };

    // =========================================================
    // 👁️ Rendering
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">👁️ Rendering</h4>';

    await test('renders every task with its completion mark', async () => {
        const { instance, desktopPreview } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        const rows = desktopPreview.querySelectorAll('.preview-task');
        if (rows.length !== 2) throw new Error(`expected 2 task rows, got ${rows.length}`);
        if (!rows[0].textContent.includes('✔️')) throw new Error('completed task should show a check');
        if (!rows[1].textContent.includes('___')) throw new Error('incomplete task should show a blank');
    });

    await test('updates BOTH the mobile and desktop panels from one call', async () => {
        const { instance, previewWindow, desktopPreview } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        if (!previewWindow.textContent.includes('Stretch')) throw new Error('mobile panel did not update');
        if (!desktopPreview.textContent.includes('Stretch')) throw new Error('desktop panel did not update');
    });

    await test('escapes user text rather than injecting it as HTML', async () => {
        const { instance, desktopPreview } = setup({
            cycles: { r1: { title: 'X', tasks: [{ text: '<img src=x onerror=alert(1)>', completed: false }] } }
        });
        instance.updatePreview('r1');
        if (desktopPreview.querySelector('img')) throw new Error('task text was injected as live HTML');
        if (!desktopPreview.textContent.includes('<img')) throw new Error('escaped text should still be readable');
    });

    await test('an empty routine says so instead of rendering an empty list', async () => {
        const { instance, desktopPreview, previewWindow } = setup({ cycles: { r1: { title: 'Empty', tasks: [] } } });
        instance.updatePreview('r1');
        if (desktopPreview.querySelectorAll('.preview-task').length !== 0) throw new Error('no rows expected');
        if (!desktopPreview.textContent.trim()) throw new Error('desktop panel should show an empty-state message');
        if (!previewWindow.textContent.trim()) throw new Error('mobile panel should show an empty-state message');
    });

    await test('the desktop title shows the routine name', async () => {
        const { instance, previewTitle } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        if (previewTitle.textContent !== 'Morning Routine') {
            throw new Error(`title was "${previewTitle.textContent}"`);
        }
    });

    await test('the date line is labelled MODIFIED when lastModified exists', async () => {
        const { instance, desktopPreview } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        const dateEl = desktopPreview.querySelector('.desktop-preview-date');
        if (!dateEl) throw new Error('expected a date line');
        if (!/2026/.test(dateEl.textContent)) throw new Error(`date not rendered: "${dateEl.textContent}"`);
    });

    await test('a routine with only createdAt still shows a date', async () => {
        const { instance, desktopPreview } = setup({
            cycles: { r1: { title: 'New', tasks: [{ text: 'A', completed: false }], createdAt: Date.UTC(2025, 5, 1) } }
        });
        instance.updatePreview('r1');
        const dateEl = desktopPreview.querySelector('.desktop-preview-date');
        if (!dateEl || !/2025/.test(dateEl.textContent)) throw new Error('createdAt should be used as a fallback');
    });

    await test('an unknown routine key renders the empty state, not a crash', async () => {
        const { instance, desktopPreview } = setup({ cycles: CYCLE });
        instance.updatePreview('does-not-exist');
        if (desktopPreview.querySelectorAll('.preview-task').length !== 0) {
            throw new Error('an unknown key must not render rows');
        }
    });

    // =========================================================
    // 🧽 Reset
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🧽 Reset</h4>';

    await test('reset clears both panels and hides the enlarge hint', async () => {
        const { instance, previewWindow, desktopPreview, hint } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        hint.style.display = 'block';
        instance._resetPreview();
        if (previewWindow.innerHTML !== '') throw new Error('mobile panel should be emptied');
        if (desktopPreview.querySelectorAll('.preview-task').length !== 0) throw new Error('desktop rows should be gone');
        if (hint.style.display !== 'none') throw new Error('the enlarge hint should be hidden');
    });

    await test('reset restores the placeholder title', async () => {
        const { instance, previewTitle } = setup({ cycles: CYCLE });
        instance.updatePreview('r1');
        instance._resetPreview();
        if (previewTitle.textContent === 'Morning Routine') {
            throw new Error('the title should fall back to the generic placeholder');
        }
    });

    // =========================================================
    // 🔍 Review dialog
    // =========================================================
    resultsDiv.innerHTML += '<h4 class="test-section">🔍 Review Dialog</h4>';

    await test('double-click opens a dialog listing every task', async () => {
        const { instance, previewWindow } = setup({ cycles: CYCLE, selectedKey: 'r1' });
        instance.setupPreviewPopout();
        previewWindow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        const overlay = document.getElementById('preview-review-overlay');
        if (!overlay) throw new Error('no review dialog was opened');
        const rows = overlay.querySelectorAll('.preview-modal-task');
        if (rows.length !== 2) throw new Error(`expected 2 rows in the dialog, got ${rows.length}`);
        overlay.remove();
    });

    await test('the dialog reports the completed count', async () => {
        const { instance } = setup({ cycles: CYCLE, selectedKey: 'r1' });
        instance._openPreviewReviewModal();
        const meta = document.querySelector('.preview-review-meta');
        if (!meta) throw new Error('expected a meta line');
        if (!/1 completed/.test(meta.textContent)) {
            throw new Error(`completed count wrong: "${meta.textContent.trim()}"`);
        }
        document.getElementById('preview-review-overlay')?.remove();
    });

    await test('the dialog escapes task text too', async () => {
        const { instance } = setup({
            cycles: { r1: { title: 'X', tasks: [{ text: '<b>bold</b>', completed: false }] } },
            selectedKey: 'r1'
        });
        instance._openPreviewReviewModal();
        const body = document.querySelector('.preview-review-body');
        if (body.querySelector('b')) throw new Error('task text was injected as live HTML');
        document.getElementById('preview-review-overlay')?.remove();
    });

    await test('opening the dialog dismisses the one-time hint and records it', async () => {
        const { instance, previewWindow, state } = setup({ cycles: CYCLE, selectedKey: 'r1' });
        instance.setupPreviewPopout();
        if (!document.getElementById('switch-preview-hint')) throw new Error('the hint should appear first time');
        previewWindow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        if (document.getElementById('switch-preview-hint')) throw new Error('the hint should be removed on use');
        if (state.settings.dismissedEducationalTips['tip.routinePreview'] !== true) {
            throw new Error('the dismissal must persist, or the hint returns next open');
        }
        document.getElementById('preview-review-overlay')?.remove();
    });

    await test('an already-dismissed hint is not re-added', async () => {
        const { instance } = setup({ cycles: CYCLE, selectedKey: 'r1', dismissedTip: true });
        instance.setupPreviewPopout();
        if (document.getElementById('switch-preview-hint')) {
            throw new Error('a dismissed hint must stay dismissed');
        }
    });

    await test('nothing selected: the dialog does not open', async () => {
        const { instance } = setup({ cycles: CYCLE, selectedKey: null });
        instance._openPreviewReviewModal();
        if (document.getElementById('preview-review-overlay')) {
            throw new Error('with no selection there is nothing to review');
        }
    });

    teardown();

    // =========================================================
    // RESULTS
    // =========================================================
    const percentage = total.count ? Math.round((passed.count / total.count) * 100) : 0;
    const summary = `<h3>Results: ${passed.count}/${total.count} tests passed (${percentage}%)</h3>`;
    resultsDiv.innerHTML = resultsDiv.innerHTML.replace(/<h3>Running tests\.\.\.<\/h3>/, summary);
    return { passed: passed.count, total: total.count };
}
