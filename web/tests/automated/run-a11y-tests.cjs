/**
 * Accessibility Semantics Regression Tests
 * =============================================================================
 * Drives the REAL app through its main surfaces and asserts two properties that
 * no other gate in this repo can see, because both are about ROLE and
 * OPERABILITY rather than about labels:
 *
 *   A. Custom controls are keyboard-operable.
 *      An element the author made focusable (tabindex >= 0) and gave a click
 *      handler is a control. If it is not a native control, it must also carry
 *      an interactive role AND a key handler — a focusable <div> does not fire
 *      click from the keyboard, so a click-only handler is unreachable without
 *      a pointer (WCAG 2.1.1 Keyboard, Level A).
 *
 *      That is exactly how Recreate shipped: entries were focusable divs with a
 *      click-only handler. Arrow-key navigation between them already worked,
 *      which is what made the gap easy to miss — the feature looked keyboard-
 *      aware right up until you tried to select something.
 *
 *   B. Interactive elements have an accessible name.
 *      The task-option checkboxes carried id and name attributes and a visible
 *      sibling <span>, and reported name="" to every screen reader.
 *
 * WHY tabindex IS THE DISCRIMINATOR FOR (A)
 * Listeners are recorded by wrapping addEventListener at document_start, so a
 * DELEGATED handler registers against the container, not the row that will
 * actually be clicked. Flagging every container with a click listener would be
 * mostly false positives. Requiring tabindex >= 0 keeps the check on elements
 * the author deliberately made focusable — i.e. meant as controls — which is
 * both the real defect shape and something a delegating wrapper almost never
 * has. The cost is that a non-focusable div-with-onclick is not reported here;
 * that is a separate defect (it fails 2.1.1 by being unreachable at all) and is
 * left to manual review rather than guessed at.
 *
 * Usage:
 *   npm run test:a11y
 *
 * Exits 0 when every surface is clean, 1 otherwise (CI-ready).
 */

const { chromium } = require('playwright');
const path = require('path');
const { startStaticServer } = require('./_static-server.cjs');

const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

const PORT = 8076;
const WEB_ROOT = path.join(__dirname, '..', '..');

// Elements that are keyboard-operable by the platform, so a click handler on
// them is already reachable via Enter/Space with no extra work.
const NATIVE_INTERACTIVE = 'a[href],button,input,select,textarea,summary,details';
// Roles that promise the user "this does something when you activate it".
const INTERACTIVE_ROLES = ['button', 'checkbox', 'link', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'radio', 'switch', 'tab', 'treeitem'];

// Recorded at document_start so listeners registered during boot are captured.
function installListenerRecorder() {
    const orig = EventTarget.prototype.addEventListener;
    const map = new WeakMap();
    globalThis.__a11yListenerTypes = (el) => Array.from(map.get(el) || []);
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        try {
            if (this instanceof Element) {
                let set = map.get(this);
                if (!set) { set = new Set(); map.set(this, set); }
                set.add(type);
            }
        } catch { /* cross-realm element — not ours to audit */ }
        return orig.call(this, type, fn, opts);
    };
}

// Runs in the page. Returns elements that are controls by intent but not by
// construction.
function findOperabilityViolations(nativeSel, roles) {
    const out = [];
    const describe = (el) => {
        const id = el.id ? `#${el.id}` : '';
        const cls = typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
        return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    document.querySelectorAll('[tabindex]').forEach(el => {
        if (parseInt(el.getAttribute('tabindex'), 10) < 0) return;
        if (el.matches(nativeSel)) return;                       // platform handles it
        const types = globalThis.__a11yListenerTypes(el);
        if (!types.includes('click')) return;                    // not a control
        const role = el.getAttribute('role');
        const hasKey = types.some(t => t === 'keydown' || t === 'keyup' || t === 'keypress');
        const reasons = [];
        if (!role || !roles.includes(role)) reasons.push(`role=${role || 'none'}`);
        if (!hasKey) reasons.push('no key handler');
        if (reasons.length) out.push({ el: describe(el), reasons: reasons.join(', ') });
    });
    return out;
}

function collectNamed(node, out = []) {
    if (!node) return out;
    if (/^(button|checkbox|link|radio|switch|tab|menuitem|option|combobox|textbox|slider)$/i.test(node.role || '')) {
        out.push({ role: node.role, name: (node.name || '').trim() });
    }
    (node.children || []).forEach(c => collectNamed(c, out));
    return out;
}

async function run() {
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    console.log(`${colors.blue}♿ miniCycle Accessibility Semantics Tests${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);

    let srv;
    try {
        srv = await startStaticServer(WEB_ROOT, PORT);
    } catch (e) {
        console.error(`${colors.red}❌ Could not start test server: ${e.message}${colors.reset}`);
        process.exit(1);
    }
    console.log(`${colors.gray}   server on ${srv.url} (web/)${colors.reset}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 900, height: 950 } });
    await context.addInitScript(installListenerRecorder);
    await context.addInitScript(() => {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register = () => Promise.reject(new Error('SW off for a11y test'));
        }
    });
    const page = await context.newPage();
    const failures = [];

    const check = async (surface) => {
        const ops = await page.evaluate(
            ([sel, roles]) => findOperabilityViolations(sel, roles),
            [NATIVE_INTERACTIVE, INTERACTIVE_ROLES]
        );
        const snap = await page.accessibility.snapshot({ interestingOnly: false });
        const unnamed = collectNamed(snap).filter(x => !x.name);

        const ok = ops.length === 0 && unnamed.length === 0;
        if (ok) {
            console.log(`   ${colors.green}✅${colors.reset} ${surface}`);
        } else {
            console.log(`   ${colors.red}❌ ${surface}${colors.reset}`);
            ops.forEach(v => {
                const msg = `${surface}: ${v.el} is focusable with a click handler but ${v.reasons}`;
                console.log(`      ${colors.red}operability: ${v.el} — ${v.reasons}${colors.reset}`);
                failures.push(msg);
            });
            unnamed.forEach(v => {
                const msg = `${surface}: a ${v.role} has no accessible name`;
                console.log(`      ${colors.red}unnamed ${v.role}${colors.reset}`);
                failures.push(msg);
            });
        }
    };

    // Each surface: how to open it, and how to know it actually opened. A surface
    // that fails to open is reported as a FAILURE, never skipped — silent
    // no-coverage is how the whole To-Do flow rode green CI for days.
    const SURFACES = [
        { name: 'main menu',
          open: () => document.querySelector('.menu-button')?.click(),
          ready: () => document.getElementById('main-menu')?.classList.contains('visible'),
          close: () => document.querySelector('.menu-button')?.click() },
        { name: 'task options customizer',
          open: () => document.getElementById('open-task-options-customizer')?.click(),
          ready: () => document.getElementById('task-options-customizer-modal')?.open },
        { name: 'recurring panel',
          open: () => document.getElementById('open-recurring-panel')?.click(),
          ready: () => document.getElementById('recurring-panel-overlay')?.open
                    || document.getElementById('recurring-panel')?.open },
        { name: 'themes modal',
          open: () => document.getElementById('open-themes-panel')?.click(),
          ready: () => document.getElementById('themes-modal')?.open },
        { name: 'routine switcher',
          open: () => document.getElementById('open-mini-cycle')?.click(),
          ready: () => document.getElementById('routine-switcher-modal')?.open },
        { name: 'reminders modal',
          open: () => document.getElementById('open-reminders-modal')?.click(),
          ready: () => document.getElementById('reminders-modal')?.open },
        { name: 'settings modal',
          open: () => document.getElementById('open-settings')?.click(),
          ready: () => document.getElementById('settings-modal')?.open },
        { name: 'stats panel',
          open: () => document.querySelector('#nav-dots [aria-controls="stats-panel"]')?.click(),
          ready: () => document.getElementById('stats-panel')?.classList.contains('show'),
          close: () => document.getElementById('nav-dot-task-view')?.click() }
    ];

    try {
        await page.goto(`${srv.url}/miniCycle.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForFunction(() => document.documentElement.dataset.appLoaded === 'true', { timeout: 25000 });
        const learn = await page.$('.first-run-btn[data-choice="learn"]');
        if (learn) { await learn.click(); await page.waitForTimeout(3000); }
        await page.addScriptTag({ content: `${findOperabilityViolations.toString()}` });

        await check('routine view');

        for (const surface of SURFACES) {
            // Menus need the menu open first; modals are reached from it.
            const needsMenu = !['main menu', 'task options customizer', 'stats panel'].includes(surface.name);
            if (needsMenu) {
                await page.evaluate(() => {
                    const m = document.getElementById('main-menu');
                    if (!m?.classList.contains('visible')) document.querySelector('.menu-button')?.click();
                });
                await page.waitForTimeout(700);
                await page.evaluate(() => document.querySelectorAll('.menu-section.collapsed')
                    .forEach(sec => sec.classList.remove('collapsed')));
            }
            await page.evaluate(surface.open);
            await page.waitForTimeout(1600);
            const opened = await page.evaluate(surface.ready);
            if (!opened) {
                console.log(`   ${colors.red}❌ ${surface.name} — could not open${colors.reset}`);
                failures.push(`${surface.name}: could not be opened, so it was NOT audited`);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(600);
                continue;
            }
            await page.addScriptTag({ content: `${findOperabilityViolations.toString()}` });
            await check(surface.name);
            if (surface.close) await page.evaluate(surface.close);
            else await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
        }

        // History needs cleared-task content, so it runs last with its own setup.
        await page.evaluate(() => {
            const cb = document.getElementById('deleteCheckedTasks');
            if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelectorAll('#taskList .task input[type="checkbox"]')
            .forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } }));
        await page.waitForTimeout(3500);

        await page.evaluate(() => document.getElementById('history-btn')?.click());
        await page.waitForTimeout(1500);
        await page.addScriptTag({ content: `${findOperabilityViolations.toString()}` });
        await check('history modal — events tab');

        await page.evaluate(() => document.querySelector('.history-tab[data-tab="cleared"]')?.click());
        await page.waitForTimeout(1200);
        await check('history modal — cleared tasks tab');

        await page.evaluate(() => document.querySelector('.history-action-btn')?.click());
        await page.waitForTimeout(1200);
        await check('history modal — recreate mode');
    } catch (e) {
        console.log(`   ${colors.red}❌ harness error: ${e.message}${colors.reset}`);
        failures.push(`harness error: ${e.message}`);
    } finally {
        await browser.close();
        await srv.close?.();
    }

    console.log(`\n${colors.blue}${'='.repeat(64)}${colors.reset}`);
    if (failures.length) {
        console.log(`${colors.red}⚠️  ${failures.length} accessibility violation(s):${colors.reset}`);
        failures.forEach(f => console.log(`   ${colors.red}• ${f}${colors.reset}`));
        console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
        process.exit(1);
    }
    console.log(`${colors.green}🎉 Every audited surface exposes operable, named controls.${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(64)}${colors.reset}`);
    process.exit(0);
}

run();
