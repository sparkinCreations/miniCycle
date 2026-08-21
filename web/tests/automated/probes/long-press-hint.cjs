/**
 * PROBE — does a long press name the icon WITHOUT activating it?
 *
 * Drives the real app on a touch-emulated context and reports, for both
 * surfaces: whether the hint/tooltip became visible, whether the action fired,
 * and — for the routine switcher — whether the hint is actually PAINTED, since
 * that modal is a showModal() dialog living in the browser's top layer where a
 * body-appended bubble would be invisible at any z-index.
 *
 * Not a test — see ./README.md. Needs `npm start` on :8080.
 */
const { chromium } = require('playwright');

const BOOT = 7000;

async function open() {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const first = await p.$('.first-run-btn[data-choice="learn"]');
  if (first) await first.click();
  await p.waitForTimeout(BOOT);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1200);
  return { b, p, errs };
}

// Synthesise a hold: touchstart, wait past the 500ms threshold, touchend.
// dispatchEvent rather than page.touchscreen.tap() because we need the dwell.
async function hold(p, selector, ms) {
  await p.evaluate(async ({ selector, ms }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`no element for ${selector}`);
    const r = el.getBoundingClientRect();
    const pt = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, identifier: 1, target: el };
    const mk = (type, touches) => new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches, targetTouches: touches, changedTouches: [new Touch(pt)],
    });
    el.dispatchEvent(mk('touchstart', [new Touch(pt)]));
    await new Promise(r2 => setTimeout(r2, ms));
    el.dispatchEvent(mk('touchend', []));
    // The browser fires the synthetic click after touchend; emulate it so the
    // guard is genuinely exercised.
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, { selector, ms });
}

function readHint(p) {
  return p.evaluate(() => {
    const h = document.getElementById('long-press-hint');
    if (!h) return { present: false };
    const cs = getComputedStyle(h);
    const r = h.getBoundingClientRect();
    // elementFromPoint answers the question z-index cannot: is it on top?
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      present: true,
      text: h.textContent,
      visible: h.classList.contains('visible'),
      opacity: cs.opacity,
      parent: h.parentElement?.tagName?.toLowerCase() + (h.parentElement?.id ? '#' + h.parentElement.id : ''),
      rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
      topmostAtCentre: mid ? (mid.id || mid.className || mid.tagName) : null,
    };
  });
}

(async () => {
  const { b, p, errs } = await open();

  // A fresh profile has no usage history, so the Quick Actions bar renders zero
  // slots. Seed pinned actions and reload — otherwise there is nothing to hold.
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('miniCycleData'));
    d.settings.quickActions = { pinned: ['stats', 'themes', 'history', null, null],
                                counts: {}, recent: [], activeView: 'pinned' };
    localStorage.setItem('miniCycleData', JSON.stringify(d));
  });
  await p.reload();
  await p.waitForTimeout(BOOT);

  console.log('--- Quick Actions slot ---');
  await p.evaluate(() => document.querySelector('.menu-button')?.click());
  await p.waitForTimeout(1500);
  const slot = '#quick-actions-slots .quick-actions-slot.filled, #quick-actions-menu-slots .quick-actions-slot.filled';
  const slotExists = await p.$(slot);
  if (!slotExists) {
    console.log('   no filled slot rendered — cannot probe');
  } else {
    const before = await p.evaluate(() => location.href);
    await hold(p, slot, 800);
    await p.waitForTimeout(400);
    console.log('   tooltip visible :', await p.evaluate(() =>
      document.getElementById('quick-actions-tooltip')?.classList.contains('visible') ?? '(no tooltip el)'));
    console.log('   menu still open :', await p.evaluate(() =>
      !!document.querySelector('#quick-actions-menu, #menu-container')));
    console.log('   navigated       :', (await p.evaluate(() => location.href)) !== before);
  }

  console.log('\n--- Quick Actions: a normal TAP must still act ---');
  // 'themes' is pinned at slot 1 and opens a <dialog> — an unambiguous signal.
  // Slot 0 is 'stats', which only switches a carousel panel; "did anything
  // happen?" is far harder to answer there, and a weak signal reads as a
  // regression that isn't one.
  await p.evaluate(() => document.getElementById('quick-actions-tooltip')?.classList.remove('visible'));
  const themeSlot = '.quick-actions-slot.filled[data-action-id="themes"]';
  if (await p.$(themeSlot)) {
    await hold(p, themeSlot, 80);
    await p.waitForTimeout(1200);
    console.log('   tap opened a dialog (must be true):', await p.evaluate(() =>
      [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className || d.tagName).join(' | ') || false));
  } else {
    console.log('   themes slot absent — cannot probe tap');
  }

  console.log('\n--- Routine switcher Routine Actions ---');
  await p.evaluate(() => {
    document.querySelector('dialog[open]')?.close();
    document.querySelector('.menu-button')?.click();
  });
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('open-mini-cycle')?.click());
  await p.waitForTimeout(1800);
  console.log('   switcher dialog open:', await p.evaluate(() =>
    !!document.getElementById('routine-switcher-modal')?.open));
  // #switch-items-row is display:none until a routine is selected — without
  // this the buttons have zero size and every measurement below is meaningless.
  await p.evaluate(() => document.querySelector('.mini-cycle-switch-item')?.click());
  await p.waitForTimeout(900);
  console.log('   actions row laid out:', await p.evaluate(() => {
    const r = document.getElementById('switch-rename')?.getBoundingClientRect();
    return r ? `${Math.round(r.width)}x${Math.round(r.height)} at y=${Math.round(r.top)}` : 'absent';
  }));

  const renamed = await p.evaluate(() => !!document.getElementById('switch-rename'));
  if (!renamed) {
    console.log('   #switch-rename not present — cannot probe');
  } else {
    await hold(p, '#switch-rename', 800);
    await p.waitForTimeout(400);
    console.log('   hint:', JSON.stringify(await readHint(p), null, 2).replace(/\n/g, '\n   '));
    console.log('   alignment:', JSON.stringify(await p.evaluate(() => {
      const h = document.getElementById('long-press-hint').getBoundingClientRect();
      const b = document.getElementById('switch-rename').getBoundingClientRect();
      return { hintCentreX: Math.round(h.left + h.width / 2),
               btnCentreX: Math.round(b.left + b.width / 2),
               hintBottom: Math.round(h.bottom), btnTop: Math.round(b.top),
               sitsAbove: h.bottom <= b.top };
    })));
    console.log('   rename prompt opened (should be false):', await p.evaluate(() =>
      !!document.getElementById('prompt-modal')?.open ||
      !!document.querySelector('#rename-modal[open], .prompt-modal.visible')));

    // And the other half of the contract: a TAP on the same button must act.
    await p.waitForTimeout(500);
    await hold(p, '#switch-rename', 80);
    await p.waitForTimeout(1200);
    console.log('   tap opened the rename prompt (must be true):', await p.evaluate(() =>
      [...document.querySelectorAll('dialog[open]')].map(d => d.id || d.className || d.tagName).join(' | ') || false));
  }

  console.log('\npage errors:', JSON.stringify(errs));
  await b.close();
})();
