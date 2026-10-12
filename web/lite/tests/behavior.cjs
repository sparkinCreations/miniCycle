/**
 * Behavior tests for miniCycle Lite — the flows the Phase 2 CSS merge and the
 * Phase 3 JS tidy must not break. Several pin specific bugs fixed in Oct 2026
 * (cycle double-count, undo restoring stats, swipe toggling tasks, the feedback
 * modal's Cancel landing on its ✕); each says so in its name.
 *
 * Each test: async ({ open }) => { ... }, where open(opts) returns a fresh page
 * (see helpers.openLite). Throw (via assert*) to fail.
 */
const {
    getState, texts, checkedPattern, checkTask, taskOption, setMode, menuAction,
    waitForReady, assert, assertEqual,
} = require('./helpers.cjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ─── Tasks ──────────────────────────────────────────────────────────────

test('loads seeded tasks', async ({ open }) => {
    const { page } = await open();
    assertEqual(texts(await getState(page)), ['Make bed', 'Drink water', 'Stretch', 'Review plan'], 'task list');
});

test('Add Tasks modal adds tasks that persist across reload', async ({ open }) => {
    const { page } = await open({ tasks: [] });
    await page.locator('#open-add-task-modal').click();
    await page.locator('#modalTaskInput').fill('Walk dog');
    await page.keyboard.press('Enter');
    await page.locator('#modalTaskInput').fill('Read');
    await page.keyboard.press('Enter');
    await page.locator('#done-adding-tasks').click();
    assertEqual(texts(await getState(page)), ['Walk dog', 'Read'], 'after adding');
    await page.reload();
    await waitForReady(page);
    assertEqual(texts(await getState(page)), ['Walk dog', 'Read'], 'after reload');
});

test('checking a task marks the row complete and fills the progress bar', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    await checkTask(page, 0);
    const s = await getState(page);
    assert(s.tasks[0].checked && s.tasks[0].completeClass, 'row 0 should be checked with .task-complete');
    assert(!s.tasks[1].completeClass, 'row 1 should not be complete');
    const width = await page.evaluate(() => document.getElementById('progressBar').style.width);
    assertEqual(width, '25%', 'progress bar width (1 of 4)');
});

// ─── Cycles & undo ──────────────────────────────────────────────────────

test('Auto Cycle completion counts ONE cycle and resets (double-count regression)', async ({ open }) => {
    const { page } = await open({ mode: 'auto-cycle' });
    for (let i = 0; i < 4; i++) await checkTask(page, i);
    await page.waitForFunction(() => localStorage.getItem('miniCycleLiteCycles') === '1', null, { timeout: 5000 });
    await page.waitForTimeout(800); // a second (buggy) increment would land here
    const s = await getState(page);
    assertEqual(s.cycles, 1, 'cycles after one completion');
    assertEqual(checkedPattern(s), '0000', 'tasks reset');
    assertEqual(await page.locator('#mini-cycle-count').textContent(), '1', 'displayed cycle count');
});

test('undo during the auto-reset delay cancels the reset', async ({ open }) => {
    const { page } = await open({ mode: 'auto-cycle' });
    for (let i = 0; i < 4; i++) await checkTask(page, i);
    // The reset is scheduled ~100ms after the last check, then waits 1.5s.
    // Undo inside that window — after it is pending, or there is nothing to cancel.
    await page.waitForTimeout(400);
    await page.locator('#undo-btn').click();
    await page.waitForTimeout(2200);
    const s = await getState(page);
    assertEqual(s.cycles, 0, 'no cycle counted');
    assertEqual(checkedPattern(s), '1110', 'last check undone, nothing reset');
});

test('undo/redo restore the cycle count after an Auto Cycle', async ({ open }) => {
    const { page } = await open({ mode: 'auto-cycle' });
    for (let i = 0; i < 4; i++) await checkTask(page, i);
    await page.waitForFunction(() => localStorage.getItem('miniCycleLiteCycles') === '1', null, { timeout: 5000 });
    await page.locator('#undo-btn').click();
    assertEqual((await getState(page)).cycles, 0, 'cycles after undo');
    await page.locator('#redo-btn').click();
    assertEqual((await getState(page)).cycles, 1, 'cycles after redo');
});

test('undo of a single check unchecks the box (undo no-op regression)', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    await checkTask(page, 1);
    await page.locator('#undo-btn').click();
    assertEqual(checkedPattern(await getState(page)), '0000', 'after undo');
    await page.locator('#redo-btn').click();
    assertEqual(checkedPattern(await getState(page)), '0100', 'after redo');
});

test('Manual Cycle: Complete All, then Start New Cycle counts one cycle', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    const button = page.locator('#completeAll');
    await button.click();
    assertEqual(checkedPattern(await getState(page)), '1111', 'Complete All checks everything');
    assertEqual((await button.textContent()).trim(), 'Start New Cycle', 'button text once all are done');
    await button.click();
    const s = await getState(page);
    assertEqual(s.cycles, 1, 'cycles');
    assertEqual(checkedPattern(s), '0000', 'reset');
});

test('To-Do: Clear Completed removes checked tasks, counts them, and undo restores', async ({ open }) => {
    const { page } = await open({ mode: 'todo-mode' });
    await checkTask(page, 0);
    await checkTask(page, 2);
    await page.locator('#completeAll').click();
    let s = await getState(page);
    assertEqual(texts(s), ['Drink water', 'Review plan'], 'remaining tasks');
    assertEqual(s.cleared, 2, 'Tasks Cleared stat');
    await page.locator('#undo-btn').click();
    s = await getState(page);
    assertEqual(texts(s).length, 4, 'tasks restored');
    assertEqual(s.cleared, 0, 'cleared stat restored');
});

// ─── Modals ─────────────────────────────────────────────────────────────

test('Edit modal: Enter saves, empty is rejected, Escape cancels', async ({ open }) => {
    const { page } = await open();
    const dialog = page.locator('#edit-task-dialog');
    await taskOption(page, 1, 'edit-btn');
    assert(await dialog.isVisible(), 'edit modal opens');
    await page.locator('#editTaskInput').fill('Drink 2L water');
    await page.keyboard.press('Enter');
    assert(!(await dialog.isVisible()), 'closes on save');
    assertEqual(texts(await getState(page))[1], 'Drink 2L water', 'saved name');

    await taskOption(page, 1, 'edit-btn');
    await page.locator('#editTaskInput').fill('   ');
    await page.locator('#save-edit-task').click();
    assert(await dialog.isVisible(), 'stays open on an empty name');
    await page.keyboard.press('Escape');
    assert(!(await dialog.isVisible()), 'Escape closes');
    assertEqual(texts(await getState(page))[1], 'Drink 2L water', 'name unchanged after cancel');
});

test('Delete task asks first (Cancel focused), deletes on confirm, undo restores', async ({ open }) => {
    const { page } = await open();
    await taskOption(page, 0, 'delete-btn');
    assert(await page.locator('#confirm-dialog').isVisible(), 'confirm opens');
    await page.waitForTimeout(100);
    assertEqual(await page.evaluate(() => document.activeElement && document.activeElement.id),
        'confirm-dialog-cancel', 'danger action focuses Cancel');
    await page.locator('#confirm-dialog-ok').click();
    assertEqual(texts(await getState(page)), ['Drink water', 'Stretch', 'Review plan'], 'after delete');
    await page.locator('#undo-btn').click();
    assertEqual(texts(await getState(page)).length, 4, 'after undo');
});

test('menu confirms: Delete All, Reset Stats (Escape keeps), Try Full Version (cancel)', async ({ open }) => {
    const { page } = await open();
    await menuAction(page, 'delete-all-mini-cycle-tasks');
    await page.locator('#confirm-dialog-ok').click();
    assertEqual(texts(await getState(page)).length, 0, 'Delete All');
    await page.locator('#undo-btn').click();
    assertEqual(texts(await getState(page)).length, 4, 'Delete All undone');

    await page.evaluate(() => localStorage.setItem('miniCycleLiteCycles', '3'));
    await menuAction(page, 'reset-all-stats');
    // The dialog listens for Escape on itself and moves focus in ~50ms after
    // opening — wait for that, as a person pressing Escape effectively does.
    await page.waitForFunction(() => document.getElementById('confirm-dialog').contains(document.activeElement));
    await page.keyboard.press('Escape');
    assertEqual((await getState(page)).cycles, 3, 'Escape keeps stats');
    await menuAction(page, 'reset-all-stats');
    await page.locator('#confirm-dialog-ok').click();
    assertEqual((await getState(page)).cycles, 0, 'confirm resets stats');

    await menuAction(page, 'try-full-version');
    await page.locator('#confirm-dialog-cancel').click();
    assertEqual(await page.evaluate(() => localStorage.getItem('miniCycleForceFullVersion')), null,
        'cancel does not switch to the full version');
});

test('feedback modal: Cancel sits in the footer, below the fields (overlap regression)', async ({ open }) => {
    const { page } = await open();
    await menuAction(page, 'open-feedback-modal');
    const modal = page.locator('#feedback-modal');
    assert(await modal.isVisible(), 'feedback modal opens');
    const cancel = await page.locator('#feedback-modal .feedback-cancel-btn').boundingBox();
    const close = await page.locator('#feedback-modal .feedback-modal-close').boundingBox();
    const textarea = await page.locator('#feedback-text').boundingBox();
    assert(cancel.y > textarea.y + textarea.height, 'Cancel is below the textarea');
    assert(cancel.y > close.y + close.height, 'Cancel does not overlap the header ✕');
    await page.locator('#feedback-modal .feedback-cancel-btn').click();
    assert(!(await modal.isVisible()), 'Cancel closes');
    await menuAction(page, 'open-feedback-modal');
    await page.locator('#feedback-modal .feedback-modal-close').click();
    assert(!(await modal.isVisible()), '✕ closes');
});

// ─── Gestures ───────────────────────────────────────────────────────────

test('mouse drag reorders, one undo step restores the order', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    const rows = page.locator('#taskList .task');
    const from = await rows.nth(0).locator('.task-text').boundingBox();
    const to = await rows.nth(2).boundingBox();
    await page.mouse.move(from.x + 40, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + from.height / 2 + 20, { steps: 4 });
    await page.mouse.move(from.x + 40, to.y + to.height - 4, { steps: 8 });
    await page.mouse.up();
    let s = await getState(page);
    assertEqual(texts(s), ['Drink water', 'Stretch', 'Make bed', 'Review plan'], 'after drag');
    assertEqual(s.saved, texts(s), 'new order saved');
    assertEqual(checkedPattern(s), '0000', 'drag did not toggle a task');
    await page.locator('#undo-btn').click();
    assertEqual(texts(await getState(page)), ['Make bed', 'Drink water', 'Stretch', 'Review plan'], 'after undo');
});

test('touch long-press drag reorders; sideways motion during it is not a swipe', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    const result = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const row = document.querySelectorAll('#taskList .task')[0];
        const txt = row.querySelector('.task-text');
        const b = row.getBoundingClientRect();
        const fire = (type, x, y) => {
            const t = new Touch({ identifier: 1, target: txt, clientX: x, clientY: y });
            txt.dispatchEvent(new TouchEvent(type, {
                bubbles: true, cancelable: true,
                touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t],
                changedTouches: [t],
            }));
        };
        const x = b.left + 120, y = b.top + b.height / 2, step = b.height + 8;
        fire('touchstart', x, y);
        await sleep(450);
        const lifted = /task-dragging/.test(row.className);
        fire('touchmove', x, y + step * 0.8); await sleep(30);
        fire('touchmove', x - 140, y + step * 1.8); await sleep(30);
        fire('touchend', x - 140, y + step * 1.8);
        await sleep(200);
        return { lifted };
    });
    assert(result.lifted, 'long-press lifts the task');
    const s = await getState(page);
    assertEqual(texts(s)[1], 'Make bed', 'task moved down one place');
    assert(!s.statsShowing, 'did not swipe to Stats');
    assertEqual(checkedPattern(s), '0000', 'no task toggled');
});

test('swipe: mouse drag across a row opens Stats without toggling it; drag back after using the pill', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    const row = await page.locator('#taskList .task').nth(1).locator('.task-text').boundingBox();
    const y = row.y + row.height / 2;
    await page.mouse.move(row.x + 200, y);
    await page.mouse.down();
    await page.mouse.move(row.x + 100, y + 3, { steps: 6 });
    await page.mouse.up();
    let s = await getState(page);
    assert(s.statsShowing, 'drag left opened Stats');
    assertEqual(checkedPattern(s), '0000', 'the row under the drag was not toggled');

    await page.locator('.dot[data-view="tasks"]').click();
    await page.locator('.dot[data-view="stats"]').click(); // stale-flag regression: pill then swipe
    const panel = await page.locator('#stats-panel').boundingBox();
    await page.mouse.move(panel.x + 60, panel.y + 120);
    await page.mouse.down();
    await page.mouse.move(panel.x + 180, panel.y + 122, { steps: 6 });
    await page.mouse.up();
    s = await getState(page);
    assert(!s.statsShowing, 'drag right returned to Tasks');
});

test('a quick touch flick across a row does not toggle it', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const txt = document.querySelectorAll('#taskList .task-text')[2];
        const b = txt.getBoundingClientRect();
        const fire = (type, x, y) => {
            const t = new Touch({ identifier: 2, target: txt, clientX: x, clientY: y });
            txt.dispatchEvent(new TouchEvent(type, {
                bubbles: true, cancelable: true,
                touches: type === 'touchend' ? [] : [t], changedTouches: [t],
            }));
        };
        fire('touchstart', b.left + 20, b.top + 10);
        await sleep(60);
        fire('touchend', b.left + 20, b.top - 50);
        await sleep(200);
    });
    assertEqual(checkedPattern(await getState(page)), '0000', 'flick did not toggle');
});

// ─── Help, layout ───────────────────────────────────────────────────────

test('help popup highlights the current mode and follows mode changes', async ({ open }) => {
    const { page } = await open({ mode: 'manual-cycle' });
    await page.locator('#quick-help-toggle').click();
    const active = () => page.evaluate(() => {
        const el = document.querySelector('#help-window .help-mode-active');
        return el && el.getAttribute('data-help-mode');
    });
    assertEqual(await active(), 'manual-cycle', 'initial highlight');
    await setMode(page, 'todo-mode');
    assertEqual(await active(), 'todo-mode', 'after switching mode');
});

test('high-priority icon sits after the text; task names stay aligned', async ({ open }) => {
    const { page } = await open({ tasks: ['One', { text: 'Two', highPriority: true }, 'Three'] });
    const row = page.locator('#taskList .task').nth(1);
    const icon = await row.locator('.priority-indicator').boundingBox();
    const text = await row.locator('.task-text').boundingBox();
    const dots = await row.locator('.three-dots-btn').boundingBox();
    const otherText = await page.locator('#taskList .task').nth(0).locator('.task-text').boundingBox();
    assert(icon.x >= text.x + text.width, 'icon is to the right of the text');
    assert(icon.x + icon.width <= dots.x, 'icon does not overlap the ⋯ button');
    assertEqual(Math.round(text.x), Math.round(otherText.x), 'task name aligned with other rows');
});

test('toast appears just below the mode selector (phone)', async ({ open }) => {
    const { page } = await open({ viewport: { width: 375, height: 812 }, notifications: true });
    await page.evaluate(() => window.showNotification('Test toast', 'info', 0));
    await page.waitForTimeout(400);
    const bar = await page.locator('.mobile-mode-selector-wrapper').boundingBox();
    const toast = await page.locator('.mc-toast').boundingBox();
    const gap = toast.y - (bar.y + bar.height);
    assert(gap >= 0 && gap <= 16, `toast should sit 0–16px under the selector bar (gap ${gap.toFixed(1)}px)`);
});

// ─── Chrome Edition popup ───────────────────────────────────────────────

test('Chrome Edition: loads, checks a task, Try Full Version opens minicycleapp.com', async ({ open }) => {
    const { page } = await open({ chrome: true, viewport: { width: 400, height: 600 }, mode: 'manual-cycle' });
    await checkTask(page, 0);
    assertEqual(checkedPattern(await getState(page)), '1000', 'checked');
    const label = await page.evaluate(() => window.editionLabel);
    assert(/^Chrome Edition v\d+\.\d+$/.test(label), `edition label (got ${label})`);
    const opened = await page.evaluate(() => {
        let url = null;
        const original = window.open;
        window.open = (u) => { url = u; };
        window.handleTryFullVersion();
        window.open = original;
        return url;
    });
    assertEqual(opened, 'https://minicycleapp.com', 'Try Full Version target');
});

module.exports = { tests };
