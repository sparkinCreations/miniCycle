#!/usr/bin/env node
/**
 * capture-store-screenshots.cjs — Regenerate the Chrome Web Store screenshots.
 *
 * Drives the running web app with Playwright and saves five 1280x800 PNGs to
 * chrome/promo/. Each shot uses a FRESH browser context (its own localStorage),
 * so this never touches your real data — it seeds a throwaway demo routine.
 *
 * Produces (chrome/promo/):
 *   screenshot-main-1280x800.png     light, populated "Opening & Closing" routine
 *   screenshot-dark-1280x800.png     same, dark mode
 *   screenshot-stats-1280x800.png    the stats panel (progress ring, milestones)
 *   screenshot-themes-1280x800.png   the vocabulary-theme picker (5 themes)
 *   screenshot-fitness-1280x800.png  the Fitness theme applied (colors + vocab)
 *
 * (The designed promo hero, screenshot-1280x800.png, is authored separately and
 * is NOT regenerated here.)
 *
 * Prerequisites:
 *   1. Dev server running:  npm start        (serves http://localhost:8080)
 *   2. Playwright + chromium installed (already a dev dependency)
 *
 * Run:
 *   npm run capture:screenshots               (from web/)
 *   node scripts/capture-store-screenshots.cjs
 *
 * If the app's first-run flow or panel trigger IDs change, update SEED /
 * NORMALIZE / the SHOTS table below.
 */
'use strict';

const path = require('path');
const { chromium } = require('playwright');

const WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const OUT = path.join(REPO_ROOT, 'chrome', 'promo');
const BASE = 'http://localhost:8080/miniCycle.html';
const BOOTED = 'document.documentElement.dataset.appBooted === "true"';
const log = (...a) => console.log('[capture-screenshots]', ...a);

// ── in-page: seed the active cycle from a passed config ──────────────────────
const SEED = (o) => {
  const KEY = 'miniCycleData';
  const st = JSON.parse(localStorage.getItem(KEY));
  const cycles = st.data.cycles;
  const id = st.appState.activeCycleId || Object.keys(cycles)[0];
  const cyc = cycles[id];
  const tmpl = (cyc.tasks && cyc.tasks[0]) || {
    id: '', text: '', completed: false, dueDate: null, highPriority: false,
    remindersEnabled: false, recurring: false, recurringSettings: {},
    deleteWhenComplete: false, schemaVersion: 2,
  };
  const mk = (t) => Object.assign(JSON.parse(JSON.stringify(tmpl)), {
    id: 'shot-' + Math.random().toString(36).slice(2, 9),
    text: t[0], completed: !!t[1], highPriority: !!t[2],
  });
  cyc.title = o.title;
  cyc.name = 'shot_routine';
  cyc.tasks = o.tasks.map(mk);
  cyc.cycleCount = o.cycleCount;
  cyc.autoReset = true;
  cyc.deleteCheckedTasks = false;
  cyc.theme = o.themeId || 'classic';
  st.appState.activeCycleId = id;
  st.settings = st.settings || {};
  st.settings.onboardingCompleted = true;
  st.settings.firstRunWelcomeDismissed = true; // skip the first-run focus splash
  st.settings.darkMode = !!o.dark;
  st.settings.defaultTheme = o.themeId || 'classic';
  st.settings.unlockedThemes = ['classic', 'habit-tracker', 'fitness', 'scholar', 'cleaning'];
  localStorage.setItem(KEY, JSON.stringify(st));
};

// ── in-page: drop any first-run focus latch before a shot ────────────────────
const NORMALIZE = () => {
  document.body.classList.remove('focus-mode', 'first-run-welcome-active');
  document.querySelectorAll('#first-run-splash, .first-run-splash').forEach((el) => el.remove());
};

// ── demo routines ────────────────────────────────────────────────────────────
const OFFICE = {
  title: '🔑 Opening & Closing Procedures', cycleCount: 14, dark: false, themeId: 'classic',
  tasks: [
    ['🔓 Unlock facility & disarm alarm system', true],
    ['💡 Turn on lights, HVAC & ventilation', true],
    ['👀 Walk-through — check for leaks, damage or safety hazards', true],
    ["📋 Review today's schedule, work orders & priorities", false, true],
    ['📦 Check inventory & restock supplies if needed', false],
  ],
};
const FITNESS = {
  title: '💪 Push Day Workout', cycleCount: 27, dark: false, themeId: 'fitness',
  tasks: [
    ['🤸 Dynamic warm-up — 5 min', true],
    ['🏋️ Barbell bench press — 4×8', true],
    ['💪 Overhead press — 3×10', false, true],
    ['🔥 Triceps & core circuit', false],
    ['🧘 Cooldown & stretch', false],
  ],
};

// ── the shots: each reseeds, reloads, optionally opens a panel, then captures ─
const SHOTS = [
  { file: 'screenshot-main-1280x800.png',    cfg: { ...OFFICE } },
  { file: 'screenshot-dark-1280x800.png',    cfg: { ...OFFICE, dark: true } },
  { file: 'screenshot-stats-1280x800.png',   cfg: { ...OFFICE }, openId: 'slide-right' },
  { file: 'screenshot-themes-1280x800.png',  cfg: { ...OFFICE }, openId: 'open-themes-panel' },
  { file: 'screenshot-fitness-1280x800.png', cfg: { ...FITNESS } },
];

async function bootInitial(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(BOOTED, { timeout: 25000 });
  await page.waitForTimeout(1500);
}
async function reseedReload(page, cfg) {
  await page.evaluate(SEED, cfg);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(BOOTED, { timeout: 25000 });
  await page.waitForTimeout(2500);
  await page.evaluate(NORMALIZE);
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // boot once so the app writes a valid default state we can reshape
  await bootInitial(page);

  for (const shot of SHOTS) {
    await reseedReload(page, shot.cfg);
    if (shot.openId) {
      await page.evaluate((id) => document.getElementById(id)?.click(), shot.openId);
      await page.waitForTimeout(1800);
    }
    await page.screenshot({ path: path.join(OUT, shot.file) });
    log('saved', shot.file);
  }

  await browser.close();
  log('done — 5 screenshots in chrome/promo/');
})().catch((e) => { console.error('[capture-screenshots] FAILED:', e.message); process.exit(1); });
