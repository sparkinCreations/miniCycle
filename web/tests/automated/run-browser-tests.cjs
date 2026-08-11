/**
 * Automated Browser Test Runner
 * Uses Playwright to run the existing browser test suite
 *
 * Usage:
 *   npm test                     # Run all tests
 *   npm test -- routineManager   # Run single module
 *   npm test -- task             # Run all modules matching "task"
 *   npm test -- --list           # List all available modules
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// All available test modules (85 modules - matches browser "Run All Tests")
const ALL_MODULES = [
    'integration', 'themeManager', 'deviceDetection', 'routineLoader', 'statsPanel',
    'consoleCapture', 'state', 'recurringCore', 'recurringIntegration', 'recurringPanel',
    'globalUtils', 'notifications', 'notificationDialogHost', 'dragDropManager', 'migrationManager', 'dueDates',
    'reminders', 'modeManager', 'routineSwitcher', 'routineManager', 'undoRedoManager',
    'gamesManager', 'onboardingManager', 'guidedTourManager', 'modalManager', 'menuManager', 'settingsManager',
    'completedTasksManager', 'pullToRefresh', 'taskCore', 'taskValidation', 'taskUtils', 'taskRenderer',
    'taskEvents', 'taskDOM', 'taskOptionsCustomizer', 'taskUI', 'taskInteractions', 'uiEffects',
    'xss-vulnerability', 'errorHandler', 'testingModal', 'backupManager', 'cycleCompletion',
    'dataValidator', 'appInit', 'appState', 'helpWindowManager', 'constants', 'basicPluginSystem',
    'accessibility', 'stress', 'coreBoot', 'uiBoot', 'featureBoot',
    'labelResolver', 'defaultLabels', 'diBase', 'themes',
    'dataSanitizer', 'storageUtils', 'storagePersistence', 'achievementsManager', 'historyManager',
    'recurringDateUtils', 'clearedTasksManager', 'taskCompletion', 'taskCRUD', 'dailyResetManager',
    'recurringMatcher', 'recurringCalculators', 'recurringActivation',
    'preferencesManager', 'settingsUIManager', 'focusMode', 'taskSearch',
    'quickActionsManager', 'actionUsage', 'backupRestoreManager', 'cycleExportManager',
    'cycleImportManager', 'shareManager', 'taskButtons', 'taskCycleReset', 'backupReminder',
    'orchestrator', 'diWiring', 'moduleLoader', 'moduleManifests', 'modalTemplates',
    'appContext', 'dataAccess', 'appGlobalState', 'migrationFacade', 'types',
    'modalRegistry', 'modalUtils', 'panelVisibilityHelpers', 'gesturePanelManager',
    'titleManager', 'headerLayoutManager', 'featureAvailability', 'dataRecovery', 'uiOrchestrator', 'preferencesBgImage', 'preferencesPresets',
    'taskDOMPatch', 'debugMode', 'iconInit', 'icons', 'keyboardNav', 'mcycPayload', 'nameUtils', 'styleValidators', 'cycleMode', 'bootSw',
    'statsPanelGestures', 'statsPanelRewards',
    'recurringPanelEvents', 'recurringPanelForm', 'recurringPanelGrids',
    'recurringPanelSetup', 'recurringPanelSummary', 'recurringSettings',
    'recurringSettingsApplicator', 'recurringWatcher', 'uxRatings', 'panelCarousel', 'focusTaskPanel'
];

// Test files that intentionally have no registered module in ALL_MODULES.
// MODULE_TEMPLATE is the copy-me template, not a real module.
const UNREGISTERED_EXEMPT = new Set(['MODULE_TEMPLATE']);

// Modules allowed to legitimately report 0 tests (e.g. a platform-gated suite that
// self-skips in headless CI). Empty by default: a 0-test result is normally a
// BROKEN module (its import threw before the Results line rendered), NOT a pass —
// see runModuleTests. Add a name here only with a comment explaining why it skips.
const ZERO_TEST_EXEMPT = new Set([]);

// Drift guard: every tests/*.tests.js file must be registered in ALL_MODULES,
// or it silently never runs in CI. Fail loudly before launching the browser.
// (xss-vulnerability lives in tests/security/, not the root, so it's not scanned here.)
function assertNoUnregisteredTests() {
    const testDir = path.join(__dirname, '..');
    const files = fs.readdirSync(testDir)
        .filter(f => f.endsWith('.tests.js'))
        .map(f => f.replace(/\.tests\.js$/, ''))
        .filter(name => !UNREGISTERED_EXEMPT.has(name));

    const unregistered = files.filter(name => !ALL_MODULES.includes(name));
    if (unregistered.length > 0) {
        console.error(`\n${colors.red}❌ ${unregistered.length} test file(s) exist but are NOT registered in ALL_MODULES — they would never run in CI:${colors.reset}`);
        unregistered.forEach(name => console.error(`   ${colors.red}• ${name}.tests.js${colors.reset}`));
        console.error(`\n${colors.yellow}Add each to ALL_MODULES in run-browser-tests.cjs AND wire it into module-test-suite.html,${colors.reset}`);
        console.error(`${colors.yellow}or add it to UNREGISTERED_EXEMPT if it is intentionally not a runnable module.${colors.reset}\n`);
        process.exit(1);
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);

    // Check for --list flag
    if (args.includes('--list') || args.includes('-l')) {
        console.log(`\n${colors.blue}Available test modules (${ALL_MODULES.length}):${colors.reset}\n`);
        ALL_MODULES.forEach((mod, i) => {
            console.log(`  ${colors.cyan}${(i + 1).toString().padStart(2)}.${colors.reset} ${mod}`);
        });
        console.log(`\n${colors.yellow}Usage:${colors.reset}`);
        console.log(`  npm test                     ${colors.cyan}# Run all tests${colors.reset}`);
        console.log(`  npm test -- routineManager   ${colors.cyan}# Run single module${colors.reset}`);
        console.log(`  npm test -- task             ${colors.cyan}# Run all modules matching "task"${colors.reset}`);
        console.log(`  npm test -- --list           ${colors.cyan}# Show this list${colors.reset}\n`);
        process.exit(0);
    }

    // Filter out flags, get module filter
    const moduleFilter = args.filter(arg => !arg.startsWith('-'))[0];

    if (!moduleFilter) {
        return ALL_MODULES; // Run all
    }

    // Find matching modules (case-insensitive partial match)
    const lowerFilter = moduleFilter.toLowerCase();
    const matchingModules = ALL_MODULES.filter(mod =>
        mod.toLowerCase().includes(lowerFilter)
    );

    if (matchingModules.length === 0) {
        console.error(`${colors.red}❌ No modules match "${moduleFilter}"${colors.reset}`);
        console.log(`\n${colors.yellow}Available modules:${colors.reset} ${ALL_MODULES.join(', ')}`);
        console.log(`\nRun ${colors.cyan}npm test -- --list${colors.reset} to see all modules.\n`);
        process.exit(1);
    }

    return matchingModules;
}

// Get modules to test based on CLI args
const modules = parseArgs();

/**
 * Result-wait budget for a module, in ms.
 *
 * Takes the larger of the module's own budget and the cold-start allowance, so
 * it stays correct no matter which module happens to run first — including when
 * a single module is named on the CLI, which makes THAT module the cold start.
 */
function timeoutFor(moduleName, index) {
    const moduleBudget = moduleName === 'stress' ? 180000
        : moduleName === 'taskCore' ? 60000
        : 45000;
    const COLD_START_BUDGET = 120000;
    return index === 0 ? Math.max(moduleBudget, COLD_START_BUDGET) : moduleBudget;
}

async function runModuleTests(page, moduleName, index = 0) {
    console.log(`\n${colors.cyan}🧪 Testing ${moduleName}...${colors.reset}`);
    const isColdStart = index === 0;

    try {
        // Navigate to test suite with cache buster to force fresh module loads
        const cacheBuster = Date.now();
        await page.goto(`http://localhost:8080/tests/module-test-suite.html?v=${cacheBuster}`, {
            waitUntil: 'networkidle',
            timeout: 10000
        });

        // Select module
        await page.selectOption('#module-select', moduleName);

        // Wait for the suite to REPORT the module loaded, rather than sleeping a
        // fixed 500ms and hoping. Every load branch renders 'Click "Run Tests" to
        // begin.' once its (dynamic) import resolves. Racing that import is how a
        // Run click gets swallowed: the button fires against a half-initialised
        // page, no tests start, and the run then burns its whole budget waiting
        // for a Results line that was never going to appear.
        // Not every branch is guaranteed to render the phrase, so fall back to
        // the old fixed sleep instead of failing the module outright.
        const readyTimeout = isColdStart ? 30000 : 10000;
        try {
            await page.waitForSelector('#results:has-text("Click \\"Run Tests\\" to begin")', { timeout: readyTimeout });
        } catch {
            await page.waitForTimeout(moduleName === 'taskCore' ? 3000 : 500);
        }

        // Click Run Tests button
        await page.click('#run-tests-btn');

        // Wait a bit for tests to start
        await page.waitForTimeout(500);

        // Wait for results.
        //
        // Two independent things make a module slow, and they compound:
        //   - heavy modules (stress, taskCore) have always needed headroom;
        //   - POSITION: whatever runs FIRST pays the entire cold start — browser
        //     just launched, first page load, every app module compiled from
        //     scratch, OS page cache and V8 code cache both empty.
        //
        // Sizing the budget by module name alone is what made `integration`
        // flake (Aug 2026, PR #40): it is simply first in ALL_MODULES. It timed
        // out at the 45s wall on a slow CI runner while the SAME COMMIT passed
        // 3056/3056 on a faster one. Every non-first module finished in ~2s —
        // a 20x gap that has nothing to do with integration's own 11 tests.
        const timeout = timeoutFor(moduleName, index);
        const startedAt = Date.now();
        await page.waitForSelector('h3:has-text("Results:")', { timeout });
        const elapsed = Date.now() - startedAt;

        // Surface near-misses. Without this a module that creeps up on its
        // budget looks identical to one that finishes instantly, and the first
        // sign of trouble is a red CI run needing log archaeology.
        if (elapsed > timeout * 0.5) {
            console.log(`   ${colors.yellow}⏱  slow: ${(elapsed / 1000).toFixed(1)}s of a ${(timeout / 1000).toFixed(0)}s budget${colors.reset}`);
        }

        // Extract summary (h3 with "Results:" text)
        const summary = await page.textContent('h3:has-text("Results:")');

        // Parse passed/total from summary text (e.g., "Results: 27/27 tests passed (100%)").
        // Tolerate spacing variants like "24 / 24" that some test files emit.
        const match = summary.match(/(\d+)\s*\/\s*(\d+)/);
        const passedTests = match ? parseInt(match[1]) : 0;
        const totalTests = match ? parseInt(match[2]) : 0;

        // A module that reports 0 tests is NOT a pass — its import almost certainly
        // threw before the Results line rendered, or its Run handler silently bailed.
        // Counting that as green is exactly the silent-skip failure mode the drift
        // guards exist to kill, so make it a hard FAILURE unless explicitly exempt.
        const zeroTests = totalTests === 0;
        if (zeroTests && !ZERO_TEST_EXEMPT.has(moduleName)) {
            console.log(`   ${colors.red}❌ ${summary} — 0 tests ran (module broke before reporting, or result line unparsed)${colors.reset}`);
            console.log(`   ${colors.yellow}  → a registered module that runs no tests is treated as a failure; check console errors above. Add to ZERO_TEST_EXEMPT only if it legitimately self-skips.${colors.reset}`);
            return {
                module: moduleName,
                passed: false,
                passedCount: 0,
                failedCount: 1,
                summary: `${summary} (0 tests ran)`,
                failedDetails: ['Module reported 0 tests — likely a load/import error before the Results line.']
            };
        }
        if (zeroTests) {
            // Exempt: report as a visible skip, neither pass-with-tests nor failure.
            console.log(`   ${colors.yellow}⏭  ${summary} — 0 tests (exempt: legitimately self-skipped)${colors.reset}`);
            return { module: moduleName, passed: true, passedCount: 0, failedCount: 0, summary, failedDetails: [] };
        }

        const failedTests = totalTests - passedTests;

        // Get failed test details if any
        let failedDetails = [];
        if (failedTests > 0) {
            failedDetails = await page.$$eval('.result.fail', els =>
                els.map(el => el.textContent.trim())
            );
        }

        // Determine if all passed
        const allPassed = failedTests === 0;

        // Print results
        if (allPassed) {
            console.log(`   ${colors.green}✅ ${summary}${colors.reset}`);
        } else {
            console.log(`   ${colors.red}❌ ${summary}${colors.reset}`);
            console.log(`\n   ${colors.yellow}Failed tests:${colors.reset}`);
            failedDetails.forEach(detail => {
                console.log(`   ${colors.red}  • ${detail}${colors.reset}`);
            });
        }

        return {
            module: moduleName,
            passed: allPassed,
            passedCount: passedTests,
            failedCount: failedTests,
            summary,
            failedDetails
        };

    } catch (error) {
        console.log(`   ${colors.red}❌ Error running tests: ${error.message}${colors.reset}`);
        return {
            module: moduleName,
            passed: false,
            passedCount: 0,
            failedCount: 1,
            summary: 'Test execution failed',
            error: error.message,
            // Distinguishes "the page never reported" from every other failure.
            // ONLY this shape is retried — see RETRY discipline in runAllTests.
            timedOut: isTimeout(error)
        };
    }
}

/**
 * Did this failure come from the module never reporting, rather than from a
 * test actually failing?
 *
 * Playwright raises TimeoutError for waitForSelector/goto expiry. That is an
 * INFRASTRUCTURE symptom: the page produced no Results line at all, which is
 * what the runner reports as `0/1`. An assertion failure looks nothing like
 * this — the module runs, renders `Results: 24/25`, and returns normally.
 */
function isTimeout(error) {
    return error?.name === 'TimeoutError' || /Timeout .* exceeded/i.test(error?.message || '');
}

async function runAllTests() {
    // Catch test files that were added but never registered (would silently skip in CI).
    assertNoUnregisteredTests();

    const isFiltered = modules.length < ALL_MODULES.length;
    const headerText = isFiltered
        ? `🧪 Testing ${modules.length} module${modules.length > 1 ? 's' : ''}: ${modules.join(', ')}`
        : '🚀 miniCycle Automated Test Suite';

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}${headerText}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    const startTime = Date.now();

    // Launch browser
    console.log(`\n${colors.cyan}🌐 Launching browser...${colors.reset}`);
    const browser = await chromium.launch({
        headless: true // Set to false to see browser
    });

    // Create context with cache disabled to ensure fresh module loads
    const context = await browser.newContext({
        bypassCSP: true
    });

    // Grant notification permissions for reminder tests
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:8080' });

    // Add init script to mock Notification API and capture errors
    await context.addInitScript(() => {
        window.__MINICYCLE_TEST__ = true;
        // Capture errors with full stack traces
        window.onerror = function(message, source, lineno, colno, error) {
            console.error(`[SYNTAX ERROR] ${message} at ${source}:${lineno}:${colno}`);
            if (error && error.stack) {
                console.error(`[STACK] ${error.stack}`);
            }
        };
        if (typeof Notification === 'undefined') {
            window.Notification = function (title, opts) { return { close() {} }; };
        }
        Notification.permission = 'granted';
        Notification.requestPermission = () => Promise.resolve('granted');
    });

    const results = [];

    // Run tests for each module
    // Page setup, factored out so a retry gets an IDENTICAL fresh page rather
    // than reusing one whose state may be why the first attempt stalled.
    const newInstrumentedPage = async () => {
        const page = await context.newPage();
        // Log console messages for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`   ${colors.red}Console error: ${msg.text()}${colors.reset}`);
                // Try to get location info from message
                const location = msg.location();
                if (location && location.url) {
                    console.log(`   ${colors.red}  at ${location.url}:${location.lineNumber}:${location.columnNumber}${colors.reset}`);
                }
            }
        });
        page.on('pageerror', error => {
            console.log(`   ${colors.red}Page error: ${error.message}${colors.reset}`);
            // Log full error details including file/line info
            console.log(`   ${colors.red}Full error: ${error.toString()}${colors.reset}`);
            console.log(`   ${colors.red}Error name: ${error.name}${colors.reset}`);
        });
        // Log network request failures
        page.on('requestfailed', request => {
            console.log(`   ${colors.yellow}Request failed: ${request.url()} - ${request.failure()?.errorText}${colors.reset}`);
        });
        // Disable cache for this page to ensure fresh module loads
        await page.route('**/*', async (route) => {
            await route.continue({ headers: { ...route.request().headers(), 'Cache-Control': 'no-cache' } });
        });
        return page;
    };

    for (const [moduleIndex, module] of modules.entries()) {
        const page = await newInstrumentedPage();
        let result = await runModuleTests(page, module, moduleIndex);
        await page.close();

        // RETRY DISCIPLINE — one retry, timeouts ONLY.
        //
        // A timeout means the page never rendered a Results line, so no test
        // actually ran. That is an infrastructure symptom, and it has been
        // recurring on a DIFFERENT module each run (Aug 2026: modalManager,
        // dailyResetManager, appGlobalState, migrationFacade,
        // completedTasksManager, taskValidation, basicPluginSystem,
        // recurringSettingsApplicator, notificationDialogHost, testingModal —
        // every one passing standalone). It already cost a red CI run on a
        // docs-only PR.
        //
        // What this deliberately does NOT retry: a module that RAN and had
        // assertions fail. Those return normally with counts and never reach
        // here, so a real regression can't be papered over by re-running.
        //
        // A retry is never silent. It prints on the spot and is tagged in the
        // summary, so a module that needs retrying repeatedly is visible as
        // degradation rather than hidden behind a green run.
        if (result.timedOut) {
            console.log(`   ${colors.yellow}🔁 no Results line — retrying once (infrastructure timeout, no test ran)${colors.reset}`);
            const retryPage = await newInstrumentedPage();
            // index 0 → the cold-start budget, since a stalled run has no warm
            // state to inherit and the retry is effectively a fresh start.
            const retryResult = await runModuleTests(retryPage, module, 0);
            await retryPage.close();
            result = { ...retryResult, retried: true, firstAttemptError: result.error };
            if (retryResult.passed) {
                console.log(`   ${colors.yellow}🔁 passed on retry — first attempt timed out${colors.reset}`);
            }
        }

        results.push(result);
    }

    await context.close();
    await browser.close();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Print summary
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}📊 Test Summary (${duration}s)${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    let totalPassed = 0;
    let totalFailed = 0;

    results.forEach(r => {
        const status = r.passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
        // A retried module is tagged on its own row, so a green run still shows
        // which module needed a second attempt.
        const tag = r.retried ? ` ${colors.yellow}🔁 retried${colors.reset}` : '';
        console.log(`   ${status} ${r.module.padEnd(20)} ${r.passedCount}/${r.passedCount + r.failedCount} tests${tag}`);
        totalPassed += r.passedCount;
        totalFailed += r.failedCount;
    });

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

    // Call out retries once more after the table. A run that is green ONLY
    // because of retries is not the same as a healthy one, and the difference
    // should not require reading 120 rows to notice.
    const retried = results.filter(r => r.retried);
    if (retried.length > 0) {
        console.log(`${colors.yellow}🔁 ${retried.length} module(s) needed a retry after producing no Results line:${colors.reset}`);
        retried.forEach(r => {
            const outcome = r.passed ? 'passed on retry' : 'failed again';
            console.log(`   ${colors.yellow}• ${r.module} — ${outcome} (first attempt: ${r.firstAttemptError || 'timeout'})${colors.reset}`);
        });
        console.log(`${colors.yellow}   Retries are for infrastructure stalls only; assertion failures are never retried.${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
    }

    const allPassed = results.every(r => r.passed);
    const totalTests = totalPassed + totalFailed;
    const percentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    if (allPassed) {
        console.log(`${colors.green}🎉 All tests passed! (${totalPassed}/${totalTests} - ${percentage}%)${colors.reset}`);
    } else {
        console.log(`${colors.red}⚠️  Some tests failed (${totalPassed}/${totalTests} - ${percentage}%)${colors.reset}`);
    }

    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

    // Exit with proper code for CI/CD
    process.exit(allPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(`${colors.red}❌ Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});

// Run tests
runAllTests().catch(error => {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});
