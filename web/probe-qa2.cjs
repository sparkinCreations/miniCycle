const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({serviceWorkers:'block', viewport:{width:390,height:844}})).newPage();
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const f = await p.$('.first-run-btn[data-choice="learn"]'); if (f) await f.click();
  await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const d=JSON.parse(localStorage.getItem('miniCycleData'));
    d.settings.quickActions = { pinned:['stats',null,null,null,null], counts:{},
      recent:['settings','a-retired-action','history','themes','games','help'], activeView:'recent' };
    localStorage.setItem('miniCycleData', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(7000);
  console.log('stored after reload:', await p.evaluate(() => {
    const q = JSON.parse(localStorage.getItem('miniCycleData')).settings.quickActions;
    return { view: q?.activeView, recent: q?.recent }; }));
  await p.evaluate(() => document.getElementById('quick-actions-btn')?.click());
  await p.waitForTimeout(1500);
  console.log('menu classes:', await p.evaluate(() => document.getElementById('quick-actions-menu')?.className));
  console.log('slot-ish elements:', await p.evaluate(() =>
    [...document.querySelectorAll('#quick-actions-menu *')].map(e=>e.className).filter(c=>typeof c==='string'&&c.includes('slot')).slice(0,8)));
  console.log('menu text:', await p.evaluate(() => (document.getElementById('quick-actions-menu')?.innerText||'').replace(/\s+/g,' ').slice(0,150)));
  await b.close();
})();
