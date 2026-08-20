const { chromium } = require('playwright');
async function run(label, action) {
  const b = await chromium.launch();
  const p = await (await b.newContext({serviceWorkers:'block', viewport:{width:390,height:844}})).newPage();
  p.on('pageerror', e => console.log('  [ERR]', e.message.slice(0,140)));
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const f = await p.$('.first-run-btn[data-choice="learn"]'); if (f) await f.click();
  await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1200);
  const read = () => p.evaluate(() => { try { const q=JSON.parse(localStorage.getItem('miniCycleData')).settings.quickActions;
    return { recent: q?.recent ?? [], counts: q?.counts ?? {} }; } catch { return {recent:'(none)',counts:{}}; } });
  const before = await read();
  const did = await p.evaluate(action);
  await p.waitForTimeout(2000);
  const after = await read();
  console.log(`${label.padEnd(30)} ${String(did).padEnd(22)} recent ${JSON.stringify(before.recent)} → ${JSON.stringify(after.recent)}  counts=${JSON.stringify(after.counts)}`);
  await b.close();
}
(async () => {
  console.log('--- fix 1: the label inside a mapped button ---');
  await run('click #toggle-task-input-btn', () => { document.getElementById('toggle-task-input-btn').click(); return 'button'; });
  await run('click #toggle-task-input-text', () => { const c=document.getElementById('toggle-task-input-text');
    if(!c) return 'child missing'; c.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'inner label'; });
  await run('click #achievement-count-badge', () => { const c=document.getElementById('achievement-count-badge');
    if(!c) return 'child missing'; c.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'inner badge'; });
  console.log('\n--- fix 2: stats from different entry points ---');
  await run('slide-right ARROW', () => { document.getElementById('slide-right')?.click(); return 'arrow'; });
  await run('Stats NAV PILL', () => { const pill=[...document.querySelectorAll('[data-tab-label], .nav-pill, .panel-nav-pill')]
    .find(e=>/stats/i.test(e.textContent)); if(!pill) return 'pill missing'; pill.click(); return 'pill'; });
})();
