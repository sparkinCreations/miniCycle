/**
 * PROBE — are the Quick Actions exposed TWICE to assistive tech?
 *
 * Quick Actions render into two containers: #quick-actions-menu-slots (inside
 * the main menu) and #quick-actions-slots (the standalone row). Both are filled
 * from the same state, so the same three buttons exist twice in the DOM.
 *
 * That is only safe if the container that is not on screen is removed from the
 * ACCESSIBILITY TREE, not merely made invisible. display:none and
 * visibility:hidden remove it; opacity:0, height:0, clip and off-screen
 * transforms do NOT — a screen reader would read "Stats, Themes, History,
 * Stats, Themes, History", and a keyboard user would tab through phantom
 * copies.
 *
 * This probe was written because an earlier run reported role=undefined for
 * every desktop slot — meaning accessibility.snapshot() returned null, i.e. the
 * nodes were absent from the tree. That is a fact about the page, so it needed
 * explaining rather than dismissing as probe noise.
 *
 * Not a test — see ./README.md. Needs `npm start` on :8080.
 */
const { chromium } = require('playwright');

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
  return p;
}

// Why is a node absent from the a11y tree? Walk up and name the culprit.
const WHY = `(el) => {
  let node = el, reasons = [];
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const id = node.id ? '#' + node.id : (node.className && typeof node.className === 'string'
        ? '.' + node.className.trim().split(/\\s+/)[0] : node.tagName.toLowerCase());
    if (cs.display === 'none') reasons.push(id + ' display:none');
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') reasons.push(id + ' visibility:' + cs.visibility);
    if (node.hasAttribute && node.hasAttribute('aria-hidden')) reasons.push(id + ' aria-hidden=' + node.getAttribute('aria-hidden'));
    if (node.hasAttribute && node.hasAttribute('inert')) reasons.push(id + ' inert');
    if (cs.opacity === '0') reasons.push(id + ' opacity:0 (does NOT hide from AT)');
    node = node.parentElement;
  }
  const r = el.getBoundingClientRect();
  return { reasons, rect: { w: Math.round(r.width), h: Math.round(r.height) } };
}`;

async function report(p, label) {
  console.log(`\n  --- ${label} ---`);
  const containers = ['quick-actions-menu-slots', 'quick-actions-slots'];
  for (const cid of containers) {
    const slots = await p.$$(`#${cid} .quick-actions-slot.filled`);
    console.log(`  #${cid}: ${slots.length} filled slot(s)`);
    let inTree = 0, tabbable = 0;
    for (const h of slots) {
      const snap = await p.accessibility.snapshot({ root: h, interestingOnly: false });
      if (snap) inTree++;
      if (await h.evaluate(el => el.tabIndex >= 0)) tabbable++;
    }
    console.log(`     in a11y tree: ${inTree}/${slots.length}   tabbable: ${tabbable}/${slots.length}`);
    if (slots.length && inTree === 0) {
      const why = await slots[0].evaluate(new Function('el', `return (${WHY})(el)`));
      console.log(`     hidden by: ${why.reasons.join(' | ') || '(nothing found — investigate)'}  rect=${why.rect.w}x${why.rect.h}`);
    }
  }
}

(async () => {
  const b = await chromium.launch();
  for (const [label, w, h] of [['MOBILE 390x844', 390, 844], ['DESKTOP 1280x900', 1280, 900]]) {
    console.log(`\n================ ${label} ================`);
    const p = await boot(b, w, h);

    await report(p, 'menu CLOSED');
    await p.evaluate(() => document.querySelector('.menu-button')?.click());
    await p.waitForTimeout(1800);
    await report(p, 'menu OPEN');

    // The decisive number: how many "Stats" buttons would a screen reader find?
    const announced = await p.evaluate(() => {
      const all = [...document.querySelectorAll('.quick-actions-slot.filled')];
      return all.filter(el => {
        let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return false;
          n = n.parentElement;
        }
        return true;
      }).map(el => el.getAttribute('aria-label'));
    });
    console.log(`\n  ==> names reachable by AT with the menu open: ${JSON.stringify(announced)}`);
    const dupes = announced.filter((n, i) => announced.indexOf(n) !== i);
    console.log(`  ==> DUPLICATES: ${dupes.length ? JSON.stringify([...new Set(dupes)]) : 'none'}`);

    await p.context().close();
  }
  await b.close();
})();
