/**
 * PROBE — how many slots render, in BOTH containers?
 *
 * Reads #quick-actions-slots and #quick-actions-menu-slots, marking empties.
 * This is the probe that finally showed the gap: a retired id among the newest
 * five rendered four slots, because the renderer sliced to SLOT_COUNT and only
 * then dropped unknown ids.
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
  await p.reload(); await p.waitForTimeout(7500);
  const slots = await p.evaluate(() => {
    const read = id => { const c = document.getElementById(id); return c
      ? [...c.querySelectorAll('.quick-actions-slot')].map(e => (e.title||'?') + (e.classList.contains('filled')?'':'(empty)'))
      : 'container absent'; };
    return { window: read('quick-actions-slots'), menuRow: read('quick-actions-menu-slots') };
  });
  console.log(`${label}\n   recent = ${JSON.stringify(recent)}`);
  console.log(`   #quick-actions-slots      : ${JSON.stringify(slots.window)}`);
  console.log(`   #quick-actions-menu-slots : ${JSON.stringify(slots.menuRow)}`);
  console.log(`   page errors               : ${JSON.stringify(errs)}\n`);
  await b.close();
}
(async () => {
  await run('A) retired id among valid ones — must still fill 5 slots',
    ['settings','a-retired-action','history','themes','games','help']);
  await run('B) prototype keys from a restored backup — must be ignored',
    ['constructor','__proto__','toString','settings','history']);
})();
