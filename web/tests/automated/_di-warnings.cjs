/**
 * Starved-dependency detection for the runners that boot the REAL app
 * (journey, a11y, layout, contrast, sw-offline).
 *
 * Why this exists: in production a missing dependency degrades gracefully by
 * design (ADR-006) — `required()` warns and resolves to null, the loader warns
 * and hands out undefined, and the feature quietly is not there. That is the
 * right call for users, but it means a wiring mistake throws nothing and fails
 * no assertion: the only trace is a console line. Wiring is fixed per BUILD, not
 * per user, so a CI run that boots the same build sees the same gap — this file
 * turns that console line into a test failure, without changing app behaviour.
 *
 * Deliberately NOT used by run-browser-tests.cjs: that suite runs modules in
 * isolation on module-test-suite.html with partial fakes on purpose, so a
 * "missing required deps" line there is expected, not a wiring bug.
 *
 * Usage:
 *   const { instrumentBrowser } = require('./_di-warnings.cjs');
 *   const di = instrumentBrowser(browser);          // before any newContext()
 *   ...
 *   failures.push(...di.failures());                // before exiting
 */

// Every message shape the app prints when a module asked for a dependency and
// got nothing. Keep in step with the emitters:
//   diBase.js          `${moduleName} missing required deps: …`
//   moduleLoader.js    `DI access: … read undeclared dep …`
//                      `DI gap: … declares "x" but no depMappings entry exists`
//                      `…: Required dep 'x' is undefined (not provided by any module)`
//                      `Lazy dep 'x' resolved to null at call time`
//   hand-rolled checks `… missing required dependency/dependencies …`,
//                      `… missing dependency …`, `… dependency not injected`
const DI_STARVATION_PATTERN = new RegExp([
    'DI access:',
    'DI gap:',
    'missing (required )?dep',
    "Required dep '[^']+' is undefined",
    "Lazy dep '[^']+' resolved to null",
    'dependency not injected'
].join('|'), 'i');

// Warnings that are known and accepted today. Each entry needs a reason; the
// list is meant to SHRINK (the same ratchet as lint's --max-warnings). An entry
// that no longer matches anything is reported so it can be deleted.
// Shape: { pattern: RegExp, reason: string }
const DI_WARNING_ALLOWLIST = [
    {
        // Seen in the journey "import keeps recurring templates with no live
        // task": a template already due at reload makes the recurring watcher
        // spawn its task DURING BOOT, and recurringIntegration then calls these
        // two before their providers exist (cycleCompletion is phase 6,
        // menuManager later). The manifest says recurringIntegration's
        // lazyRequires are "only called after user interaction" — this path
        // breaks that. Probably harmless (the UI renders from state later in
        // boot), not verified on screen. Fix in the app (defer the watcher's
        // first pass to app-ready, or skip UI refresh calls before it), then
        // delete this entry. Caveat: the message carries no call site, so this
        // also hides the same line from any other path until it is removed.
        pattern: /Lazy dep '(updateProgressBar|updateMainMenuHeader)' resolved to null at call time/,
        reason: 'recurring watcher refreshes UI during boot, before phase-6 providers (Nov 2026)'
    }
];

/**
 * Is this console text a starved-dependency warning that should fail a run?
 * @param {string} text
 * @returns {boolean}
 */
function isDiStarvation(text) {
    if (!DI_STARVATION_PATTERN.test(text)) return false;
    for (const entry of DI_WARNING_ALLOWLIST) {
        if (entry.pattern.test(text)) {
            entry.hits = (entry.hits || 0) + 1;
            return false;
        }
    }
    return true;
}

/**
 * Start collecting DI warnings on one page into `page.__diWarnings`.
 * Idempotent: a page already watched keeps its listener and its array.
 * @param {import('playwright').Page} page
 * @param {(text: string, page: import('playwright').Page) => void} [onWarning]
 * @returns {string[]} the page's warning array
 */
function watchDiWarnings(page, onWarning) {
    if (page.__diWatched) return page.__diWarnings;
    page.__diWatched = true;
    page.__diWarnings = [];
    page.on('console', (msg) => {
        const type = msg.type();
        if (type !== 'warning' && type !== 'error') return;
        const text = msg.text();
        if (!isDiStarvation(text)) return;
        const line = text.slice(0, 240);
        page.__diWarnings.push(line);
        if (onWarning) onWarning(line, page);
    });
    return page.__diWarnings;
}

/**
 * Watch every page of every context this browser opens from now on.
 * Wraps browser.newContext, so call it BEFORE the first context is created.
 * @param {import('playwright').Browser} browser
 * @param {{ onPage?: (page: import('playwright').Page) => void,
 *           onWarning?: (text: string, page: import('playwright').Page) => void }} [opts]
 * @returns {{ pages: import('playwright').Page[], failures: (label?: string) => string[] }}
 */
function instrumentBrowser(browser, opts = {}) {
    const pages = [];
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => {
        const context = await originalNewContext(...args);
        // 'page' fires for context.newPage() too, before it resolves and before
        // any navigation, so no console line can slip past.
        context.on('page', (page) => {
            pages.push(page);
            // URL at warning time, not at creation (a new page is about:blank).
            watchDiWarnings(page, (line, pg) => {
                pg.__diWarningUrls = pg.__diWarningUrls || [];
                pg.__diWarningUrls.push(safeUrl(pg));
                if (opts.onWarning) opts.onWarning(line, pg);
            });
            if (opts.onPage) opts.onPage(page);
        });
        return context;
    };
    return {
        pages,
        /**
         * One failure line per distinct warning seen on any watched page, plus a
         * note for allow-list entries that matched nothing (delete them).
         * @param {string} [label] prefix, e.g. the suite name
         * @returns {string[]}
         */
        failures(label = 'DI wiring gap') {
            const seen = new Map();
            for (const pg of pages) {
                (pg.__diWarnings || []).forEach((w, i) => {
                    if (!seen.has(w)) seen.set(w, (pg.__diWarningUrls || [])[i] || '');
                });
            }
            return [...seen].map(([w, url]) => `${label} — ${w}${url ? ` (on ${url})` : ''}`);
        },
        /** Allow-list entries that never matched in this run. */
        staleAllowlist() {
            return DI_WARNING_ALLOWLIST.filter(e => !e.hits).map(e => `${e.pattern} — ${e.reason}`);
        }
    };
}

function safeUrl(page) {
    try {
        const u = new URL(page.url());
        return u.pathname + u.search;
    } catch {
        return '';
    }
}

module.exports = {
    DI_STARVATION_PATTERN,
    DI_WARNING_ALLOWLIST,
    isDiStarvation,
    watchDiWarnings,
    instrumentBrowser
};
