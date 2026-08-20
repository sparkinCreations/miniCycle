/**
 * PROBE — what does the recent view render for a given `recent` array?
 *
 * Seeds settings.quickActions.recent, reloads, opens the menu and lists the
 * filled slots inside #quick-actions-menu. Written for the v2.459 audit; note
 * this container is the WRONG one to read (see quick-actions-slot-count.cjs),
 * which is how the slot-gap bug was missed twice.
 *
 * Not a test — see ./README.md. Needs `npm start` on :8080.
 */
const { chromium } = require('playwright');
async function run(label, recent) {
  const b = await chromium.launch();
  const p = await (await b.newContext({serviceWorkers:'block', viewport:{width:390,height:844}})).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,120)));
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const f = await p.$('.first-run-btn[data-choice="learn"]'); if (f) await f.click();
  await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1200);
  await p.evaluate((r) => { const d=JSON.parse(localStorage.getItem('miniCycleData'));
    d.settings.quickActions = { pinned:['stats',null,null,null,null], counts:{}, recent:r, activeView:'recent' };
    localStorage.setItem('miniCycleData', JSON.stringify(d)); }, recent);
  await p.reload(); await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('quick-actions-btn')?.click());
  await p.waitForTimeout(1500);
  const slots = await p.evaluate(() =>
    [...document.querySelectorAll('#quick-actions-menu .quick-actions-slot.filled')].map(e => e.title || e.dataset.action || '?'));
  console.log(`${label}\n   recent=${JSON.stringify(recent)}\n   rendered ${slots.length}: ${JSON.stringify(slots)}\n   errors: ${JSON.stringify(errs)}`);
  await b.close();
}
(async () => {
  await run('A) a retired id among valid ones (was: left a gap)',
    ['settings','a-retired-action','history','themes','games','help']);
  await run('B) prototype keys from a restored backup',
    ['constructor','__proto__','toString','settings','history']);
})();
