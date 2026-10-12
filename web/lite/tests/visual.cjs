/**
 * Visual baselines for miniCycle Lite — the guard for Phase 2 of CLEANUP_PLAN.md
 * (folding miniCycle-lite-polish.css into the base stylesheet must not move a
 * pixel). Each shot opens Lite in a fixed state and compares a screenshot to
 * baselines/<name>.png.
 *
 * Local-only by design: rendering depends on the machine's fonts, so baselines
 * made on macOS would fail on CI's Linux. Run before and after a CSS refactor.
 *
 * The pixel diff runs inside the browser on a <canvas> (no PNG library needed):
 * a pixel "differs" when any channel moves by more than CHANNEL_TOLERANCE, and a
 * shot fails when more than MAX_DIFF_RATIO of its pixels differ.
 */

const CHANNEL_TOLERANCE = 24;      // absorbs anti-aliasing noise
const MAX_DIFF_RATIO = 0.0005;     // 0.05% of pixels

// Seed: one completed task and one high-priority task, so both states are covered.
const TASKS = [
    { text: 'Make bed', completed: true },
    { text: 'Drink water', highPriority: true },
    'Stretch for ten minutes before work',
    'Review plan',
];

const VIEWPORTS = {
    phone: { width: 375, height: 812 },
    tablet: { width: 690, height: 1000 },
    desktop: { width: 1024, height: 768 },
};

// What to open before the screenshot. Each runs in the page.
const STATES = {
    list: null,
    help: async (page) => { await page.locator('#quick-help-toggle').click(); },
    toast: async (page) => {
        await page.evaluate(() => window.showNotification('Mode changed to: Manual Cycle', 'info', 0));
    },
    edit: async (page) => {
        await page.evaluate(() => window.openEditTaskModal(document.querySelectorAll('#taskList .task')[1]));
    },
    confirm: async (page) => {
        await page.evaluate(() => window.deleteTask(document.querySelectorAll('#taskList .task')[0]));
    },
    feedback: async (page) => {
        await page.locator('#menu-button').click();
        await page.locator('#open-feedback-modal').click();
    },
    focus: async (page) => { await page.locator('#focus-toggle').click(); },
};

function buildShots() {
    const shots = [];
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
        for (const dark of [false, true]) {
            for (const state of Object.keys(STATES)) {
                shots.push({
                    name: `web-${vpName}-${dark ? 'dark' : 'light'}-${state}`,
                    viewport, dark, state, chrome: false,
                });
            }
        }
    }
    for (const dark of [false, true]) {
        for (const state of ['list', 'help', 'edit', 'feedback', 'focus']) {
            shots.push({
                name: `chrome-popup-${dark ? 'dark' : 'light'}-${state}`,
                viewport: { width: 400, height: 600 }, dark, state, chrome: true,
            });
        }
    }
    return shots;
}

/** Runs in the page: compare two PNG data URLs pixel by pixel. */
async function diffInPage(page, baselineB64, actualB64, tolerance) {
    return page.evaluate(async ({ a, b, tol }) => {
        const load = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = 'data:image/png;base64,' + src;
        });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) {
            return { sizeMismatch: true, a: [ia.width, ia.height], b: [ib.width, ib.height] };
        }
        const w = ia.width, h = ia.height;
        const read = (img) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, w, h).data;
        };
        const da = read(ia), db = read(ib);
        let diff = 0;
        for (let i = 0; i < da.length; i += 4) {
            if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol ||
                Math.abs(da[i + 2] - db[i + 2]) > tol) diff++;
        }
        return { diff, total: w * h };
    }, { a: baselineB64, b: actualB64, tol: tolerance });
}

module.exports = { buildShots, STATES, TASKS, diffInPage, CHANNEL_TOLERANCE, MAX_DIFF_RATIO };
