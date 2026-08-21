/**
 * PROBE — is focus-mode chrome hidden from assistive tech WITHOUT relying on `inert`?
 *
 * focusMode.js sets `inert` on the chrome it fades out, and says why: "so
 * keyboard / screen-reader users don't land on invisible buttons." But `inert`
 * needs Chrome 102 / Safari 15.5, while the app's feature gate admits Chrome 71
 * / Safari 12.1 — inside that band the protection silently did not happen.
 * opacity:0 leaves a control in the accessibility tree, and pointer-events only
 * blocks the mouse, not Tab or a screen reader.
 *
 * This checks the CSS carries the exclusion on its own, by stripping `inert`
 * off the elements and re-measuring — which is what a browser without `inert`
 * support effectively gives you.
 *
 * It also checks the fade still plays. visibility:hidden applied without a
 * transition delay would make the chrome vanish instantly instead of fading,
 * so "hidden" alone is not success — it has to become hidden LATE.
 *
 * Not a test — see ./README.md. Needs `npm start` on :8080.
 */
const { chromium } = require('playwright');

const CHROME = ['#quick-actions-window', '#footer-container', '#personalization-btn',
                '#quick-dark-toggle', '#slide-left', '#slide-right'];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({
    serviceWorkers: 'block', viewport: { width: 1280, height: 900 },
  })).newPage();
  await p.goto('http://localhost:8080/miniCycle.html');
  await p.waitForTimeout(2500);
  const f = await p.$('.first-run-btn[data-choice="learn"]');
  if (f) await f.click();
  await p.waitForTimeout(7000);
  await p.evaluate(() => document.getElementById('first-run-welcome-dismiss')?.click());
  await p.waitForTimeout(1500);

  const inFocus = await p.evaluate(() => document.body.classList.contains('focus-mode'));
  console.log('focus mode active:', inFocus);

  console.log('\n-- computed visibility while in focus mode --');
  for (const sel of CHROME) {
    const v = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return '(absent)';
      const cs = getComputedStyle(el);
      return `visibility=${cs.visibility} opacity=${cs.opacity} inert=${el.inert}`;
    }, sel);
    console.log(`   ${sel.padEnd(24)} ${v}`);
  }

  // The decisive test: drop `inert` and see whether anything still holds the
  // chrome out of the tree. This is the old-browser case.
  console.log('\n-- with `inert` stripped (simulating a browser without it) --');
  await p.evaluate((sels) => {
    sels.forEach(s => { const el = document.querySelector(s); if (el) el.inert = false; });
  }, CHROME);
  await p.waitForTimeout(300);

  for (const sel of CHROME) {
    const h = await p.$(sel);
    if (!h) { console.log(`   ${sel.padEnd(24)} (absent)`); continue; }
    const snap = await p.accessibility.snapshot({ root: h, interestingOnly: false });
    const focusables = await h.evaluate(el =>
      el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').length);
    const reachable = await h.evaluate(el => {
      // Would a Tab land inside? visibility:hidden and display:none both prevent it.
      let n = el;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        n = n.parentElement;
      }
      return true;
    });
    console.log(`   ${sel.padEnd(24)} inA11yTree=${snap ? 'YES ❌' : 'no ✅'}  ` +
                `focusableDescendants=${focusables} tabReachable=${reachable ? 'YES ❌' : 'no ✅'}`);
  }

  // Fade timing, driven by toggling the CLASS rather than the UI control: the
  // exit control lives inside the chrome this rule hides, and what is under test
  // is the CSS transition, not the button wiring.
  console.log('\n-- fade timing (class toggled directly) --');
  const sample = async (label, waits) => {
    const out = [];
    for (const ms of waits) {
      await p.waitForTimeout(ms);
      out.push(await p.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('quick-actions-window'));
        return `${cs.visibility}/${Number(cs.opacity).toFixed(2)}`;
      }));
    }
    console.log(`   ${label}: ${out.join('  →  ')}`);
    return out;
  };

  await p.evaluate(() => document.body.classList.remove('focus-mode'));
  const shown = await sample('leaving  (t=0, 80ms, 500ms)', [0, 80, 420]);

  await p.evaluate(() => document.body.classList.add('focus-mode'));
  const hidden = await sample('entering (t=0, 80ms, 500ms)', [0, 80, 420]);

  const fadeVisibleMid = hidden[1].startsWith('visible');
  const hiddenAtEnd = hidden[2].startsWith('hidden');
  const shownImmediately = shown[0].startsWith('visible');
  console.log(`\n   fade-out still plays (visible at 80ms) : ${fadeVisibleMid ? '✅' : '❌ vanishes instantly'}`);
  console.log(`   leaves the tree once faded             : ${hiddenAtEnd ? '✅' : '❌ stays exposed'}`);
  console.log(`   returns immediately on exit            : ${shownImmediately ? '✅' : '❌ delayed, fade-in invisible'}`);

  await b.close();
})();
