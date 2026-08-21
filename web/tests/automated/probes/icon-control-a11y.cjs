/**
 * PROBE — are icon-only controls NAMED and REACHABLE without touch?
 *
 * The long-press hint is a touch affordance. It must be an addition, never the
 * only way to learn what a control does: a VoiceOver user never long-presses,
 * and a keyboard user never touches at all. This probe asks Chromium for the
 * COMPUTED accessible name of each control — the same value a screen reader
 * announces — rather than inferring it from markup.
 *
 * It runs at two widths on purpose. `.switch-btn-label` is `display: none`
 * under the mobile breakpoint, and display:none removes text from the
 * accessibility tree, not just from view — so the mobile name can differ from
 * the desktop one for the very same button.
 *
 * Not a test — see ./README.md. Needs `npm start` on :8080.
 */
const { chromium } = require('playwright');

const SWITCH_BUTTONS = ['switch-duplicate', 'switch-rename', 'switch-delete',
                        'switch-download', 'switch-theme'];

async function boot(browser, width, height) {
  const ctx = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width, height },
    hasTouch: width < 700,
    isMobile: width < 700,
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const first = await p.$('.first-run-btn[data-choice="learn"]');
  if (first) await first.click();
  await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1200);
  return p;
}

// Chromium's computed accessible name, via the same tree a screen reader reads.
async function names(p, ids) {
  const out = {};
  for (const id of ids) {
    const handle = await p.$(`#${id}`);
    if (!handle) { out[id] = '(absent)'; continue; }
    const snap = await p.accessibility.snapshot({ root: handle, interestingOnly: false });
    const visible = await handle.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const focusable = await handle.evaluate(el => el.tabIndex >= 0 && !el.disabled);
    out[id] = {
      role: snap?.role ?? '(no node)',
      name: snap?.name ?? '(no name)',
      laidOut: visible,
      focusable,
    };
  }
  return out;
}

async function openSwitcher(p) {
  await p.evaluate(() => document.querySelector('.menu-button')?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById('open-mini-cycle')?.click());
  await p.waitForTimeout(1800);
  // The Routine Actions row is display:none until a routine is selected.
  await p.evaluate(() => document.querySelector('.mini-cycle-switch-item')?.click());
  await p.waitForTimeout(900);
}

(async () => {
  const b = await chromium.launch();

  for (const [label, w, h] of [['MOBILE 390x844', 390, 844], ['DESKTOP 1280x900', 1280, 900]]) {
    console.log(`\n================ ${label} ================`);
    const p = await boot(b, w, h);

    // Quick Actions: seed pinned slots, otherwise a fresh profile renders none.
    await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('miniCycleData'));
      d.settings.quickActions = { pinned: ['stats', 'themes', 'history', null, null],
                                  counts: {}, recent: [], activeView: 'pinned' };
      localStorage.setItem('miniCycleData', JSON.stringify(d));
    });
    await p.reload();
    await p.waitForTimeout(9000);
    await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
    await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.menu-button')?.click());
    await p.waitForTimeout(2000);

    console.log('\n-- Quick Actions slots --');
    const slots = await p.evaluate(() =>
      [...document.querySelectorAll('.quick-actions-slot.filled')].map(el => el.dataset.actionId));
    console.log('   rendered:', JSON.stringify(slots));
    for (const action of slots) {
      const h = await p.$(`.quick-actions-slot.filled[data-action-id="${action}"]`);
      if (!h) continue;
      const snap = await p.accessibility.snapshot({ root: h, interestingOnly: false });
      const attrs = await h.evaluate(el => ({
        tag: el.tagName, tabIndex: el.tabIndex,
        ariaLabel: el.getAttribute('aria-label'), title: el.title,
      }));
      console.log(`   ${action.padEnd(10)} role=${String(snap?.role).padEnd(8)} name="${snap?.name}" <${attrs.tag}> tabIndex=${attrs.tabIndex} aria-label="${attrs.ariaLabel}"`);
    }

    await p.evaluate(() => { document.querySelector('dialog[open]')?.close(); });
    await openSwitcher(p);

    console.log('\n-- Routine Actions buttons --');
    const info = await names(p, SWITCH_BUTTONS);
    for (const [id, v] of Object.entries(info)) {
      if (typeof v === 'string') { console.log(`   ${id.padEnd(18)} ${v}`); continue; }
      console.log(`   ${id.padEnd(18)} role=${String(v.role).padEnd(8)} name="${v.name}"  laidOut=${v.laidOut} focusable=${v.focusable}`);
    }

    // Is the visible text in the a11y tree, or hidden by display:none?
    console.log('\n   .switch-btn-label computed display:',
      await p.evaluate(() => {
        const el = document.querySelector('#switch-rename .switch-btn-label');
        return el ? getComputedStyle(el).display : '(absent)';
      }));

    // Keyboard reachability: can Tab land on them at all?
    const tabbable = await p.evaluate((ids) => ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return `${id}:absent`;
      const cs = getComputedStyle(el);
      const hidden = cs.display === 'none' || cs.visibility === 'hidden';
      return `${id}:${hidden ? 'HIDDEN' : 'reachable'}`;
    }), SWITCH_BUTTONS);
    console.log('   keyboard reachability:', tabbable.join('  '));

    await p.context().close();
  }

  await b.close();
})();
